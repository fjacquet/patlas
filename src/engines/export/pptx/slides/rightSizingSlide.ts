/**
 * P-RS — VM right-sizing & stress. KPI strip (three category totals) + a
 * NATIVE pptxgenjs bar of the six per-resource counts + a self-describing
 * caption (sample basis, powered-on scope, the thresholds used). NATIVE
 * shapes+text only — the rasterized-chart path loses all text (resvg-wasm has
 * no font), so this mirrors `eosSlide`. Brand-free, factual, no verdict
 * colour: neutral measurement against user-editable thresholds (ADR-0012).
 *
 * The deck summarizes (counts); the per-VM list lives in the web Right-sizing
 * view and its CSV export.
 */
import type PptxGenJS from 'pptxgenjs'
import type { EstateSizing } from '@/engines/aggregation'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addRightSizingSlide(
  pptx: PptxGenJS,
  sizing: EstateSizing,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['rs.title'] ?? 'Right-sizing — configured vs used')

  // Three category totals.
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['rs.oversized'] ?? 'Allocation ≫ usage',
        value: pptxNumber(sizing.counts.oversized, locale),
      },
      {
        label: strings['rs.undersized'] ?? 'Usage near allocation',
        value: pptxNumber(sizing.counts.undersized, locale),
      },
      {
        label: strings['rs.stressed'] ?? 'Ballooning / CPU-ready',
        value: pptxNumber(sizing.counts.stressed, locale),
      },
    ],
    y,
  )

  // Six per-resource counts as a native bar (text guaranteed to render).
  const buckets = [
    { label: strings['rs.cpuOver'] ?? 'CPU over', value: sizing.counts.cpuOversized },
    { label: strings['rs.memOver'] ?? 'Mem over', value: sizing.counts.memOversized },
    { label: strings['rs.cpuUnder'] ?? 'CPU under', value: sizing.counts.cpuUndersized },
    { label: strings['rs.memUnder'] ?? 'Mem under', value: sizing.counts.memUndersized },
    { label: strings['rs.memStress'] ?? 'Mem stress', value: sizing.counts.memStressed },
    { label: strings['rs.cpuStress'] ?? 'CPU ready', value: sizing.counts.cpuStressed },
  ]

  const captionBandH = 0.4
  const panelY = y2
  const panelH = 7.15 - captionBandH - panelY
  s.addShape('roundRect', {
    x: M,
    y: panelY,
    w: CONTENT_W,
    h: panelH,
    fill: { color: PPTX_COLORS.pageBg },
    line: { color: PPTX_COLORS.hairline, width: 0.75 },
    rectRadius: 0.06,
  })
  s.addText(pptxSafeFormat(strings['rs.byCategory'] ?? 'By category and resource'), {
    x: M + 0.25,
    y: panelY + 0.12,
    w: CONTENT_W - 0.5,
    h: 0.3,
    fontFace: 'Arial',
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
    s.addText(pptxSafeFormat(b.label), {
      x: bx,
      y: plotBottom + 0.08,
      w: bw,
      h: labelBandH,
      fontFace: 'Arial',
      fontSize: 11,
      color: PPTX_COLORS.inkMuted,
      align: 'center',
      valign: 'top',
      margin: 0,
    })
  })

  // Self-describing caption: sample basis + powered-on scope + thresholds.
  const t = sizing.thresholds
  const basis =
    sizing.snapshotCount >= 2
      ? `${strings['rs.basisMax'] ?? 'max across'} ${pptxNumber(sizing.snapshotCount, locale)} ${
          strings['rs.snapshots'] ?? 'snapshots'
        }`
      : (strings['rs.basisSingle'] ?? 'single snapshot')
  const poweredOn = strings['rs.poweredOnOnly'] ?? 'powered-on VMs only'
  const thr = `CPU ≤${t.cpuOversizePct}% / ≥${t.cpuUndersizePct}% · ${
    strings['rs.mem'] ?? 'mem'
  } ≤${t.memOversizePct}% / ≥${t.memUndersizePct}%`
  s.addText(pptxSafeFormat(`${basis} · ${poweredOn} · ${thr}`), {
    x: M,
    y: 7.15 - captionBandH + 0.04,
    w: CONTENT_W,
    h: captionBandH,
    fontFace: 'Arial',
    fontSize: 10,
    color: PPTX_COLORS.inkMuted,
    align: 'left',
    valign: 'top',
    margin: 0,
  })
}
