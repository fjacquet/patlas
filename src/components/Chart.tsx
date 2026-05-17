import { BarChart, GaugeChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
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
import ReactEChartsCore from 'echarts-for-react/esm/core'
import type { CSSProperties } from 'react'
import { memo } from 'react'
import { MIDNIGHT_EXECUTIVE_DARK, MIDNIGHT_EXECUTIVE_LIGHT } from '@/theme/echartsTheme'

/**
 * The single chart primitive for vatlas (every phase, every chart).
 *
 * Tree-shaken ECharts registry (module scope, ONCE — RESEARCH Pattern 1):
 * only the series/components/renderer this project uses are registered. The
 * full barrel import of the top-level echarts package (~1 MB, un-tree-shaken)
 * is FORBIDDEN — always import from echarts/core + per-feature subpaths. The
 * CI bundle-size gate (scripts/check-bundle-size.mjs, ≤300 KB gz) catches any
 * regression. Only the SVG renderer is registered — the canvas renderer is
 * deliberately never imported (VIZ-01); a caller structurally cannot pick it.
 */
echarts.use([
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart, // P7 EOS forecast timeline (SVG — VIZ-01)
  LineChart, // P8 trend line + per-cluster sparkline (SVG — VIZ-01)
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  CalendarComponent, // P7 EOS calendar-coordinate forecast
  VisualMapComponent, // P7 heatmap neutral colour ramp (no verdict colour)
  SVGRenderer, // SVG ONLY — the canvas renderer is intentionally excluded (VIZ-01)
])

// VIZ-03: register both Midnight Executive variants once at module load,
// before any <Chart> mounts (ECharts theme is fixed at instance creation).
echarts.registerTheme('midnight-executive', MIDNIGHT_EXECUTIVE_LIGHT)
echarts.registerTheme('midnight-executive-dark', MIDNIGHT_EXECUTIVE_DARK)

export interface ChartProps {
  /**
   * The full ECharts option object. This single universal surface covers
   * bar/pie/gauge NOW and treemap/heatmap/calendar/line/sparkline LATER
   * with zero `<Chart>` API change (a per-chart-family prop set would be
   * the premature abstraction PROJECT.md forbids). Option objects originate
   * from pure selectors derived off the memoized `useEstateView` output, so
   * the reference-equality memo comparator below short-circuits correctly.
   */
  option: EChartsOption
  /** height/width; defaults to a 320px min-height (UI-SPEC §Layout donut). */
  style?: CSSProperties
  className?: string
  /** Accessibility hook (echarts `aria` config lives inside `option`). */
  ariaLabel?: string
  /** Pass-through for the rare full-replace case. */
  notMerge?: boolean
}

function chartPropsEqual(a: ChartProps, b: ChartProps): boolean {
  // RESEARCH Pattern 2 / Moderate-9: reference-equality on `option` (the
  // data) + shallow on the rest. Correct because `option` is a memoized
  // value built off useEstateView-derived selectors — a deep compare here
  // would be redundant work.
  return (
    a.option === b.option &&
    a.className === b.className &&
    a.ariaLabel === b.ariaLabel &&
    a.style === b.style &&
    a.notMerge === b.notMerge
  )
}

const isDark = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

function ChartImpl({ option, style, className, ariaLabel, notMerge }: ChartProps) {
  // Theme is fixed at mount (ECharts contract). Dark mode is class-strategy
  // (`.dark` on <html>, shipped Phase 1); Phase-2 dashboards remount on
  // snapshot change so a render-time read is sufficient (KISS — a later
  // phase can make this reactive if a live theme toggle without remount is
  // required).
  const theme = isDark() ? 'midnight-executive-dark' : 'midnight-executive'
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge={notMerge}
      lazyUpdate
      opts={{ renderer: 'svg' }} // VIZ-01 — injected here so no caller can forget
      theme={theme}
      className={className}
      style={style ?? { minHeight: 320 }}
      aria-label={ariaLabel}
    />
  )
}

export const Chart = memo(ChartImpl, chartPropsEqual)
