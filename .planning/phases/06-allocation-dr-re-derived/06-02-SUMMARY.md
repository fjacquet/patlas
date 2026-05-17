---
phase: 06-allocation-dr-re-derived
plan: 02
subsystem: planning-surface (ViewToggle 4th segment + planned-ratios control)
tags: [view-toggle, planned-ratios, zustand-slice, no-url-hash, single-memo, i18n-parity, d-03-separation]
requires:
  - "06-01 plannedRatios Zustand slice + selectPlannedRatios/selectSetPlannedRatios"
  - "06-01 buildEstateView plannedView/plannedDrSim composition + DR two-mode contract"
  - "shipped P3/P5 ViewToggle fieldset/aria-pressed idiom + P5 hosts-segment precedent"
provides:
  - "AppView union + VIEWS array 4th 'planning' segment (App-routed, accent-gold active)"
  - "PlanningView shell — useEstateView consumed once, planned block + 2xl break + DR slot for Plan 03"
  - "PlannedRatiosControl — preset buttons fill editable numeric field, Zustand-backed, zero URL-hash/localStorage"
  - "alloc.json planned.* i18n group (EN+FR parity); inventory.json nav.planning (EN+FR parity)"
  - "applyPlannedToDr flag lifted as PlanningView component state (default false) for Plan 03 (D-11)"
affects:
  - "Plan 06-03 (DrSimPanel full rework lands in the PlanningView DR slot; consumes applyPlannedToDr)"
tech-stack:
  added: []
  patterns:
    - "preset-fills-editable-numeric (no slider widget) — D-05"
    - "in-memory Zustand slice only, killed URL-hash codec structurally excluded — D-06"
    - "structurally-separate labelled surfaces for planned vs measured (D-03), not just wording"
key-files:
  created:
    - src/components/planning/PlannedRatiosControl.tsx
    - src/components/planning/PlanningView.tsx
  modified:
    - src/components/ViewToggle.tsx
    - src/App.tsx
    - src/components/dashboard/GlobalDashboard.tsx
    - src/i18n/locales/en/inventory.json
    - src/i18n/locales/fr/inventory.json
    - src/i18n/locales/en/alloc.json
    - src/i18n/locales/fr/alloc.json
decisions:
  - "Task ordering: committed Task 2 (self-contained new components) before Task 1 (App import wiring) so each commit compiles standalone — App.tsx imports PlanningView, so the component must exist first"
  - "Open Item 1/2 (Site-loss disabled-state, Verdict word) are DrSimPanel concerns deferred to Plan 03 — this plan only builds the shell + DR slot placeholder, no DR rework"
  - "applyPlannedToDr held with `void` to satisfy strict no-unused-locals until Plan 03 wires the DR slot"
metrics:
  duration: ~14min
  completed: 2026-05-17
---

# Phase 6 Plan 02: Planning Surface (ViewToggle 4th segment + planned-ratios control) Summary

Shipped the new top-level "Planning" surface: extended the shipped ViewToggle to a 4th
`planning` segment, built the `PlanningView` shell + the in-memory preset+numeric
`PlannedRatiosControl` that replaces the killed slider/URL-hash mechanism, App-routed it,
and stripped `AllocationSliders` + `useAllocationHash` + `DrSimPanel` from the Dashboard —
all on the 06-01 spine with zero greenfield rewrites.

## What Was Built

- **Task 1** — `AppView` union + `VIEWS` array gain `'planning'` (the generic
  fieldset/legend/aria-pressed/Arrow-key/wraparound idiom + accent-gold active style +
  CI-gated literal `role="group"` kept verbatim — P5 `hosts`-segment precedent). `App.tsx`
  view switch routes `activeView === 'planning'` to `<PlanningView />`. `inventory.json`
  `nav.planning` EN ("Planning") + FR ("Planification") with identical `nav` key sets.
- **Task 2** — `PlannedRatiosControl`: the `<fieldset role="group">`+`aria-pressed`
  segmented preset group + `matchesPreset` reused verbatim (presets 1:1/4:1/8:1/VDI 10:1,
  `h-8`, `bg-primary-600 text-white` active — NOT accent); the two `<input type="range">`
  replaced by one `<input type="number">` each for CPU/RAM; clicking a preset fills the
  field via `setPlannedRatios`, off-preset typing clears the active preset. State source is
  the in-memory `plannedRatios` Zustand slice via `selectPlannedRatios`/
  `selectSetPlannedRatios` ONLY — no URL-hash codec, no localStorage (D-06). `PlanningView`
  consumes `useEstateView` exactly once (no 2nd memo), heading "Capacity planning —
  what-if", the planned-ratios block above a `2xl` (48px) break, then a labelled DR slot
  placeholder for Plan 03; a read-only "measured" caption points at Dashboard › Operational
  Insights (D-03 structural separation, never rebuilt — D-01/D-02). `applyPlannedToDr`
  lifted as component state (default false) for Plan 03's affordance (D-11). `alloc.json`
  `planned.*` group EN+FR with identical flattened key sets.
- **Task 3** — Removed `AllocationSliders` import+render, `useAllocationHash` import+state,
  and the `DrSimPanel` import+render block from `GlobalDashboard`; `useEstateView(mode)` now
  called without the `ratios` arg (engine default measured path). Removed the now-unused
  `scenario`/`setScenario`/`drMode`/`setDrMode` local state; kept the `stretchedClusters`
  wiring (per-cluster pill stays on the Dashboard). `AllocationSliders.tsx`/`DrSimPanel.tsx`
  files NOT deleted (Plan 03 reworks `DrSimPanel`; `AllocationSliders` cleanup is Plan 03
  scope). Dashboard still renders summary/insights/donut/columns/cpu-ready unchanged.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors
- `npx vitest run` → 313 passed / 0 failed (full suite, incl. `src/components/dashboard`)
- `npx @biomejs/biome check` on all 9 modified/created files → clean
- Task 1 gates: `AppView`/`VIEWS` contain `'planning'`; App routes it; `nav.planning`
  EN+FR with identical `nav` key sets; `grep -c 'role="group"' ViewToggle.tsx` == 3 (≥1)
- Task 2 gates: `<input type="number">` present (no `type="range"`); url-hash gate
  `grep -v '^#' | grep -c 'useAllocationHash\|location.hash\|history.replaceState\|localStorage'`
  == 0; `selectPlannedRatios` wired; `grep -rc 'useMemo' src/components/planning/` == 0;
  `en/fr alloc.json` flattened key sets identical
- Task 3 gates: `grep -c 'AllocationSliders\|useAllocationHash\|DrSimPanel' GlobalDashboard.tsx`
  == 0; `grep -c 'useMemo' GlobalDashboard.tsx` == 0; `useEstateView` called once without
  `ratios` arg

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDoc prose tripped two literal grep acceptance gates**
- **Found during:** Task 2
- **Issue:** The url-hash gate (`grep -v '^#' … | grep -c 'useAllocationHash\|…\|localStorage'` == 0)
  and the planning-dir memo gate (`grep -rc 'useMemo' src/components/planning/` == 0) are
  literal token counts. `grep -v '^#'` only strips lines starting with a literal `#`, so
  explanatory JSDoc that *names the anti-pattern to forbid it* (`NO \`useAllocationHash\`,
  NO localStorage` in `PlannedRatiosControl`; `no second \`useMemo\`` in `PlanningView`)
  counted against the gate even though no such call/import exists. Same class as 06-01
  deviation #3 (JSDoc tripping a structural grep gate).
- **Fix:** Reworded both JSDoc blocks to preserve the privacy/single-memo rationale
  ("the killed URL-hash codec and any browser-storage write are structurally excluded";
  "no second memoization hook") without the literal trigger tokens. The structural intent
  of each gate (no URL-hash/localStorage mechanism imported; no second memo call) holds —
  verified by re-running both gates → 0.
- **Files modified:** src/components/planning/PlannedRatiosControl.tsx, src/components/planning/PlanningView.tsx
- **Commit:** dbb65a0

**2. [Plan discretion exercised] Commit ordering Task 2 before Task 1**
- The plan lists Task 1 (ViewToggle + App import of `PlanningView`) before Task 2
  (creates `PlanningView`). `App.tsx` cannot compile without `PlanningView` existing, so
  committing Task 1 first would yield a non-compiling commit. Committed the self-contained
  new components (Task 2) first, then the App wiring (Task 1), then Task 3 — each commit
  compiles standalone. No behavioural change; only commit sequencing.
- **Commits:** dbb65a0 (T2), 2876a91 (T1), 5287676 (T3)

## Known Stubs

The Planning DR slot is an intentional labelled placeholder (`planned.drSlotHeading` /
`planned.drSlotPending`), explicitly scoped to Plan 06-03 per the plan's Task 2 action
("a slot below for the reworked DrSimPanel (Plan 03 fills this … render a placeholder
section")  and 06-CONTEXT D-04/D-07. `applyPlannedToDr` is intentionally held as unused
component state (D-11) for Plan 03 to consume. These are documented forward-references,
not goal-blocking stubs — the Plan 02 goal (4th segment + planned-ratios control +
Dashboard cleanup) is fully achieved.

## Self-Check: PASSED

- src/components/planning/PlannedRatiosControl.tsx — FOUND (preset+numeric, Zustand-backed)
- src/components/planning/PlanningView.tsx — FOUND (shell, single useEstateView, DR slot)
- src/components/ViewToggle.tsx — FOUND ('planning' in union+array)
- src/App.tsx — FOUND ('planning' branch → PlanningView)
- src/components/dashboard/GlobalDashboard.tsx — FOUND (killed mechanism removed)
- .planning/phases/06-allocation-dr-re-derived/06-02-SUMMARY.md — FOUND (this file)
- Commit dbb65a0 — FOUND
- Commit 2876a91 — FOUND
- Commit 5287676 — FOUND
