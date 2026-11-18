#!/usr/bin/env bash
# ==============================================================================
# Controlled, one-app-at-a-time PM2 replacement for Workspace Junction.
#
#   bash scripts/devops/pm2-switch.sh <wsj-backend|wsj-web> release <legacy.json>
#   bash scripts/devops/pm2-switch.sh <wsj-backend|wsj-web> legacy  <legacy.json>
#
# release : delete ONLY <app>, wait until its port is free, start it from ecosystem.config.cjs
#           (--env production), wait for health, verify exec mode + process count
#           (EXPECT_MODE, default fork_mode; WSJ_INSTANCES, default 1) and 0 restarts.
#           If any step fails, the release app is deleted and the legacy definition is
#           started again automatically (exit 1).
# legacy  : delete ONLY <app> and start the captured legacy (fork) definition (rollback).
#
# The script/args of the process change (npm start -> next start -H 127.0.0.1, dist -> dist-<sha>),
# which pm2 restart/reload cannot apply, so there is a real gap between delete and the new process
# listening. Measured in staging; see the runbook.
# Never calls `pm2 save`: persist only after the full acceptance gate passes.
# Run from the application root (the directory containing ecosystem.config.cjs).
# ==============================================================================
set -Eeuo pipefail
APP="${1:-}"; TARGET="${2:-}"; LEGACY="${3:-}"
WEB_PORT="${WSJ_WEB_PORT:-3600}"; API_PORT="${WSJ_API_PORT:-4000}"; INSTANCES="${WSJ_INSTANCES:-1}"; EXPECT_MODE="${EXPECT_MODE:-fork_mode}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
log() { echo "[$(date -u '+%H:%M:%S.%3N')] $*" >&2; }
die() { log "ABORT: $*"; exit 1; }

case "${APP}" in
  wsj-backend) PORT="${API_PORT}"; HEALTH_URL="http://127.0.0.1:${PORT}/api/health"; EXPECT='"status":"ok"';;
  wsj-web)     PORT="${WEB_PORT}"; HEALTH_URL="http://127.0.0.1:${PORT}/";           EXPECT='<html';;
  *) die "usage: $0 <wsj-backend|wsj-web> <release|legacy> <legacy.json>";;
esac
[ "${TARGET}" = "release" ] || [ "${TARGET}" = "legacy" ] || die "target must be release or legacy"
[ -f "${LEGACY}" ] || die "legacy PM2 capture not found: ${LEGACY} (run pm2-capture-legacy.sh first)"
[ -f ecosystem.config.cjs ] || die "run from the application root (ecosystem.config.cjs missing in $(pwd))"
command -v pm2 >/dev/null && command -v curl >/dev/null && command -v ss >/dev/null || die "pm2, curl and ss are required"

port_listeners() { ss -ltnH "sport = :${PORT}" | wc -l; }
app_state() { pm2 jlist 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s.slice(s.indexOf("["))).filter(p=>p.name===process.argv[1]);
  console.log(a.length+" "+[...new Set(a.map(p=>p.pm2_env.exec_mode))].join(",")+" "+a.filter(p=>p.pm2_env.status==="online").length+" "+a.reduce((n,p)=>n+p.pm2_env.restart_time,0))})' "${APP}"; }
wait_port_free() { local i; for i in $(seq 1 60); do [ "$(port_listeners)" = "0" ] && return 0; sleep 0.25; done; return 1; }
wait_healthy() { local i end=$(( $(date +%s) + HEALTH_TIMEOUT )); while [ "$(date +%s)" -lt "${end}" ]; do
    if curl -fsS -m 5 "${HEALTH_URL}" 2>/dev/null | grep -q "${EXPECT}"; then return 0; fi; sleep 0.25; done; return 1; }

if [ "${TARGET}" = "release" ]; then
  AVAIL_MB="$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)"
  [ "${AVAIL_MB}" -ge "${MIN_AVAILABLE_MB:-1500}" ] || die "only ${AVAIL_MB} MB available; need ${MIN_AVAILABLE_MB:-1500} MB before starting the release"
fi

read -r N MODE ONLINE _ <<< "$(app_state)"
log "${APP} before: processes=${N} mode=${MODE:-none} online=${ONLINE} port=${PORT} listeners=$(port_listeners)"

start_legacy() {
  pm2 delete "${APP}" >/dev/null 2>&1 || true
  wait_port_free || log "WARNING: port ${PORT} still busy after delete"
  pm2 start "${LEGACY}" --only "${APP}" >/dev/null
  wait_healthy && log "legacy ${APP} healthy" || log "LEGACY ${APP} NOT HEALTHY - manual intervention required"
}

T0=$(date +%s%N)
pm2 delete "${APP}" >/dev/null 2>&1 || log "${APP} was not running"
wait_port_free || { log "port ${PORT} still in use after deleting ${APP}:"; ss -ltnp "sport = :${PORT}" >&2; start_legacy; die "port conflict"; }
T1=$(date +%s%N)

if [ "${TARGET}" = "release" ]; then
  if ! pm2 start ecosystem.config.cjs --only "${APP}" --env production >/dev/null; then
    log "pm2 start failed"; start_legacy; die "reverted ${APP} to legacy"
  fi
else
  pm2 start "${LEGACY}" --only "${APP}" >/dev/null
fi

if ! wait_healthy; then
  log "health check failed: ${HEALTH_URL}"
  [ "${TARGET}" = "release" ] && { start_legacy; die "reverted ${APP} to legacy"; }
  die "legacy ${APP} not healthy - manual intervention required"
fi
T2=$(date +%s%N)
sleep "${SETTLE_SECONDS:-5}"
read -r N MODE ONLINE RESTARTS <<< "$(app_state)"
log "${APP} after: processes=${N} mode=${MODE} online=${ONLINE} restarts=${RESTARTS} listeners=$(port_listeners)"
if [ "${TARGET}" = "release" ]; then
  if [ "${MODE}" != "${EXPECT_MODE}" ] || [ "${N}" != "${INSTANCES}" ] || [ "${ONLINE}" != "${INSTANCES}" ] || [ "${RESTARTS}" != "0" ]; then
    start_legacy; die "expected ${INSTANCES} online ${EXPECT_MODE} process(es) with 0 restarts; reverted ${APP} to legacy"
  fi
fi
log "port released after $(( (T1-T0)/1000000 )) ms; healthy $(( (T2-T0)/1000000 )) ms after delete (unavailability window upper bound)"
echo "SWITCH_OK app=${APP} target=${TARGET} window_ms=$(( (T2-T0)/1000000 ))"
