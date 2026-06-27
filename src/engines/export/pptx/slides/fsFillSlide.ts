/**
 * Pack B — Filesystem fill risk: mounts at or above the configured threshold.
 * KPI band + native pptxgenjs table of the top-N at-risk mounts.
 * Brand-free, factual, neutral. No editorial verbs, no numbers in strings.
 */
import type PptxGenJS from 'pptxgenjs'
import type { FsFillRisk } from '@/engines/aggregation/fsFillRisk'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, addMoreFooter, CONTENT_W, M } from './_layout'

const TOP_N = 12

export function addFsFillSlide(
  pptx: PptxGenJS,
  risk: FsFillRisk,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(
    s,
    strings['protection.fsFill.heading'] ?? 'Filesystem fill risk',
    strings['protection.fsFill.subtitle'] ?? 'In-guest mounts at or above threshold',
  )

  const pct = (v: number): string => `${pptxNumber(Math.round(v), locale)} %`

  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['protection.fsFill.kpi.overThreshold'] ?? 'Mounts over threshold',
        value: pptxNumber(risk.overThresholdCount, locale),
      },
      {
        label: strings['protection.fsFill.kpi.totalMounts'] ?? 'Total mounts',
        value: pptxNumber(risk.totalMounts, locale),
      },
      {
        label: strings['protection.fsFill.kpi.totalVms'] ?? 'VMs with partitions',
        value: pptxNumber(risk.totalVms, locale),
      },
      {
        label: strings['protection.fsFill.kpi.threshold'] ?? 'Threshold',
        value: pct(risk.threshold * 100),
      },
    ],
    y,
  )

  if (risk.overThreshold.length === 0) {
    s.addText(
      pptxSafeFormat(strings['protection.fsFill.none'] ?? 'No mounts at or above threshold.'),
      {
        x: M,
        y: y2,
        w: CONTENT_W,
        h: 0.4,
        color: PPTX_COLORS.inkMuted,
        fontFace: 'Arial',
        fontSize: 12,
      },
    )
    return
  }

  const cell = (text: string, opts: Record<string, unknown> = {}) => ({
    text: pptxSafeFormat(text),
    options: { fontFace: 'Arial', fontSize: 10, color: PPTX_COLORS.ink, ...opts },
  })

  const hdr = [
    cell(strings['protection.fsFill.col.node'] ?? 'Node', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['protection.fsFill.col.vmName'] ?? 'VM', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['protection.fsFill.col.mountPoint'] ?? 'Mount point', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['protection.fsFill.col.fsType'] ?? 'FS type', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
    }),
    cell(strings['protection.fsFill.col.totalGb'] ?? 'Total (GB)', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
    cell(strings['protection.fsFill.col.usedPct'] ?? 'Used %', {
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align: 'right',
    }),
  ]

  const shown = risk.overThreshold.slice(0, TOP_N)
  const rows = shown.map((r) => [
    cell(r.node),
    cell(r.vmName || r.vmId),
    cell(r.mountPoint),
    cell(r.fsType),
    cell(pptxNumber(Math.round(r.totalGb), locale), { align: 'right' }),
    cell(r.usedPct !== null ? pct(r.usedPct) : '—', { align: 'right' }),
  ])

  const rowH = 0.26
  const tableY = y2 + 0.05
  s.addTable([hdr, ...rows], {
    x: M,
    y: tableY,
    w: CONTENT_W,
    colW: [
      CONTENT_W * 0.15,
      CONTENT_W * 0.22,
      CONTENT_W * 0.28,
      CONTENT_W * 0.13,
      CONTENT_W * 0.11,
      CONTENT_W * 0.11,
    ],
    rowH,
    valign: 'middle',
    border: { type: 'solid', pt: 0.5, color: PPTX_COLORS.hairline },
    autoPage: false,
  })

  const remainder = risk.overThreshold.length - shown.length
  if (remainder > 0) {
    addMoreFooter(
      s,
      strings['protection.fsFill.more'] ?? '+ {{count}} more mounts over threshold',
      remainder,
      locale,
      { x: M, y: tableY + (shown.length + 1) * rowH + 0.06, w: CONTENT_W, h: 0.3 },
    )
  }
}
