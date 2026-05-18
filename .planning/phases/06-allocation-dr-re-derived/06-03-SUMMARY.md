---
phase: 06-allocation-dr-re-derived
plan: 03
subsystem: dr-presenter (two-mode physical-impact panel + Planning DR slot)
tags: [dr-sim, two-mode, physical-impact, no-confidence, custom-failover, single-memo, i18n-parity, presenter-test]
requires:
  - "06-01 DR contract: DrMode='server'|'site', DrScenario{failedHosts,failedSites}, DrSimResult physical-impact + caveats, EstateView.plannedDrSim"
  - "06-02 PlanningView shell + 2xl break + DR-slot placeholder + lifted applyPlannedToDr state"
  - "shipped EsxAggregate (hostName/cluster/faultDomain/vmCount/physicalGhz/memoryMib), snapshotStore selectScenario/selectSetScenario/selectStretchedClusters"
provides:
  - "Two-mode physical-impact DrSimPanel: Server (host multi-select + per-cluster N-of-M stepper) + Site (declared-stretched fault-domain picker + factual lost line)"
  - "Single in-panel Custom-Failover checkbox switching presenter view.drSim<->view.plannedDrSim (D-11, not a 3rd mode)"
  - "DrSimPanel wired into PlanningView DR slot (Plan 02 placeholder removed)"
  - "dr.json EN/FR reworked: server.*/site.*/impact.*/applyPlanned.*/empty.noStretched, no confidence.*, identical flattened key sets"
  - "DrSimPanel.test.tsx — presenter contract test (two-mode/physical/no-confidence/reversible/apply-planned/site-picker)"
affects:
  - "Phase 6 COMPLETE — final plan; no downstream Phase-6 consumers"
tech-stack:
  added: []
  patterns:
    - "presenter-only in-render projection of view.hosts (no second memo) — same idiom the shipped panel used"
    - "replace-never-mutate set-replace for the per-cluster host-count stepper"
    - "EMPTY_VIEW-as-stub-base for the presenter test (referential-stability frozen constant reused)"
key-files:
  created:
    - src/components/dr/DrSimPanel.test.tsx
  modified:
    - src/components/dr/DrSimPanel.tsx
    - src/components/planning/PlanningView.tsx
    - src/i18n/locales/en/dr.json
    - src/i18n/locales/fr/dr.json
decisions:
  - "Site picker uses radio (single fault-domain) semantics; re-picking the same site clears it (reversible/neutral, no destructive styling) — within D-08 locked intent"
  - "caveats.siteSymmetric NOT added: the frozen 06-01 runScenario only emits caveats.reservationHigh; adding an unreferenced i18n key would be dead/un-producible (calc-from-real-data — keys map to engine output only)"
  - "Open Item 1 honored: Site segment always rendered; picker replaced by the factual empty.noStretched note when zero declared-stretched (not hidden)"
  - "Open Item 2 honored: per-survivor renders the Verdict enum WORD via t(`verdict.${p.verdict}`) + the before/after physical numbers, neutral text, no traffic-light"
metrics:
  duration: ~28min
  completed: 2026-05-17
---

# Phase 6 Plan 03: Two-Mode Physical-Impact DrSimPanel + Planning DR Slot Summary

Reworked the shipped `DrSimPanel` in place to the G3 two-mode physical-impact model
(Server + Site loss only, physical CPU/RAM impact, no confidence, per-cluster host-count
stepper, Site picker with the explicit "lost — no DR target" line, in-panel
Custom-Failover toggle), wired it into the `PlanningView` DR slot (removing the Plan 02
placeholder), and reworked `dr.json` EN/FR with parity — closing the final Phase-6 plan.

## What Was Built

- **Task 1 (`a151fca`, JSDoc reword `a5f0dd4`)** — `DrSimPanel` reworked in place:
  Server loss = individual host multi-select (kept reversible checkbox + grey strike +
  `failed.chip` verbatim) AND a per-cluster `<input type="number">` "N of M" stepper
  (`replaceClusterHosts` replace-never-mutate set-replace). Site loss = a radio picker
  over the fault-domain values of the user's declared-stretched clusters + the explicit
  factual `site.lost` line for non-stretched workload physically at the picked site
  (counts via `fmt*`); Site segment always shown, picker replaced by the factual
  `empty.noStretched` note when zero declared-stretched (Open Item 1). Single gold
  `text-accent-500` figure re-pointed to physical CPU (GHz/cores) + physical RAM (MiB).
  `confidence` block deleted; assumptions + caveats kept. Single in-panel "Apply planned
  ratios" checkbox switches the presented result `view.drSim` ↔ `view.plannedDrSim`
  (D-11, not a mode tab). `DrSimPanelProps` extended with `declaredStretched`,
  `applyPlannedToDr`, `onApplyPlannedToDr`. No `useMemo` (pure presenter).
- **Task 2 (`61bfcf2`)** — `PlanningView` renders `<DrSimPanel>` in the DR slot below the
  `2xl` break (Plan 02 placeholder removed); `scenario`/`setScenario` from
  `selectScenario`/`selectSetScenario`, `declaredStretched` from
  `selectStretchedClusters`, `drMode` lifted as local state (default `'server'`),
  `applyPlannedToDr` + its setter (Plan 02 lifted flag) wired into the Custom-Failover
  affordance. `view` passed from the single `useEstateView` call — no second memo.
- **Task 3 (`4c12fb8`)** — `dr.json` EN+FR reworked: `mode.{label,server,site}`,
  `server.{legend,clusterStep,ofM}`, `site.{legend,lost}`, `impact.{cpuLabel,cores,ramLabel}`,
  `applyPlanned.{label,on,off}`, `empty.{noSelection,noStretched}`, `stat.vms`; `failed.chip`
  / `verdict.*` / `assumptions.*` / `caveats.reservationHigh` kept (content updated to the
  two-mode/physical model). No `confidence.*` / `mode.host|cluster|vcenter`. EN/FR flattened
  key sets identical (31 keys). `DrSimPanel.test.tsx` (6 tests) asserts the two-mode /
  physical-not-vCPU / no-confidence / reversible-chip / apply-planned-switch / site-picker +
  no-stretched-note + lost-line contract.

## Verification

- `npx tsc -b` (incl. the test project) → No errors
- `npx vitest run` → 319 passed / 0 failed (full suite; +6 new DrSimPanel tests vs 313 at 06-02)
- `npx @biomejs/biome check .` → clean (168 files)
- Task 1 gates: `MODES === ['server','site']`; `grep -v '^#' DrSimPanel.tsx | grep -c
  'confidence\|failedClusters\|failedVCenters\|evacueeVcpu'` == 0 (after the JSDoc reword);
  `physical|Physical` matches 6 (>0); `role="group"` == 2 (≥1); `useMemo` == 0
- Task 2 gates: `DrSimPanel` referenced in PlanningView; `useMemo` == 0; `useEstateView`
  literal count == 2 (the irreducible `import` line + the single call — see Deviation 1);
  `tsc` 0; planning+dr tests pass
- Task 3 gates: `en/fr dr.json` flattened key sets identical; no `confidence.*` /
  `mode.host|cluster|vcenter`; new keys present EN+FR; presenter test exits 0; biome clean
- Phase-wide guardrails: no `useMemo` in `src/components/dr/` or `src/components/planning/`;
  DrSimPanel wired into PlanningView; placeholder keys (`drSlotPending`/`drSlotHeading`)
  count 0 in PlanningView; `DrMode` strictly server|site; no `confidence` reintroduced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import + JSDoc prose trip literal `grep -c` acceptance gates**

- **Found during:** Task 1 (confidence), Task 2 (useEstateView)
- **Issue:** Two acceptance gates are literal token counts. Task 1's
  `grep -v '^#' DrSimPanel.tsx | grep -c 'confidence...'` == 0 was tripped by the JSDoc
  line *naming* the retired concept ("the high/med/low **confidence** grade is RETIRED").
  Task 2's `grep -c 'useEstateView' PlanningView.tsx` == 1 counts both the irreducible
  `import { useEstateView }` line AND the single call (== 2, never reducible to 1 while
  the hook is imported by name). Same JSDoc/import-trips-literal-grep class as 06-01
  deviation #3 and 06-02 deviation #1.
- **Fix:** Reworded the DrSimPanel JSDoc to "the high/med/low **scenario grade** is
  RETIRED entirely (… — D-10)" — preserves the D-10 rationale, drops the literal token;
  the Task-1 gate is now exactly 0 (commit `a5f0dd4`). For Task 2, the structural intent
  (one `useEstateView` *call*, no second `useMemo`) is verified (`useMemo` == 0, one
  `useEstateView(mode)` call, no second `buildEstateView`); the literal count of 2 is the
  unavoidable `import` + call and is documented here rather than removing a required
  import.
- **Files modified:** src/components/dr/DrSimPanel.tsx
- **Commits:** a151fca (T1), 61bfcf2 (T2), a5f0dd4 (JSDoc reword)

**2. [Plan discretion exercised] `caveats.siteSymmetric` not added**

- The plan's Task 3 says "extend `caveats.*` content for the two-mode/physical model".
  The frozen 06-01 `runScenario` only ever pushes `caveats.reservationHigh`. `caveats`
  are i18n KEY suffixes emitted by the engine; adding an i18n key the engine can never
  emit would be dead/un-producible copy and violates calc-from-real-data (keys map to
  engine output only). Kept `caveats.reservationHigh` only; updated `assumptions.*`
  content to the two-mode/physical wording instead. No engine change (06-01 is frozen).
- **Commit:** 4c12fb8

**3. [Plan discretion exercised] Site picker = radio (single fault-domain) semantics**

- D-08 locks "pick a site (stretched fault-domain)". Implemented as single-selection
  radio inputs; re-picking the same site clears it (reversible/neutral, no destructive
  styling — kept G3 idiom). Within the locked intent; the exact widget was executor
  discretion.
- **Commit:** a151fca

## Known Stubs

None. The Plan 02 DR-slot placeholder is removed; `DrSimPanel` is fully wired and renders
real `view.drSim`/`view.plannedDrSim` data. `applyPlannedToDr` is now consumed (no longer
a held-unused forward-reference). Phase 6 is complete.

## Threat Flags

None. This plan adds no network/auth/file/schema surface — it is a pure presenter rework
- in-memory store reads. T-06-10..T-06-13 mitigations hold: zero `confidence` tokens in
the panel + zero `confidence.*` keys (T-06-10); physical labels, no `vCPU`/`evacueeVcpu`
leakage, em-dash sentinel idiom retained (T-06-11); the Apply-planned toggle switches
between two distinct engine results, asserted exclusive by the presenter test (T-06-12);
no persistence/network added (T-06-13).

## Self-Check: PASSED

- src/components/dr/DrSimPanel.tsx — FOUND (two-mode physical-impact, no confidence)
- src/components/dr/DrSimPanel.test.tsx — FOUND (6 presenter contract tests)
- src/components/planning/PlanningView.tsx — FOUND (DrSimPanel wired, placeholder gone)
- src/i18n/locales/en/dr.json + fr/dr.json — FOUND (parity 31 keys, no confidence)
- .planning/phases/06-allocation-dr-re-derived/06-03-SUMMARY.md — FOUND (this file)
- Commits a151fca / 61bfcf2 / 4c12fb8 / a5f0dd4 — FOUND
