---
phase: 05-rich-cluster-host-esx-intelligence
plan: 01
subsystem: aggregation
tags: [parser, powerstate, vpartition, operational-insights, estate-view]

requires:
  - phase: 04
    provides: merged estate + single useEstateView memo + per-site stretched
provides:
  - "parser: VPowerState enum + Template + host model/vendor/esxVersion (poweredOn derived)"
  - "MergedEstate.vpartition (concatenated) + pure aggregateGuestData engine"
  - "EstateView.operationalInsights (estate) + clusterInsights + clusterDetail (per-cluster), single memo"
affects: [05-02, 06, 07]

tech-stack:
  added: []
  patterns:
    - "Additive parser column aliases + derived-field shim = zero-blast-radius schema extension, regression-gated"
    - "Parallel EstateView maps (not ClusterAggregate fields) keep fixture blast radius near-zero"

key-files:
  created:
    - src/engines/aggregation/guestData.ts
    - src/engines/aggregation/guestData.test.ts
  modified:
    - src/engines/parser/adapters/rvtools.ts
    - src/engines/parser/schemas.ts
    - src/types/vinfo.ts (VPowerState, powerState, template)
    - src/types/vhost.ts (model, vendor, esxVersion)
    - src/types/estate.ts (OperationalInsights, ClusterDetail, EstateView fields)
    - src/types/index.ts
    - src/engines/snapshotMerge/mergeSnapshotsToEstate.ts (vpartition)
    - src/engines/aggregation/estateView.ts (insights in the single pass)
    - 16 test builders conformed to the new required fields

key-decisions:
  - "poweredOn kept as a DERIVED boolean from powerState → no consumer breakage"
  - "guest data null when vPartition absent (factual, never invented 0)"
  - "operational insights as parallel EstateView maps, not ClusterAggregate fields (low blast radius)"

patterns-established:
  - "calc-from-real-data: an unavailable metric is null/em-dash, never fabricated"

requirements-completed: [RCI-01, RCI-02, RCI-03, RCI-04]

duration: ~1 session (inline, resumed)
completed: 2026-05-17
---

# Phase 5 Plan 01: Data Layer — Summary

**Parser additively captures the exact powered-state enum + Template + host model/vendor/ESXi (poweredOn derived, validated-parser regression intact), and the full operational-insights metric set is computed estate-wide AND per-cluster inside the single useEstateView pass — every value from real parsed columns, guest-data factually null when vPartition is absent.**

## Performance

- **Completed:** 2026-05-17 (executed inline; Task 1 then resumed Task 2)
- **Tasks:** 2 of 2
- **Files:** 2 created, ~25 modified (incl. 16 conformed test builders)

## Accomplishments

- **Task 1** `feat(05-01)`: RVTools `Powerstate` → `VPowerState` enum (poweredOn|poweredOff|suspended); `poweredOn` kept DERIVED (zero consumer breakage). `Template`→boolean. vHost `model`/`vendor`/`esxVersion` factual text (absent→'', no lifecycle verdict). Schemas+types+barrel. **MiB canary + all existing parser fixtures green**; 3 new P5 cases; parser 65/65 @ 85.5%.
- **Task 2** `feat(05-01)`: `MergedEstate.vpartition` concatenated; pure `aggregateGuestData` (vPartition→VM→cluster; estate `null` when no vPartition). `EstateView.operationalInsights` + `clusterInsights` + `clusterDetail` computed in the **single** `buildEstateView` pass (no 2nd memo): realized overcommit, core/mem-weighted avgs, powered-state+template breakdown, provisioned/in-use, totals, guest-used.
- Full suite **311/311**; tsc/biome/supply-chain/bundle green; aggregation 98% coverage; single-`useMemo`=2 (intact).

## Task Commits
1. `feat(05-01)` parser extension (regression-gated) — `dcf1934`
2. `feat(05-01)` operational-insights aggregations — (this commit)

## Deviations from Plan

- Operational insights surfaced as **parallel `EstateView` maps** (`clusterInsights`/`clusterDetail`) rather than extending `ClusterAggregate` — deliberate low-blast-radius choice (avoids re-breaking ~16 fixtures again). Plan explicitly permitted "extend ClusterAggregate OR a parallel map".
- Bulk test-builder conformance done via full-line-anchored scripted insert (no call-site drift; one VmDisplayRow over-match hand-corrected). Standing single-useMemo grep note as in prior plans (2 real call sites).

**No scope creep.** Real-file UAT for the data layer is folded into 05-02's mandatory real-file UAT (the metrics only become user-observable through the UI).

## Issues Encountered

RTK rendered the snapshotMerge file as "binary" for grep (unicode) — used Read instead. No functional impact.

## User Setup Required

None.
