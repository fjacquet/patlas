---
phase: 09-storage-network-detailed-views-threshold-alerting
plan: 04
subsystem: ui
tags: [react, viewtoggle, echarts, treemap, storage, i18n]

requires:
  - phase: 09-storage-network-detailed-views-threshold-alerting
    provides: "plan 03 — storage/vsan/network/flags + thresholds slice on EstateView"
provides:
  - ViewToggle Storage+Network segments + TreemapChart registration
  - storage/alerts i18n namespaces (EN/FR)
  - StorageView shell (lens/scope/threshold) + DatastoreDetail + VmDetail drills
  - LC-4 engine-surface extension (vsanRelink.datastoreVms, detailIndex, datastoreDetail/vmDetail on EstateView)
affects: [09-05, 10]

tech-stack:
  added: []
  patterns:
    - "Detail drills = lifted view-state off the single useEstateView (GlobalDashboard/ClusterDetail idiom)"
    - "Per-entity detail Maps on EstateView (the clusterDetail precedent)"

key-files:
  created:
    - src/components/ViewToggle.test.tsx
    - src/components/storage/StorageView.tsx (+test)
    - src/components/storage/StorageLensToggle.tsx
    - src/components/storage/ThresholdConfig.tsx
    - src/components/storage/DatastoreDetail.tsx (+test)
    - src/components/storage/VmDetail.tsx (+test)
    - src/components/inventory/columns/storageColumns.ts
    - src/engines/aggregation/detailIndex.ts (+test)
    - src/i18n/locales/{en,fr}/{storage,alerts}.json
  modified:
    - src/components/ViewToggle.tsx
    - src/components/Chart.tsx
    - src/i18n/index.ts
    - src/i18n/locales/{en,fr}/inventory.json
    - src/types/estate.ts
    - src/engines/aggregation/{vsanRelink,thresholdFlags,estateView,index}.ts
    - src/App.tsx

key-decisions:
  - "User-chosen full LC-4: extended the engine surface (datastoreDetail/vmDetail Maps) rather than shipping reduced-scope screens"
  - "vsanRelink exposes datastoreVms (same vInfo.Path parse — single source, no new join)"
  - "Tasks 2+3 merged into one commit (StorageView imports the detail screens — must compile together)"

patterns-established:
  - "Factual threshold marker = gold tint + left rule (bg-accent-500/15 + border-l-2); never a status colour scale"

requirements-completed: [STG-04, STG-05, DTL-01, DTL-02, ALR-05]

duration: ~3h (incl. the LC-4 plan-gap resolution + engine extension)
completed: 2026-05-18
---

# Phase 9 Plan 04: Storage UI Summary

**ViewToggle gains Storage/Network, the StorageView shell ships with lens/scope/threshold controls + treemap/stacked-bar via the single Chart site + screen-fit Datastore/VM drills — backed by a user-chosen LC-4 engine-surface extension. Full suite 403/403, bundle OK.**

## Performance
- **Completed:** 2026-05-18
- **Tasks:** 3 (T1 standalone; T2+T3 merged)
- **Files:** ~25 created/modified

## Accomplishments
- Task 1: ViewToggle +Storage/+Network (idiom unchanged), TreemapChart registered (bundle 269.8 KiB ≤ 300), storage/alerts i18n EN/FR
- LC-4 engine extension: `vsanRelink.datastoreVms`, shared `fsOver`, new `detailIndex` engine, `datastoreDetail`/`vmDetail` Maps on EstateView (single-pass, clusterDetail precedent)
- Tasks 2+3: StorageLensToggle + ThresholdConfig (shipped idioms verbatim), storageColumns, StorageView shell (single useEstateView, lifted lens/scope/drill, treemap/stacked-bar, factual alerts count line), DatastoreDetail + VmDetail screen-fit drills, App route

## Task Commits
1. **Task 1: ViewToggle/Chart/i18n** - `9cb817b` (feat)
2. **LC-4 engine-surface extension** - `da75ad7` (feat)
3. **Tasks 2+3: StorageView + detail drills** - `1502829` (feat)

## Decisions Made
- Resolved the LC-4 plan gap (09-02/09-03 surface lacked per-entity breakdowns) by the user's choice: extend the engine surface (option 2), following the shipped `clusterDetail` Map precedent — not reduced-scope screens.
- `vsanRelink` now also returns `datastoreVms` from the SAME `vInfo.Path` parse (single source, no new join).
- Tasks 2 and 3 merged: `StorageView` imports `DatastoreDetail`/`VmDetail`, so they must land together to typecheck.

## Deviations from Plan

**1. [Scope — user-approved] LC-4 engine-surface extension**
- The plan's Task 2/3 detail screens assumed `EstateView` exposed per-datastore VM lists + per-VM partitions/portgroups; 09-02/09-03 did not build that. Surfaced as a plan gap; user chose to extend the engine surface. Added `detailIndex` + `datastoreDetail`/`vmDetail` Maps + `vsanRelink.datastoreVms`. Committed `da75ad7`. New engines ≥75% (detailIndex 97.95 %).

**2. [Plan inaccuracy] ViewToggle.test.tsx did not exist**
- Task 1 acceptance said "extend the shipped ViewToggle test"; none existed. Created it (8-segment + arrow-wrap coverage).

**3. [Plan inaccuracy] Tasks 2+3 merged**
- The plan's T2/T3 split is not independently compilable (StorageView imports the T3 detail screens). Built + gated + committed together.

**4. [Grep-gate gotcha] Denylist tokens in absence-describing comments/asserts**
- Doc-comments / negative test assertions describing the *absence* of status-colour classes contained the literal denylisted tokens. Rephrased; negative assertions construct the forbidden substrings at runtime so source carries no literal token (the documented CLAUDE.md gotcha).

**5. [Plan-criterion nuance] single-useEstateView / single-useMemo literal grep**
- `grep -c "useEstateView"` = 3 (import + doc-comment + the ONE call); the real invariant (exactly one `useEstateView` call, zero `useMemo(` in `src/components/storage/`) holds. Same nuance as the prior plans' grep-vs-intent note.

---
**Total deviations:** 5 (1 user-approved scope extension, 2 plan inaccuracies, 1 grep-gate gotcha, 1 criterion nuance). No scope creep beyond the user-approved LC-4 extension.

## Issues Encountered
- **No live browser verification** (environment constraint, disclosed up front): StorageView/detail screens are verified by component tests + tsc + Biome + bundle gate ONLY — not visually in a browser. The treemap/stacked-bar render path is exercised by the StorageView render tests in jsdom but not visually confirmed.
- **Pre-existing, OUT OF SCOPE (carried):** repo-wide `biome check .` `package.json` formatting nit — untouched, flagged for user decision.

## User Setup Required
None.

## Next Phase Readiness
- Storage surface complete + routed. 09-05 (NetworkView + EsxDetail augmenting Hosts + the MANDATORY real-file vSAN relink validation gate) consumes `view.network`/`view.vsan`/`view.datastoreDetail` already shipped.
- Open for user: pre-existing `package.json` biome nit; live browser verification of the 3 new storage screens (not possible in this environment).

---
*Phase: 09-storage-network-detailed-views-threshold-alerting*
*Completed: 2026-05-18*
