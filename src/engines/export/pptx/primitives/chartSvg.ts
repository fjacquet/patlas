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
  // Reset the memo on failure so a transient initWasm error (e.g. a
  // momentary asset fetch hiccup) does not permanently poison every future
  // export with a forever-rejected promise (CodeRabbit — chartSvg.ts:29).
  if (!wasmReady) {
    wasmReady = initWasm(source).catch((e) => {
      wasmReady = null
      throw e
    })
  }
  await wasmReady
}

/**
 * Rasterize an ECharts-SSR SVG string to PNG bytes — NO DOM. The locked
 * `chartSvgToPng` contract for plan 04/05.
 *
 * `fontBuffers` is optional: when provided, resvg uses those fonts and
 * disables system font loading (needed for the network diagram, whose text
 * labels vanish without an explicit font — resvg-wasm ships no default font).
 * Charts omit it and keep the existing call unchanged.
 */
export async function chartSvgToPng(
  svg: string,
  width: number,
  _height: number,
  wasmSource: WasmSource,
  fontBuffers?: Uint8Array[],
): Promise<Uint8Array> {
  await ensureWasm(wasmSource)
  const opts = fontBuffers
    ? {
        fitTo: { mode: 'width' as const, value: width },
        font: { fontBuffers, loadSystemFonts: false },
      }
    : { fitTo: { mode: 'width' as const, value: width } }
  const r = new Resvg(svg, opts)
  // try/finally so a render()/asPng() throw still frees the wasm-backed
  // Resvg + RenderedImage handles (CodeRabbit — chartSvg.ts:47 leak).
  let rendered: ReturnType<typeof r.render> | null = null
  try {
    rendered = r.render()
    return rendered.asPng()
  } finally {
    rendered?.free()
    r.free()
  }
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
  addImage(opts: {
    data: string
    x: number
    y: number
    w: number
    h: number
    sizing?: { type: 'contain' | 'cover' | 'crop'; w: number; h: number }
  }): unknown
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
  // PPT-01: `sizing: contain` preserves the chart's aspect inside the panel
  // box (centered/letterboxed) instead of stretching it — what made gauges
  // and donuts look "oversized"/distorted in wide single-chart slides.
  slide.addImage({
    data: `image/png;base64,${bytesToBase64(png)}`,
    ...layout,
    sizing: { type: 'contain', w: layout.w, h: layout.h },
  })
}
