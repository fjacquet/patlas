/** Phase 10 — OS end-of-support forecast: KPI strip + the app's EOS
 *  bucket bar (real chart, rasterized). */
import type PptxGenJS from 'pptxgenjs'
import type { EosProjection } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addEosSlide(
  pptx: PptxGenJS,
  eos: EosProjection,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const c = eos.cumulative
  const y = addHeader(s, strings['eos.title'] ?? 'OS end-of-support forecast')
  const y2 = addKpiRow(
    s,
    [
      { label: strings['eos.overdue'] ?? 'Overdue', value: pptxNumber(c.overdue, locale) },
      { label: strings['eos.le3'] ?? '≤ 3 mo', value: pptxNumber(c.le3, locale) },
      { label: strings['eos.le6'] ?? '≤ 6 mo', value: pptxNumber(c.le6, locale) },
      { label: strings['eos.le9'] ?? '≤ 9 mo', value: pptxNumber(c.le9, locale) },
      { label: strings['eos.le12'] ?? '≤ 12 mo', value: pptxNumber(c.le12, locale) },
      { label: strings['eos.unknown'] ?? 'Unknown', value: pptxNumber(c.unknown, locale) },
    ],
    y,
  )
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['eos.byBucket'] ?? 'By support window',
  )
}
