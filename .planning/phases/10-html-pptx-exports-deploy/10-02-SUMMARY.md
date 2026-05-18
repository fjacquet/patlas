---
phase: 10-html-pptx-exports-deploy
plan: 02
subsystem: export
tags: [d-08, ssr, echarts, i18n, key-parity, pure-engine, wave-1]
requires: []
provides:
  - "buildExportView — pure D-08/D-09 entrypoint (active-snapshot view + all-snapshots trends)"
  - "chartToSvg — DOM-free ECharts SSR chart→SVG string (HTML inline + PPTX raster source)"
  - "report + pptx i18n namespaces (EN+FR) + Minor-7 recursive key-parity CI gate"
affects: [10-03, 10-04, 10-05]
tech-stack:
  added: []
  patterns:
    - "Export engines clone the dashboard hook's buildEstateView call directly (no React/Zustand) — worker-safe"
    - "ECharts SSR registry replicated from Chart.tsx, light-theme only for static exports"
    - "i18n three-touch registration + recursive Object.keys deep-diff parity test over every namespace"
key-files:
  created:
    - src/engines/export/types.ts
    - src/engines/export/buildExportView.ts (+test)
    - src/engines/export/html/renderCharts.ts (+test)
    - src/i18n/locales/{en,fr}/report.json
    - src/i18n/locales/{en,fr}/pptx.json
    - src/i18n/keyParity.test.ts
  modified:
    - src/i18n/index.ts
key-decisions:
  - "buildExportView returns {view,trends}: view=buildEstateView([active]) (D-08); trends null when <2 snapshots (D-09)"
  - "ExportResponse error = hand-built {name,message} only (no spread/cause/rows — T-10-06 privacy)"
  - "Exported charts are light-theme-fixed (static shareable artifact, no dark/prefers-color-scheme)"
requirements-completed: [HTM-05, PPT-04]
duration: ~40min
completed: 2026-05-18
---

# Phase 10 Plan 02: Rasterizer-independent export spine Summary

**The shared, rasterizer-independent export spine is in: a pure D-08/D-09 `buildExportView` proven equivalent to the single-snapshot dashboard view (A2), a DOM-free `chartToSvg` SSR engine on the project's tree-shaken registry, and EN+FR `report`/`pptx` namespaces guarded by a recursive key-parity CI gate. 31/31 export+i18n tests green.**

## Accomplishments
- `buildExportView(active, all, mode, today, opts)` → `{view, trends}`: body = `buildEstateView(mergeSnapshotsToEstate([active]),…)` (D-08 active snapshot, NOT merged); trends across all snapshots, `null` when <2 (D-09). Pure — no React/Zustand/hook (acceptance grep clean). A2 proven: single-snapshot `.view` deep-equals the direct `buildEstateView` call; "active not merged" proven with a 2-snapshot fixture.
- `types.ts`: `ExportRequest`/`ExportResponse` mirroring `parseInWorker.ts`; error branch is a hand-built `{name,message}` (no spread/cause/rows — T-10-06).
- `chartToSvg(option,w,h)`: ECharts SSR (`init(null,'midnight-executive',{ssr:true}).renderToSVGString()`, guaranteed dispose), Chart.tsx registry verbatim, **light theme only** (no barrel import, no dark variant — grep-gated).
- `report.json`/`pptx.json` EN+FR from the UI-SPEC copywriting contract (factual-only, numbers via `{{interpolation}}` not pre-formatted); three-touch registered; `keyParity.test.ts` recursive deep-diff fails CI on any future EN/FR drift (Minor-7) — 16 namespaces all parity-green.

## Task Commits
1. **Task 1: pure D-08/D-09 buildExportView + A2** — `feat(10-02)` (5/5)
2. **Task 2: DOM-free chartToSvg SSR** — `feat(10-02)` (4/4)
3. **Task 3: report/pptx i18n + key-parity gate** — this commit (16/16)

## Deviations from Plan
**1. [Grep-gate gotcha] Doc-comment token rephrase.** `buildExportView.ts`'s comment originally named the dashboard hook and the literal `useEstateView`, which would trip the plan's own purity acceptance grep (`grep -lE "…useEstateView" buildExportView.ts`). Rephrased to reference the hook by role/path without the literal symbol (the documented CLAUDE.md grep-gate trap). No behavioural change; acceptance grep now clean.

No other deviations — plan executed as written; no new dependencies (supply-chain OK).

## Issues Encountered
- None functional. The `node:fs`/`@/...` IDE diagnostics are the known tsconfig-path IDE noise (`npm run typecheck` exit 0, authoritative).

## Next Plan Readiness
Plans 03 (HTML engine) and 04 (PPTX engine) consume `buildExportView`, `chartToSvg`, and the `report`/`pptx` namespaces. 10-04 also consumes 10-01's `10-SPIKE-DECISION.md` (resvg-wasm in the worker). Wave-2 (10-03, 10-04) can proceed.

---
*Phase: 10-html-pptx-exports-deploy*
*Completed: 2026-05-18*
