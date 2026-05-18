/**
 * Phase 10 — DR scenario physical-impact: KPI cards + before/after bar
 * (real chart). Factual "no scenario" note when drSim is null. No verdict
 * language.
 */
import type PptxGenJS from 'pptxgenjs'
import type { DrSimResult } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, addNote, CONTENT_W, M } from './_layout'

export function addDrSimSlide(
  pptx: PptxGenJS,
  drSim: DrSimResult | null,
  chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['dr.title'] ?? 'DR results')
  if (drSim === null) {
    addNote(s, strings['dr.none'] ?? 'No DR scenario selected.', y)
    return
  }
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['dr.cpuRemovedCores'] ?? 'Phys. cores removed',
        value: pptxNumber(Number(drSim.physicalCpuRemovedCores), locale),
      },
      {
        label: strings['dr.ramRemovedMib'] ?? 'Phys. RAM removed (GiB)',
        value: pptxNumber(Math.round(Number(drSim.physicalRamRemovedMib) / 1024), locale),
      },
      {
        label: strings['dr.survivors'] ?? 'Survivor clusters',
        value: pptxNumber(drSim.perSurvivor.length, locale),
      },
    ],
    y,
  )
  addChartPanel(
    s,
    chartPng,
    { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 },
    strings['dr.beforeAfter'] ?? 'Physical capacity before / after',
  )
}
