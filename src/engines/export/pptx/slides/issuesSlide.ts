/**
 * Pack C — Issues slide: KPI band (total / errors / warnings) + native table
 * of the top-N issue rows grouped by section. Factual, no editorial verbs.
 */
import type PptxGenJS from 'pptxgenjs'
import type { IssuesPosture } from '@/engines/aggregation/governance'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 15

export function addIssuesSlide(
  pptx: PptxGenJS,
  issues: IssuesPosture,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['governance.issues.title'] ?? 'Issues')

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['governance.issues.kpi.total'] ?? 'Total',
        value: pptxNumber(issues.totalCount, locale),
      },
      {
        label: strings['governance.issues.kpi.errors'] ?? 'Errors',
        value: pptxNumber(issues.errorCount, locale),
      },
      {
        label: strings['governance.issues.kpi.warnings'] ?? 'Warnings',
        value: pptxNumber(issues.warningCount, locale),
      },
    ],
    y,
  )

  if (issues.rows.length === 0) return

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })

  const header = [
    cell(strings['governance.issues.col.severity'] ?? 'Severity', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['governance.issues.col.section'] ?? 'Section', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['governance.issues.col.message'] ?? 'Message', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
  ]

  const dataRows = issues.rows
    .slice(0, TOP_N)
    .map((r) => [cell(r.severity), cell(r.section), cell(r.message)])

  const colW1 = 1.2
  const colW2 = 1.8
  const colW3 = CONTENT_W - colW1 - colW2

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [colW1, colW2, colW3],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
