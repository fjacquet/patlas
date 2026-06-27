/**
 * P8 Pack A — Node Headroom slide. KPI band of estate-wide RRD utilization +
 * a NATIVE pptxgenjs table of the top-N nodes by CPU peak (peak / p95 / mean
 * CPU & memory). Native tables render text fine (the resvg trap only affects
 * rasterized chart images). Brand-free, factual, neutral — no verdict colour,
 * no editorial verb, no numbers embedded in i18n strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { RrdHeadroom } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

const TOP_N = 18

export function addRrdHeadroomSlide(
  pptx: PptxGenJS,
  hr: RrdHeadroom,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['rrdHeadroom.title'] ?? 'Node headroom — RRD utilization')
  const pctStr = (r: number): string => `${pptxNumber(r * 100, locale)} %`

  const y2 = addKpiRow(
    s,
    [
      { label: strings['rrdHeadroom.kpi.cpuPeak'] ?? 'Peak CPU', value: pctStr(hr.estate.cpuPeak) },
      { label: strings['rrdHeadroom.kpi.cpuAvg'] ?? 'Mean CPU', value: pctStr(hr.estate.cpuAvg) },
      {
        label: strings['rrdHeadroom.kpi.memPeak'] ?? 'Peak memory',
        value: pctStr(hr.estate.memPeak),
      },
      {
        label: strings['rrdHeadroom.kpi.memAvg'] ?? 'Mean memory',
        value: pctStr(hr.estate.memAvg),
      },
      {
        label: strings['rrdHeadroom.kpi.psiMemPeak'] ?? 'Peak memory pressure',
        value: pctStr(hr.estate.psiMemPeak),
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
    head(strings['rrdHeadroom.col.node'] ?? 'Node'),
    head(strings['rrdHeadroom.col.cpuPeak'] ?? 'CPU peak', 'right'),
    head(strings['rrdHeadroom.col.cpuP95'] ?? 'CPU p95', 'right'),
    head(strings['rrdHeadroom.col.cpuAvg'] ?? 'CPU mean', 'right'),
    head(strings['rrdHeadroom.col.memPeak'] ?? 'Mem peak', 'right'),
    head(strings['rrdHeadroom.col.memP95'] ?? 'Mem p95', 'right'),
    head(strings['rrdHeadroom.col.memAvg'] ?? 'Mem mean', 'right'),
  ]

  const dataRows = hr.perNode
    .slice(0, TOP_N)
    .map((n) => [
      cell(n.node),
      cell(pctStr(n.cpuPeak), { align: 'right' }),
      cell(pctStr(n.cpuP95), { align: 'right' }),
      cell(pctStr(n.cpuAvg), { align: 'right' }),
      cell(pctStr(n.memPeak), { align: 'right' }),
      cell(pctStr(n.memP95), { align: 'right' }),
      cell(pctStr(n.memAvg), { align: 'right' }),
    ])

  s.addTable([header, ...dataRows], {
    x: M,
    y: y2 + 0.1,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.28,
      CONTENT_W * 0.12,
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
