#!/usr/bin/env bash
# ==============================================================================
# Workspace Junction - PostgreSQL custom-format backup with fail-fast verification
#
# Read-only against the source database (pg_dump only). Never restores anything.
#
# Usage:
#   bash scripts/devops/backup-postgres.sh [label]
#
# Environment (all optional; defaults are the values verified on the VPS on 2026-11-09):
#   PG_CONTAINER         source container            (default: wsj-app-postgres-1)
#   BACKUP_DIR           output directory            (default: /root/wsj-backups/db)
#   GPG_PASSPHRASE_FILE  also write an AES256 copy   (default: unset -> no encryption)
#   S3_BACKUP_BUCKET     off-host copy, only if set  (no default bucket is assumed)
#   RETENTION_DAYS       prune older files written by this script (default: unset -> keep all)
#
# On success the LAST line of stdout is:   BACKUP_PATH=/absolute/path/to/file.dump
# Alongside it: <file>.sha256 and <file>.counts (table|rows read right after the dump).
# Any failure exits non-zero and removes the partial file.
# ==============================================================================
set -Eeuo pipefail
umask 077

PG_CONTAINER="${PG_CONTAINER:-wsj-app-postgres-1}"
BACKUP_DIR="${BACKUP_DIR:-/root/wsj-backups/db}"
LABEL="${1:-manual}"
case "${LABEL}" in (*[!A-Za-z0-9._-]*|'') echo "ABORT: label must match [A-Za-z0-9._-]+" >&2; exit 2;; esac
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL="${BACKUP_DIR}/wsj_${LABEL}_${TIMESTAMP}.dump"
PARTIAL="${FINAL}.partial"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" >&2; }
die() { log "ABORT: $*"; exit 1; }
trap 'rm -f -- "${PARTIAL}"' EXIT
trap 'die "command failed at line ${LINENO}: ${BASH_COMMAND}"' ERR

psql_src() { docker exec "${PG_CONTAINER}" psql -U "${PGUSER_IN}" -d "${PGDB_IN}" -XAtq -v ON_ERROR_STOP=1 "$@" </dev/null; }

# --- prerequisites -----------------------------------------------------------
command -v docker >/dev/null || die "docker not found"
[ "$(docker inspect -f '{{.State.Running}}' "${PG_CONTAINER}" 2>/dev/null || true)" = "true" ] \
  || die "container ${PG_CONTAINER} is not running"
HEALTH="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${PG_CONTAINER}")"
[ "${HEALTH}" = "healthy" ] || [ "${HEALTH}" = "none" ] || die "container health is ${HEALTH}"

# Credentials come from the container's own environment; nothing is assumed or printed.
PGUSER_IN="$(docker exec "${PG_CONTAINER}" printenv POSTGRES_USER </dev/null)" || die "cannot read POSTGRES_USER"
PGDB_IN="$(docker exec "${PG_CONTAINER}" printenv POSTGRES_DB </dev/null)"   || die "cannot read POSTGRES_DB"
[ -n "${PGUSER_IN}" ] && [ -n "${PGDB_IN}" ] || die "POSTGRES_USER/POSTGRES_DB empty in ${PG_CONTAINER}"

mkdir -p -- "${BACKUP_DIR}"
chmod 700 -- "${BACKUP_DIR}"
[ -w "${BACKUP_DIR}" ] || die "${BACKUP_DIR} not writable"
AVAIL_KB="$(df -Pk -- "${BACKUP_DIR}" | awk 'NR==2{print $4}')"
DB_BYTES="$(psql_src -c 'select pg_database_size(current_database())')"
[ "${AVAIL_KB}" -gt $(( DB_BYTES / 1024 * 2 + 102400 )) ] || die "insufficient disk space in ${BACKUP_DIR}"

# --- dump (never use -t: a TTY rewrites \n to \r\n and corrupts the binary stream) --
log "pg_dump ${PGDB_IN} from ${PG_CONTAINER} -> ${FINAL}"
docker exec "${PG_CONTAINER}" pg_dump -U "${PGUSER_IN}" -d "${PGDB_IN}" -Fc -Z 6 </dev/null > "${PARTIAL}"

# --- verification -------------------------------------------------------------
SIZE="$(stat -c%s -- "${PARTIAL}")"
[ "${SIZE}" -gt 1024 ] || die "dump is only ${SIZE} bytes"
[ "$(head -c 5 -- "${PARTIAL}")" = "PGDMP" ] || die "dump does not start with the PGDMP custom-format header"
TOC="$(docker exec -i "${PG_CONTAINER}" pg_restore --list < "${PARTIAL}")" || die "pg_restore --list failed"
TABLES_IN_TOC="$(printf '%s\n' "${TOC}" | grep -c ' TABLE DATA public ' || true)"
TABLES_IN_DB="$(psql_src -c "select count(*) from pg_tables where schemaname='public'")"
[ "${TABLES_IN_TOC}" = "${TABLES_IN_DB}" ] || die "archive has ${TABLES_IN_TOC} table-data entries, database has ${TABLES_IN_DB} tables"

mv -- "${PARTIAL}" "${FINAL}"
( cd "$(dirname -- "${FINAL}")" && sha256sum -- "$(basename -- "${FINAL}")" ) > "${FINAL}.sha256"
COUNT_SQL="$(psql_src -c "select string_agg(format('select %L||''|''||count(*) from %I.%I', tablename, schemaname, tablename), ' union all ' order by tablename) from pg_tables where schemaname='public'")"
psql_src -c "${COUNT_SQL}" > "${FINAL}.counts"
log "verified: ${SIZE} bytes, PGDMP header, ${TABLES_IN_TOC}/${TABLES_IN_DB} tables in TOC; wrote .sha256 and .counts"
log "NOTE: .counts is read just after the dump; concurrent writes can make it differ slightly."
log "NOTE: this proves the archive is readable, NOT that it restores. Run restore-postgres.sh into an isolated target."

# --- optional encryption / off-host copy (only when explicitly configured) -----
if [ -n "${GPG_PASSPHRASE_FILE:-}" ]; then
  [ -f "${GPG_PASSPHRASE_FILE}" ] || die "GPG_PASSPHRASE_FILE set but missing"
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "${GPG_PASSPHRASE_FILE}" \
      --symmetric --cipher-algo AES256 -o "${FINAL}.gpg" "${FINAL}"
  log "encrypted copy: ${FINAL}.gpg"
fi
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  command -v aws >/dev/null || die "S3_BACKUP_BUCKET set but aws CLI missing"
  UPLOAD="${FINAL}"; [ -f "${FINAL}.gpg" ] && UPLOAD="${FINAL}.gpg"
  aws s3 cp "${UPLOAD}" "${S3_BACKUP_BUCKET%/}/$(basename -- "${UPLOAD}")" --sse AES256
  log "uploaded to ${S3_BACKUP_BUCKET}"
fi

if [ -n "${RETENTION_DAYS:-}" ]; then
  find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'wsj_*_*.dump*' -mtime +"${RETENTION_DAYS}" -print -delete >&2
fi

trap - EXIT
echo "BACKUP_PATH=${FINAL}"
