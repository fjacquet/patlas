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
import { topologyTreeOption } from './charts/topologyOption'
import { assembleHtml } from './html/assembleHtml'
import { buildHtmlCharts } from './html/buildHtmlCharts'
import { chartToSvg } from './html/renderCharts'
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
  // Dedicated worker — only the same-origin parent document can post here, so
  // `e.origin` is always '' in practice. Reject any unexpected cross-origin
  // sender defensively before touching `e.data`.
  if (e.origin !== '' && e.origin !== self.location.origin) return
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
    // `req.strings` is the app's own i18n bundle, but it crosses a postMessage
    // boundary. Build the resolved bundle via Object.fromEntries — no computed
    // property-write sink, and its [[DefineOwnProperty]] semantics mean a
    // '__proto__' key becomes a plain own property, never polluting the
    // prototype. Resolve `{{token}}` only against own keys of `vars`.
    const strings = Object.fromEntries(
      Object.entries(req.strings).map(([k, v]) => [
        k,
        v.replace(/\{\{(\w+)\}\}/g, (m, key) => {
          const val = Object.hasOwn(vars, key) ? vars[key] : undefined
          return val ?? m
        }),
      ]),
    ) as typeof req.strings

    // Topology labels shared by both export branches. The resolved `strings`
    // bag has the same values as req.strings for these keys (the worker's
    // vars step only substitutes vcenters/clusters/hosts/vms/captureDate;
    // {{count}}/{{withVms}}/{{total}} are left intact for topologyTreeOption
    // to interpolate). Using `strings` here keeps both branches consistent.
    const topoLabels = {
      estate: strings['topology.estate'] ?? 'Estate',
      nodesWord: strings['topology.nodesWord'] ?? 'nodes',
      unconfigured: strings['topology.unconfigured'] ?? '+ {{count}} unconfigured NICs',
      vms: strings['topology.vms'] ?? 'VMs',
      ofNodes: strings['topology.ofNodes'] ?? '{{withVms}}/{{total}} nodes',
    }

    let bytes: ArrayBuffer
    if (req.kind === 'html') {
      // HTML inlines SVG directly (no rasterize, no resvg on this path).
      // buildHtmlCharts covers per-cluster gauges, storage-treemap, AND the
      // topology-tree slot — the seam is now tested in buildHtmlCharts.test.ts.
      const charts = buildHtmlCharts(view, optBundle, topoLabels, CHART_W, CHART_H)
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
        // storageSlide no longer accepts a PNG — the slot is still in the
        // HTML-report path (SVG inline) but the PPTX slide uses a native
        // text table instead. Skip rasterization to avoid wasted work.
        if (k === 'storageTreemap') continue
        sharedPng.set(k, await raster(opt))
      }
      const perClusterPng = new Map<string, Uint8Array>()
      for (const [name, opt] of optBundle.perCluster) {
        perClusterPng.set(name, await raster(opt))
      }
      const charts: PngBundle = { shared: sharedPng, perCluster: perClusterPng }

      // P-NT (Spec 2): render the topology tree to a PNG for the network slide.
      // topologyTreeOption produces an ECharts tree option + dynamic height;
      // chartToSvg renders it SSR; chartSvgToPng rasterizes via resvg-wasm.
      // Best-effort: a topology render failure must never sink the whole export.
      let topologyPng: Uint8Array | null = null
      if (view.topology.hasData) {
        try {
          const { option, height } = topologyTreeOption(view.topology, topoLabels)
          topologyPng = await chartSvgToPng(
            chartToSvg(option, CHART_W, height),
            CHART_W,
            height,
            wasmSource(),
          )
        } catch {
          topologyPng = null
        }
      }

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
        // Topology-tree PNG for the network slide (Pitfall 1 — must be PNG).
        topologyPng,
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
