import type { EChartsOption } from 'echarts/types/dist/shared'
import type { TrendSeries } from '@/types/estate'
import { fmtDate } from '@/utils/format'

/**
 * Pure ECharts option builders for the trend view (no hooks, no memo —
 * called with the memoized `view.trends`). The line builder uses a real
 * TEMPORAL axis (`xAxis.type: 'time'`, `[Date, value]` pairs) so irregular
 * capture dates show visibly non-uniform spacing (TRD-02 / criterion 2).
 * D-05 fallback: when any point's order had to be inferred the WHOLE
 * series renders on an ordered `category` axis (never mixed — honest, no
 * fabricated positions); the factual caption is rendered by the view.
 * No editorial verb, no verdict colour — series use the theme palette.
 */

interface TrendCopy {
  vmCount: string
  poweredOnVms: string
  tooltipDate: string
  tooltipMeta: string
}

export const trendLineOption = (
  trends: TrendSeries,
  copy: TrendCopy,
  locale: string,
): EChartsOption => {
  const { points, orderInferred } = trends
  const vmSeries = points.map((p) => p.headline.vmCount)
  const onSeries = points.map((p) => p.headline.poweredOnVms)

  // Tooltip lists the capture date + the per-point metadata array
  // (criterion 6). Factual only; numbers/dates via the locale formatter.
  const tooltipFormatter = (params: unknown): string => {
    const arr = Array.isArray(params) ? params : [params]
    const idx = (arr[0] as { dataIndex?: number } | undefined)?.dataIndex ?? 0
    const point = points[idx]
    if (!point) return ''
    const dateLine = copy.tooltipDate.replace(
      '{{date}}',
      orderInferred && point.ordinal !== null
        ? `#${point.ordinal + 1}`
        : fmtDate(point.date.toISOString(), locale),
    )
    const metaLines = point.metadata
      .map((m) =>
        copy.tooltipMeta
          .replace('{{cluster}}', m.vCenterLabel)
          .replace('{{version}}', m.rvtoolsVersion),
      )
      .join('<br/>')
    const rows = (arr as { seriesName?: string; value?: number }[])
      .map((s) => `${s.seriesName ?? ''}: ${s.value ?? ''}`)
      .join('<br/>')
    return `${dateLine}<br/>${metaLines}<br/>${rows}`
  }

  const series = [
    { name: copy.vmCount, type: 'line' as const, showSymbol: true },
    { name: copy.poweredOnVms, type: 'line' as const, showSymbol: true },
  ]

  if (orderInferred) {
    return {
      grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis', formatter: tooltipFormatter },
      legend: { data: [copy.vmCount, copy.poweredOnVms] },
      xAxis: {
        type: 'category',
        data: points.map((p, i) =>
          p.ordinal !== null
            ? `#${p.ordinal + 1}`
            : fmtDate(p.date.toISOString(), locale) || `#${i + 1}`,
        ),
      },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { ...series[0], data: vmSeries },
        { ...series[1], data: onSeries },
      ],
    }
  }

  return {
    grid: { left: 8, right: 8, top: 24, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', formatter: tooltipFormatter },
    legend: { data: [copy.vmCount, copy.poweredOnVms] },
    xAxis: { type: 'time' },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { ...series[0], data: points.map((p) => [p.date, p.headline.vmCount]) },
      { ...series[1], data: points.map((p) => [p.date, p.headline.poweredOnVms]) },
    ],
  }
}

/**
 * Minimal per-cluster sparkline: no axes, no grid chrome, single neutral
 * theme stroke (NOT a per-cluster colour, NOT the util status ramp — it is
 * a shape, not a categorical legend). UI-SPEC §Color/Spacing contract.
 */
export const sparklineOption = (values: number[]): EChartsOption => ({
  grid: { top: 2, bottom: 2, left: 2, right: 2 },
  xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
  yAxis: { type: 'value', show: false },
  tooltip: { show: false },
  series: [
    {
      type: 'line',
      data: values,
      showSymbol: false,
      lineStyle: { width: 1.5 },
    },
  ],
})
