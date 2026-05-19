import type { EChartsOption } from 'echarts/types/dist/shared'
import {
  MIDNIGHT_EXECUTIVE_DARK,
  MIDNIGHT_EXECUTIVE_LIGHT,
  type MidnightExecutiveTheme,
} from '@/theme/echartsTheme'

/**
 * Pure ECharts `option` selector for the PLN-01 "visual return" — measured vs
 * planned vCPU capacity against the constant allocated demand (a gold markLine
 * — the factual marker, never a verdict). No React, no memo hooks, no engine
 * import: every input is read off the already-memoized `EstateView`. Mirrors
 * `dashboard/chartOptions.ts` (theme read at render time from the `.dark`
 * class; the registered theme can't expose custom fields back to builders).
 */

// sRGB of the Midnight Executive `--color-accent-500` gold token (the factual
// marker, never a verdict). Mirrors engines/export/pptx/primitives/colors.ts.
const GOLD = '#f9b935'

const isDark = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

const theme = (): MidnightExecutiveTheme =>
  isDark() ? MIDNIGHT_EXECUTIVE_DARK : MIDNIGHT_EXECUTIVE_LIGHT

export interface PlannedHeadroomLabels {
  measured: string
  planned: string
  capacity: string
  demand: string
  axisCores: string
  ariaTitle: string
}

export const plannedHeadroomBarOption = (
  measuredCapacityVcpu: number,
  plannedCapacityVcpu: number,
  allocatedVcpu: number,
  labels: PlannedHeadroomLabels,
): EChartsOption => {
  const palette = theme().color
  return {
    aria: { enabled: true, label: { description: labels.ariaTitle } },
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: [labels.measured, labels.planned] },
    yAxis: { type: 'value', name: labels.axisCores },
    series: [
      {
        type: 'bar',
        name: labels.capacity,
        barMaxWidth: 64,
        data: [
          { value: measuredCapacityVcpu, itemStyle: { color: palette[2] } },
          { value: plannedCapacityVcpu, itemStyle: { color: palette[0] } },
        ],
        markLine: {
          symbol: 'none',
          data: [{ yAxis: allocatedVcpu, name: labels.demand }],
          label: { formatter: labels.demand, position: 'insideEndTop' },
          lineStyle: { color: GOLD, type: 'dashed', width: 2 },
        },
      },
    ],
  }
}
