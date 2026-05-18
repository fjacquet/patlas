---
phase: 09-storage-network-detailed-views-threshold-alerting
plan: 02
subsystem: api
tags: [aggregation, vsan, storage, network, pure-engine, vitest]

requires:
  - phase: 09-storage-network-detailed-views-threshold-alerting
    provides: "plan 01 — vInfo.path + network arrays on MergedEstate"
provides:
  - relinkBlankClusterDatastores (vInfo.Path vSAN relink, closes STR-04)
  - storageByX (two-lens storage-by-Cluster/ESX/VM/Datastore)
  - networkRollup (vSwitch/dvSwitch/portgroup/uplink aggregates)
affects: [09-03, 09-04, 09-05]

tech-stack:
  added: []
  patterns:
    - "perDatastore Map-accumulate + naa ?? name dedupe reused verbatim across new engines"
    - "shared-LUN minimal-inference: excluded from single-cluster, kept in estate (no proportional split)"

key-files:
  created:
    - src/engines/aggregation/vsanRelink.ts
    - src/engines/aggregation/vsanRelink.test.ts
    - src/engines/aggregation/storageByX.ts
    - src/engines/aggregation/storageByX.test.ts
    - src/engines/aggregation/network.ts
    - src/engines/aggregation/network.test.ts
  modified:
    - src/engines/aggregation/index.ts

key-decisions:
  - "vSAN relink keys off vInfo.Path bracket token matched to datastore name; result keyed by naa ?? name"
  - "Merge flatten loop made resilient (?? []) for the 4 new arrays — repairs a 09-01 regression"

patterns-established:
  - "Two-lens storage projection: consumption (provisioned/in-use, mode-aware) + capacity (deduped datastore)"

requirements-completed: [STG-01, STG-02, STG-03, NET-04, VSR-01, VSR-02, VSR-03]

duration: ~70min
completed: 2026-05-17
---

# Phase 9 Plan 02: Pure aggregation engines Summary

**Three pure engines — the vInfo.Path vSAN relink (closes the STR-04 under-count), two-lens storage-by-X, and the network topology rollup — all ≥75% covered (100/100/94), full suite 375/375.**

## Performance

- **Duration:** ~70 min (incl. a substantial 09-01 regression repair)
- **Completed:** 2026-05-17
- **Tasks:** 3
- **Files modified:** 7 created/modified + 14 in the 09-01 regression fix

## Accomplishments
- `relinkBlankClusterDatastores`: anchored bracket regex on `vInfo.path`, `naa ?? name` dedupe, size-1 attribute / size-0 unrelinkable / size>1 sharedAcross (D-09/D-10)
- `storageByX`: consumption (mode-aware) + capacity lenses by Cluster/ESX/VM/Datastore, reconcile-to-estate, vSAN-attributed per-cluster, no shared-LUN double-count (D-07/D-08)
- `networkRollup`: vSwitch/dvSwitch/portgroup/uplink aggregates, tolerates all-empty input (D-11 Pitfall 1)
- Repaired a broad 09-01 test-typecheck + merge-resilience regression (see Issues)

## Task Commits

1. **Task 1: vsanRelink** - `1c56ce5` (feat)
2. **Task 2: storageByX** - `6de47c2` (feat)
3. **Task 3: networkRollup** - `2dfcc7d` (feat)

**09-01 regression repair (in this work stream):** `84a32a0` (fix)

## Files Created/Modified
- `src/engines/aggregation/vsanRelink.ts` (+test) - blank-cluster datastore relink
- `src/engines/aggregation/storageByX.ts` (+test) - two-lens storage rollup
- `src/engines/aggregation/network.ts` (+test) - network topology rollup
- `src/engines/aggregation/index.ts` - barrel exports for the three engines

## Decisions Made
- The relink's `dsToClusters` is keyed by the **datastore name** (the `[token]` is the display name) and matched against `VDatastoreRow.name`; results are keyed by the shipped `naa ?? name` dedupe key so `storageByX` can join.
- The regex is applied via `String.prototype.match` (identical result for a non-global anchored regex) instead of the RegExp method whose name collides with the security hook's child-process token (the documented CLAUDE.md grep-gate gotcha — see Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Regression] Repaired a broad 09-01 test-typecheck + merge regression**
- **Found during:** Task 1 (running the stronger app+test typecheck)
- **Issue:** 09-01 made `vInfo.path` + 4 network arrays required; its app-only `tsc` gate missed that ~15 test fixtures no longer satisfied the types, and `mergeSnapshotsToEstate` crashed on synthetic Snapshots built without the new arrays (8 integration tests red at runtime).
- **Fix:** Completed required-field defaults in 13 fixture builders + 1 inline literal; made the merge flatten loop resilient (`?? []`, factual-degrade) for the 4 new arrays only.
- **Verification:** `npm run typecheck` (app+test) 0; full suite 375/375.
- **Committed in:** `84a32a0`

---

**Total deviations:** 1 (a necessary regression repair spanning 14 files). No scope creep.

## Issues Encountered
- **09-01 regression (fixed):** see deviation 1. Root cause = the GSD plan template's verification used app-only `tsc`, not `npm run typecheck` (app+test). **Mitigation adopted for the rest of the phase:** every task gate now runs app+test typecheck + full `vitest run`.
- **Security-hook gotcha:** the regex method whose name is the child-process token tripped the Write hook (CLAUDE.md grep-gate gotcha applies to source AND to docs describing it). Worked around with the equivalent string method; this SUMMARY phrases the note without the literal token.
- **Pre-existing, OUT OF SCOPE (carried from 09-01):** `npx @biomejs/biome check .` still reports the `package.json` formatting nit — untouched by this work, dependency-sensitive, flagged for user decision. All files this plan touched are biome-clean.

## User Setup Required
None.

## Next Phase Readiness
- The three pure engines are ready to compose into the single `buildEstateView` pass in plan 09-03 (thresholds slice + thresholdFlags + EstateView extension). All barrel-exported from `@/engines/aggregation`.
- Open for user: the pre-existing `package.json` biome-format nit (repo-wide gate).

---
*Phase: 09-storage-network-detailed-views-threshold-alerting*
*Completed: 2026-05-17*
