---
phase: 04-multi-vcenter-stretched-allocation-dr
plan: 04
subsystem: aggregation
tags: [dr-simulation, scenario, zustand, react-i18next, what-if]

requires:
  - phase: 04-01
    provides: merged estate (vCenter-loss filters by viSdkUuid)
  - phase: 04-02
    provides: per-site stretched reservation (subtracted on survivors)
  - phase: 04-03
    provides: allocRatios threaded through aggregateClusters (capacity verdict)
provides:
  - "engines/drSim: pure runScenario (host/cluster/vCenter loss) re-running shipped aggregation on survivors"
  - "survivorVerdict absorbs|tight|overflows (worse-of CPU+RAM, no library)"
  - "DrSimResult + DrScenario + Verdict types; EstateView.drSim + EstateView.vcenters"
  - "scenario inputs-only store slice threaded through the single useEstateView memo"
  - "DrSimPanel: 3-mode selector + reversible fail-select + before/after + evacuee + assumptions + caveats"
  - "dr i18n namespace (EN/FR parity, 23 keys)"
affects: [07-exports]

tech-stack:
  added: []
  patterns:
    - "DR = the shipped aggregation re-run on a survivor row subset (estateView compose pattern; never re-derive, never mutate)"
    - "confidence + caveats[] (i18n keys) + always-visible assumptions panel = the #1-risk disclosure mitigation"

key-files:
  created:
    - src/engines/drSim/allocate.ts
    - src/engines/drSim/runScenario.ts
    - src/engines/drSim/index.ts
    - src/engines/drSim/allocate.test.ts
    - src/engines/drSim/runScenario.test.ts
    - src/components/dr/DrSimPanel.tsx
    - src/i18n/locales/en/dr.json
    - src/i18n/locales/fr/dr.json
  modified:
    - src/types/estate.ts
    - src/engines/aggregation/estateView.ts
    - src/store/snapshotStore.ts
    - src/hooks/useEstateView.ts
    - src/components/dashboard/GlobalDashboard.tsx
    - src/i18n/index.ts

key-decisions:
  - "vCenter-loss folds the failed vCenter's clusters into the cluster filter so host rows (no viSdkUuid) drop consistently"
  - "evacuee = before − after under one accounting mode (no separate re-derivation — DRY)"
  - "EstateView gained vcenters[] (plan-in-scope: estate.ts/estateView.ts) so the vCenter-loss picker has labels"

patterns-established:
  - "drSim engine pure (no React/Zustand/Zod); survivor verdict consumes ratio-applied capacity from aggregateClusters"

requirements-completed: [DRS-01, DRS-02, DRS-03, DRS-04, DRS-05, DRS-06]

duration: ~1 session
completed: 2026-05-16
---

# Phase 4 Plan 04: DR Simulation (3 modes) — Summary

**Host / cluster / vCenter loss simulated by re-running the SHIPPED aggregation on the survivor row subset — with the 04-02 stretched reservation and 04-03 ratios flowing through — surfaced as a reversible neutral what-if panel with before/after, a gold evacuee total, factual per-survivor verdicts, and an always-visible assumptions + caveats disclosure (the project's #1-risk mitigation). Validated on the real allvCenters estate: vCenter-loss 1373→53 VMs, 5958 evacuee vCPU.**

## Performance

- **Completed:** 2026-05-16
- **Tasks:** 3 of 3
- **Files modified:** 6 (+8 created)

## Accomplishments

- `drSim/allocate.ts`: factual `absorbs|tight|overflows` (worse-of CPU+RAM, zero-capacity safe, no library); consumes the ratio-applied `capacityVcpu/capacityRamMib` (DRY). 5/5 tests.
- `drSim/runScenario.ts`: 3 modes; vCenter-loss filters by `viSdkUuid` on the **merged** estate; survivors re-aggregated with the SAME `stretchedClusters` + `allocRatios` (04-02/04-03 flow through); evacuee = before−after; `confidence` = worst verdict; `caveats[]` = i18n key suffixes only; empty → `null`. 8/8 tests; `engines/drSim/` **98%** coverage.
- `scenario` inputs-only store slice (3 Sets, replace-never-mutate, no persist) threaded into the **single** `useEstateView` memo — `runScenario` runs inside `buildEstateView` (no 2nd memo).
- `DrSimPanel`: 3-mode aria-pressed selector (Arrow-key idiom verbatim); reversible checkbox fail-select, neutral grey strike/dim + "simulated failed" chip, **no red, no confirm dialog**; before/after stat blocks; single gold evacuee figure; factual verdict list; always-visible assumptions panel + confidence + caveats (omitted when empty). Mounted after `CpuReadyPanel` with a 2xl break.
- `dr` i18n EN/FR parity (23 keys, assumptions copy verbatim from UI-SPEC). Full suite **305/305**; typecheck/biome/supply-chain/bundle green; single `useMemo` intact.

## Task Commits

1. **Task 1: drSim/allocate** — `feat(04-04)`
2. **Task 2: drSim/runScenario + types** — `feat(04-04)`
3. **Task 3: scenario slice + DR integration + DrSimPanel + dr i18n** — `feat(04-04)`

## Real-File UAT (mandatory — feedback_real_file_uat)

Throwaway harness against the real `allvCenters.xlsx` (deleted; never committed):

- ✅ vCenter-loss of one `viSdkUuid` on the merged estate: **before 1373 VMs → after 53**, evacuee **5958 vCPU / 28 924 588 MiB vRAM**, **3 survivor clusters**, confidence `high`, caveats `[]`.
- ✅ empty scenario → `drSim` is `null`.
- Stretched reservation (CL_VXB1K_CORE) flowed through the survivor aggregation without error.

## Deviations from Plan

### Standing deviation — single-useMemo grep gate

Same as 04-01/02/03: literal grep matches comments + the pre-existing P1 `SnapshotListSidebar` sort memo. Real `useMemo(` call sites remain exactly **2** (`useEstateView`, P1 `SnapshotListSidebar`). Phase 4 added zero memos; `runScenario` runs inside the existing `useEstateView` memo.

### In-scope addition — `EstateView.vcenters`

Added `vcenters: { viSdkUuid; label }[]` to `EstateView` (estate.ts + estateView.ts — both in the plan's files_modified) so the vCenter-loss picker has human labels. Minimal, justified, no scope creep.

### Verification scope — browser UAT deferred

Plan step 9's interactive half (toggle a failed component in a browser, see it strike/dim and restore with no confirm) is the user's `gsd-verify-work` step. The engine — the risky half (wrong DR numbers = project #1 risk) — is unit-proven (13 tests) AND real-file-validated.

**Total deviations:** 1 standing, 1 in-scope type addition, 1 scoping. No code/scope creep.

## Issues Encountered

None — clean execution (no partial-state surprise, no schema mismatch like 04-02's A3).

## User Setup Required

None.
