import { Chart } from '@/components/Chart'
import { sparklineOption } from './trendsChartOptions'

/**
 * Minimal per-cluster sparkline (TRD-03) — a shape, not a legend. Fixed
 * 36px canvas height (UI-SPEC §Spacing documented exception). Rendered by
 * the dashboard cluster card only when >=2 points exist for the cluster.
 */
export function TrendSparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  return <Chart option={sparklineOption(values)} ariaLabel={ariaLabel} style={{ height: 36 }} />
}
