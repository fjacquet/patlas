/**
 * Phase 10 — in-session trends slide (P8 TrendSeries). The builder only
 * calls this when trends is non-null (D-09 — omitted at <2 snapshots).
 */
import type PptxGenJS from 'pptxgenjs'
import type { TrendSeries } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeading, addMetricList } from './_layout'

export function addTrendsSlide(
  pptx: PptxGenJS,
  trends: TrendSeries,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  addHeading(s, strings['trends.title'] ?? 'In-session trends')
  addMetricList(s, [
    {
      label: strings['trends.points'] ?? 'Timeline points',
      value: pptxNumber(trends.points.length, locale),
    },
    {
      label: strings['trends.deltas'] ?? 'Deltas',
      value: pptxNumber(trends.deltas.length, locale),
    },
  ])
}
