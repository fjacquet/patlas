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

// PPT-01: render at print-grade resolution at the slide's 16:9 aspect
// (13.333:7.5 ≈ 1.778). The old 560×360 PNG was upscaled into 12-inch
// slide boxes → blurry; this gives ~3× the pixels so charts stay crisp,
// and `addChartImage` places them with aspect-preserving `contain` sizing
// so they are no longer stretched/distorted in non-16:9 boxes.
const CHART_W = 1600
const CHART_H = 900

/** Same-origin Vite-bundled resvg wasm — fetchGuard permits same-origin;
 *  never a remote host (privacy). */
const wasmSource = (): Promise<Response> =>
  fetch(new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url))

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  const req = e.data
  try {
    const { view, trends, sizing } = buildExportView(
      req.active,
      req.all,
      req.mode,
      new Date(req.today),
      req.opts,
    )
    const optBundle = buildChartBundle(view, trends, req.locale)

    // The strings bag is the RAW i18n bundle (getResourceBundle does not
    // interpolate). Resolve `{{token}}` placeholders here — the worker is
    // the only place that has view counts + capture date + locale together
    // (engines stay pure; they receive final strings). Fixes the literal
    // `{{vcenters}}`/`{{captureDate}}` on the title slide + report footer.
    const bcp47 = req.locale === 'fr' ? 'fr-FR' : 'en-US'
    const fmtN = (n: number): string =>
      Number.isFinite(n) ? n.toLocaleString(bcp47, { maximumFractionDigits: 0 }) : '—'
    const vars: Record<string, string> = {
      vcenters: view.clusters[0]?.cluster ?? '',
      clusters: fmtN(view.globals.clusterCount),
      hosts: fmtN(view.globals.hostCount),
      vms: fmtN(view.globals.vmCount),
      captureDate: new Date(req.active.capturedAt).toLocaleDateString(bcp47),
    }
    const strings: typeof req.strings = {}
    for (const [k, v] of Object.entries(req.strings)) {
      strings[k] = v.replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m)
    }

    let bytes: ArrayBuffer
    if (req.kind === 'html') {
      // HTML inlines SVG directly — feed each per-cluster slot the REAL
      // per-cluster gauge SVG (no rasterize, no resvg on this path).
      const charts = new Map<string, string>()
      for (const slot of exportChartSlots(view)) {
        const opt = optBundle.perCluster.get(slot.cluster)
        if (opt) charts.set(slot.id, chartToSvg(opt, CHART_W, CHART_H))
      }
      // F-2: the single estate-level Storage treemap (fixed slot id —
      // matches renderReport.tsx's data-chart-slot="storage-treemap").
      // 11-01 threads it unconditionally; guard is factual (absent ⇒
      // empty slot, never fabricated).
      const treemap = optBundle.shared.storageTreemap
      if (treemap) charts.set('storage-treemap', chartToSvg(treemap, CHART_W, CHART_H))
      const html = assembleHtml({
        view,
        trends,
        charts,
        strings,
        locale: req.locale,
        networkSvg: req.active.networkSvg ?? null,
      })
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
      // P-RS: the deck's right-sizing slide reflects ALL loaded snapshots
      // (max-of-N) — override the active-only `view.sizing` with the
      // all-snapshots `sizing` from buildExportView. HTML report is unaffected
      // (right-sizing is web + PPTX only).
      bytes = await buildPptx({ ...view, sizing }, trends, strings, req.locale, {
        charts,
        // Active snapshot's real capture date for the D-03 title slide.
        capturedAt: new Date(req.active.capturedAt).toISOString().slice(0, 10),
        // Network diagram SVG from the zip bundle (mirrors the HTML report path).
        networkSvg: req.active.networkSvg ?? null,
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
