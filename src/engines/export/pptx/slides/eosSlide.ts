/** Phase 10 — OS end-of-support forecast (P7 EosProjection.cumulative). */
import type PptxGenJS from 'pptxgenjs'
import type { EosProjection } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeading, addMetricList } from './_layout'

export function addEosSlide(
  pptx: PptxGenJS,
  eos: EosProjection,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const c = eos.cumulative
  const s = pptx.addSlide()
  addHeading(s, strings['eos.title'] ?? 'OS end-of-support forecast')
  addMetricList(s, [
    { label: strings['eos.overdue'] ?? 'Overdue', value: pptxNumber(c.overdue, locale) },
    { label: strings['eos.le3'] ?? 'Within 3 months', value: pptxNumber(c.le3, locale) },
    { label: strings['eos.le6'] ?? 'Within 6 months', value: pptxNumber(c.le6, locale) },
    { label: strings['eos.le9'] ?? 'Within 9 months', value: pptxNumber(c.le9, locale) },
    { label: strings['eos.le12'] ?? 'Within 12 months', value: pptxNumber(c.le12, locale) },
    { label: strings['eos.unknown'] ?? 'Unknown', value: pptxNumber(c.unknown, locale) },
  ])
}
