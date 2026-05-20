/**
 * Phase 18 — OS end-of-support forecast: KPI strip + a NATIVE pptxgenjs bar
 * chart (per-bucket rects with category + value labels). The previous
 * rasterized ECharts bar lost ALL text — resvg-wasm renders chart SVG with
 * no font loaded, so axis/value labels vanished. Native shapes+text always
 * render. Brand-free (navy bars). Factual.
 */
import type PptxGenJS from 'pptxgenjs'
import type { EosProjection } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addEosSlide(
  pptx: PptxGenJS,
  eos: EosProjection,
  _chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const c = eos.cumulative
  const y = addHeader(s, strings['eos.title'] ?? 'OS end-of-support forecast')
  const buckets = [
    { label: strings['eos.overdue'] ?? 'Overdue', value: c.overdue },
    { label: strings['eos.le3'] ?? '≤ 3 mo', value: c.le3 },
    { label: strings['eos.le6'] ?? '≤ 6 mo', value: c.le6 },
    { label: strings['eos.le9'] ?? '≤ 9 mo', value: c.le9 },
    { label: strings['eos.le12'] ?? '≤ 12 mo', value: c.le12 },
    { label: strings['eos.unknown'] ?? 'Unknown', value: c.unknown },
  ]
  const y2 = addKpiRow(
    s,
    buckets.map((b) => ({ label: b.label, value: pptxNumber(b.value, locale) })),
    y,
  )

  // ── Native bar chart (text guaranteed to render) ──────────────────────
  const panelY = y2
  const panelH = 7.15 - y2
  s.addShape('roundRect', {
    x: M,
    y: panelY,
    w: CONTENT_W,
    h: panelH,
    fill: { color: PPTX_COLORS.pageBg },
    line: { color: PPTX_COLORS.hairline, width: 0.75 },
    rectRadius: 0.06,
  })
  s.addText(pptxSafeFormat(strings['eos.byBucket'] ?? 'By support window'), {
    x: M + 0.25,
    y: panelY + 0.12,
    w: CONTENT_W - 0.5,
    h: 0.3,
    fontFace: 'Calibri',
    fontSize: 12,
    bold: true,
    color: PPTX_COLORS.inkMuted,
    margin: 0,
  })
  const plotTop = panelY + 0.55
  const labelBandH = 0.55
  const plotH = panelH - 0.55 - labelBandH - 0.2
  const plotBottom = plotTop + plotH
  const max = Math.max(1, ...buckets.map((b) => b.value))
  const gap = 0.25
  const bw = (CONTENT_W - 0.5 - gap * (buckets.length - 1)) / buckets.length
  buckets.forEach((b, i) => {
    const bx = M + 0.25 + i * (bw + gap)
    const bh = (b.value / max) * plotH
    if (bh > 0) {
      s.addShape('roundRect', {
        x: bx,
        y: plotBottom - bh,
        w: bw,
        h: bh,
        fill: { color: PPTX_COLORS.primary500 },
        line: { type: 'none' },
        rectRadius: 0.03,
      })
    }
    // value above the bar
    s.addText(pptxNumber(b.value, locale), {
      x: bx,
      y: plotBottom - bh - 0.34,
      w: bw,
      h: 0.3,
      fontFace: 'Consolas',
      fontSize: 13,
      bold: true,
      color: PPTX_COLORS.ink,
      align: 'center',
      margin: 0,
    })
    // category label below the axis
    s.addText(pptxSafeFormat(b.label), {
      x: bx,
      y: plotBottom + 0.08,
      w: bw,
      h: labelBandH,
      fontFace: 'Calibri',
      fontSize: 11,
      color: PPTX_COLORS.inkMuted,
      align: 'center',
      valign: 'top',
      margin: 0,
    })
  })
}
