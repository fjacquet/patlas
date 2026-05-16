---
phase: 02-aggregation-global-dashboard
plan: 02
subsystem: engine
tags: [aggregation, branded-units, accounting-modes, cpu-ready, naa-dedupe, useEstateView, vsizer-port]

# Dependency graph
requires:
  - phase: 01-foundation-invariants
    provides: "branded units (mib/mhz/ghz/cores/sockets + mhzToGhz), Snapshot/VInfoRow/VHostRow/VDatastoreRow row types, inputs-only snapshotStore + selectActiveSnapshot, vitest+coverage gate"
  - phase: 02-aggregation-global-dashboard (02-01)
    provides: "ECharts SVG infra + <Chart> wrapper + theme (consumed by 02-03, not by this plan)"
provides:
  - "Pure buildEstateView(snapshot, mode) → EstateView assembler + frozen EMPTY_VIEW"
  - "Six ported math engines (ghz/perCluster/vinfoMerge/aggregateClusters/globals/contention) brand-retrofitted"
  - "Three net-new pure engines: osFamily (3-way classifier), perDatastore (NAA dedupe), perEsx (host rollup)"
  - "Three accounting modes via a single mode param threaded through vinfoMerge/perEsx (no precompute)"
  - "Exported readinessStats helper (shared by vinfoMerge + perEsx; reused by future phases)"
  - "src/utils/format.ts ported locale formatters with GiB/TiB suffixes (ADR-0010)"
  - "useEstateView(mode) — the project's single sanctioned useMemo store→view bridge"
  - "src/types/estate.ts — EstateView/ClusterAggregate/GlobalSummary/DatastoreAggregate/EsxAggregate contract"
affects: [02-03-dashboard-ui, phase-03-inventory, phase-04-trends-multi-snapshot, phase-05-eos, phase-07-exports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Brand retrofit: brand on boundary → `x as number` for arithmetic → re-wrap via units constructor"
    - "Accounting mode = one param recompute (Pitfall 2), never parallel precomputed arrays"
    - "NAA-keyed dedupe: group by `naa ?? name`, capacity from first row, never summed (Moderate-11)"
    - "Pure assembler + frozen EMPTY_VIEW constant (modeled on globals.ts:emptySummary)"
    - "Single useMemo bridge: useEstateView orchestrates+memoizes, engines hold the logic"

key-files:
  created:
    - src/types/estate.ts
    - src/utils/format.ts
    - src/engines/aggregation/{ghz,perCluster,vinfoMerge,aggregateClusters,globals,contention}.ts
    - src/engines/aggregation/{osFamily,perDatastore,perEsx,estateView,index}.ts
    - src/hooks/useEstateView.ts
    - src/test/arrays.ts
  modified:
    - src/types/index.ts

key-decisions:
  - "useEstateView added as the ONE new useMemo; pre-existing SnapshotListSidebar useMemo (Phase-1) logged as out-of-scope deferred item"
  - "Stretched-cluster DR math ported intact but dormant (empty set); covered by direct regression test to keep branch coverage ≥75% and protect math integrity (T-02-06)"
  - "Test-only `first()` helper placed at src/test/arrays.ts (outside coverage include globs) to satisfy noUncheckedIndexedAccess without non-null assertions"
  - "A1 implemented: global datastoreCount + totalStorageMib only; ClusterAggregate carries NO per-cluster datastore field (02-03 renders em-dash)"

patterns-established:
  - "Brand retrofit mechanical pattern applied across all ported engines"
  - "Shared readinessStats exported from vinfoMerge, imported by perEsx (DRY, no copied reduce loop)"
  - "Frozen EMPTY_VIEW / emptySummary empty-but-valid-shape idiom"

requirements-completed: [DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06]

# Metrics
duration: 60min
completed: 2026-05-16
---

# Phase 2 Plan 02: Aggregation Engines + useEstateView Summary

**Six vsizer aggregation engines ported with the branded-units retrofit plus three net-new pure engines (osFamily, NAA-deduped perDatastore, perEsx), assembled into a pure buildEstateView with three one-param accounting modes, exposed through the project's single useMemo bridge useEstateView — 99.1% stmt / 85.3% branch engine coverage.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-05-16T05:10:43Z
- **Completed:** 2026-05-16T06:10Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 30 (29 created, 1 modified)

## Accomplishments
- Ported `ghz/perCluster/vinfoMerge/aggregateClusters/globals/contention` to branded units with the mechanical retrofit; `ghz.ts` imports `mhzToGhz` from `@/engines/units` (zero re-declaration — DRY gate green).
- Added the three net-new pure engines: `osFamily` (3-way, `other` always a visible bucket), `perDatastore` (NAA-keyed, first-row capacity never summed — no shared-LUN double-count), `perEsx` (host rollup reusing the shared `readinessStats`).
- Threaded the three accounting modes through `vinfoMerge`/`perEsx` as a single `mode` param (one-param recompute, no precomputed parallel arrays); proven to yield three distinct global totals on a ~50/50 powered-on fixture (Critical-6).
- `buildEstateView(snapshot, mode)` composes the full `EstateView` with `trends: null` (Phase-4 forward-compat) + frozen `EMPTY_VIEW`.
- `useEstateView(mode)` is the single new `useMemo` site; contains no aggregation logic.
- Engine coverage: **99.11% stmts / 85.32% branch / 100% funcs / 100% lines** (≥75% gate). Full suite: 187 tests / 29 files green. `typecheck`/`lint`/`check:supply-chain` exit 0.

## Task Commits

1. **Task 1: Estate types + ported math engines + format.ts** — `11224ce` (feat) — 38 tests incl. the 62.4 GHz `physicalGhz` composition canary and the explicit `vcpuPerPcpu`-uses-physical-cores assertion.
2. **Task 2: New engines + estateView assembler + barrel + useEstateView** — `36e3e88` (feat) — 22 tests incl. NAA-dedupe, three-modes-distinct, EMPTY_VIEW frozen, useEstateView memo identity.

_Both tasks are `tdd="true"`; the port is verbatim/compositional so RED (tests vs not-yet-imported modules) → GREEN was a single coherent cycle per task; RED→GREEN observed via the test runs before each commit._

## Files Created/Modified
- `src/types/estate.ts` — branded `ClusterAggregate`/`GlobalSummary`/`ClusterHostStats`/`ClusterVmStats` + `AccountingMode`/`OsFamily`/`DatastoreAggregate`/`EsxAggregate`/`OsBreakdown`/`TimelinePoint`/`EstateView`. active-memory chain dropped; `datastoreCount`/`totalStorageMib` added; `trends: TimelinePoint[] | null`.
- `src/types/index.ts` — re-exports the new estate types.
- `src/utils/format.ts` (+ test) — ported vsizer formatters; `fmtMemMb` suffixes GiB/TiB (base-2 math unchanged); locale is a passed param; em-dash sentinel preserved.
- `src/engines/aggregation/ghz.ts` — `physicalGhz`/`consumedGhz` only; imports `mhzToGhz` from units.
- `src/engines/aggregation/perCluster.ts` — host rollup; `memoryMib` (renamed), GHz unwrap/rewrap.
- `src/engines/aggregation/vinfoMerge.ts` — mode-driven powered-off filter; `readinessStats` exported + always powered-on-only.
- `src/engines/aggregation/aggregateClusters.ts` — verbatim port incl. dormant stretched DR math; mode threaded.
- `src/engines/aggregation/globals.ts` — verbatim port + `datastoreCount`/`totalStorageMib`; frozen `emptySummary`.
- `src/engines/aggregation/contention.ts` — `CONTENTION_THRESHOLDS`/`TOP_N_DEFAULT` verbatim (PPTX prose stripped).
- `src/engines/aggregation/osFamily.ts` — `classifyOsFamily` 3-way regex bank.
- `src/engines/aggregation/perDatastore.ts` — NAA dedupe, first-row capacity, `sharedDuplicateCount`.
- `src/engines/aggregation/perEsx.ts` — host rollup, mode-aware, DRY `readinessStats` reuse.
- `src/engines/aggregation/estateView.ts` — pure `buildEstateView` + frozen `EMPTY_VIEW`.
- `src/engines/aggregation/index.ts` — public barrel.
- `src/hooks/useEstateView.ts` (+ test) — the one `useMemo` bridge.
- `src/test/arrays.ts` — test-only `first()` helper (outside coverage include).

## Contract for 02-03 (the EstateView shape it consumes)

`EstateView = { globals: GlobalSummary; clusters: ClusterAggregate[]; hosts: EsxAggregate[]; datastores: DatastoreAggregate[]; vmsByCluster: Map<string, OsBreakdown>; osBreakdown: OsBreakdown; accountingMode: AccountingMode; trends: TimelinePoint[] | null }`

- `GlobalSummary` (DSH-02): `clusterCount/hostCount/vmCount`, branded `physicalCores/usablePhysicalCores: Cores`, `vcpuPerPcpu: number`, `physicalGhz/consumedGhz/availableGhz/drReservedGhz: GHz`, `physicalRamMib/consumedRamMib/drReservedRamMib/availableRamMib/vramAllocatedMib: MiB`, `meanCpuRatio/meanRamRatio: number`, `vcpuAllocated: Cores`, `mhzPerVcpu: number`, `stretchedClusterCount: number`, `vmsAboveReadinessWarning: number | null` (null when no cluster reports — never 0), `datastoreCount: number`, `totalStorageMib: MiB`.
- `ClusterAggregate` (DSH-01/03/05): same unit-fields per cluster; `meanCpuReadinessPercent/maxCpuReadinessPercent: number | null`, `readinessAvailable: boolean` (branch on this for "not reported", never render `0 %`). **No per-cluster datastore field** (A1 — render em-dash `—`).
- `EsxAggregate` (DSH-01 / Phase-3 tree): `hostName/cluster`, `sockets: Sockets`, `cores: Cores` (physical), `speedMhz: MHz`, `physicalGhz: GHz`, `memoryMib/vramAllocatedMib: MiB`, `vmCount/vcpuAllocated` mode-aware, `cpuRatio/ramRatio: number`, readiness fields.
- `DatastoreAggregate` (DSH-02): `key (naa ?? name)`, `name`, `type`, `capacityMib/freeMib/usedMib/provisionedMib: MiB`, `usedRatio/overProvisionRatio: number`, `sharedDuplicateCount: number`.
- `OsBreakdown` (DSH-04): `{ windows: number; linux: number; other: number }` — `other` always present.

**Shared `readinessStats` signature** (exported from `vinfoMerge`, re-exported by the barrel; perEsx + future phases reuse): `readinessStats(rows: VInfoRow[]) → { mean: number | null; max: number | null; countAboveWarning: number; available: boolean }` — always powered-on-only, arithmetic mean, reduce-not-spread max, count > `CONTENTION_THRESHOLDS.warning` (5).

**Canary reference values for 02-03's integration test** (canary fixture = 1 VM / 1 host / 1 cluster; vHost: 2 sockets × 12 cores @ 2600 MHz, per 01-04-SUMMARY): `physicalGhz = (2600 × 12) / 1000 = 31.2 GHz` per host; global `physicalGhz = 31.2` (single host); `clusterCount = 1`, `hostCount = 1`. The branded composition `2 × physicalGhz(mhz(2600), cores(12)) = 62.4` is asserted in `ghz.test.ts` (ROADMAP success #6). Exact parsed VM vCPU/vRAM/datastore figures derive from the canary's parsed rows (01-04 contract) — 02-03 should drive `parseSnapshot → buildEstateView` on the fixture and assert structural presence + three-modes-distinct rather than hardcoding parsed scalars.

## Decisions Made
- `useEstateView` is the one new `useMemo`. The pre-existing Phase-1 `SnapshotListSidebar.tsx:25` `useMemo` (the documented reference idiom in 02-PATTERNS) is out of scope for 02-02 and logged in `deferred-items.md`.
- Exercised the dormant stretched-cluster DR math with a direct regression test (math ports intact for Phase 4) — lifts branch coverage from 74.3% → 85.3% and protects report-integrity (threat T-02-06).
- `first()` test helper at `src/test/arrays.ts` (outside all coverage `include` globs) — clean way to satisfy `noUncheckedIndexedAccess` without scattering `!`.
- A1 implemented as planned: datastore attribution is GLOBAL only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] noUncheckedIndexedAccess broke destructured test fixtures**
- **Found during:** Task 1 (engine tests)
- **Issue:** `const [c] = aggregate...()` yields `T | undefined` under the strict `tsconfig.test.json`; typecheck failed.
- **Fix:** Added a test-only `first()` helper at `src/test/arrays.ts` (outside coverage include globs) and switched destructuring to `first(...)`.
- **Files modified:** src/test/arrays.ts, perCluster/vinfoMerge/aggregateClusters/perDatastore/perEsx/estateView test files
- **Verification:** `npm run typecheck` exits 0; all tests green.
- **Committed in:** 11224ce / 36e3e88 (task commits)

**2. [Rule 2 - Missing Critical] Branch coverage below the 75% gate**
- **Found during:** Task 2 (coverage gate)
- **Issue:** First coverage run hit 74.31% branches — below the ≥75% project gate (ROADMAP success #6). The gap was the dormant stretched-cluster DR branches in `aggregateClusters.ts` and the readiness-rollup branches in `globals.ts`.
- **Fix:** Added a direct stretched-cluster regression test (the ported math is testable even though Phase-2 callers pass an empty set) plus globals readiness/zero-divisor tests.
- **Files modified:** aggregateClusters.test.ts, globals.test.ts
- **Verification:** Coverage 99.11% stmt / 85.32% branch / 100% funcs / 100% lines; no threshold error.
- **Committed in:** 36e3e88 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical/test-gate)
**Impact on plan:** Both auto-fixes were necessary to satisfy the project's strict TS + coverage gates. No scope creep — no engine behavior changed; the stretched test exercises ported-intact math the plan explicitly preserves.

## Threat Flags

No new security surface introduced. Engines are pure transforms with zero network/DOM/Zod/React/Zustand imports (verified). The ported ADRs (0010/0011/0012/0007) and the ≥75% coverage gate (incl. 62.4 GHz, vcpuPerPcpu-uses-cores, NAA-dedupe, three-modes-distinct) mitigate the report-integrity threats T-02-06/T-02-07 per the plan's threat register.

## Issues Encountered
- The plan's `useMemo` count gate (`grep -rl 'useMemo' | grep -v test`) matches the literal string in JSDoc/prose, so it reports 4 files. The substantive criterion — exactly one NEW real `useMemo()` call site, containing no aggregation logic — is met (`useEstateView.ts:19`). The only other real call site (`SnapshotListSidebar.tsx:25`) is pre-existing Phase-1 code and the documented reference idiom; logged as a deferred item.
- The `activeMemMb` absence gate initially tripped on explanatory JSDoc; reworded comments to "active-memory" prose so the gate is genuinely clean (zero `activeMemMb`/`sumActiveMem` tokens in `aggregation/` + `estate.ts`).

## Next Phase Readiness
- 02-03 (dashboard UI) can build directly on `useEstateView(mode)` + the documented `EstateView` contract; 02-01's `<Chart>` infra is already shipped.
- Phase 3 inventory consumes `perEsx`/`perDatastore`/`vmsByCluster` — no new engine needed there.
- Phase 4 multi-snapshot populates `trends` (already typed `TimelinePoint[] | null`) and activates the dormant stretched-cluster math without changing the component contract.

## Self-Check: PASSED

All 8 key files verified present on disk; both task commits (`11224ce`, `36e3e88`) verified in git history.

---
*Phase: 02-aggregation-global-dashboard*
*Completed: 2026-05-16*
