---
phase: 04-multi-vcenter-stretched-allocation-dr
plan: 02
subsystem: aggregation
tags: [stretched-cluster, dr-reservation, confidence, datastore-attribution, zustand, i18n]

requires:
  - phase: 04-01
    provides: faultDomain parsed column, MergedEstate contract, selectedSnapshotIds memo path
provides:
  - "per-site, per-resource stretched reservation (replaces flat 0.5) + factual stretchedConfidence"
  - "ClusterAggregate stretched fields (confidence, reservedFraction, per-site GHz/RAM, em-dash null)"
  - "stretchedClusters store slice threaded through the single useEstateView memo"
  - "StretchedPill (aria-pressed idiom reuse) + neutral LowConfidenceChip + ClusterColumn wiring"
  - "str i18n namespace (EN/FR parity)"
  - "datastoreCountByCluster optional Hosts→cluster join (CORRECT but inert on real RVTools — see Deviations)"
affects: [04-04-dr, 05-eos, 06-trends, 07-exports]

tech-stack:
  added: []
  patterns:
    - "ADR-0007-EXT: per-resource reservation f=maxSiteCap/totalCap, factor=1/(1-f); confidence never collapses absence to high"
    - "Stretched UI elements colocated in components/stretched/; pill reuses the segmented aria-pressed idiom verbatim"

key-files:
  created:
    - src/components/stretched/StretchedPill.tsx
    - src/i18n/locales/en/str.json
    - src/i18n/locales/fr/str.json
  modified:
    - src/engines/aggregation/aggregateClusters.ts
    - src/types/estate.ts
    - src/engines/aggregation/perDatastore.ts
    - src/engines/aggregation/estateView.ts
    - src/store/snapshotStore.ts
    - src/hooks/useEstateView.ts
    - src/components/dashboard/ClusterColumn.tsx
    - src/components/dashboard/PerClusterColumns.tsx
    - src/components/dashboard/GlobalDashboard.tsx
    - src/i18n/index.ts

key-decisions:
  - "perCluster.ts/globals.ts left untouched (plan-sanctioned KISS — reservation computed from raw vhost rows in aggregateClusters)"
  - "Confidence model: all hosts tagged + ≥2 domains → high; partial → medium; none → low (binding test matrix)"
  - "RVTools vDatastore `Hosts` column is a host COUNT, not a name list — the Pitfall-6 join is correct code but inert on real exports (see Deviations / RESEARCH A3)"

patterns-established:
  - "Per-site reservation pinned in an ADR-0007-EXT comment block at the helper"
  - "Stretched store slice = inputs-only Set, replace-never-mutate, no persist (T-04-06)"

requirements-completed: [STR-01, STR-02, STR-03]

duration: ~1 session
completed: 2026-05-16
---

# Phase 4 Plan 02: Stretched-Cluster Per-Site Reservation + Confidence — Summary

**The dormant flat-0.5 reservation is replaced by a factual per-site, per-resource fraction with a never-optimistic confidence enum — validated 0.5/high on the REAL CL_VXB1K_CORE (4 Secondary + 4 UNI) — surfaced through a DRY StretchedPill. The named Pitfall-6 vSAN datastore-attribution fix is correct but proven INERT on real RVTools data (see Deviations).**

## Performance

- **Completed:** 2026-05-16
- **Tasks:** 3 of 3
- **Files modified:** 10 (+3 created)

## Accomplishments

- Per-site, per-resource reservation `f = maxSiteCap/totalCap` (GHz/RAM/cores independent); `factor = 1/(1-f)` (= 2 at symmetric 0.5 — shipped V1 behaviour preserved exactly).
- `stretchedConfidence` is factual: all-tagged+≥2-domains → high; partial → medium; untagged → low. **Never collapses metadata absence to high.**
- Full matrix green (12 aggregateClusters tests): 4+4→0.5/high, 6+4-tagged→0.6/high, 6+4-untagged→0.5/low, partial→medium, 8+0 failback, 2+2→0.5/high, real CL_VXB1K_CORE→0.5/high.
- `StretchedPill` reuses the `AccountingModeToggle` fieldset/legend/aria-pressed idiom verbatim (no bespoke toggle); neutral grey `LowConfidenceChip` (never red, no editorial verb).
- `stretchedClusters` inputs-only store slice threaded through the **single** `useEstateView` memo (single-memo invariant intact). `str` i18n EN/FR parity.
- Full suite **281/281**, typecheck/biome/supply-chain/bundle all green; engines coverage 94.94%.

## Task Commits

1. **Task 1: per-site reservation + confidence** — `feat(04-02)` (ADR-0007-EXT)
2. **Task 2: Hosts→cluster datastore attribution** — `feat(04-02)` (Pitfall-6)
3. **Task 3: StretchedPill + store slice + ClusterColumn + str i18n** — `feat(04-02)`

## Real-File UAT (mandatory — feedback_real_file_uat)

Throwaway harness against `~/…/20260430_1400_allvCenters.xlsx` (deleted after; never committed):

- ✅ **Merge:** 3 vCenters, **1446** vinfo rows (the expected vMotion-deduped total), 111 hosts, 170 datastores — confirms 04-01 merge on real data.
- ✅ **Stretched #1-risk:** `CL_VXB1K_CORE` flagged → `reservedFraction 0.5`, `confidence high`, fault domains `['Secondary','UNI']` — exactly the plan success criterion, on REAL data.
- ❌ **vSAN attribution:** see Deviations — proven inert on this file.

## Deviations from Plan

### Verified finding — Pitfall-6 / A3: RVTools `Hosts` is a count, not a name list

- **Found during:** mandatory real-file UAT (Task 2 verification step 7).
- **Issue:** Plan 04-02 Task 2 (and Plan 04-01's `VDatastoreRow.hosts`) assumed the RVTools vDatastore `Hosts` column is a host-NAME list to join `vHost.hostName → vHost.cluster`. On the real `allvCenters.xlsx` the column values are **counts** (`"1"`, `"3"`). All 75 blank-`Cluster name` datastores have a numeric `hosts`, so the join attributes nothing: per-cluster datastore totals are identical with and without the map (95 == 95). The "vSAN/host-local storage no longer under-counted" success criterion is **NOT achieved on real RVTools exports**.
- **Status:** This is RESEARCH **Assumption A3**, which the plan explicitly flagged with "Descope risk". The risk is now realized and confirmed empirically (tests-pass ≠ verified).
- **Code disposition:** Task 2 code is **kept** — it is correct for the specified contract, fully unit-tested, and SAFE: the non-blank-`Cluster name` path (the real, working attribution) is unchanged, and the join NEVER mis-attributes (unmatched host tokens are dropped, never fabricated). It is inert, not harmful, and would work if a future RVTools/normalizer ever supplies a host-name list.
- **Recommended follow-up (user decision):** either (a) accept the descope — blank-`Cluster name` vSAN datastores stay in the estate-wide total only (current shipped behaviour, no regression), or (b) replan a different linkage (e.g. attribute via `vInfo` VM→datastore→cluster, the only column carrying real cluster identity for these rows). Flagged for the user; does not block 04-03/04-04 (DR consumes the stretched reservation, which IS correct).

### Plan file-list deviations (sanctioned)

- `perCluster.ts` and `globals.ts` were NOT modified — the plan explicitly permitted "thread into perCluster.ts OR pass raw vhost" and "leave globals untouched — KISS". Reservation is computed from raw `vhost` rows inside `aggregateClusters`.
- `globals.test.ts` modified (not in the plan's file list) to extend the `ClusterAggregate` fixture with the 6 new required fields — necessary for typecheck after the type extension.

### Documented standing deviation — single-useMemo grep gate

Same as 04-01: the plan's literal grep returns the pre-existing P1 `SnapshotListSidebar` sort memo + comment matches. Actual `useMemo(` call sites remain exactly 2 (`useEstateView`, pre-existing `SnapshotListSidebar`). Phase 4 added none.

**Total deviations:** 1 verified blocking-finding (A3 realized — flagged to user, code kept as safe no-op), 2 sanctioned file-list, 1 standing.
**Impact:** STR-01/02/03 fully delivered + real-file-validated. STR-04 (vSAN under-count) NOT delivered on real data — explicit user decision required; no regression introduced.

## Issues Encountered

The mandatory real-file UAT (not unit tests) is what surfaced the A3 reality — exactly the value of the feedback_real_file_uat discipline. Engine math for the project's #1 risk (asymmetric stretched reservation) is now proven correct on the real CL_VXB1K_CORE.

## User Setup Required

None.
