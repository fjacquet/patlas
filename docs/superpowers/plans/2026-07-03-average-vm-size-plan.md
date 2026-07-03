# Average VM size — implementation plan

Executes `docs/superpowers/specs/2026-07-03-average-vm-size-design.md`.
Branch: `feat/avg-vm-size`.

## Global Constraints (bind every task)

- Engines are **pure functions** — no React/DOM/Zustand/Zod inside
  `engines/aggregation/`. Zod only at the parser boundary.
- **Branded units** everywhere (`Cores`, `MiB`). Never a raw `* 1.048576`
  or hand MiB↔GiB factor — use the `@/engines/units` helpers.
- **Accounting-mode population rule** (verbatim): a VM is included when
  `mode === 'configured'`, otherwise only when `g.poweredOn` is true —
  i.e. skip when `mode !== 'configured' && !g.poweredOn`. This is the same
  rule `vinfoMerge.ts` uses.
- **Median**: sort ascending; odd N → middle; even N → arithmetic mean of
  the two middle values. Empty N=0 → all-zero `emptyAvgVmSize`.
- **Mean** = `Σ / N`, divide-by-zero guarded (N=0 → 0).
- i18n keys land in **all four** locales `en`/`fr`/`de`/`it`; the
  `src/i18n/keyParity.test.ts` gate enforces identical key paths. No
  pre-formatted numbers in strings; no editorial verbs.
- No `localStorage` of dataset rows; no new network calls.
- Commit prefix `<type>(NN-NN): …`.
- After adding the required `EstateView.avgVmSize` field, run the full
  `npm run typecheck` (app + `tsconfig.test.json`), not just `rtk tsc` —
  test literals of `EstateView`/`EMPTY_VIEW` surface only there.
- Lint with `npx @biomejs/biome check .` (NOT `npm run lint`).

## Task 1 — Engine `computeAvgVmSize` + types + tests (TDD)

**Files:** create `src/engines/aggregation/avgVmSize.ts` and
`src/engines/aggregation/avgVmSize.test.ts`.

**Type:**
```ts
export interface AvgVmSize {
  vmCount: number
  vcpu: { mean: Cores; median: Cores }
  vramMib: { mean: MiB; median: MiB }
  provisionedMib: { mean: MiB; median: MiB }
}
```

**Exports:**
- `emptyAvgVmSize: AvgVmSize` — frozen (`Object.freeze`) all-zero constant
  (`vmCount: 0`, every mean/median `0` via the branded constructors
  `cores(0)` / `mib(0)` from `@/engines/units`). Mirror the `emptySummary`
  idiom in `globals.ts`.
- `computeAvgVmSize(guests: readonly GuestRow[], mode: AccountingMode): AvgVmSize`.

**Behaviour:**
- Filter `guests` by the accounting-mode rule (Global Constraints).
- If the filtered population is empty → return `emptyAvgVmSize`.
- Otherwise compute mean and median for `vcpu`, `vramMib`, `provisionedMib`
  over the filtered rows, wrapping every result value with the matching
  branded constructor. `vmCount` = filtered population size.
- Import `GuestRow` from `@/types/guest`, `AccountingMode` from
  `@/types/estate`, unit helpers from `@/engines/units`.

**Tests (write first, TDD):**
- Odd N: median is the middle value; mean is `Σ/N`.
- Even N: median is the mean of the two middle values (include a case like
  vCPU `[2,4,6,8]` → median `5`).
- `configured` mode counts powered-off VMs; `active` mode excludes them
  (assert both `vmCount` and the resulting means differ appropriately).
- Empty input, and input that filters to empty under `active` →
  `emptyAvgVmSize` (deep-equal).
- Branded units preserved (values usable as `Cores`/`MiB`).

**Done when:** `rtk vitest src/engines/aggregation/avgVmSize.test.ts`
passes; engine has no React/DOM imports.

## Task 2 — Wire `avgVmSize` into `EstateView`

**Files:** `src/types/estate.ts`, `src/engines/aggregation/estateView.ts`,
plus any `EstateView`/`EMPTY_VIEW` test literals the typecheck flags.

- Add `avgVmSize: AvgVmSize` to the `EstateView` interface (import/export
  `AvgVmSize` — re-export from `avgVmSize.ts` or declare in `estate.ts`;
  match the codebase's existing pattern for where engine result types live).
- In `buildEstateView`, compute
  `const avgVmSize = computeAvgVmSize(merged.guests, mode)` (both are already
  in scope, ~line 157) and add `avgVmSize` to the returned object (line
  ~365 return block).
- Add `avgVmSize: emptyAvgVmSize` to `EMPTY_VIEW` (~line 619).

**Tests:**
- Extend an existing `estateView` test (or add a small one) asserting
  `view.avgVmSize.vmCount` matches the fixture population and a known
  mean/median; assert `EMPTY_VIEW.avgVmSize` deep-equals `emptyAvgVmSize`.

**Done when:** `npm run typecheck` (full, app + test) is clean and
`rtk vitest src/engines/aggregation/estateView.test.ts` passes.

## Task 3 — Web surface: StatTiles on `GlobalSummaryCard`

**Files:** `src/components/dashboard/GlobalSummaryCard.tsx`,
`src/components/dashboard/GlobalDashboard.tsx`, and the four locale files
`src/i18n/locales/{en,fr,de,it}/<dashboard-namespace>.json`.

- Thread `avgVmSize` from `GlobalDashboard` (reads `view.avgVmSize`) into
  `GlobalSummaryCard` as a new prop.
- Add three `StatTile`s — avg vCPU, avg RAM, avg disk — after the existing
  vcpu/vram/storage tiles. `value` = mean, `sub` = median label + value.
- Format RAM and disk in GiB using the **same formatter helpers** the
  neighbouring vram/storage tiles already use (find and reuse — do not
  hand-roll a MiB→GiB factor). vCPU shown as a number (may be fractional).
- Add i18n label keys in all four locales: avg vCPU, avg RAM, avg disk, and
  a "median" qualifier. Reuse the existing dashboard namespace the other
  `GlobalSummaryCard` tiles read from.

**Tests:**
- Follow the existing `GlobalSummaryCard`/StatTile test pattern: render with
  a stub `avgVmSize` and assert the three tiles show the mean, and the
  median appears in the `sub`. If the file has a smoke-test DOM contract,
  keep to it.

**Done when:** component tests pass, `keyParity.test.ts` passes, and
`npx @biomejs/biome check .` is clean.

## Task 4 — PPTX surface: overview-slide KPI row

**Files:** `src/engines/export/pptx/slides/overviewSlide.ts`,
`src/engines/export/pptx/builder.ts`, and (if the slide reads i18n at build
time) reuse the Task-3 keys — do not add new locale keys unless the slide
needs a different string.

- Add `avgVmSize: AvgVmSize` to the `OverviewData` interface.
- Thread it from `builder.ts` (pass `view.avgVmSize` into the overview
  slide's data object).
- Add the three average-size metrics as KPI tiles via the existing
  `addKpiRow` helper, each value formatted `mean / median` (matching the
  reviewed mock, e.g. `6.4 / 4`). Reuse the slide's existing GiB formatting
  helper for RAM/disk.

**Tests:**
- Follow the existing overview-slide test pattern (if present) — assert the
  slide builder runs with `avgVmSize` in `OverviewData` and emits the tiles;
  otherwise a minimal builder smoke test that `OverviewData` accepts the
  field and the slide renders without throwing.

**Done when:** relevant pptx tests pass, `npm run typecheck` is clean, and
`npx @biomejs/biome check .` is clean.

## Final

Whole-branch review, then `superpowers:finishing-a-development-branch`.
