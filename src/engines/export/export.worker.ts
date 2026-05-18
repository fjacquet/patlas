/// <reference lib="webworker" />
// fetchGuard MUST be the first import — it installs synchronous throwing
// wrappers before any module captures `fetch` (privacy invariant; the
// same-origin Vite-bundled resvg wasm fetch below is allowed, any
// non-same-origin attempt throws). Mirrors parser.worker.ts.
import '../../privacy/fetchGuard'
// SECOND: the worker `window` shim — MUST precede every heavy import below
// (ESM hoists imports above any statement, so an inline shim runs too late;
// react-dom/server / zrender / pptxgenjs read `window` at module-eval).
import './workerEnv'

import type { EChartsOption } from 'echarts/types/dist/shared'
import { buildExportView } from './buildExportView'
import { assembleHtml } from './html/assembleHtml'
import { chartToSvg } from './html/renderCharts'
import { exportChartSlots } from './html/renderReport'
import { chartSvgToPng } from './pptx/primitives/chartSvg'
import type { ExportRequest, ExportResponse } from './types'

const CHART_W = 520
const CHART_H = 300

/** A factual per-cluster bar (hosts vs VMs) — magnitude only, navy ramp
 *  via the registered theme; no verdict colour. */
function clusterChartOption(hosts: number, vms: number): EChartsOption {
  return {
    xAxis: { type: 'category', data: ['Hosts', 'VMs'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [hosts, vms] }],
  }
}

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

    let bytes: ArrayBuffer
    if (req.kind === 'html') {
      const charts = new Map<string, string>()
      const byName = new Map(view.clusters.map((c) => [c.cluster, c]))
      for (const slot of exportChartSlots(view)) {
        const c = byName.get(slot.cluster)
        if (c) {
          charts.set(
            slot.id,
            chartToSvg(
              clusterChartOption(Number(c.hostCount), Number(c.vmCount)),
              CHART_W,
              CHART_H,
            ),
          )
        }
      }
      const html = assembleHtml({ view, trends, charts, strings: req.strings, locale: req.locale })
      bytes = new TextEncoder().encode(html).buffer
    } else {
      // pptxgenjs evaluated lazily AFTER the window shim above.
      const { buildPptx } = await import('./pptx/builder')
      bytes = await buildPptx(view, trends, req.strings, req.locale, {
        renderClusterChart: async (c) =>
          chartSvgToPng(
            chartToSvg(
              clusterChartOption(Number(c.hostCount), Number(c.vmCount)),
              CHART_W,
              CHART_H,
            ),
            CHART_W,
            CHART_H,
            wasmSource(),
          ),
        // Active snapshot's real capture date for the D-03 title slide
        // (NOT a vCenter label — CodeRabbit builder.ts:59).
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
