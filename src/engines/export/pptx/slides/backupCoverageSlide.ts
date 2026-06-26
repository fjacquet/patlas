/**
 * Pack B — Backup coverage & operational health: vzdump task summary,
 * uncovered VMs, per-type task health. KPI band + native pptxgenjs tables.
 * Brand-free, factual, neutral. No editorial verbs, no numbers in strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { BackupCoverage } from '@/engines/aggregation/backupCoverage'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 14

export function addBackupCoverageSlide(
  pptx: PptxGenJS,
  coverage: BackupCoverage,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['protection.backupCoverage.heading'] ?? 'Backup coverage',
    strings['protection.backupCoverage.subtitle'] ?? 'vzdump tasks and operational health',
  )

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['protection.backupCoverage.kpi.total'] ?? 'vzdump tasks',
        value: pptxNumber(coverage.vzdump.totalCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.success'] ?? 'Successful',
        value: pptxNumber(coverage.vzdump.successCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.failed'] ?? 'Failed',
        value: pptxNumber(coverage.vzdump.failedCount, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.coveredVmids'] ?? 'VMs with backup',
        value: pptxNumber(coverage.vzdump.coveredVmids, locale),
      },
      {
        label: strings['protection.backupCoverage.kpi.uncoveredCount'] ?? 'VMs without backup',
        value: pptxNumber(coverage.vzdump.uncoveredCount, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })
  const hdrCell = (text: string) => cell(text, { bold: true, color: PPTX_COLORS.inkMuted })

  let curY = y2

  const subHead = (label: string): void => {
    s.addText(pptxSafeFormat(label), {
      x: M,
      y: curY,
      w: CONTENT_W,
      h: 0.28,
      color: PPTX_COLORS.ink,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
    })
    curY += 0.3
  }

  // Uncovered VMs table
  subHead(strings['protection.backupCoverage.uncovered.heading'] ?? 'VMs without successful backup')
  if (coverage.vzdump.uncoveredGuests.length === 0) {
    s.addText(
      pptxSafeFormat(
        strings['protection.backupCoverage.uncovered.none'] ??
          'All VMs have at least one successful backup.',
      ),
      {
        x: M,
        y: curY,
        w: CONTENT_W,
        h: 0.3,
        color: PPTX_COLORS.inkMuted,
        fontFace: 'Arial',
        fontSize: 10,
      },
    )
    curY += 0.35
  } else {
    const uncovHdr = [
      hdrCell(strings['protection.backupCoverage.col.vmName'] ?? 'VM'),
      hdrCell(strings['protection.backupCoverage.col.vmId'] ?? 'VM ID'),
    ]
    const uncovRows = coverage.vzdump.uncoveredGuests
      .slice(0, TOP_N)
      .map((g) => [cell(g.vmName), cell(g.vmid)])
    s.addTable([uncovHdr, ...uncovRows], {
      x: M,
      y: curY,
      w: CONTENT_W * 0.48,
      colW: [CONTENT_W * 0.34, CONTENT_W * 0.14],
      rowH: 0.24,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
    curY += (uncovRows.length + 1) * 0.24 + 0.15
  }

  // Operational health: per-type summary table
  subHead(strings['protection.backupCoverage.operationalHealth.heading'] ?? 'Operational health')
  if (coverage.operationalHealth.taskTypes.length > 0) {
    const ohHdr = [
      hdrCell(strings['protection.backupCoverage.col.type'] ?? 'Type'),
      cell(strings['protection.backupCoverage.col.total'] ?? 'Total', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
      cell(strings['protection.backupCoverage.col.ok'] ?? 'OK', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
      cell(strings['protection.backupCoverage.col.failed'] ?? 'Failed', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
    ]
    const ohRows = coverage.operationalHealth.taskTypes
      .slice(0, TOP_N)
      .map((t) => [
        cell(t.type),
        cell(pptxNumber(t.total, locale), { align: 'right' }),
        cell(pptxNumber(t.ok, locale), { align: 'right' }),
        cell(pptxNumber(t.failed, locale), { align: 'right' }),
      ])
    s.addTable([ohHdr, ...ohRows], {
      x: M,
      y: curY,
      w: CONTENT_W * 0.5,
      colW: [CONTENT_W * 0.28, CONTENT_W * 0.07, CONTENT_W * 0.07, CONTENT_W * 0.08],
      rowH: 0.24,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }
}
