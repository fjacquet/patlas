/**
 * Pack B — Disk hygiene: unused/orphaned disks, stray ISOs, no-backup disks,
 * risky cache modes. KPI band + native pptxgenjs tables.
 * Brand-free, factual, neutral. No editorial verbs, no numbers in strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { DiskHygiene } from '@/engines/aggregation/diskHygiene'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 10

export function addDiskHygieneSlide(
  pptx: PptxGenJS,
  hygiene: DiskHygiene,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['protection.diskHygiene.heading'] ?? 'Disk hygiene',
    strings['protection.diskHygiene.subtitle'] ??
      'Unused disks, stray ISOs, backup exclusions, cache modes',
  )

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['protection.diskHygiene.kpi.unusedCount'] ?? 'Orphaned disks',
        value: pptxNumber(hygiene.unusedCount, locale),
      },
      {
        label: strings['protection.diskHygiene.kpi.reclaimableGb'] ?? 'Reclaimable (GB)',
        value: pptxNumber(Math.round(hygiene.reclaimableGb), locale),
      },
      {
        label: strings['protection.diskHygiene.kpi.strayIsoCount'] ?? 'Stray ISOs',
        value: pptxNumber(hygiene.strayIsoCount, locale),
      },
      {
        label: strings['protection.diskHygiene.kpi.noBackupCount'] ?? 'Disks without backup',
        value: pptxNumber(hygiene.noBackupCount, locale),
      },
      {
        label: strings['protection.diskHygiene.kpi.riskyCacheCount'] ?? 'Risky cache modes',
        value: pptxNumber(hygiene.riskyCacheCount, locale),
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

  // Section sub-heading helper
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

  // Disk table helper (node / vmName / id / storage / fileName / sizeGb)
  const diskTable = (
    rows: ReadonlyArray<{
      node: string
      vmId: string
      vmName: string
      id: string
      storage: string
      fileName: string
      sizeGb: number
    }>,
  ): void => {
    if (rows.length === 0) return
    const hdr = [
      hdrCell(strings['protection.diskHygiene.col.node'] ?? 'Node'),
      hdrCell(strings['protection.diskHygiene.col.vmName'] ?? 'VM'),
      hdrCell(strings['protection.diskHygiene.col.id'] ?? 'Disk ID'),
      hdrCell(strings['protection.diskHygiene.col.storage'] ?? 'Storage'),
      hdrCell(strings['protection.diskHygiene.col.fileName'] ?? 'File'),
      cell(strings['protection.diskHygiene.col.sizeGb'] ?? 'Size (GB)', {
        bold: true,
        color: PPTX_COLORS.inkMuted,
        align: 'right',
      }),
    ]
    const dataRows = rows
      .slice(0, TOP_N)
      .map((r) => [
        cell(r.node),
        cell(r.vmName || r.vmId),
        cell(r.id),
        cell(r.storage),
        cell(r.fileName),
        cell(pptxNumber(Math.round(r.sizeGb), locale), { align: 'right' }),
      ])
    s.addTable([hdr, ...dataRows], {
      x: M,
      y: curY,
      w: CONTENT_W,
      colW: [
        CONTENT_W * 0.12,
        CONTENT_W * 0.18,
        CONTENT_W * 0.12,
        CONTENT_W * 0.15,
        CONTENT_W * 0.35,
        CONTENT_W * 0.08,
      ],
      rowH: 0.24,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
    curY += (dataRows.length + 1) * 0.24 + 0.15
  }

  if (hygiene.unusedCount > 0) {
    subHead(strings['protection.diskHygiene.unused.heading'] ?? 'Orphaned disks')
    diskTable(hygiene.unusedDisks)
  }
  if (hygiene.strayIsoCount > 0) {
    subHead(strings['protection.diskHygiene.strayIso.heading'] ?? 'Stray mounted ISOs')
    diskTable(hygiene.strayIsos)
  }

  if (hygiene.riskyCacheCount > 0) {
    subHead(strings['protection.diskHygiene.riskyCache.heading'] ?? 'Disks with non-standard cache')
    const hdr = [
      hdrCell(strings['protection.diskHygiene.col.node'] ?? 'Node'),
      hdrCell(strings['protection.diskHygiene.col.vmName'] ?? 'VM'),
      hdrCell(strings['protection.diskHygiene.col.id'] ?? 'Disk ID'),
      hdrCell(strings['protection.diskHygiene.col.storage'] ?? 'Storage'),
      hdrCell(strings['protection.diskHygiene.col.cache'] ?? 'Cache'),
    ]
    const dataRows = hygiene.riskyCacheDisks
      .slice(0, TOP_N)
      .map((r) => [
        cell(r.node),
        cell(r.vmName || r.vmId),
        cell(r.id),
        cell(r.storage),
        cell(r.cache),
      ])
    s.addTable([hdr, ...dataRows], {
      x: M,
      y: curY,
      w: CONTENT_W,
      colW: [
        CONTENT_W * 0.15,
        CONTENT_W * 0.25,
        CONTENT_W * 0.15,
        CONTENT_W * 0.25,
        CONTENT_W * 0.2,
      ],
      rowH: 0.24,
      valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
      autoPage: false,
    })
  }

  if (
    hygiene.unusedCount === 0 &&
    hygiene.strayIsoCount === 0 &&
    hygiene.riskyCacheCount === 0 &&
    hygiene.noBackupCount === 0
  ) {
    s.addText(pptxSafeFormat('—'), {
      x: M,
      y: curY,
      w: CONTENT_W,
      h: 0.4,
      color: PPTX_COLORS.inkMuted,
      fontFace: 'Arial',
      fontSize: 12,
    })
  }
}
