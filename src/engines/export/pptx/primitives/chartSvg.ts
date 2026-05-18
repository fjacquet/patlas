/**
 * Phase 10 — PowerPoint-safe chart raster (RESEARCH Pitfall 1, locked by
 * 10-SPIKE-DECISION.md). PowerPoint clients do NOT render embedded SVG, so
 * every deck chart is an ECharts-SSR SVG rasterized to PNG via
 * `@resvg/resvg-wasm` (the Wave-0-locked, DOM-free, worker-safe mechanism).
 *
 * `chartSvgToPng` keeps the LOCKED signature `(svg, width, height) =>
 * Promise<Uint8Array>` plus an injected `WasmSource` — the wasm bytes are
 * provided by the caller (plan 05's worker supplies a same-origin
 * Vite-bundled URL fetch; tests inject node-fs bytes). This keeps the
 * module free of any `node:*` import so `tsc -b` / the browser app build
 * stays green (the regression pattern caught in 10-01).
 *
 * `addChartImage` ALWAYS emits an `image/png` data URI — never an
 * SVG-mime data URI (PowerPoint renders an embedded-SVG image blank).
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm'

/** `initWasm` accepts BufferSource | Response | Promise of either. */
export type WasmSource = BufferSource | Promise<BufferSource> | Response | Promise<Response>

let wasmReady: Promise<unknown> | null = null

/** Process-global single-shot init; memoised so parallel/repeat calls do
 *  not throw "Already initialized". */
async function ensureWasm(source: WasmSource): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(source)
  await wasmReady
}

/**
 * Rasterize an ECharts-SSR SVG string to PNG bytes — NO DOM. The locked
 * `chartSvgToPng` contract for plan 04/05.
 */
export async function chartSvgToPng(
  svg: string,
  width: number,
  _height: number,
  wasmSource: WasmSource,
): Promise<Uint8Array> {
  await ensureWasm(wasmSource)
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  const rendered = r.render()
  const png = rendered.asPng()
  rendered.free()
  r.free()
  return png
}

/** Chunked base64 of raw bytes — worker/browser safe (no Buffer, no
 *  call-stack blow-up on large PNGs). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/** Minimal structural slide type — decouples from the pptxgenjs class so
 *  this primitive stays pure and trivially testable. */
export interface ImageSink {
  addImage(opts: { data: string; x: number; y: number; w: number; h: number }): unknown
}

export interface ChartLayout {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Place a rasterized chart on a slide. The payload mime is ALWAYS
 * `image/png` (Pitfall 1 / T-10-15 — an SVG-mime data URI renders blank
 * in PowerPoint).
 */
export function addChartImage(slide: ImageSink, png: Uint8Array, layout: ChartLayout): void {
  slide.addImage({ data: `image/png;base64,${bytesToBase64(png)}`, ...layout })
}
