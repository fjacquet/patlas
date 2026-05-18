---
phase: 10-html-pptx-exports-deploy
plan: 04
subsystem: export
tags: [pptx, pptxgenjs, resvg-wasm, slides, golden-snapshot, wave-2]
requires: [10-01, 10-02]
provides:
  - "buildPptx — pure PPT-03 deck composition root → valid OOXML ArrayBuffer"
  - "PowerPoint-safe chartSvgToPng (resvg-wasm PNG, never SVG) + addChartImage"
  - "pptxNumber/pptxSafeFormat — locale-correct, net-new FR U+202F→U+00A0"
  - "8 pure slide modules + brand-free Midnight Executive theme/primitives"
affects: [10-05]
tech-stack:
  added: []
  patterns:
    - "Injected WasmSource keeps chartSvg.ts free of node:* (tsc -b green) — the 10-01 regression pattern"
    - "Builder takes async renderClusterChart opt: pure/sync slides, golden test wasm-free, plan-05 wires the raster"
    - "Shared slides/_layout.ts heading+metric helper (DRY — no per-slide copy-paste)"
key-files:
  created:
    - src/engines/export/pptx/theme.ts
    - src/engines/export/pptx/format.ts (+test)
    - src/engines/export/pptx/primitives/{colors,kpiCard,progressBar,chartSvg}.ts (chartSvg +test)
    - src/engines/export/pptx/slides/{_layout,titleSlide,overviewSlide,clusterSlide,contentionAnnex,eosSlide,drSimSlide,trendsSlide,inventorySlide}.ts
    - src/engines/export/pptx/builder.ts (+test)
key-decisions:
  - "chartSvgToPng = @resvg/resvg-wasm w/ injected WasmSource (10-SPIKE-DECISION); addChartImage emits image/png ONLY"
  - "FR U+202F→U+00A0 substitution lives ONLY in pptx/format.ts; special code points via String.fromCharCode (no literal in source)"
  - "One slide per cluster ALWAYS (D-01, no cap); trends slide iff trends non-null (D-09); CPU-Ready annex conditional"
  - "buildPptx(view,trends,strings,locale,opts?) — added optional opts (async chart raster + contention rows): justified refinement so the builder stays pure & golden test wasm-free"
requirements-completed: [PPT-01, PPT-02, PPT-03, PPT-04]
duration: ~70min
completed: 2026-05-18
---

# Phase 10 Plan 04: PPTX deck engine Summary

**`buildPptx` produces a valid OOXML deck in the fixed PPT-03 order — one slide per cluster always (D-01), trends conditional (D-09), every chart a PowerPoint-renderable PNG (never SVG — Pitfall 1), locale-correct numbers incl. the net-new FR U+202F→U+00A0 substitution. 59/59 export+i18n tests, supply/bundle green.**

## Accomplishments
- Brand-free Midnight Executive `theme.ts`/`primitives` (sRGB hex, no `#` — pptxgenjs convention; P9 source-of-truth values).
- `format.ts`: `pptxNumber`/`pptxSafeFormat` — locale-param, em-dash on non-finite, the NET-NEW FR narrow→regular no-break-space substitution + control-char strip (Moderate-8); special code points via `String.fromCharCode` so no literal U+202F/U+00A0/control char appears in source.
- `chartSvg.ts`: locked `chartSvgToPng(svg,w,h,wasmSource)` via `@resvg/resvg-wasm` (10-SPIKE-DECISION; injected WasmSource ⇒ no `node:*`, `tsc -b` green) + `addChartImage` (image/png ONLY — grep-asserted no SVG-mime).
- 8 pure typed slide modules (4 ported-fresh + 4 net-new) on a shared DRY `_layout` helper; factual-only, no React/Zustand/translation runtime.
- `builder.ts` pure composition root: fixed PPT-03 order, one slide per cluster (D-01 no cap), trends iff non-null (D-09), conditional contention annex; valid `PK\x03\x04` OOXML; both-locale golden structural snapshot.

## Task Commits
1. **Task 1: theme/format/primitives/chartSvg** — `feat(10-04)` + `fix(10-04)` (strict-index) (7+3 tests)
2. **Task 2: 8 slide modules + _layout** — `feat(10-04)` (typecheck/purity clean)
3. **Task 3: builder + golden snapshot** — this commit (5/5 → 59/59 export+i18n)

## Deviations from Plan
**1. [Rule-17 helper] `slides/_layout.ts`** added (not in files_modified) — the shared heading+metric idiom; the alternative is the same ~6 lines copied into 7 slides (CLAUDE.md forbids copy-paste). Small, justified.
**2. [Signature refinement] `buildPptx(..., opts?)`** — optional `{ renderClusterChart, contentionRows }`. Chart raster is async + wasm-dependent; making it an injected opt keeps the builder a pure composition root and the golden structural test wasm-free (plan 05's worker injects the real ECharts→resvg raster + the contention rows). Honors 10-SPIKE-DECISION (raster wired in plan 05).
**3. [Grep-gate gotcha ×2]** `chartSvg.ts` doc-comment rephrased to drop the literal `svg+xml`; `titleSlide.ts` comment rephrased to drop the literal `i18next` — both would trip the plan's own acceptance greps (documented CLAUDE.md trap).
**4. [Both-locale golden]** interpreted as: build EN+FR, assert valid OOXML + identical structure (locale never changes slide structure); per-locale number correctness is proven directly by `format.test.ts` (redundant to re-assert inside the zip).

No new dependencies; supply-chain + bundle-size green.

## Issues Encountered
- One strict-index typecheck error in `chartSvg.test.ts` (noUncheckedIndexedAccess) — fixed forward (`fix(10-04)`). `@/...` IDE diagnostics are the known tsconfig-path noise (`npm run typecheck` exit 0 authoritative).

## Next Plan Readiness
10-05 (worker + ExportButtons + App wiring + DEP verification) consumes `assembleHtml` (10-03) and `buildPptx` (10-04), wiring the real ECharts→`chartSvgToPng` raster + same-origin Vite wasm URL into the export worker, and resolving the `checkpoint:human-verify` (a real exported .html + .pptx opened by a human).

---
*Phase: 10-html-pptx-exports-deploy*
*Completed: 2026-05-18*
