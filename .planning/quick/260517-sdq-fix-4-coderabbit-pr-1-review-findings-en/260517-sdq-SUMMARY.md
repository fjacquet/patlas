---
quick_id: 260517-sdq
status: complete
date: 2026-05-17
---

# Quick Task 260517-sdq — Summary

Fixed the 4 inline CodeRabbit findings on PR #1 (Phase 7). Each was verified
valid against the codebase before any edit (receiving-code-review discipline).

## Outcomes

| Finding | Fix | Commit |
|---------|-----|--------|
| `estateView.ts` engine purity (Major) | `today: Date` is now a required 3rd param of `buildEstateView`, threaded to `buildEosProjection`; `new Date()` sampled only at the `useEstateView` memo boundary. Engine deterministic. | `47422e4` |
| `bucketEos.ts` month-boundary math (Major) | Pure leap-aware `daysInUTCMonth` clamp stops end-of-month overflow; `todayMs` is date-only via `Date.UTC` so a same-day EOL isn't flipped to `overdue` by time-of-day. | `4650bc8` |
| `format.ts` fmtDate TZ back-shift (Major) | Bare `YYYY-MM-DD` parsed into a local-time `Date` with round-trip overflow validation; `'—'` sentinel preserved for malformed/overflow input. | `6a0c7ec` |
| `STATE.md` contradictory Current Position (Minor) | Collapsed to one coherent state — Phase 7 COMPLETE, phase 100% / project 70% (7/10, reconciled against ROADMAP). | docs commit |

## Deviation from CodeRabbit's suggestion

Finding 2: used a pure `daysInUTCMonth` helper instead of CodeRabbit's
`new Date(Date.UTC(...)).getUTCDate()`. Rationale: the engine's doc-contract
states "Date.UTC / Date.parse / getters only"; a Date construction would have
falsified it and risked the grep-gate. The helper is equivalent and keeps the
contract true.

## Validation

- `npm run typecheck` — clean (app + test tsconfig).
- `npm run test:run` — 340 passed; 1 failure (`e2e-smoke.test.tsx`) is
  **pre-existing and out of scope**: an uncommitted working-tree branding
  edit renamed `vatlas`→`vAtlas` in `App.tsx`/`index.html` while the smoke
  test still asserts `/vatlas/`. Not touched by this task.
- All 8 suites covering the changed files pass (56/56).
- `npx @biomejs/biome check` — clean on all 9 touched files.
- Regression tests added: EOS end-of-month/time-of-day, fmtDate TZ-stability + overflow.

## Follow-up (not in scope)

- The unrelated `vatlas`→`vAtlas` branding change in the working tree breaks
  `e2e-smoke.test.tsx`; whoever owns that change should update the test regex.
- Replies posted to the 4 PR #1 comment threads.
