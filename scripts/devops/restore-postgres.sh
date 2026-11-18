#!/usr/bin/env bash
# ==============================================================================
# Workspace Junction - ISOLATED restore drill with integrity verification
#
# This script NEVER restores into the production database. It refuses:
#   - target database names that do not match ^wsj_(restore|drill|staging)[a-z0-9_]*$
#   - a target database with the production database name inside the production container
#
# Usage:
#   RESTORE_CONTAINER=wsj-staging-pg bash scripts/devops/restore-postgres.sh <file.dump|file.dump.gpg>
#
# Environment:
#   RESTORE_CONTAINER   container that receives the restore (REQUIRED, no default)
#   TARGET_DB           isolated database name     (default: wsj_restore_drill)
#   PROD_CONTAINER      production container name  (default: wsj-app-postgres-1, used for guards
#                       and for the optional read-only source comparison)
#   COMPARE_SOURCE=1    also compare per-table row counts and full-content md5 with the live
#                       source (read-only SELECTs). Differences on tables written during/after
#                       the dump are expected and are reported, not hidden.
#   GPG_PASSPHRASE_FILE passphrase for *.gpg input
#
# Exit status: 0 only when restore AND every integrity check pass.
# ==============================================================================
set -Eeuo pipefail
umask 077

BACKUP_FILE="${1:-}"
RESTORE_CONTAINER="${RESTORE_CONTAINER:-}"
TARGET_DB="${TARGET_DB:-wsj_restore_drill}"
PROD_CONTAINER="${PROD_CONTAINER:-wsj-app-postgres-1}"
TEMP_DUMP=""
FAILURES=0

log()  { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" >&2; }
die()  { log "ABORT: $*"; exit 1; }
fail() { log "CHECK FAILED: $*"; FAILURES=$((FAILURES + 1)); }
trap '[ -n "${TEMP_DUMP}" ] && rm -f -- "${TEMP_DUMP}"' EXIT
trap 'die "command failed at line ${LINENO}: ${BASH_COMMAND}"' ERR

[ -n "${BACKUP_FILE}" ] || die "usage: RESTORE_CONTAINER=<container> $0 <file.dump|file.dump.gpg>"
[ -f "${BACKUP_FILE}" ] || die "backup file not found: ${BACKUP_FILE}"
[ -n "${RESTORE_CONTAINER}" ] || die "RESTORE_CONTAINER is required (use a dedicated staging container)"
[[ "${TARGET_DB}" =~ ^wsj_(restore|drill|staging)[a-z0-9_]*$ ]] || die "TARGET_DB '${TARGET_DB}' is not an isolated drill name"
[ "$(docker inspect -f '{{.State.Running}}' "${RESTORE_CONTAINER}" 2>/dev/null || true)" = "true" ] || die "${RESTORE_CONTAINER} not running"

RUSER="$(docker exec "${RESTORE_CONTAINER}" printenv POSTGRES_USER </dev/null)" || die "cannot read POSTGRES_USER in ${RESTORE_CONTAINER}"
if [ "${RESTORE_CONTAINER}" = "${PROD_CONTAINER}" ]; then
  PROD_DB="$(docker exec "${PROD_CONTAINER}" printenv POSTGRES_DB </dev/null)"
  [ "${TARGET_DB}" != "${PROD_DB}" ] || die "refusing to restore over the production database"
  log "WARNING: restoring inside the production cluster; prefer a dedicated container"
fi
rsql() { docker exec "${RESTORE_CONTAINER}" psql -U "${RUSER}" -d "$1" -XAtq -v ON_ERROR_STOP=1 -c "$2" </dev/null; }

# --- checksum + optional decryption -------------------------------------------
if [ -f "${BACKUP_FILE}.sha256" ]; then
  ( cd "$(dirname -- "${BACKUP_FILE}")" && sha256sum -c --status -- "$(basename -- "${BACKUP_FILE}").sha256" ) \
    || die "sha256 mismatch for ${BACKUP_FILE}"
  log "sha256 verified"
fi
RESTORE_FILE="${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gpg ]]; then
  TEMP_DUMP="$(mktemp /tmp/wsj_restore_XXXXXX.dump)"
  gpg --batch --yes --pinentry-mode loopback ${GPG_PASSPHRASE_FILE:+--passphrase-file "${GPG_PASSPHRASE_FILE}"} \
      --decrypt -o "${TEMP_DUMP}" "${BACKUP_FILE}"
  RESTORE_FILE="${TEMP_DUMP}"
fi
[ "$(head -c 5 -- "${RESTORE_FILE}")" = "PGDMP" ] || die "not a PostgreSQL custom-format archive"
TOC="$(docker exec -i "${RESTORE_CONTAINER}" pg_restore --list < "${RESTORE_FILE}")" || die "pg_restore --list failed"
TOC_TABLES="$(printf '%s\n' "${TOC}" | grep -c ' TABLE DATA public ' || true)"
log "archive readable: ${TOC_TABLES} table-data entries"

# --- isolated target database -------------------------------------------------
rsql postgres "select pg_terminate_backend(pid) from pg_stat_activity where datname='${TARGET_DB}' and pid<>pg_backend_pid()" >/dev/null
rsql postgres "drop database if exists \"${TARGET_DB}\"" >/dev/null
rsql postgres "create database \"${TARGET_DB}\"" >/dev/null

START=$(date +%s%N)
docker exec -i "${RESTORE_CONTAINER}" pg_restore -U "${RUSER}" -d "${TARGET_DB}" \
  --exit-on-error --single-transaction --no-owner --no-acl < "${RESTORE_FILE}"
log "restore completed in $(( ($(date +%s%N) - START) / 1000000 )) ms"

# --- integrity checks ---------------------------------------------------------
T_TABLES="$(rsql "${TARGET_DB}" "select count(*) from pg_tables where schemaname='public'")"
[ "${T_TABLES}" = "${TOC_TABLES}" ] || fail "restored ${T_TABLES} tables, archive lists ${TOC_TABLES}"
echo "tables=${T_TABLES}"
echo "extensions=$(rsql "${TARGET_DB}" "select string_agg(extname||' '||extversion, ', ' order by extname) from pg_extension")"
echo "sequences=$(rsql "${TARGET_DB}" "select coalesce(string_agg(sequencename||'='||coalesce(last_value::text,'unset'), ', '), 'none') from pg_sequences where schemaname='public'")"
FK_TOTAL="$(rsql "${TARGET_DB}" "select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace")"
FK_UNVALIDATED="$(rsql "${TARGET_DB}" "select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace and not convalidated")"
echo "foreign_keys=${FK_TOTAL} unvalidated=${FK_UNVALIDATED}"
[ "${FK_UNVALIDATED}" = "0" ] || fail "${FK_UNVALIDATED} foreign keys are not validated"
INVALID_IDX="$(rsql "${TARGET_DB}" "select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not (i.indisvalid and i.indisready)")"
echo "indexes=$(rsql "${TARGET_DB}" "select count(*) from pg_indexes where schemaname='public'") invalid=${INVALID_IDX}"
[ "${INVALID_IDX}" = "0" ] || fail "${INVALID_IDX} invalid indexes"
echo "migrations=$(rsql "${TARGET_DB}" "select string_agg(migration_name, ',' order by started_at) from _prisma_migrations where finished_at is not null and rolled_back_at is null")"
FAILED_MIG="$(rsql "${TARGET_DB}" "select count(*) from _prisma_migrations where finished_at is null or rolled_back_at is not null")"
[ "${FAILED_MIG}" = "0" ] || fail "${FAILED_MIG} unfinished/rolled-back Prisma migrations in archive"

# Row counts vs the counts captured by backup-postgres.sh at dump time.
COUNT_SQL="$(rsql "${TARGET_DB}" "select string_agg(format('select %L||''|''||count(*) from %I.%I', tablename, schemaname, tablename), ' union all ' order by tablename) from pg_tables where schemaname='public'")"
RESTORED_COUNTS="$(rsql "${TARGET_DB}" "${COUNT_SQL}")"
echo "${RESTORED_COUNTS}" | sed 's/^/rows: /'
if [ -f "${BACKUP_FILE%.gpg}.counts" ]; then
  if diff <(sort "${BACKUP_FILE%.gpg}.counts") <(echo "${RESTORED_COUNTS}" | sort) >/dev/null; then
    log "row counts match the dump-time counts file"
  else
    log "row counts differ from dump-time counts (expected only if writes happened between dump and count):"
    diff <(sort "${BACKUP_FILE%.gpg}.counts") <(echo "${RESTORED_COUNTS}" | sort) >&2 || true
  fi
fi

# Optional read-only comparison against the live source: counts + full-content md5 per table.
if [ "${COMPARE_SOURCE:-0}" = "1" ]; then
  SUSER="$(docker exec "${PROD_CONTAINER}" printenv POSTGRES_USER </dev/null)"
  SDB="$(docker exec "${PROD_CONTAINER}" printenv POSTGRES_DB </dev/null)"
  MD5_SQL="$(rsql "${TARGET_DB}" "select string_agg(format('select %L||''|''||count(*)||''|''||coalesce(md5(string_agg(t::text, chr(10) order by t::text)),''empty'') from %I.%I t', tablename, schemaname, tablename), ' union all ' order by tablename) from pg_tables where schemaname='public'")"
  T_MD5="$(rsql "${TARGET_DB}" "${MD5_SQL}")"
  S_MD5="$(docker exec "${PROD_CONTAINER}" psql -U "${SUSER}" -d "${SDB}" -XAtq -v ON_ERROR_STOP=1 -c "${MD5_SQL}" </dev/null)"
  MATCH=0; DIFFER=0
  while IFS='|' read -r tbl cnt md5; do
    s_line="$(printf '%s\n' "${S_MD5}" | grep -E "^${tbl}\|" || true)"
    if [ "${s_line}" = "${tbl}|${cnt}|${md5}" ]; then MATCH=$((MATCH+1)); else DIFFER=$((DIFFER+1)); echo "source-diff: restored=${tbl}|${cnt} live=${s_line%|*}"; fi
  done <<< "${T_MD5}"
  echo "source_comparison: identical_tables=${MATCH} differing_tables=${DIFFER}"
fi

if [ "${FAILURES}" -gt 0 ]; then die "${FAILURES} integrity check(s) failed"; fi
log "isolated restore into ${RESTORE_CONTAINER}/${TARGET_DB} PASSED all integrity checks"
