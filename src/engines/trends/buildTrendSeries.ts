import type { AccountingMode, TrendSeries } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'

/**
 * Pure temporal-trends engine. No React/DOM/Zustand/Zod, no clock — any
 * "now" is supplied by the caller. Implemented in Task 2; this signature
 * is the stable contract the single `buildEstateView` pass composes with.
 */
export const buildTrendSeries = (
  selected: Snapshot[],
  _mode: AccountingMode,
  _opts: {
    stretchedClusters?: ReadonlySet<string>
    allocRatios?: { cpuRatio: number; ramRatio: number }
  },
): TrendSeries | null => {
  if (selected.length < 2) return null
  return null
}
