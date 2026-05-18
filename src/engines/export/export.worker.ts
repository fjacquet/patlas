/// <reference lib="webworker" />
// fetchGuard MUST be the first import — installs synchronous throwing
// wrappers before any module captures `fetch` (same-origin Vite-bundled
// resvg wasm below is allowed; non-same-origin throws). Mirrors
// parser.worker.ts.
import '../../privacy/fetchGuard'
// SECOND: the worker `window` shim — MUST precede every heavy import below
// (ESM hoists imports above any statement; react-dom/server / zrender /
// pptxgenjs read `window` at module-eval).
import './workerEnv'

import { buildExportView } from './buildExportView'
import { buildChartBundle, type PngBundle } from './chartBundle'
import { assembleHtml } from './html/assembleHtml'
import { chartToSvg } from './html/renderCharts'
import { exportChartSlots } from './html/renderReport'
import { chartSvgToPng } from './pptx/primitives/chartSvg'
import type { ExportRequest, ExportResponse } from './types'

// Donut/gauge read better near-square; bars/line wider. One generous size
// keeps it simple — pptxgenjs scales the PNG into the panel box.
const CHART_W = 560
const CHART_H = 360

/** Same-origin Vite-bundled resvg wasm — fetchGuard permits same-origin;
 *  never a remote host (privacy). */
const wasmSource = (): Promise<Response> =>
  fetch(new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url))

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  const req = e.data
  try {
    const { view, trends } = buildExportView(
      req.active,
      req.all,
      req.mode,
      new Date(req.today),
      req.opts,
    )
    const optBundle = buildChartBundle(view, trends, req.locale)

    let bytes: ArrayBuffer
    if (req.kind === 'html') {
      // HTML inlines SVG directly — feed each per-cluster slot the REAL
      // per-cluster gauge SVG (no rasterize, no resvg on this path).
      const charts = new Map<string, string>()
      for (const slot of exportChartSlots(view)) {
        const opt = optBundle.perCluster.get(slot.cluster)
        if (opt) charts.set(slot.id, chartToSvg(opt, CHART_W, CHART_H))
      }
      const html = assembleHtml({ view, trends, charts, strings: req.strings, locale: req.locale })
      bytes = new TextEncoder().encode(html).buffer
    } else {
      // PPTX: PowerPoint can't render SVG → rasterize every chart to PNG
      // via the Wave-0-locked resvg path (10-SPIKE-DECISION).
      const raster = (opt: Parameters<typeof chartToSvg>[0]): Promise<Uint8Array> =>
        chartSvgToPng(chartToSvg(opt, CHART_W, CHART_H), CHART_W, CHART_H, wasmSource())

      const sharedPng = new Map<string, Uint8Array>()
      for (const [k, opt] of Object.entries(optBundle.shared)) {
        sharedPng.set(k, await raster(opt))
      }
      const perClusterPng = new Map<string, Uint8Array>()
      for (const [name, opt] of optBundle.perCluster) {
        perClusterPng.set(name, await raster(opt))
      }
      const charts: PngBundle = { shared: sharedPng, perCluster: perClusterPng }

      // pptxgenjs evaluated lazily AFTER the window shim above.
      const { buildPptx } = await import('./pptx/builder')
      bytes = await buildPptx(view, trends, req.strings, req.locale, {
        charts,
        // Active snapshot's real capture date for the D-03 title slide.
        capturedAt: new Date(req.active.capturedAt).toISOString().slice(0, 10),
      })
    }

    const ok: ExportResponse = { kind: 'ok', bytes, filename: req.filename }
    self.postMessage(ok, [bytes])
  } catch (err) {
    // Hand-built error ONLY — never spread `err`, never `cause`/rows
    // (T-10-18 / T-04-04: no parsed workbook bytes leak via an error).
    const error = {
      name: err instanceof Error ? err.name : 'ExportError',
      message: err instanceof Error ? err.message : 'export failed',
    }
    const fail: ExportResponse = { kind: 'err', error }
    self.postMessage(fail)
  }
}
