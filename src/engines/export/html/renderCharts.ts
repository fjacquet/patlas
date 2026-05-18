/**
 * Phase 10 — DOM-free ECharts → SVG-string engine, shared by the HTML report
 * (inlines the SVG directly) and the PPTX deck (plan 04 rasterizes the SVG to
 * PNG via the locked resvg-wasm path — 10-SPIKE-DECISION.md).
 *
 * RESEARCH Pattern 2: `echarts.init(null, …, { ssr: true })` renders with no
 * canvas and no `document`/`window` — safe inside the export Web Worker.
 * The registry is the `src/components/Chart.tsx` tree-shaken set, replicated
 * verbatim (core entry + per-feature subpaths + `SVGRenderer`). The
 * un-subpathed top-level echarts barrel import is forbidden — it blows the
 * 300 KB bundle gate; always import via the core entry + subpaths as below.
 * Heavy echarts imports are confined to this module (chunk discipline).
 *
 * Exported reports are LIGHT-FIXED (UI-SPEC §Color): a static, shareable,
 * print/offline artifact has no live theme — only the light Midnight
 * Executive theme is registered here (no dark variant, no
 * `prefers-color-scheme`). Colours are sRGB hex (the Phase-9 zrender/oklch
 * fix in echartsTheme.ts; do not regress).
 */
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

/**
 * Render an ECharts option to an inline SVG string with NO DOM.
 *
 * `width`/`height` are REQUIRED — SSR has no responsive container to measure.
 * The instance is always disposed (RESEARCH Pattern 2): calling this in a
 * loop over many chart options must not leak ECharts instances.
 */
export function chartToSvg(option: EChartsOption, width: number, height: number): string {
  const inst = echarts.init(null, 'midnight-executive', {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  })
  try {
    inst.setOption(option)
    return inst.renderToSVGString()
  } finally {
    inst.dispose()
  }
}
