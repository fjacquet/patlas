import type { EChartsOption } from 'echarts/types/dist/shared'
import {
  MIDNIGHT_EXECUTIVE_DARK,
  MIDNIGHT_EXECUTIVE_LIGHT,
  type MidnightExecutiveTheme,
} from '@/theme/echartsTheme'
import type { OsBreakdown } from '@/types/estate'

/**
 * Pure ECharts `option` selectors (no React, no memo hooks). Each function
 * takes an already-memoized `EstateView` slice + the resolved labels and
 * returns a deterministic `option` object. Called once per render from the
 * chart-host components; because the inputs are referentially stable per
 * (data, mode) the resulting `<Chart>` reference is stable enough for its
 * memo comparator to short-circuit when nothing changed (RESEARCH
 * Anti-Patterns: option built in a small selector, NOT inline in JSX, NOT
 * inside a component-level memo hook — the single sanctioned memo site is
 * the useEstateView bridge).
 *
 * The Midnight Executive theme is registered globally on `<Chart>`, but its
 * series palette + gauge bands + allocation color must also be referenced
 * here for the donut series order and the gauge axisLine bands (ECharts does
 * not expose registered-theme custom fields back to option builders). We read
 * the theme object directly and pick the light/dark variant from the live
 * `.dark` class (mirrors `Chart.tsx`'s `isDark()` — KISS, render-time read).
 */

const isDark = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

const theme = (): MidnightExecutiveTheme =>
  isDark() ? MIDNIGHT_EXECUTIVE_DARK : MIDNIGHT_EXECUTIVE_LIGHT

export interface OsLabels {
  windows: string
  linux: string
  other: string
}

/**
 * OS-family donut. Series order Windows → Linux → Other matches the theme
 * palette color[0..2] (UI-SPEC §Color chart-series map). "Other" is always a
 * present, visible bucket — even at 0 (UI-SPEC: "Other/unknown is a real,
 * visible bucket"). `aria` is enabled for screen-reader access.
 */
export const osDonutOption = (
  osBreakdown: OsBreakdown,
  labels: OsLabels,
  ariaTitle: string,
): EChartsOption => {
  const palette = theme().color
  return {
    aria: { enabled: true, label: { description: ariaTitle } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: [
          { name: labels.windows, value: osBreakdown.windows, itemStyle: { color: palette[0] } },
          { name: labels.linux, value: osBreakdown.linux, itemStyle: { color: palette[1] } },
          { name: labels.other, value: osBreakdown.other, itemStyle: { color: palette[2] } },
        ],
      },
    ],
  }
}

/** Gauge kind: CPU/RAM utilization (banded) vs an allocation ratio (single
 *  brand color — a ratio is not a verdict, Moderate-4: NO banding). */
export type GaugeKind = 'cpu' | 'ram' | 'alloc'

/**
 * Small utilization / allocation gauge.
 *
 * - `kind='cpu'|'ram'`: 0..1 utilization, axisLine banded
 *   util-low/mid/high at 0–60 / 60–80 / 80–100 (status only, NO verdict text).
 * - `kind='alloc'`: a 0..1-normalized allocation position, single brand
 *   color, NO banding (UI-SPEC / Moderate-4 — a ratio is not a utilization).
 *
 * `value0to1` is the gauge needle position (0..1). `displayLabel` is the
 * already-formatted, unit-bearing string shown in the gauge center (the
 * caller formats via `utils/format.ts`; this selector never formats numbers).
 */
export const utilizationGaugeOption = (
  value0to1: number,
  kind: GaugeKind,
  displayLabel: string,
  ariaTitle: string,
): EChartsOption => {
  const t = theme()
  const axisLineColor: Array<[number, string]> =
    kind === 'alloc'
      ? [[1, t.allocationGaugeColor]]
      : t.gaugeBands.map((b) => [b[0], b[1]] as [number, string])

  return {
    aria: { enabled: true, label: { description: ariaTitle } },
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 1,
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        progress: { show: false },
        pointer: { width: 3, length: '60%' },
        axisLine: { lineStyle: { width: 8, color: axisLineColor } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, '40%'],
          fontSize: 12,
          color: 'inherit',
          formatter: () => displayLabel,
        },
        data: [{ value: value0to1 }],
      },
    ],
  }
}
