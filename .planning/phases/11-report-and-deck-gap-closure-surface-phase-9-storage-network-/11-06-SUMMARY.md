---
phase: 11
plan: "06"
subsystem: export
tags: [html, report, storage, network, planned, treemap, f-2, f-1]
requires:
  - "chartBundle shared.storageTreemap (11-01)"
  - "storage/network/planned i18n keys (11-02)"
provides:
  - "HTML report Storage + Network + planned sections + the storage-treemap chart slot (F-2/F-1 HTML side)"
affects:
  - src/engines/export/html/renderReport.tsx
  - src/engines/export/export.worker.ts
tech-stack:
  added: []
  patterns:
    - "Section + Metric(flag) + .annex-table + data-chart-slot idiom; TOP_N_CLUSTERS fold reused for P9 tables"
key-files:
  created: []
  modified:
    - src/engines/export/html/renderReport.tsx
    - src/engines/export/export.worker.ts
    - src/engines/export/html/renderReport.test.tsx
key-decisions:
  - "Storage+Network inserted after per-cluster / before eos; planned after dr (fixed HTM-04 order)"
  - "TOP_N_CLUSTERS fold reused for storage by-cluster/by-datastore + planned-delta tables (budget)"
  - "Worker treemap slot guarded (noUncheckedIndexedAccess) — absent ⇒ empty slot, never fabricated"
requirements-completed: [STG-01, STG-02, STG-03, STG-04, STG-05, NET-01, NET-02, NET-03, NET-04, NET-05, DTL-01, DTL-02, DTL-03, ALR-01, ALR-02, ALR-03, ALR-04, ALR-05, VSR-01, VSR-02, VSR-03, VSR-04, VSR-05, PLN-03, PLN-04]
duration: 22 min
completed: 2026-05-19
---

# Phase 11 Plan 06: HTML report P9 + planned sections Summary

Added three `<Section>`s to `renderReport.tsx` in the fixed HTM-04 order: **Storage** (provisioned/in-use/capacity GiB metrics + factual flagged-datastore `<Metric flag>` gold style + per-cluster & per-datastore `.annex-table`s under the existing `TOP_N_CLUSTERS` fold + vSAN shared-LUN as factual "shared across N clusters" + the `data-chart-slot="storage-treemap"`), **Network** (factual vSwitch/dvSwitch/portgroup/VM-adjacency rollup, no chart per D-08), and **planned** (null-guarded measured-vs-planned metrics + per-cluster `vcpuPerPcpu` delta table, F-1 HTML side). Fed the single estate treemap into the worker's HTML branch (guarded). Every user value is a plain JSX text node — the no-raw-markup React-tree invariant is preserved.

- Tasks: 3 · Files: 3 modified · Start 2026-05-19 · ~22 min

## Deviations from Plan

**[Rule 2 - Type-driven guard] Task 2 worker treemap set** — Found during: Task 2 tsc. `noUncheckedIndexedAccess` types `optBundle.shared.storageTreemap` as `EChartsOption | undefined`, so the bare `chartToSvg(...)` failed typecheck. Added the factual `if (treemap)` guard the plan explicitly sanctioned ("if added, keep it factual — skip the set, the slot renders empty, never fabricate"). Not a behavioral deviation — 11-01 threads it unconditionally so it's always present in practice.

**[Rule 1 - Test premise correction] Task 3 non-null plannedView test** — Found during: Task 3 vitest (1 fail). `buildExportView` yields `plannedView: null` unless `opts.plannedRatios` is supplied (root-caused in `estateView.ts:261`). The production export path passes them via `useExport`; the test fixture did not. Fixed the TEST (supply `{ plannedRatios: { cpuRatio: 4, ramRatio: 1 } }`) — the code is correct. This also confirms F-1's export behavior: planned section shows real data when ratios are set, the factual `.none` note otherwise.

**[Rule 1 - Biome formatter] Task 1 vsanShared JSX** — Biome reflowed the `{k} — {(...).replace(...)}` text/expression; applied `biome check --write` (Biome owns formatting project-wide). No semantic change.

**Total deviations:** 3 (1 sanctioned guard, 1 test-premise fix with code confirmed correct, 1 formatter). **Impact:** none behavioral; F-1 export-null semantics now explicitly tested both branches.

## Verification

- `npx tsc -b` → exit 0
- `npx vitest run src/engines/export/html/renderReport.test.tsx` → 9/9 (3 new sections + slot + null/non-null planned + 40-cluster budget fold)
- `npx @biomejs/biome check` → exit 0 (3 files)
- `node scripts/check-bundle-size.mjs` → OK
- Greps: 3 `<Section>`s, `data-chart-slot="storage-treemap"` ×1, P9 refs ×12, 0 DataTable import, 0 `1.048576`, 0 editorial verbs, 0 raw-markup prop, worker `charts.set('storage-treemap'` ×1, `assembleHtml.ts` unmodified, PPTX worker branch untouched

## Self-Check: PASSED

- renderReport.tsx + export.worker.ts modified; `git log --grep="11-06"` → 3 production commits (feat ×2, test)
- All task `<acceptance_criteria>` re-run green (with documented deviations); plan `<verification>` green

## Next

Phase 11 plans 01–06 all complete. Wave 2 done. Ready for phase completion + `/gsd-audit-milestone 1.0` re-audit (F-1 + F-2 closed: P9 in report+deck, plannedView rendered+exported, traceability reconciled).
