# Session Handoff — 2026-11-12

**Branch:** `feature/public-motion-performance-optimization` (local only, not pushed)
**Last verified commit:** `feddb78` (FU-01), followed by a docs commit
**Phase:** Stage A–F done for this session; Stage B follow-ups open.

## Commits on this branch
| Commit | Content |
|---|---|
| a044b1e | Baseline: pre-existing uncommitted work snapshotted as found |
| 8a9c370 | Motion runtime rewrite, WebGL gating, WSJ-01/02/04, carousel, dead code + `motion` dep removed |
| 96f538c | WebGL after first interaction, route-scoped CSS, LCP priority, AA contrast, QA scripts, docs |
| feddb78 | FU-01: dead catch-all views + 9 sheets removed, :has() hot spots fixed, ScrollTrigger on demand, route-only client views code-split |

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

## FU-01 outcome
Mobile median average 60.1 -> 63.6, TBT -18%, desktop home 78 -> 89. Figma-page mobile LCP unchanged
(~5.8 s): Lighthouse replays every early request on a 1.6 Mbps link, so the hero image competes with
~276 KB JS + 124 KB fonts + 109 KB CSS. See PERFORMANCE_RESULTS "FU-01 results".

## Environment notes (added)
- With MSYS_NO_PATHCONV=1, pass QA_OUT as a Windows path (cygpath -w); a /c/... path makes Node write to C:c...
- `.next-fu01-base` holds the pre-FU-01 build used for before/after comparisons.

## Next precise action
FU-03 (font preloads, needs design sign-off) gives the largest remaining mobile LCP lever. FU-06 (server-rendered
public-site flag on <body> replacing 55 body:has(.wj-platform) rules; GSAP/mega-menu JS after first paint)
needs a root-layout change reviewed for admin/account.
