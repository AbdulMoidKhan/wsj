# Resume Instructions

For any new session continuing this mission. Do not restart from scratch and do not ask the
owner to repeat requirements.

1. Read `MASTER_MISSION.md`, `PROGRESS_STATE.json`, `SESSION_HANDOFF.md`, `TASK_CHECKLIST.md`.
2. Inspect git:
   ```bash
   git branch --show-current          # expect feature/public-motion-performance-optimization
   git log --oneline -5
   git status --short
   ```
3. Reconcile: every task marked IMPLEMENTED/VERIFIED must exist in the code at
   `PROGRESS_STATE.json.lastVerifiedCommit` or later. Uncommitted changes = work in progress from
   an interrupted session — review the diff, then validate before continuing.
4. Environment (local only; never production):
   - PostgreSQL: docker container `wsj-postgres-1` (`npm run db:up` if stopped).
   - API: `.claude/launch.json` → `wsj-api` (port 4000).
   - Production build for measurements (keeps the dev server on :3000 untouched):
     ```bash
     NEXT_DIST_DIR=.next-mission-after node node_modules/next/dist/bin/next build
     NEXT_DIST_DIR=.next-mission-after node node_modules/next/dist/bin/next start -p 3001
     ```
     Port 3001 is in the API CORS allow-list. `next build` rewrites `tsconfig.json` includes for the
     custom dist dir — revert with `git checkout tsconfig.json` before committing.
5. Verification commands:
   ```bash
   npm run typecheck && npm run lint
   npm run test:plan-hint && npm run test:content && npm run test:service-content && npm run test:performance-optimizations
   npm run test:payment-safety && npm run test:pricing-catalog
   QA_BASE_URL=http://localhost:3001 npm run test:redirects
   QA_BASE_URL=http://localhost:3001 QA_OUT=$PWD/docs/implementation/evidence/perf-<label>.json npm run test:mission-perf
   QA_BASE_URL=http://localhost:3001 QA_OUT=$PWD/docs/implementation/evidence/responsive-<label>.json npm run test:mission-responsive
   ```
   On Git Bash for Windows prefix commands that pass `/route/` arguments with `MSYS_NO_PATHCONV=1`.
6. Continue with the first NOT_STARTED item in `IMPLEMENTATION_PLAN.md → Next actions` (FU-01).
7. After each batch: update TASK_CHECKLIST → PROGRESS_STATE.json → SESSION_HANDOFF → commit.

Automatic resumption is **not configured** (no scheduler/agent-runner was set up or verified).
