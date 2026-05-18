---
phase: 09-storage-network-detailed-views-threshold-alerting
plan: 01
subsystem: parser
tags: [rvtools, xlsx, zod, web-worker, network-inventory, vsan]

requires:
  - phase: 04-multi-vcenter-stretched-allocation-dr
    provides: mergeSnapshotsToEstate / MergedEstate spine the new arrays thread into
  - phase: 05-rich-cluster-host-esx-intelligence
    provides: the P5 D-07 regression-gated-parser-change pattern this plan reuses
provides:
  - VNetworkRow/VSwitchRow/VDvSwitchRow/VDvPortRow row types + Zod schemas
  - vInfo.path field (the vSAN relink join key, D-09 prerequisite)
  - adaptRvtoolsVNetwork/VSwitch/DvSwitch/DvPort adapters
  - OPTIONAL-sheet factual-degrade for the 4 network sheets (warning + [], never throw)
  - the 4 network arrays threaded through Snapshot, MergedEstate, releaseRawRows
affects: [09-02, 09-03, 09-04, 09-05]

tech-stack:
  added: []
  patterns:
    - "P5 D-07 regression-gated parser extension (additive, MiB canary byte-unchanged)"
    - "OPTIONAL-sheet findSheet → collected missing-sheet warning → [] degrade (never throw)"

key-files:
  created: []
  modified:
    - src/types/vinfo.ts
    - src/types/snapshot.ts
    - src/types/index.ts
    - src/engines/parser/schemas.ts
    - src/engines/parser/adapters/rvtools.ts
    - src/engines/parser/adapters/rvtools.test.ts
    - src/engines/parser/normalizeColumns.ts
    - src/engines/parser/parser.worker.ts
    - src/engines/snapshotMerge/mergeSnapshotsToEstate.ts
    - src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts
    - src/store/snapshotStore.ts

key-decisions:
  - "Network sheets OPTIONAL (warning + []) — never the REQUIRED-sheet parseError path"
  - "Port/VLAN counts are plain non-negative numbers, never MiB-branded"
  - "vInfo.path schema is z.string().trim() (empty allowed) — P5 Powerstate/Template precedent"

patterns-established:
  - "P9 network row types model field-for-field on VDatastoreRow with doc-comment per RVTools column"

requirements-completed: [NET-01, NET-02, NET-03, VSR-04]

duration: ~55min
completed: 2026-05-17
---

# Phase 9 Plan 01: Regression-gated parser extension Summary

**Four OPTIONAL RVTools network sheets (vNetwork/vSwitch/dvSwitch/dvPort) + the vInfo.path vSAN-relink key added to the validated parser with zero regression — MiB canary byte-unchanged, parser+merge+store 101/101.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-05-17
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Four network row types + Zod schemas + Snapshot arrays (D-11)
- `vInfo.path` field + real aliased column read (D-09 relink prerequisite)
- Four adapters + OPTIONAL-sheet factual-degrade block (absent ⇒ collected warning + [], never throw)
- New arrays threaded end-to-end: parser → normalizeColumns → worker → merge → releaseRawRows
- Additive tests: network-present, network-absent (per-sheet warning, no throw), vInfo.path round-trip

## Task Commits

1. **Task 1: network row types + vInfo.path + Zod schemas** - `606387c` (feat)
2. **Task 2: adapters + OPTIONAL-sheet degrade; thread merge/store** - `546e814` (feat)
3. **Task 3: additive network/path tests** - `48cf785` (test)

## Files Created/Modified
- `src/types/vinfo.ts` - `path: string` field on VInfoRow
- `src/types/snapshot.ts` - 4 network row interfaces + 4 Snapshot arrays
- `src/types/index.ts` - re-export the 4 new row types
- `src/engines/parser/schemas.ts` - 4 z.ZodType schemas + `path` on VInfoRowSchema
- `src/engines/parser/adapters/rvtools.ts` - 4 alias maps + 4 adapters + path read + OPTIONAL-sheet blocks
- `src/engines/parser/adapters/rvtools.test.ts` - extended optional-sheet test + P9 additive blocks
- `src/engines/parser/normalizeColumns.ts` - validate + thread the 4 arrays (deviation)
- `src/engines/parser/parser.worker.ts` - post the 4 arrays in the snapshot payload (deviation)
- `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` - MergedEstate + EMPTY + flatten + return
- `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts` - `snap()` fixture defaults completed
- `src/store/snapshotStore.ts` - releaseRawRows clears the 4 arrays

## Decisions Made
- Network sheets are OPTIONAL with factual-degrade (warning + `[]`), never the REQUIRED-sheet throw path — matches the shipped vDatastore/vPartition pattern and D-11.
- Counts (`ports`/`freePorts`/`mtu`/`vms`/`maxMtu`) are plain non-negative integers, never `mib()`/`MibSchema`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 17 — Scope] Threaded arrays through 2 files outside `files_modified`**
- **Found during:** Task 2
- **Issue:** Plan's `files_modified` listed merge/store but not `normalizeColumns.ts`/`parser.worker.ts`; the now-required Snapshot arrays cannot reach merge/store without the parse→Snapshot assembly path. tsc fails otherwise.
- **Fix:** Validated the 4 arrays in `normalizeColumns.ts` (SnapshotRows Pick + return) and posted them in `parser.worker.ts`.
- **Verification:** tsc 0; parser+merge+store 101/101.
- **Committed in:** `546e814`

**2. [Rule 2 — Regression] Completed merge `snap()` fixture defaults + extended optional-sheet test**
- **Found during:** Task 2
- **Issue:** Shared merge `snap()` builder predated the new required arrays (`snap.vnetwork` undefined → "not iterable", 9 tests red); an existing optional-sheet test asserted `warnings` empty but D-11 correctly warns on absent network sheets.
- **Fix:** Added `[]` defaults to the `snap()` builder; added the 4 network sheets to the "all optional sheets present" fixture and asserted they wire through. No assertion logic weakened.
- **Verification:** parser+merge+store 101/101; MiB canary byte-unchanged.
- **Committed in:** `546e814` / `48cf785`

**3. [Rule 1 — Plan inaccuracy] Task 1 verify referenced non-existent `schemas.test.ts`**
- **Found during:** Task 1
- **Issue:** Plan verify command `npx vitest run src/engines/parser/schemas.test.ts` — that file does not exist.
- **Fix:** Treated the green parser suite (which exercises schema validation via the adapters) as the equivalent gate.
- **Verification:** parser suite green; tsc 0.

---

**Total deviations:** 3 auto-fixed (1 scope-necessary threading, 1 regression-fixture completion, 1 plan inaccuracy). No scope creep — all necessary for correctness/regression-freedom.

## Issues Encountered
- **Pre-existing, OUT OF SCOPE:** `npx @biomejs/biome check .` reports 1 error — `package.json` formatting. `package.json` is NOT in this plan's `files_modified` and is untouched by this work (clean in `git status`); it is dependency-sensitive (CLAUDE.md xlsx-tarball warning). Not fixed under 09-01 — flagged for user decision. All files this plan touched are biome-clean.
- IDE diagnostic tool emits repo-wide `@/...`/`react` "cannot find module" noise (no tsconfig path resolution); not real — `tsc --noEmit` is clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `MergedEstate` now carries `vnetwork`/`vswitch`/`dvswitch`/`dvport`; every `VInfoRow` carries `path`. Plan 09-02 can build the vSAN relink (on `vInfo.path`), storage-by-X, and network rollup engines on this spine.
- Open for user: the pre-existing `package.json` biome-format nit (repo-wide gate).

---
*Phase: 09-storage-network-detailed-views-threshold-alerting*
*Completed: 2026-05-17*
