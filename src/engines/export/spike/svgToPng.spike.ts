/**
 * Phase 10 Wave-0 spike — SVG→PNG-without-DOM (RESEARCH Open Question 1).
 *
 * PowerPoint clients do NOT render embedded SVG (RESEARCH Pitfall 1,
 * verified) so PPTX charts must be rasterized to PNG. ECharts SSR yields an
 * SVG *string* with no canvas/DOM. This module prototypes the two candidate
 * rasterizers the 10-01 decision picks between:
 *
 *   (A) `@resvg/resvg-wasm` — WASM, no DOM, worker-safe, node-testable.
 *   (B) main-thread `OffscreenCanvas` + `createImageBitmap` — zero new deps,
 *       but browser-only (validated via Playwright, not the jsdom suite).
 *
 * Heavy `echarts/*` + `@resvg/resvg-wasm` imports are CONFINED to this spike
 * file (mirrors `parser.worker.ts` chunk discipline) so the main bundle and
 * the echarts bundle-size gate are unaffected.
 *
 * THROWAWAY probe: synthetic chart data only — never parsed workbook bytes.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm'
import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  TreemapChart,
} from 'echarts/charts'
import {
  CalendarComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { MIDNIGHT_EXECUTIVE_LIGHT } from '@/theme/echartsTheme'

// Same tree-shaken registry as src/components/Chart.tsx (do not re-derive —
// SVG renderer ONLY; the un-subpathed top-level echarts barrel import is
// forbidden, it blows the bundle-size gate — always use the core entry +
// per-feature subpaths as imported above).
echarts.use([
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  CalendarComponent,
  VisualMapComponent,
  SVGRenderer,
])
echarts.registerTheme('midnight-executive', MIDNIGHT_EXECUTIVE_LIGHT)

/** Treemap option — the P9 datastore-footprint lens (visually hard: nested
 *  rects + labels). Colours come from the registered Midnight Executive
 *  theme (sRGB hex only — the Phase-9 zrender/oklch fix guarantees this). */
export function treemapOption(): EChartsOption {
  return {
    series: [
      {
        type: 'treemap',
        roam: false,
        breadcrumb: { show: false },
        label: { show: true },
        data: [
          {
            name: 'cluster-a',
            value: 4200,
            children: [
              { name: 'ds-01', value: 2200 },
              { name: 'ds-02', value: 2000 },
            ],
          },
          {
            name: 'cluster-b',
            value: 3100,
            children: [
              { name: 'ds-03', value: 1800 },
              { name: 'ds-04', value: 1300 },
            ],
          },
          { name: 'cluster-c', value: 1700 },
        ],
      },
    ],
  }
}

/** Heatmap option — the P7 EOS forecast matrix (visually hardest:
 *  per-cell fills + a visualMap ramp). */
export function heatmapOption(): EChartsOption {
  const x = ['Q1', 'Q2', 'Q3', 'Q4']
  const y = ['2026', '2027', '2028']
  const data: [number, number, number][] = []
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) data.push([i, j, (i * 7 + j * 13) % 50])
  }
  return {
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'category', data: y },
    visualMap: { min: 0, max: 50, calculable: false, show: false },
    series: [{ type: 'heatmap', data }],
  }
}

/**
 * ECharts SSR → SVG string. DOM-FREE: `echarts.init(null, …, { ssr: true })`
 * uses no canvas/document (RESEARCH Pattern 2). Disposes the instance.
 */
export function renderChartSvg(option: EChartsOption, width: number, height: number): string {
  const inst = echarts.init(null, 'midnight-executive', {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  })
  inst.setOption(option)
  const svg = inst.renderToSVGString()
  inst.dispose()
  return svg
}

// --- Candidate (A): @resvg/resvg-wasm — WASM, no DOM ------------------------

let wasmReady: Promise<unknown> | null = null

/** initWasm is process-global and single-shot; memoise so repeat calls (and
 *  parallel test cases) don't throw "Already initialized". The wasm binary
 *  is read from the installed package (bundled, never fetched — privacy). */
async function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    // node/vitest path: resolve the package's wasm and hand initWasm the
    // bytes. No `document`/`window`/`fetch` — pure node fs + wasm.
    const { readFileSync } = await import('node:fs')
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')
    wasmReady = initWasm(readFileSync(wasmPath))
  }
  await wasmReady
}

/**
 * Option A: rasterize an SVG string to PNG bytes with NO DOM. Worker-safe.
 * Returns the `chartSvgToPng(svg,width,height)` shape plans 02/04 implement
 * against if this candidate is chosen.
 */
export async function svgToPngResvg(
  svg: string,
  width: number,
  _height: number,
): Promise<Uint8Array> {
  await ensureWasm()
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  const rendered = r.render()
  const png = rendered.asPng()
  rendered.free()
  r.free()
  return png
}

// --- Candidate (B): main-thread OffscreenCanvas (browser-only) --------------

/**
 * Option B: rasterize via `OffscreenCanvas` + `createImageBitmap`. ZERO new
 * deps but BROWSER-ONLY — `OffscreenCanvas`/`createImageBitmap` are undefined
 * in node/jsdom, so this path is exercised by the Playwright probe, not the
 * jsdom spike test. Throws a clear error if the APIs are absent (so the
 * jsdom suite records the limitation rather than a cryptic ReferenceError).
 */
export async function svgToPngOffscreen(
  svg: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error(
      'svgToPngOffscreen requires OffscreenCanvas/createImageBitmap (browser only — not jsdom/node)',
    )
  }
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const out = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await out.arrayBuffer())
}

/** The 8-byte PNG file signature — both candidates must produce this. */
export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}
