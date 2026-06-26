/**
 * P8 Pack A — Storage time-to-full slide. KPI band + a NATIVE pptxgenjs table
 * of per-storage capacity growth (GiB/day) and projected days-to-full from the
 * RRD-Storage time-series. `daysToFull` is the em-dash sentinel when a storage
 * is not growing / already full (never fabricated). Brand-free, factual,
 * neutral — no verdict colour, no editorial verb, no numbers in i18n strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { RrdStorageGrowth } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 18

export function addStorageGrowthSlide(
  pptx: PptxGenJS,
  g: RrdStorageGrowth,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['storageGrowth.title'] ?? 'Storage time-to-full — RRD growth')
  const growing = g.rows.filter((r) => r.growthGibPerDay > 0).length

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['storageGrowth.kpi.storages'] ?? 'Storages',
        value: pptxNumber(g.rows.length, locale),
      },
      {
        label: strings['storageGrowth.kpi.soonest'] ?? 'Soonest full (days)',
        value:
          g.soonestDaysToFull === null ? '—' : pptxNumber(Math.round(g.soonestDaysToFull), locale),
      },
      {
        label: strings['storageGrowth.kpi.window'] ?? 'Window (days)',
        value: pptxNumber(Math.round(g.windowDays), locale),
      },
      {
        label: strings['storageGrowth.kpi.growing'] ?? 'Growing storages',
        value: pptxNumber(growing, locale),
      },
    ],
    y,
  )

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 11, color: PPTX_COLORS.ink, ...opts },
  })
  const head = (text: string, align: 'left' | 'right' = 'left') =>
    cell(text, { bold: true, color: PPTX_COLORS.inkMuted, align })

  const header = [
    head(strings['storageGrowth.col.storage'] ?? 'Storage'),
    head(strings['storageGrowth.col.node'] ?? 'Node'),
    head(strings['storageGrowth.col.used'] ?? 'Used (GiB)', 'right'),
    head(strings['storageGrowth.col.size'] ?? 'Size (GiB)', 'right'),
    head(strings['storageGrowth.col.usage'] ?? 'Usage', 'right'),
    head(strings['storageGrowth.col.growth'] ?? 'Growth (GiB/day)', 'right'),
    head(strings['storageGrowth.col.daysToFull'] ?? 'Days to full', 'right'),
  ]

  const dataRows = g.rows.slice(0, TOP_N).map((r) => [
    cell(r.storage),
    cell(r.node),
    cell(pptxNumber(Math.round(r.usedGib), locale), { align: 'right' }),
    cell(pptxNumber(Math.round(r.sizeGib), locale), { align: 'right' }),
    cell(`${pptxNumber(r.usageRatio * 100, locale)} %`, { align: 'right' }),
    cell(pptxNumber(Math.round(r.growthGibPerDay * 10) / 10, locale, 1), { align: 'right' }),
    cell(r.daysToFull === null ? '—' : pptxNumber(Math.round(r.daysToFull), locale), {
      align: 'right',
    }),
  ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.2,
      CONTENT_W * 0.2,
      CONTENT_W * 0.12,
      CONTENT_W * 0.12,
      CONTENT_W * 0.12,
      CONTENT_W * 0.12,
      CONTENT_W * 0.12,
    ],
    rowH: 0.28,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })
}
