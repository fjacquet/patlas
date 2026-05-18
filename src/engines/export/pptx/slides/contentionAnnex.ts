/**
 * Phase 10 — CPU-Ready contention annex (PPT-03, CONDITIONAL: the builder
 * only calls this when readiness data is present). Factual list of the
 * worst CPU-Ready clusters; no verdict colour. Pure.
 */
import type PptxGenJS from 'pptxgenjs'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeading, addMetricList } from './_layout'

export interface ContentionRow {
  cluster: string
  cpuReadyPct: number
}

export function addContentionAnnex(
  pptx: PptxGenJS,
  rows: ReadonlyArray<ContentionRow>,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  addHeading(s, strings['contention.title'] ?? 'CPU Ready (annex)')
  addMetricList(
    s,
    rows.slice(0, 12).map((r) => ({
      label: r.cluster,
      value: `${pptxNumber(Number(r.cpuReadyPct), locale, 1)} %`,
    })),
  )
}
