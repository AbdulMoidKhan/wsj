// PM2 process definitions for Workspace Junction (wp.workspacejunction.com),
// release/performance-security-20261109.
//
// Verified production facts (VPS 72.61.0.11, 2026-11-09):
//   - Nginx proxies "/" to 127.0.0.1:3600 and "/api/" to 127.0.0.1:4000.
//   - The live processes run in FORK mode under the same names (wsj-web via `npm start`,
//     wsj-backend via backend/dist/main.js) and listen on *:3600 / 0.0.0.0:4000.
//
// This release deliberately stays in FORK mode with ONE process per app (audit item F-012,
// PM2 cluster mode, is deferred): the API rate limiter and the public response cache are
// in-memory per process, so clustering would double effective rate limits and let one worker
// serve stale content after an admin edit. Changes versus production:
//   - bind 127.0.0.1 only (reachable through Nginx only; closes direct internet access),
//   - run the commit-named build directories so the previous build stays untouched for rollback,
//   - restart guards.
// Runtime configuration stays in .env.local (Next.js) and backend/.env (dotenv); no secrets here.
//
// Overridable ONLY for isolated staging drills:
//   WSJ_WEB_PORT (3600)  WSJ_API_PORT (4000)  WSJ_BIND_HOST (127.0.0.1)
//   WSJ_NEXT_DIST_DIR (.next)  WSJ_API_DIST (dist, relative to backend/)
const fs = require('fs');
const path = require('path');

const BIND = process.env.WSJ_BIND_HOST || '127.0.0.1';
const WEB_PORT = Number(process.env.WSJ_WEB_PORT || 3600);
const API_PORT = Number(process.env.WSJ_API_PORT || 4000);
const NEXT_DIST = process.env.WSJ_NEXT_DIST_DIR || '.next';
const API_DIST = process.env.WSJ_API_DIST || 'dist';

for (const [k, v] of Object.entries({ WEB_PORT, API_PORT })) {
  if (!Number.isInteger(v) || v <= 0) throw new Error(`ecosystem.config.cjs: invalid ${k}=${v}`);
}
if (process.env.WSJ_SKIP_BUILD_CHECK !== '1') {
  for (const f of [path.join(__dirname, NEXT_DIST, 'BUILD_ID'), path.join(__dirname, 'backend', API_DIST, 'main.js')]) {
    if (!fs.existsSync(f)) throw new Error(`ecosystem.config.cjs: build output missing: ${f}`);
  }
}

const common = {
  exec_mode: 'fork',
  instances: 1,
  kill_timeout: 10000,
  min_uptime: '20s',
  max_restarts: 10,
  exp_backoff_restart_delay: 200,
  merge_logs: true,
  time: true,
  autorestart: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'wsj-web',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: `start -H ${BIND} -p ${WEB_PORT}`,
      max_memory_restart: '1200M',
      env_production: { NODE_ENV: 'production', PORT: String(WEB_PORT), NEXT_DIST_DIR: NEXT_DIST },
    },
    {
      ...common,
      name: 'wsj-backend',
      cwd: path.join(__dirname, 'backend'),
      script: `${API_DIST}/main.js`,
      max_memory_restart: '700M',
      env_production: { NODE_ENV: 'production', PORT: String(API_PORT), HOST: BIND },
    },
  ],
};
