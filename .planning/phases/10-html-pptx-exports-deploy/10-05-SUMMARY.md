---
phase: 10-html-pptx-exports-deploy
plan: 05
subsystem: export
tags: [web-worker, useExport, ExportButtons, dep, self-verified, wave-3]
requires: [10-03, 10-04]
provides:
  - "export.worker.ts — fetchGuard-first worker: buildExportView → assembleHtml / buildPptx → transferable bytes"
  - "useExport — main-thread driver (store/i18n/D-05 resolved off-worker, sonner toast, Blob download)"
  - "ExportButtons — two header buttons (ThemeToggle idiom) wired into App.tsx"
  - "DEP-VERIFICATION.md — DEP-01/DEP-02 confirmed (no CI authoring)"
affects: []
tech-stack:
  added: []
  patterns:
    - "workerEnv.ts side-effect import 2nd (after fetchGuard) — ESM-safe window shim before react-dom/echarts/pptxgenjs eval"
    - "Relative worker URL (not @/ alias) for Vite worker static-analysis (parseInWorker precedent)"
key-files:
  created:
    - src/engines/export/export.worker.ts
    - src/engines/export/workerEnv.ts
    - src/hooks/useExport.ts (+test)
    - src/components/ExportButtons.tsx (+test)
    - src/engines/export/DEP-VERIFICATION.md
  modified:
    - src/App.tsx
    - src/engines/export/html/renderReport.tsx (exportChartSlots helper)
key-decisions:
  - "Whole synthesis in the worker (10-SPIKE-DECISION): HTML+chart-SVG+resvg-PNG+pptxgenjs all worker-side"
  - "window shim moved to a side-effect module imported 2nd — inline statement runs too late (ESM hoist)"
  - "useExport worker URL = relative path; @/ alias fails Vite worker bundling"
  - "checkpoint:human-verify self-verified via Playwright per user direction"
requirements-completed: [HTM-01, PPT-01, DEP-01, DEP-02]
duration: ~75min
completed: 2026-05-18
---

# Phase 10 Plan 05: Export worker + UI wiring + DEP — Summary

**The click→download path is live and self-verified end-to-end in a real browser: Export HTML yields a self-contained offline `.html` (16 inline SVG charts, 7 sections, D-05 name); Export PPTX yields a valid OOXML deck (24 slides, embedded PNG charts — resvg-wasm worked in the worker, Pitfall-1 satisfied). DEP-01/DEP-02 confirmed by the existing pipeline. 67/67 export+i18n+hook+component tests.**

## Accomplishments
- `export.worker.ts`: fetchGuard FIRST, `workerEnv` shim SECOND, then heavy imports; `buildExportView` → HTML (`assembleHtml` + chart SVGs keyed by `exportChartSlots`) or PPTX (`buildPptx` with the resvg `renderClusterChart`, same-origin Vite wasm); transferable bytes; hand-built error only.
- `useExport`: singleton worker, ALL store/i18n/D-05-filename resolved on the main thread (Pitfall 2), sonner toast lifecycle, Blob download; pure `exportFilename` (D-05/T-10-19) tested.
- `ExportButtons`: ThemeToggle fieldset idiom pixel-identical, busy spinner, gated `hasSnapshots`, wired in `App.tsx` between ViewToggle and Language.
- `DEP-VERIFICATION.md`: static.yml steps line-cited, `base:'/vatlas/'`, recent green runs; workflow byte-unchanged.

## Self-verification (Playwright — checkpoint:human-verify automated per user)
- **HTML**: `vatlas_spvspherevc11_ad_net_fr_ch_2026-05-18.html`, `<!doctype html>` + CSP `default-src 'none'`, 16 `<svg>` charts inline, no `<script>`, no fetchable http(s), sections cover/headlines/per-cluster/eos/dr/annex/methodology, trends omitted (1 snapshot — D-09), 68 KB ≪ 5 MB.
- **PPTX**: valid OOXML (`PK\x03\x04`, opens without Repair), 24 slides (title+overview + per-cluster D-01 + eos/drSim/inventory), embedded `ppt/media/image-*-1.png` real PNG chart images (`‰PNG`+IHDR — resvg-wasm rasterization worked in the worker; charts are PNG not SVG — Pitfall 1), correct D-05 filename, ~369 KB.

## Task Commits
1. **Task 1: worker + useExport** — `feat(10-05)` + `fix(10-05)` (workerEnv shim, relative URL)
2. **Task 2: ExportButtons + App** — `feat(10-05)`
3. **Task 3: DEP-VERIFICATION** — `docs(10-05)`
4. **Task 4: human-verify** — self-verified via Playwright (this commit)

## Deviations from Plan
**1. [Integration fix] `workerEnv.ts` (not in files_modified).** First browser run hit `ReferenceError: window is not defined` — ESM hoists imports above an inline shim statement, so react-dom/server / zrender / pptxgenjs evaluated before it. Moved the shim into a no-import side-effect module imported 2nd (after fetchGuard). Required for the worker to load at all.
**2. [Vite-bundling fix] relative worker URL.** `new URL('@/…', import.meta.url)` does not bundle as a worker in Vite; switched to the relative path (matches the shipped `parseInWorker.ts`).
**3. [renderReport re-touch] `exportChartSlots`** added (10-03 file) — single source of the chart-slot ids the worker needs for the HTML ChartMap; re-deriving sort+slug+N elsewhere would drift.
**4. [Self-verify method]** the human-verify checkpoint was automated via Playwright (user-directed): both real artifacts captured from the live click→worker→Blob path and structurally validated. One harness note: a Vite dev full-reload (source edits mid-session — the documented `vatlas-uat-vite-reload-trap` memory) wiped the loaded snapshot once; re-uploaded and re-verified — not a product defect.

## Issues Encountered
- Two self-verify capture-method bugs of my own (fetch(blob:) blocked by CSP/fetchGuard; a regex that missed pptxgenjs's `image-{id}-1.png` media naming → a false "0 PNG charts" that was disproven on closer inspection). No product defects.

## Phase 10 status
5/5 plans complete. The export loop ("the report is the product") is shipped and proven end-to-end; DEP confirmed. Ready for phase verification/transition.

---
*Phase: 10-html-pptx-exports-deploy*
*Completed: 2026-05-18*
