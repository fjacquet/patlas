---
quick_id: 260517-sdq
status: in-progress
date: 2026-05-17
---

# Quick Task 260517-sdq: Fix 4 CodeRabbit PR #1 review findings

Address the four inline CodeRabbit findings on PR #1 (Phase 7). Each verified
valid against the codebase before planning (receiving-code-review discipline).

## Task 1 — engine purity (estateView.ts)

- **Files:** `src/engines/aggregation/estateView.ts`, `src/hooks/useEstateView.ts`, `src/engines/aggregation/estateView.test.ts`
- **Action:** Add required `today: Date` as 3rd positional param of `buildEstateView`; forward to `buildEosProjection` (drop in-engine `new Date()`). Inject `new Date()` at the `useEstateView` hook boundary (the single useMemo). Add `today` to the memo dep array. Update test call sites + the in-engine doc comment.
- **Verify:** `npm run typecheck`; `npx vitest run src/engines/aggregation src/hooks` green.
- **Done:** No `new Date()` in `src/engines/**` non-test code for the EOS path; engine deterministic for identical inputs.

## Task 2 — EOS month-boundary math (bucketEos.ts)

- **Files:** `src/engines/eos/bucketEos.ts`, `src/engines/eos/bucketEos.test.ts`
- **Action:** Add pure `daysInUTCMonth(year, month)` helper (leap-aware, no Date construction — keeps the "Date.UTC/Date.parse/getters only" doc-contract accurate). Clamp `monthsAfter` day to `min(getUTCDate(), daysInUTCMonth)`. Make `todayMs` date-only via `Date.UTC(y, m, d)`. Add regression tests (end-of-month input, same-day-EOL with time-of-day).
- **Verify:** `npx vitest run src/engines/eos` green.
- **Done:** Jan-31 +1mo lands on Feb 28/29; same-day EOL not flipped to overdue by time-of-day.

## Task 3 — fmtDate timezone (format.ts)

- **Files:** `src/utils/format.ts`, `src/utils/format.test.ts`
- **Action:** Parse `^(\d{4})-(\d{2})-(\d{2})$` into a local-time `new Date(y, m-1, d)` with round-trip overflow validation; non-matching/overflow input returns the `'—'` sentinel (contract preserved). Add TZ-stability + invalid-date tests.
- **Verify:** `npx vitest run src/utils/format` green.
- **Done:** `fmtDate('2026-05-17')` shows May 17 regardless of host TZ.

## Task 4 — STATE.md Current Position

- **Files:** `.planning/STATE.md`
- **Action:** Collapse the contradictory block to a single coherent state — Phase 7 complete; reconcile the Progress line/phase count against ROADMAP.
- **Verify:** Block reads one consistent status.
- **Done:** No "EXECUTING/40%" vs "complete/100%" contradiction.

## Post

- `npm run typecheck` + full `npm run test:run` green; `npx @biomejs/biome check .` clean on touched files.
- Reply in each of the 4 PR comment threads via `pulls/1/comments/{id}/replies`.
