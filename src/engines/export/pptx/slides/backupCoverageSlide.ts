/**
 * Pack B — Backup coverage & operational health: vzdump task summary,
 * uncovered VMs, per-type task health. KPI band + two side-by-side native
 * pptxgenjs tables (the slide is 12.33" wide). Side-by-side makes the prior
 * vertical-stack overlap structurally impossible. Brand-free, factual, neutral.
 * No editorial verbs, no numbers in strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { BackupCoverage } from '@/engines/aggregation/backupCoverage'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, addMoreFooter, CONTENT_W, M } from './_layout'

const TOP_N = 12

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

  // Two columns: left = uncovered guests, right = operational health. Both
  // start at the same y below the KPI row, so they cannot collide vertically.
  const leftX = M
  const leftW = CONTENT_W * 0.48
  const rightX = M + CONTENT_W * 0.52
  const rightW = CONTENT_W * 0.46
  const startY = y2
  const rowH = 0.24

  const subHead = (label: string, x: number, w: number): void => {
    s.addText(pptxSafeFormat(label), {
      x,
      y: startY,
      w,
      h: 0.28,
      color: PPTX_COLORS.ink,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
    })
  }
  const tableY = startY + 0.32

  // LEFT — VMs without a successful backup (capped + remainder footer).
  subHead(
    strings['protection.backupCoverage.uncovered.heading'] ?? 'VMs without successful backup',
    leftX,
    leftW,
  )
  if (coverage.vzdump.uncoveredGuests.length === 0) {
    s.addText(
      pptxSafeFormat(
        strings['protection.backupCoverage.uncovered.none'] ??
          'All VMs have at least one successful backup.',
      ),
      {
        x: leftX,
        y: tableY,
        w: leftW,
        h: 0.3,
        color: PPTX_COLORS.inkMuted,
        fontFace: 'Arial',
        fontSize: 10,
      },
    )
  } else {
    const uncovHdr = [
      hdrCell(strings['protection.backupCoverage.col.vmName'] ?? 'VM'),
      hdrCell(strings['protection.backupCoverage.col.vmId'] ?? 'VM ID'),
    ]
    const shown = coverage.vzdump.uncoveredGuests.slice(0, TOP_N)
    const uncovRows = shown.map((g) => [cell(g.vmName), cell(g.vmid)])
    s.addTable([uncovHdr, ...uncovRows], {
      x: leftX,
      y: tableY,
      w: leftW,
      colW: [leftW * 0.7, leftW * 0.3],
      rowH,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
    const remainder = coverage.vzdump.uncoveredGuests.length - shown.length
    if (remainder > 0) {
      addMoreFooter(
        s,
        strings['protection.backupCoverage.more'] ?? '+ {{count}} more guests without backup',
        remainder,
        locale,
        { x: leftX, y: tableY + (shown.length + 1) * rowH + 0.06, w: leftW, h: 0.3 },
      )
    }
  }

  // RIGHT — operational health per task type.
  subHead(
    strings['protection.backupCoverage.operationalHealth.heading'] ?? 'Operational health',
    rightX,
    rightW,
  )
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
      x: rightX,
      y: tableY,
      w: rightW,
      colW: [rightW * 0.46, rightW * 0.18, rightW * 0.18, rightW * 0.18],
      rowH,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }
}
