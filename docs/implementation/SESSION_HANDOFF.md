# Session Handoff — 2026-11-12

**Branch:** `feature/public-motion-performance-optimization` (local only, not pushed)
**Last verified commit:** `96f538c` (followed by a docs-only handoff commit)
**Phase:** Stage A–F done for this session; Stage B follow-ups open.

## Commits on this branch
| Commit | Content |
|---|---|
| a044b1e | Baseline: pre-existing uncommitted work snapshotted as found |
| 8a9c370 | Motion runtime rewrite, WebGL gating, WSJ-01/02/04, carousel, dead code + `motion` dep removed |
| 96f538c | WebGL after first interaction, route-scoped CSS, LCP priority, AA contrast, QA scripts, docs |

## State
- Compiles: typecheck and lint clean. All unit/guard suites pass (see PROGRESS_STATE.json).
- Production build passes. Measurements were taken on a local production build on port 3001.
- Working tree is clean after the handoff commit.
- Backend, billing, auth, Stripe, Prisma: **untouched** (`git diff a044b1e -- backend` is empty).

## Decisions made
- The prior uncommitted work was committed as a baseline instead of being stashed, so mission
  diffs are isolated and reversible.
- `CoworkingView` and `DynamicPageView` were deleted rather than optimised. Every route they
  handled is served first by the Figma page view, so they were unreachable.
- `PublicLayout` renders per page, so the shell remounts on every navigation. Rather than
  refactoring layouts (which would touch admin and account), the WebGL world and Lenis are
  module-level singletons with deferred disposal.
- Header retract stays inactive on Figma routes because their header is deliberately non-sticky.
- AA contrast was fixed by darkening text-only tokens. The brand amber stays for CTAs and on
  dark grounds.

## Environment notes
- Processes started for QA: the local API (`wsj-api`, :4000) and `next start` on :3001. Both are
  local and safe to stop. The dev server on :3000 was not started by this session and was left
  alone.
- Git Bash rewrites `/route/` arguments; use `MSYS_NO_PATHCONV=1`.
- `next build` with a custom dist dir edits `tsconfig.json`; run `git checkout tsconfig.json` before
  committing.

## Next precise action
FU-01: map which global stylesheet rules each route actually needs (start with `inner-redesign.css`
at 94 KB and `design-system.css`), move route-specific sheets into their views, then re-run
`npm run test:mission-perf` and compare mobile LCP render delay against `evidence/perf-final.json`.
