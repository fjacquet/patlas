/**
 * Plan A — Snapshot Sprawl: how many checkpoints the Proxmox estate holds,
 * how old, how large. KPI band + a NATIVE pptxgenjs table of the top-N
 * oldest checkpoints (native tables render text fine — the resvg trap only
 * affects rasterized chart images). Brand-free, factual, neutral measurement.
 * No VMware tokens, no editorial verbs, no numbers embedded in i18n strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { SnapshotSprawl } from '@/engines/aggregation/snapshotSprawl'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 18

export function addSnapshotSprawlSlide(
  pptx: PptxGenJS,
  sprawl: SnapshotSprawl,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['snapshotSprawl.title'] ?? 'Snapshot sprawl — checkpoint inventory',
  )
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['snapshotSprawl.kpi.snapshots'] ?? 'Checkpoints',
        value: pptxNumber(sprawl.count, locale),
      },
      {
        label: strings['snapshotSprawl.kpi.guests'] ?? 'Guests w/ checkpoints',
        value: pptxNumber(sprawl.guestsWithSnapshots, locale),
      },
      {
        label: strings['snapshotSprawl.kpi.totalGib'] ?? 'Total size',
        value: pptxMemMib(sprawl.totalSizeMib, locale),
      },
      {
        label: strings['snapshotSprawl.kpi.oldestDays'] ?? 'Oldest (days)',
        value: pptxNumber(sprawl.oldestAgeDays ?? 0, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })

  const header = [
    cell(strings['snapshotSprawl.col.guest'] ?? 'Guest', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['snapshotSprawl.col.node'] ?? 'Node', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['snapshotSprawl.col.checkpoint'] ?? 'Checkpoint', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['snapshotSprawl.col.ageDays'] ?? 'Age (days)', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
    cell(strings['snapshotSprawl.col.sizeGib'] ?? 'Size (GiB)', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
  ]

  const dataRows = sprawl.rows
    .slice(0, TOP_N)
    .map((r) => [
      cell(r.guestName),
      cell(r.node),
      cell(r.name),
      cell(r.ageDays !== null ? pptxNumber(r.ageDays, locale) : '—', { align: 'right' }),
      cell(pptxMemMib(r.sizeMib, locale), { align: 'right' }),
    ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.28,
      CONTENT_W * 0.18,
      CONTENT_W * 0.28,
      CONTENT_W * 0.13,
      CONTENT_W * 0.13,
    ],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
