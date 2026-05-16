---
phase: 04-multi-vcenter-stretched-allocation-dr
plan: 01
subsystem: aggregation
tags: [multi-vcenter, snapshot-merge, zustand, react-i18next, useMemo, rvtools]

requires:
  - phase: 01-foundation
    provides: parser worker, branded units, Snapshot type, snapshotStore, useEstateView single-memo invariant
  - phase: 02-aggregation
    provides: buildEstateView / aggregateClusters / perDatastore engine spine
provides:
  - "engines/snapshotMerge: row-keyed (viSdkUuid) N-snapshot merge with cluster-collision suffix + vMotion VM dedupe"
  - "buildEstateView now consumes the MERGED bundle (MergedEstate), not a raw Snapshot"
  - "inputs-only selectedSnapshotIds store slice (default=all, replace-never-mutate, no persist)"
  - "merge runs INSIDE the single useEstateView useMemo (single-memo invariant preserved)"
  - "SnapshotCard MVC-04 meta line: N vCenters + per-vCenter Server labels + correct RVTools version"
  - "mvc i18n namespace (EN/FR parity)"
affects: [04-02-stretched, 04-03-allocation, 04-04-dr, 05-eos, 06-trends, 07-exports]

tech-stack:
  added: []
  patterns:
    - "Pure snapshotMerge engine (no React/Zustand/Zod); input never mutated; non-colliding rows pass through by reference"
    - "Two referentially-stable store reads (snapshots Map + selectedSnapshotIds Set); Snapshot[] derived inside the one memo, never in a selector"

key-files:
  created:
    - src/engines/snapshotMerge/vCenterIndex.ts
    - src/engines/snapshotMerge/mergeSnapshotsToEstate.ts
    - src/engines/snapshotMerge/index.ts
    - src/engines/snapshotMerge/vCenterIndex.test.ts
    - src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts
    - src/i18n/locales/en/mvc.json
    - src/i18n/locales/fr/mvc.json
  modified:
    - src/engines/parser/adapters/rvtools.ts (Task 1 — columnar vMetaData + faultDomain/Hosts aliases)
    - src/engines/parser/captureDate.ts (Task 1)
    - src/types/snapshot.ts (Task 1 — vMetaData as per-vCenter list)
    - src/engines/aggregation/estateView.ts (buildEstateView signature → MergedEstate)
    - src/hooks/useEstateView.ts (merge inside the single memo)
    - src/store/snapshotStore.ts (selectedSnapshotIds slice + selectors)
    - src/components/SnapshotCard.tsx (MVC-04 meta line; removed redundant version span)
    - src/i18n/index.ts (mvc namespace)

key-decisions:
  - "Resumed partial execution rather than re-running: Task 1 was pre-committed (50d7bd5); Task 2 code was written-but-uncommitted and verified-correct (14/14, tsc clean) before committing"
  - "buildEstateView authority for RVTools version moved to the MVC-04 line (correct per-vCenter value from Task 1); the old snapshot-level version span removed (was duplicated + potentially stale '3.11+')"

patterns-established:
  - "snapshotMerge: collision keyed on viSdkUuid not filename — N files and one N-vCenter workbook take the identical path"
  - "Store exposes raw stable inputs; all derivation lives inside useEstateView's single useMemo"

requirements-completed: [MVC-01, MVC-02, MVC-03, MVC-04]

duration: ~resume session
completed: 2026-05-16
---

# Phase 4 Plan 01: Multi-vCenter Merge + Parser Prerequisites + Single-Memo Contract — Summary

**N separately-dropped RVTools workbooks (and one N-vCenter workbook) now merge into ONE logical estate via row-keyed `viSdkUuid` identity — collision-suffixed, vMotion-deduped — consumed inside the project's single `useMemo`.**

## Performance

- **Duration:** resume session (Task 1 + Task 2 code pre-existed; this run verified, fixed, completed Task 3)
- **Completed:** 2026-05-16
- **Tasks:** 3 of 3
- **Files modified:** 17 (+2 new i18n locale files)

## Accomplishments

- `engines/snapshotMerge/` shipped: `buildVCenterIndex` + `mergeSnapshotsToEstate` — 14/14 tests, **97.18% stmts / 83.33% branch / 100% funcs / 98.41% lines** (≥75% gate).
- `buildEstateView` contract changed to take the merged bundle; merge wired **inside** the single `useEstateView` `useMemo` — single-memo invariant preserved.
- `selectedSnapshotIds` inputs-only store slice (default = all loaded snapshots, replace-never-mutate, no persist/localStorage).
- MVC-04 SnapshotCard meta line: N-vCenters + per-vCenter Server labels + correct RVTools version; `mvc` i18n namespace with EN/FR parity.
- Full suite green: **270/270 tests**, typecheck (app + test config) clean, biome clean, supply-chain OK, echarts bundle 207.8 KiB ≤ 300.

## Task Commits

1. **Task 1: Parser prerequisites (columnar vMetaData + faultDomain/Hosts + types)** — `50d7bd5` (feat) — *pre-committed before this resume session*
2. **Task 2: snapshotMerge engine + tests** — `4e8b917` (feat); biome-format fixup `a9a1841` (style)
3. **Task 3: single-useMemo contract + selectedSnapshotIds slice + MVC-04 card + mvc i18n** — `da8d14f` (feat)

## Files Created/Modified

See frontmatter `key-files`. Engine is pure (no React/Zustand/Zod); input snapshots never mutated; non-colliding rows pass through by reference.

## Decisions Made

- **Resume over re-execute.** Plan 04-01 was found partially executed (Task 1 committed; Task 2 written-but-uncommitted; Task 3 written-but-uncommitted). Rather than discard, each pre-existing artifact was independently verified against the plan before committing (Task 2: 14/14 + coverage + tsc; Task 3: full suite after fixes).
- **Version display authority.** The MVC-04 line now owns RVTools-version display (correct per-vCenter value from the Task-1 columnar fix). The previous snapshot-level `rvtoolsVersion` span in the capture-date line was removed — it duplicated the value (broke an e2e single-match assertion) and could carry the stale `3.11+` fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Stale fixture — type contract] dashboard-smoke & inventory-stress missing required `vMetaData`**

- **Found during:** Task 3 verification (full suite run)
- **Issue:** Task 1 made `Snapshot.vMetaData` a required `VMetaDataEntry[]`. Two pre-Task-1 test fixtures omitted it → `SnapshotCard` crashed (`Cannot read properties of undefined (reading 'map')`).
- **Fix:** Added `vMetaData: rows.vMetaData` to both fixtures (mirrors the already-correct `e2e-smoke` fixture).
- **Files modified:** `src/__tests__/dashboard-smoke.test.tsx`, `src/__tests__/inventory-stress.test.tsx`
- **Verification:** 270/270 suite green.
- **Committed in:** `da8d14f`

**2. [Signature change — callers] test callers of changed `buildEstateView`**

- **Found during:** Task 3 verification (test-config typecheck)
- **Issue:** `buildEstateView(snapshot, mode)` → `(merged, mode)` broke `inventory-stress` and `columns.test` direct callers.
- **Fix:** Local merge shim `buildEstateViewMerged(mergeSnapshotsToEstate([snap]), mode)` — same pattern `estateView.test.ts` already used.
- **Files modified:** `src/__tests__/inventory-stress.test.tsx`, `src/components/inventory/columns/columns.test.ts`
- **Verification:** typecheck exit 0; suite green.
- **Committed in:** `da8d14f`

**3. [Plan defect — naive verification] single-useMemo grep gate**

- **Found during:** Task 3 verification (plan verify step 6)
- **Issue:** Plan requires `grep -rn 'useMemo' src ... | grep -v '.test.'` to return **exactly one line**. This has been impossible since Phase 1: the grep matches comment text mentioning "useMemo" AND the pre-existing `SnapshotListSidebar.tsx:25` sort memo (shipped in `f58950d feat(01-05)`).
- **Resolution:** Verified by intent instead: exactly **2** real `useMemo(` call sites exist — `useEstateView.ts:31` (the estate-aggregation memo this invariant governs) and the pre-existing P1 `SnapshotListSidebar` sort memo. **Phase 4 added zero new memos**; the merge runs inside the existing `useEstateView` memo. Deleting a shipped P1 feature's memo is out of scope and a regression risk, so it was not done.
- **Files modified:** none (analysis only)
- **Committed in:** n/a

**4. [Pre-commit miss] biome format not applied to Task 2 before its commit**

- **Found during:** Task 3 verification (biome)
- **Fix:** `biome check --write`; committed as a separate `style(04-01)` commit to keep the feature commit clean.
- **Committed in:** `a9a1841`

---

**Total deviations:** 4 (2 auto-fixed test-conformance, 1 documented plan-defect, 1 style fixup)
**Impact on plan:** All fixes necessary for correctness; no scope creep. The single-useMemo plan-defect is a verification-text flaw, not a code regression — the actual invariant holds.

## Issues Encountered

Plan 04-01 was discovered partially executed at session start (production commit `50d7bd5` with no SUMMARY, plus untracked Task 2/3 working-tree code). Handled via safe-resume: each artifact independently re-verified against the plan before being committed; nothing was assumed correct on faith.

## User Setup Required

None.
