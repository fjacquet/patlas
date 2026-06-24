/**
 * Plan A — Storage Content: what occupies Proxmox storage, broken down by
 * content type and by storage pool. KPI band + two native pptxgenjs tables
 * (by content type; by storage pool), each capped at 12 rows.
 * Brand-free, factual, neutral measurement. No VMware tokens, no editorial
 * verbs, no numbers embedded in i18n strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { StorageContentHealth } from '@/engines/aggregation/storageContentHealth'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 12

export function addStorageContentSlide(
  pptx: PptxGenJS,
  storage: StorageContentHealth,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['storageContent.title'] ?? 'Storage content — file inventory by type and pool',
  )
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['storageContent.kpi.totalGib'] ?? 'Total size',
        value: pptxMemMib(storage.totalSizeMib, locale),
      },
      {
        label: strings['storageContent.kpi.files'] ?? 'Files',
        value: pptxNumber(storage.fileCount, locale),
      },
      {
        label: strings['storageContent.kpi.contentTypes'] ?? 'Content types',
        value: pptxNumber(storage.byContent.length, locale),
      },
      {
        label: strings['storageContent.kpi.backups'] ?? 'Backup files',
        value: pptxNumber(storage.backups.count, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })

  const headerCell = (text: string, align?: 'right') =>
    cell(text, { bold: true, color: PPTX_COLORS.inkMuted, ...(align ? { align } : {}) })

  // Table 1: by content type (left half)
  const byContentHeader = [
    headerCell(strings['storageContent.col.content'] ?? 'Content'),
    headerCell(strings['storageContent.col.count'] ?? 'Count', 'right'),
    headerCell(strings['storageContent.col.sizeGib'] ?? 'Size (GiB)', 'right'),
  ]

  const byContentRows = storage.byContent
    .slice(0, TOP_N)
    .map((r) => [
      cell(r.content),
      cell(pptxNumber(r.count, locale), { align: 'right' }),
      cell(pptxMemMib(r.totalSizeMib, locale), { align: 'right' }),
    ])

  // Table 2: by storage pool (right half)
  const byStorageHeader = [
    headerCell(strings['storageContent.col.storage'] ?? 'Storage'),
    headerCell(strings['storageContent.col.count'] ?? 'Count', 'right'),
    headerCell(strings['storageContent.col.sizeGib'] ?? 'Size (GiB)', 'right'),
  ]

  const byStorageRows = storage.byStorage
    .slice(0, TOP_N)
    .map((r) => [
      cell(r.storage),
      cell(pptxNumber(r.count, locale), { align: 'right' }),
      cell(pptxMemMib(r.totalSizeMib, locale), { align: 'right' }),
    ])

  const tableY = y2 + 0.15
  const halfW = (CONTENT_W - 0.2) / 2

  s.addTable([byContentHeader, ...byContentRows], {
    x: M,
    y: tableY,
    w: halfW,
    colW: [halfW * 0.5, halfW * 0.25, halfW * 0.25],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })

  s.addTable([byStorageHeader, ...byStorageRows], {
    x: M + halfW + 0.2,
    y: tableY,
    w: halfW,
    colW: [halfW * 0.5, halfW * 0.25, halfW * 0.25],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
