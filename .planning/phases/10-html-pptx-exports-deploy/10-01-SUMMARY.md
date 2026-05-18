---
phase: 10-html-pptx-exports-deploy
plan: 01
subsystem: export
tags: [spike, resvg-wasm, pptxgenjs, echarts-ssr, web-worker, wave-0]
requires: []
provides:
  - "Proven DOM-free SVG→PNG mechanism (@resvg/resvg-wasm) for PPTX charts"
  - "Empirical pptxgenjs worker-safety (worker AND main-thread both valid)"
  - "10-SPIKE-DECISION.md — the binding rasterizer + pptxgenjs-location contract for plans 02/04"
affects: [10-02, 10-04]
tech-stack:
  added: ["@resvg/resvg-wasm@^2.6.2", "pptxgenjs@^4.0.1"]
  patterns:
    - "Heavy echarts/resvg imports confined to one file (parser.worker.ts chunk discipline) — spike absent from dist"
    - "Injected WasmSource keeps app-compiled engine code free of node:* (tsc -b stays green)"
key-files:
  created:
    - src/engines/export/spike/svgToPng.spike.ts
    - src/engines/export/spike/svgToPng.spike.test.ts
    - .planning/phases/10-html-pptx-exports-deploy/10-SPIKE-DECISION.md
key-decisions:
  - "Rasterizer = @resvg/resvg-wasm in the export Web Worker (user-locked)"
  - "pptxgenjs runs in the export Web Worker (worker-safe proven; main-thread documented fallback)"
  - "chartSvgToPng(svg,width,height)=>Promise<Uint8Array> signature locked for plan 04"
requirements-completed: [PPT-01, PPT-02]
duration: ~50min
completed: 2026-05-18
---

# Phase 10 Plan 01: Wave-0 SVG→PNG rasterizer spike Summary

**The single genuine Phase-10 unknown is resolved: `@resvg/resvg-wasm` rasterizes ECharts-SSR SVG (treemap + heatmap) to valid PNGs with no DOM, and `pptxgenjs@4.0.1` emits a valid `.pptx` from a Web Worker — both locked into 10-SPIKE-DECISION.md for plans 02/04.**

## Accomplishments
- ECharts SSR (`init(null,…,{ssr:true}).renderToSVGString()`) proven DOM-free for the two hardest charts, reusing the Chart.tsx tree-shaken registry verbatim.
- `@resvg/resvg-wasm` → valid PNG (signature + length) for treemap & heatmap, zero `document`/`window` (6/6 jsdom tests).
- Playwright probe (user-approved env adaptation — jsdom lacks OffscreenCanvas/Worker): pptxgenjs valid OOXML `PK\x03\x04` from **both** Worker (44734 B) and main thread (44738 B). Option B (OffscreenCanvas) shown DOM-bound in Chromium (`createImageBitmap(svgBlob)` rejected).
- 4 gates green with the new deps: supply-chain OK, npm audit 0 vulns, bundle-size OK (spike not in dist), xlsx pin byte-exact.
- Decision locked: resvg-wasm + pptxgenjs both in the export worker.

## Task Commits
1. **Task 1: resvg-wasm SVG→PNG spike** — `feat(10-01)`
2. **Task 2: build-safe wasm injection + Playwright probe + gates** — `fix(10-01)`
3. **Task 3: 10-SPIKE-DECISION.md** — this commit

## Deviations from Plan
**1. [Env adaptation — user-approved] Option B + worker probe via Playwright, not jsdom.** The plan prescribed `npm run test:run` for the OffscreenCanvas path and the pptxgenjs-in-worker probe; jsdom/node has no `OffscreenCanvas`/`Worker`. User chose: prove option A in the jsdom suite (fully testable), validate option B + pptxgenjs-worker via the already-wired Playwright harness. Option A is the chosen mechanism so the core acceptance is met in-suite; B/worker evidence is recorded in 10-SPIKE-DECISION.md.

**2. [Rule 2 — Regression caught in Task 2] node:* imports broke `tsc -b`.** The spike's `node:fs`/`node:module` imports failed the browser app build (`tsconfig.app.json` has no @types/node). Refactored `svgToPngResvg` to take an injected `WasmSource`; the node-typed test supplies bytes. App build exit 0; this is the binding pattern recorded for plans 02/04.

## Issues Encountered
- jsdom `createImageBitmap`/`OffscreenCanvas`/`Worker` undefined — handled via the user-approved Playwright adaptation.
- pptxgenjs raw-ESM import via Vite-served node_modules hit a jszip interop error; the self-contained UMD bundle (`pptxgen.bundle.js`) under `importScripts` + `window=self` shim probed cleanly (worker AND main-thread valid).

## Next Plan Readiness
10-SPIKE-DECISION.md is the binding contract. Plan 04 implements `chartSvgToPng(svg,w,h)=>Promise<Uint8Array>` via resvg-wasm in the export worker; plan 02 builds that worker (parser.worker.ts pattern). Plan 02 is wave-1 and can proceed.

---
*Phase: 10-html-pptx-exports-deploy*
*Completed: 2026-05-18*
