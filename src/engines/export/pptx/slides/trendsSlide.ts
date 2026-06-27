/**
 * Phase 10 — in-session trends: KPI cards + the app's real trend line
 * (rasterized).
 *
 * P8 Pack A: also covers SINGLE-FILE trends. When the cross-snapshot series is
 * null (fewer than two snapshots) but the active export carries an RRD
 * timeline, the slide renders the estate-wide RRD utilization summary instead
 * — so a single dropped file still produces a trends slide. The builder calls
 * this whenever `trends` is non-null OR `headroom.timeline` is non-empty.
 */
import type PptxGenJS from 'pptxgenjs'
import type { RrdHeadroom, TrendSeries } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, addNote, CONTENT_W, M } from './_layout'

export function addTrendsSlide(
  pptx: PptxGenJS,
  trends: TrendSeries | null,
  headroom: RrdHeadroom,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const pctStr = (r: number): string => `${pptxNumber(r * 100, locale)} %`

  if (trends === null) {
    // Single-file RRD trend (P8 Pack A): no cross-snapshot series, summarize
    // the intra-export estate utilization from the RRD timeline.
    const y = addHeader(s, strings['trends.singleTitle'] ?? 'Single-file trends — RRD time-series')
    const y2 = addKpiRow(
      s,
      [
        {
          label: strings['trends.singleSamples'] ?? 'Timeline samples',
          value: pptxNumber(headroom.timeline.length, locale),
        },
        {
          label: strings['trends.singleCpu'] ?? 'Mean CPU %',
          value: pctStr(headroom.estate.cpuAvg),
        },
        {
          label: strings['trends.singleMem'] ?? 'Mean memory %',
          value: pctStr(headroom.estate.memAvg),
        },
      ],
      y,
    )
    addNote(
      s,
      strings['trends.singleNote'] ?? 'Derived from the RRD time-series in this export.',
      y2,
    )
    return
  }

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
