/**
 * Phase 10 — CPU-Ready contention annex (PPT-03, CONDITIONAL: the builder
 * only calls this when readiness data is present). Header band + KPI cards
 * for the worst CPU-Ready clusters (top 8, factual % — no verdict colour).
 */
import type PptxGenJS from 'pptxgenjs'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addHeader, addKpiRow } from './_layout'

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
  let y = addHeader(s, strings['contention.title'] ?? 'CPU Ready (annex)')
  const top = rows.slice(0, 8)
  // Up to 4 cards per row.
  for (let i = 0; i < top.length; i += 4) {
    y = addKpiRow(
      s,
      top.slice(i, i + 4).map((r) => ({
        label: r.cluster,
        value: `${pptxNumber(Number(r.cpuReadyPct), locale, 1)} %`,
      })),
      y,
    )
  }
}
