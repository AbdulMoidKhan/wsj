#!/usr/bin/env bash
# ==============================================================================
# Capture the CURRENT wsj-web / wsj-backend PM2 definitions so they can be restored
# exactly (fork mode, same script/args/cwd/env/log files) during a rollback.
#
# Usage: bash scripts/devops/pm2-capture-legacy.sh <output-dir>
# Writes (mode 0600, never printed):
#   <output-dir>/pm2-legacy.ecosystem.json   startable with: pm2 start <file> --only <name>
#   <output-dir>/pm2-legacy.summary.txt      non-secret summary (names, modes, ports, env KEY names)
# Refuses to overwrite an existing capture.
# ==============================================================================
set -Eeuo pipefail
umask 077
OUT_DIR="${1:-}"
APPS="${WSJ_PM2_APPS:-wsj-web wsj-backend}"
die() { echo "ABORT: $*" >&2; exit 1; }
trap 'die "command failed at line ${LINENO}: ${BASH_COMMAND}"' ERR

[ -n "${OUT_DIR}" ] || die "usage: $0 <output-dir>"
mkdir -p -- "${OUT_DIR}"; chmod 700 -- "${OUT_DIR}"
OUT="${OUT_DIR}/pm2-legacy.ecosystem.json"
[ ! -e "${OUT}" ] || die "${OUT} already exists; refusing to overwrite a previous capture"
command -v pm2 >/dev/null || die "pm2 not found"

JL="$(mktemp)"; trap 'rm -f -- "${JL}"' EXIT
pm2 jlist > "${JL}" 2>/dev/null || die "pm2 jlist failed"

APPS="${APPS}" OUT="${OUT}" SUMMARY="${OUT_DIR}/pm2-legacy.summary.txt" node - "${JL}" <<'NODE'
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
const list = JSON.parse(raw.slice(raw.indexOf('[')));
const wanted = process.env.APPS.split(/\s+/).filter(Boolean);
const internal = /^(pm_|PM2_|unique_id|axm_|vizion|km_link|instance_var|exit_code|restart_time|unstable_restarts|created_at|status|pm_id|NODE_APP_INSTANCE|versioning|version|node_version|windowsHide|kill_retry_time|_pm2_version|treekill|automation|filter_env|namespace|username|exec_interpreter|exec_mode|autostart|autorestart|vizion_running|watch|instances|args|node_args|name|merge_logs|env)$/;
const apps = [], summary = [];
for (const name of wanted) {
  const procs = list.filter((p) => p.name === name);
  if (!procs.length) { console.error(`ABORT: PM2 app ${name} not found`); process.exit(1); }
  const e = procs[0].pm2_env;
  const env = {};
  for (const [k, v] of Object.entries(e.env || {})) if (!internal.test(k) && typeof v !== 'object') env[k] = String(v);
  apps.push({
    name,
    cwd: e.pm_cwd,
    script: e.pm_exec_path,
    args: e.args || [],
    node_args: e.node_args || [],
    interpreter: e.exec_interpreter || 'node',
    exec_mode: e.exec_mode === 'cluster_mode' ? 'cluster' : 'fork',
    instances: procs.length,
    out_file: e.pm_out_log_path,
    error_file: e.pm_err_log_path,
    merge_logs: true,
    autorestart: true,
    env,
  });
  summary.push(`${name}: mode=${e.exec_mode} processes=${procs.length} status=${procs.map((p) => p.pm2_env.status).join(',')} cwd=${e.pm_cwd} script=${e.pm_exec_path} args=${JSON.stringify(e.args || [])} PORT=${env.PORT ?? '(from .env)'} envKeys=${Object.keys(env).sort().join(',')}`);
}
fs.writeFileSync(process.env.OUT, JSON.stringify({ apps }, null, 2), { mode: 0o600 });
fs.writeFileSync(process.env.SUMMARY, summary.join('\n') + '\n', { mode: 0o600 });
console.log(summary.join('\n'));
NODE
echo "LEGACY_PM2_FILE=${OUT}"
