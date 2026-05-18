/**
 * Phase 10 — DR scenario physical-impact slide (P6 DrSimResult). Factual
 * physical CPU/RAM removed + survivor count; a factual "no scenario" line
 * when drSim is null. No verdict language.
 */
import type PptxGenJS from 'pptxgenjs'
import type { DrSimResult } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { PPTX_THEME, SLIDE } from '../theme'
import { addHeading, addMetricList } from './_layout'

export function addDrSimSlide(
  pptx: PptxGenJS,
  drSim: DrSimResult | null,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  addHeading(s, strings['dr.title'] ?? 'DR results')
  if (drSim === null) {
    s.addText(strings['dr.none'] ?? 'No DR scenario selected.', {
      ...PPTX_THEME.body,
      x: SLIDE.margin,
      y: 1.3,
      w: SLIDE.w - SLIDE.margin * 2,
      h: 0.4,
    })
    return
  }
  addMetricList(s, [
    {
      label: strings['dr.cpuRemovedCores'] ?? 'Physical cores removed',
      value: pptxNumber(Number(drSim.physicalCpuRemovedCores), locale),
    },
    {
      label: strings['dr.ramRemovedMib'] ?? 'Physical RAM removed (MiB)',
      value: pptxNumber(Number(drSim.physicalRamRemovedMib), locale),
    },
    {
      label: strings['dr.survivors'] ?? 'Survivor clusters',
      value: pptxNumber(drSim.perSurvivor.length, locale),
    },
  ])
}
