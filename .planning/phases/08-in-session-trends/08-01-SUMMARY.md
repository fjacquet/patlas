---
phase: 08-in-session-trends
plan: 01
subsystem: engine
tags: [trends, aggregation, timeseries, capture-date, react-memo]

requires:
  - phase: 04-multi-vcenter-stretched-allocation-dr
    provides: mergeSnapshotsToEstate spine + (VI SDK UUID, vm_bios_uuid) cross-snapshot identity
  - phase: 02
    provides: aggregateClusters/aggregateGlobals/perDatastore pipeline + the single buildEstateView pass
provides:
  - Pure src/engines/trends/ module (buildTrendSeries + captureDateOrdinal)
  - TrendSeries/TrendPoint/TrendDelta/TrendHeadline types replacing the TimelinePoint stub
  - EstateView.trends populated inside the single buildEstateView pass (no second memo)
  - Snapshot.rawReleased/releasedAggregate + ReleasedTrendAggregate (DD-C carry contract)
  - ISO_DATE_RE/filenameIsoDate exported from captureDate.ts (DRY for plan 08-02)
affects: [08-02, 08-03, trends UI, dashboard sparklines, delta panel]

tech-stack:
  added: []
  patterns:
    - "Single-pass pure composition: trends sub-call inside buildEstateView (P5/P6/P7 precedent), no second useMemo"
    - "DD-A A2: timeline point = one capturedAt calendar day; same-day multi-vCenter spatially merged via shipped mergeSnapshotsToEstate"
    - "DD-C A3 resolution: a released snapshot's surviving aggregate is an input fact, not a cached derivation"

key-files:
  created:
    - src/engines/trends/buildTrendSeries.ts
    - src/engines/trends/buildTrendSeries.test.ts
    - src/engines/trends/captureDateOrdinal.ts
    - src/engines/trends/captureDateOrdinal.test.ts
    - src/engines/trends/index.ts
  modified:
    - src/types/estate.ts
    - src/types/index.ts
    - src/types/snapshot.ts
    - src/engines/parser/captureDate.ts
    - src/engines/aggregation/estateView.ts
    - src/hooks/useEstateView.ts
    - src/engines/aggregation/estateView.test.ts
    - src/components/inventory/columns/columns.test.ts
    - src/__tests__/inventory-stress.test.tsx

key-decisions:
  - "DD-A = A2 (per-capturedAt-date, same-day files spatially merged first) — counts reconcile with the dashboard by construction"
  - "DD-B = B1 (consecutive-pair count-deltas on existing aggregate fields); identity churn rejected (deferred DIF-01)"
  - "DD-C A3 LOCKED: releasedAggregate carried on Snapshot is consistent with inputs-only (only remaining input fact once rows are gone)"
  - "D-05 ordinal fallback: undeterminable (epoch/NaN) capturedAt -> stable load-order ordinal + orderInferred; nothing fabricated"
  - "Snapshot.rawReleased/releasedAggregate added in 08-01 (not 08-02) because Task 2 consumes them under sequential execution"

patterns-established:
  - "engines/trends/ pure module, Vitest-gated (Stmts 98.8% / Branch 77.5% — >=75% gate)"
  - "Doc-comments avoid the literal React-memo-hook token (grep-gate/security-hook matches comments)"

requirements-completed: [TRD-01, TRD-02, TRD-04, TRD-05]

duration: 38min
completed: 2026-05-17
---

# Phase 8 Plan 01: Pure Trends Engine Summary

**Per-snapshot temporal trend series (DD-A A2 / DD-B B1 / DD-C carry / D-05 ordinal) composed into the single `buildEstateView` pass with zero new memo sites and the shipped aggregates reused so counts reconcile with the dashboard by construction.**

## Performance

- **Duration:** ~38 min
- **Tasks:** 3/3 (TDD: 2 RED/GREEN, 1 compose)
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments

- **Task 1:** `TimelinePoint` stub replaced by `TrendHeadline`/`TrendPoint`/`TrendDelta`/`TrendSeries`; `EstateView.trends: TrendSeries | null`. Pure `captureDateOrdinal` (stable load order + undeterminable-date detection, D-05). `ISO_DATE_RE`/`filenameIsoDate` exported from `captureDate.ts` (DRY); `inferCaptureDate` refactored to reuse it (behavior-identical, parser tests green).
- **Task 2:** `buildTrendSeries` — per-day grouping via shipped `mergeSnapshotsToEstate` + `aggregateClusters`/`aggregateGlobals`/`perDatastore`; consecutive-pair branded deltas (`mibToGib`, never `* 1.048576`); DD-C released-aggregate carry with a dedicated passing test; D-05 ordinal path. 13 trends tests, coverage Stmts 98.8% / Branch 77.5%.
- **Task 3:** `buildEstateView` widened with pre-merge `selected`; trends composed before `return` mirroring the EOS block; `trends: null` → `trends` (EMPTY_VIEW literal unchanged). Hook threads `selected` through the ONE memo. 3 test wrappers updated. Full suite 354 pass.

## Deviations from Plan

**[Rule 2 - missing critical] Snapshot trend-carry fields relocated 08-02 → 08-01** — Found during: Task 2. `Snapshot.rawReleased`/`releasedAggregate` + the `ReleasedTrendAggregate` interface were assigned to plan 08-02, but plan 08-01 Task 2 (`buildTrendSeries`) consumes them and execution is sequential, so they were added here. 08-02 still owns the `releaseRawRows` mutation that populates them. Files: src/types/snapshot.ts. Verified: tsc + 354 tests green. Commit: dcaccc3.

**Total deviations:** 1 auto-fixed (Rule 2). **Impact:** none — type-only addition; 08-02's scope is unchanged (it adds the mutation, not the fields).

## Verification

- `npx vitest run` → 354 passed (incl. 13 new trends tests + DD-C release-correctness)
- `engines/trends/` coverage: Stmts 98.8% / Branch 77.5% / Func 95.7% / Lines 98.6% (≥75% gate)
- `npx tsc --noEmit -p tsconfig.app.json` → no errors
- `npx @biomejs/biome check` → clean
- Single-memo grep gate: only `useEstateView:48` + documented `SnapshotListSidebar:25` sort — UNCHANGED (no second memo)
- `grep -c "1.048576" buildTrendSeries.ts` = 0; `grep "new Date(" buildTrendSeries.ts` = none (pure)

## Self-Check: PASSED

Key files exist on disk; 3 task commits present (a367f2f, dcaccc3, cccd115); all acceptance criteria re-run green; plan `<verification>` block satisfied.

## Next

Ready for **08-02** (releaseRawRows mutation + latest-first non-blocking warm-up + LineChart registration). 08-02 populates the `rawReleased`/`releasedAggregate` fields this plan defined and consumes.
