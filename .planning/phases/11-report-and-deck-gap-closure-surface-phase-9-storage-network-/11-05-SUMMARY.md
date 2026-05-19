---
phase: 11
plan: "05"
subsystem: export
tags: [pptx, storage, network, planned, slides, f-2, f-1]
requires:
  - "chartBundle shared.storageTreemap (11-01)"
  - "storage/network/planned i18n keys (11-02)"
provides:
  - "PPTX deck Storage + Network + Planned slides (F-2 deck side + F-1 deck side)"
affects:
  - src/engines/export/pptx/builder.ts
tech-stack:
  added: []
  patterns:
    - "_layout-only slide modules (eosSlide/drSimSlide analog); builder fixed-order insertion at D-05 positions"
key-files:
  created:
    - src/engines/export/pptx/slides/storageSlide.ts
    - src/engines/export/pptx/slides/networkSlide.ts
    - src/engines/export/pptx/slides/plannedSlide.ts
  modified:
    - src/engines/export/pptx/builder.ts
    - src/engines/export/pptx/builder.test.ts
key-decisions:
  - "Storage+Network inserted after the per-cluster loop, before the conditional annex (D-05); Planned after addDrSimSlide with the other re-aggregation"
  - "Network = KPI-only, no chart (D-08); Storage flagged KPI = counts.ds+counts.lu, gold addHeader rule only (D-06, no verdict)"
  - "Worker untouched — png('storageTreemap') resolves the 11-01 shared key via the existing generic raster loop"
requirements-completed: [STG-01, STG-02, STG-03, STG-04, STG-05, NET-01, NET-02, NET-03, NET-04, NET-05, ALR-01, ALR-02, ALR-03, ALR-04, ALR-05, VSR-01, VSR-02, VSR-03, VSR-04, VSR-05, PLN-03, PLN-04]
duration: 16 min
completed: 2026-05-19
---

# Phase 11 Plan 05: PPTX Storage/Network/Planned slides Summary

Added three `_layout`-only PPTX slide modules — `addStorageSlide` (KPI row provisioned/in-use/capacity GiB + factual flagged-datastore count + the 11-01 `storageTreemap` chart panel), `addNetworkSlide` (KPI-only, no chart per D-08), `addPlannedSlide` (null-guarded measured-vs-planned KPI row, F-1 deck side) — copied verbatim from the `eosSlide`/`drSimSlide` shape. Wired into `builder.ts` at the D-05 positions (Storage+Network after the per-cluster loop / before the conditional annex; Planned after `addDrSimSlide`). Branded MiB→GiB via `Math.round(Number(x)/1024)`. Extended the golden-structure test (+3 every count + a Storage/Network/Planned presence assertion). No `export.worker.ts` edit — `png('storageTreemap')` resolves the 11-01 shared key through the existing generic raster loop.

- Tasks: 4 · Files: 5 (3 created, 2 modified) · Start 2026-05-19 · ~16 min

## Deviations from Plan

None - plan executed exactly as written. (Golden-test counts updated +3 across all five assertions as the plan anticipated; new `it('F-2/F-1: deck carries Storage, Network and Planned slides')` asserts the three slide titles in the OOXML text + the count formula.)

## Verification

- `npx tsc -b` → exit 0
- `npx vitest run src/engines/export/pptx/builder.test.ts` → 6/6 (incl. +3 golden counts 14/15/16/58/12/13 and the new presence test)
- `npx @biomejs/biome check` → clean (5 files)
- `node scripts/check-bundle-size.mjs` → OK (no new echarts registration — 11-01)
- `git diff --name-only` does NOT list `src/engines/export/export.worker.ts` (worker owned by 11-06)
- Per-task greps: addStorageSlide/addNetworkSlide/addPlannedSlide each exported once; network has no `addChartPanel`/`chartPng`; planned has the `=== null`→`addNote` guard; builder has `png('storageTreemap')` ×1 + all three calls; 0 `s.addText`/`s.addShape`; 0 editorial verbs; MiB→GiB `/1024` form ×3

## Self-Check: PASSED

- 3 slide files exist; `git log --grep="11-05"` → 1 production commit (feat)
- All task `<acceptance_criteria>` re-run green; plan `<verification>` green

## Next

Ready for 11-06 (HTML report sections + treemap slot — F-2 HTML side + F-1 HTML side). Deck side of F-2/F-1 is closed.
