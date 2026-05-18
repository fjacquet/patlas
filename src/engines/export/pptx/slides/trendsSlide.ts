/**
 * Phase 10 — in-session trends: KPI cards + the app's real trend line
 * (rasterized). The builder only calls this when trends is non-null
 * (D-09 — omitted at <2 snapshots).
 */
import type PptxGenJS from 'pptxgenjs'
import type { TrendSeries } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addTrendsSlide(
  pptx: PptxGenJS,
  trends: TrendSeries,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['trends.title'] ?? 'In-session trends')
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['trends.points'] ?? 'Timeline points',
        value: pptxNumber(trends.points.length, locale),
      },
      {
        label: strings['trends.deltas'] ?? 'Deltas',
        value: pptxNumber(trends.deltas.length, locale),
      },
    ],
    y,
  )
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['trends.series'] ?? 'VM count over snapshots',
  )
}
