---
phase: 11
plan: "04"
subsystem: ui
tags: [planning, f-1, plannedView, presenter, i18n]
requires: []
provides:
  - "PlannedEstatePanel — the first non-test reader of view.plannedView (F-1 screen side resolved)"
affects:
  - src/components/planning/PlanningView.tsx
tech-stack:
  added: []
  patterns:
    - "Pure { view }-prop presenter mirroring DrSimPanel (Stat row, null-guard ternary, no hook/memo/engine)"
key-files:
  created:
    - src/components/planning/PlannedEstatePanel.tsx
  modified:
    - src/components/planning/PlanningView.tsx
    - src/i18n/locales/en/alloc.json
    - src/i18n/locales/fr/alloc.json
key-decisions:
  - "Direct view.plannedView references (matches plan <action> + satisfies the proxy) rather than an alias; TS narrows across the ternary since reads are outside the .map callback"
  - "Absence-of-invariant doc-comment phrased WITHOUT literal useMemo/useEstateView tokens (CLAUDE.md grep-gate gotcha)"
requirements-completed: [PLN-03, PLN-04]
duration: 14 min
completed: 2026-05-19
---

# Phase 11 Plan 04: PlannedEstatePanel (F-1 screen side) Summary

Created `PlannedEstatePanel` — a pure `{ view }`-prop presenter mirroring `DrSimPanel` exactly (copied `Stat` row, null-guard ternary, `useTranslation('alloc')` + `i18n.language`, `fmtInt` formatting) that renders measured-vs-planned estate (`view.globals` vs `view.plannedView`) plus a per-cluster `vcpuPerPcpu` delta — and mounted it in `PlanningView` inside the existing `ErrorBoundary`/single-`useEstateView` surface, structurally separated like the DR block. `view.plannedView` now has a non-test reader: F-1's dead projection is a live on-screen feature. Added matched `plannedEstate` alloc i18n block EN+FR.

- Tasks: 3 · Files: 4 (1 created, 3 modified) · Start 2026-05-19 · ~14 min

## Deviations from Plan

**[Rule 1 - Criterion-proxy imprecision] Task 1 `view.plannedView ≥ 2`** — Found during: Task 1 gate. Initial alias `const planned = view.plannedView` (the DrSimPanel idiom) yielded grep-count 1. Rewrote to direct `view.plannedView` references matching the plan's own `<action>` wording (TS narrowing holds across the ternary since every `view.plannedView.*` read is outside the `.map` callback). Count now 5. No functional change.

**[Rule 1 - grep-gate gotcha] Task 1 `useMemo`/`useEstateView` == 0** — Found during: Task 1 gate. The doc-comment documenting the invariants' *absence* literally contained `useMemo`/`useEstateView`, tripping the count (CLAUDE.md known gotcha). Rephrased the comment without the literal tokens; code unchanged. Counts now 0.

**[Rule 1 - Criterion-proxy imprecision] Task 2 `useEstateView` == exactly 1** — Found during: Task 2 gate. `grep -c` returns 2 (the mandatory `import` line + the single call) — was 2 before this change too; the criterion didn't account for the import. The true invariant (no *second* hook call, no second useMemo) is satisfied: exactly one `useEstateView(` call site at PlanningView.tsx:54, `useMemo` 0, `<PlannedEstatePanel view={view} />` passes the existing result.

**Total deviations:** 3 auto-fixed/clarified (all criterion-proxy imprecision or the documented grep-gate gotcha — zero behavioral deviation). **Impact:** none — component is a pure single-`useEstateView` prop-consumer exactly as specified.

## Verification

- `npx tsc -b` → exit 0
- `npx vitest run src/i18n/keyParity.test.ts` → 16/16 (alloc EN↔FR parity green)
- `npx @biomejs/biome check` → clean (PlannedEstatePanel.tsx, PlanningView.tsx, both alloc.json)
- `view.plannedView` non-test reader present (PlannedEstatePanel, 5 refs); single `useEstateView(` call-site; 0 `useMemo`; 0 `@/engines`; 0 `1.048576`; 0 editorial verbs; alloc paths identical EN↔FR; denylist clean

## Self-Check: PASSED

- `src/components/planning/PlannedEstatePanel.tsx` exists; `git log --grep="11-04"` → 3 production commits (feat ×3)
- All task `<acceptance_criteria>` re-run green (with documented proxy clarifications); plan `<verification>` green

## Next

Ready for Wave 2 (11-05 PPTX, 11-06 HTML) — they carry `view.plannedView` into the exports (F-1 export side) and surface P9 (F-2). Wave-1 contracts `shared.storageTreemap` (11-01) + Storage/Network/planned i18n (11-02) are in place.
