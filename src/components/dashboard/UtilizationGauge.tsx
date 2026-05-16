import { Chart } from '@/components/Chart'
import { type GaugeKind, utilizationGaugeOption } from './chartOptions'

export interface UtilizationGaugeProps {
  /** Needle position 0..1 (utilization ratio, or allocation normalized). */
  value0to1: number
  kind: GaugeKind
  /** Already-formatted, unit-bearing value (caller formats via format.ts). */
  displayLabel: string
  /** Visible caption under the gauge (i18n label from the caller). */
  caption: string
}

/**
 * Small (≤96px) caption-wrapped gauge host (UI-SPEC §Layout). Builds the
 * ECharts `option` in the pure `utilizationGaugeOption` selector and routes
 * it through `<Chart>`. CPU/RAM kinds are util-banded; `alloc` is a single
 * brand color (a ratio is not a verdict — Moderate-4). Dark-pair classes.
 */
export function UtilizationGauge({
  value0to1,
  kind,
  displayLabel,
  caption,
}: UtilizationGaugeProps) {
  const option = utilizationGaugeOption(value0to1, kind, displayLabel, caption)

  return (
    <div className="flex flex-col items-center">
      <Chart option={option} ariaLabel={caption} style={{ height: 96, width: 96 }} />
      <span className="text-xs text-slate-500 dark:text-slate-400">{caption}</span>
    </div>
  )
}
