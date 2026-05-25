/**
 * P-RS — Monster VMs: the largest VMs by CONFIGURED allocation. KPI count +
 * a NATIVE pptxgenjs table of the top-N (native tables render text fine — the
 * resvg trap only affects rasterized chart images) + a thresholds caption.
 * Brand-free, factual, neutral measurement against user-editable lines.
 */
import type PptxGenJS from 'pptxgenjs'
import type { MonsterEstate } from '@/engines/aggregation'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const MIB_PER_GIB = 1024
const TOP_N = 18

export function addMonsterSlide(
  pptx: PptxGenJS,
  monsters: MonsterEstate,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['monster.title'] ?? 'Monster VMs — largest by allocation')
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['monster.count'] ?? 'Monster VMs',
        value: pptxNumber(monsters.count, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })
  const header = [
    cell(strings['monster.colVm'] ?? 'VM', { bold: true, color: PPTX_COLORS.inkMuted }),
    cell(strings['monster.colCluster'] ?? 'Cluster', { bold: true, color: PPTX_COLORS.inkMuted }),
    cell(strings['monster.colVcpu'] ?? 'vCPU', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
    cell(strings['monster.colVram'] ?? 'vRAM (GiB)', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
  ]
  const dataRows = monsters.rows
    .slice(0, TOP_N)
    .map((r) => [
      cell(r.vmName),
      cell(r.cluster),
      cell(pptxNumber(r.vcpu, locale), { align: 'right' }),
      cell(pptxNumber(Math.round(r.vramMib / MIB_PER_GIB), locale), { align: 'right' }),
    ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [CONTENT_W * 0.42, CONTENT_W * 0.3, CONTENT_W * 0.14, CONTENT_W * 0.14],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })

  const t = monsters.thresholds
  s.addText(
    pptxSafeFormat(
      `${strings['monster.lines'] ?? 'Lines'}: vCPU ≥ ${t.minVcpu} · vRAM ≥ ${t.minVramGib} GiB`,
    ),
    {
      x: M,
      y: 7.0,
      w: CONTENT_W,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 10,
      color: PPTX_COLORS.inkMuted,
      margin: 0,
    },
  )
}
