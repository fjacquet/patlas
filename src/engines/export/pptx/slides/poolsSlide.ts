/**
 * Pack C — Resource pools slide: KPI band (pool count / total members) +
 * native table of pool → member breakdown. Factual, no editorial verbs.
 */
import type PptxGenJS from 'pptxgenjs'
import type { PoolsPosture } from '@/engines/aggregation/governance'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 20

export function addPoolsSlide(
  pptx: PptxGenJS,
  pools: PoolsPosture,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['governance.pools.title'] ?? 'Resource pools')

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['governance.pools.kpi.pools'] ?? 'Pools',
        value: pptxNumber(pools.poolCount, locale),
      },
      {
        label: strings['governance.pools.kpi.members'] ?? 'Members',
        value: pptxNumber(pools.totalMembers, locale),
      },
    ],
    y,
  )

  if (pools.pools.length === 0) return

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })

  const header = [
    cell(strings['governance.pools.col.pool'] ?? 'Pool', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['governance.pools.col.members'] ?? 'Members', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
    cell(strings['governance.pools.col.vms'] ?? 'Guests', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
    cell(strings['governance.pools.col.storages'] ?? 'Storages', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
  ]

  const dataRows = pools.pools.slice(0, TOP_N).map((p) => [
    cell(p.pool),
    {
      ...cell(pptxNumber(p.memberCount, locale)),
      options: { ...cell('').options, align: 'right' },
    },
    {
      ...cell(p.vmCount > 0 ? pptxNumber(p.vmCount, locale) : '—'),
      options: { ...cell('').options, align: 'right' },
    },
    {
      ...cell(p.storageCount > 0 ? pptxNumber(p.storageCount, locale) : '—'),
      options: { ...cell('').options, align: 'right' },
    },
  ])

  const colW1 = CONTENT_W * 0.55
  const colW2 = CONTENT_W * 0.15
  const colW3 = CONTENT_W * 0.15
  const colW4 = CONTENT_W - colW1 - colW2 - colW3

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [colW1, colW2, colW3, colW4],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
