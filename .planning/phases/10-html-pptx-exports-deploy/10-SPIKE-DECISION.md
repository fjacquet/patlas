# Phase 10 — Wave-0 Spike Decision (BINDING for plans 02 & 04)

**Decided:** 2026-05-18 · `checkpoint:decision` (10-01 Task 3) · user-locked
**Status:** LOCKED — plans 02 and 04 implement against this; they do NOT re-decide.

---

## 1. SVG→PNG rasterizer: `@resvg/resvg-wasm`

PowerPoint clients do not render embedded SVG (RESEARCH Pitfall 1, verified),
so PPTX charts must be rasterized to PNG. The chosen mechanism is
**`@resvg/resvg-wasm`** (WASM, DOM-free), running **in the export Web Worker**.

**Task-1 evidence (jsdom, `npm run test:run -- src/engines/export/spike`, 6/6 green):**
- ECharts SSR (`echarts.init(null,'midnight-executive',{renderer:'svg',ssr:true,w,h}).renderToSVGString()`) produces a valid SVG string for the two visually-hardest charts (treemap + heatmap) with **no DOM**.
- `@resvg/resvg-wasm` rasterizes both SVGs to valid PNGs (8-byte signature `89 50 4E 47 0D 0A 1A 0A`, length > 1 KB) with **no `document`/`window`** (source-asserted).
- Rejected alternative — **OffscreenCanvas**: the Playwright probe showed `createImageBitmap(new Blob([svg]))` raises `InvalidStateError: source image could not be decoded` in Chromium; the only working browser SVG→raster path is an `<img>`-element load = DOM-bound + main-thread, which defeats the worker-offload goal. Zero-dep but mechanically inferior.

**Added dependency:** `@resvg/resvg-wasm@^2.6.2` (resolved 2.6.2).

**Gate results (Task 2, all green with the dep installed):**
| Gate | Result |
|------|--------|
| `node scripts/check-supply-chain.mjs` | `check-supply-chain: OK` (exit 0) — telemetry denylist clean |
| `npm audit --audit-level=low` | `found 0 vulnerabilities` (exit 0) |
| `node scripts/check-bundle-size.mjs` | OK (exit 0) — echarts chunk 269.8 KiB ≤ 300; **spike is NOT in `dist/`** (heavy echarts/resvg imports confined to the spike file → production bundle unaffected) |
| xlsx SheetJS tarball pin | byte-exact: `grep -c "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz" package.json` = **1**, value unchanged (line moved 37→39 only because two deps sort before it) |
| OSV | runs in CI (`static.yml` `osv-scanner`, green on PR #2, every push); local equivalent = npm audit + supply-chain above |

**WASM loading (privacy):** the wasm binary is provided to `initWasm` as injected
bytes/URL — never a remote network fetch (privacy invariant; the guard throws on
non-same-origin fetch). The spike injects node-fs bytes from the test; plans 02/04
supply a Vite-bundled `new URL('…/index_bg.wasm', import.meta.url)`.

## 2. pptxgenjs execution location: the export Web Worker

`pptxgenjs@^4.0.1` (resolved 4.0.1, installed). The Playwright probe proved
`pptx.write({ outputType:'arraybuffer' })` emits a valid OOXML/ZIP container
(`PK\x03\x04`) from **both**:
- a **Web Worker** — 44 734 bytes ✓ (chosen)
- the **main thread** — 44 738 bytes ✓ (documented conservative fallback)

**Chosen: the export Web Worker.** Paired with resvg-wasm, the entire 5–30 MB
HTML+PPTX synthesis runs off the main thread in one worker, so the UI stays
interactive (D-06, no modal). **Fallback (recorded, do not implement unless
needed):** if the ESM-module-worker integration of pptxgenjs proves fiddly
during plan 02/04, move only pptxgenjs assembly to the main thread — charts
still rasterize in the worker via resvg-wasm. Both paths are proven valid.

## 3. Contract for plans 02 & 04

Plan 04's `src/engines/export/pptx/primitives/chartSvg.ts` MUST implement and
export exactly:

```
chartSvgToPng(svg: string, width: number, height: number): Promise<Uint8Array>
```

- **Implementation:** `@resvg/resvg-wasm` — `new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()` → `Uint8Array`; `.free()` the render + instance.
- **Execution thread:** inside the **export Web Worker** (the same worker plan 02 builds; mirrors `parser.worker.ts` — fetchGuard imported first).
- **WASM init:** memoised single-shot `initWasm` from a Vite-bundled local URL/bytes (never a remote fetch). Reuse the spike's `WasmSource` injection shape so the engine never statically imports `node:*` (this kept `tsc -b` / the app build green — a real regression caught in Task 2).
- **Chart SVG source:** ECharts SSR reusing the `src/components/Chart.tsx` tree-shaken registry verbatim (core entry + per-feature subpaths + `SVGRenderer`; the un-subpathed barrel import is bundle-gate-forbidden); colours from the registered `midnight-executive` theme (sRGB hex only — the Phase-9 zrender/oklch fix).

## 4. Reference

Spike module: `src/engines/export/spike/svgToPng.spike.ts` (+ `.test.ts`).
Commits: `feat(10-01)` (spike), `fix(10-01)` (build-safe wasm injection + Task-2 evidence).
