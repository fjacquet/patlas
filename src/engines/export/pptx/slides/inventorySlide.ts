/** Phase 18 — inventory summary: KPI cards + a NAMED OS-family breakdown
 *  line (the donut alone had no legend — "missing text") above the donut.
 *  Factual counts, brand-free. */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addInventorySlide(
  pptx: PptxGenJS,
  view: EstateView,
  _chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['inventory.title'] ?? 'Inventory summary')
  const y2 = addKpiRow(
    s,
    [
      {
        label: strings['inventory.vms'] ?? 'VM rows',
        value: pptxNumber(view.vmRows.length, locale),
      },
      {
        label: strings['inventory.hosts'] ?? 'Hosts',
        value: pptxNumber(view.hosts.length, locale),
      },
      {
        label: strings['inventory.clusters'] ?? 'Clusters',
        value: pptxNumber(view.clusters.length, locale),
      },
      {
        label: strings['inventory.datastores'] ?? 'Datastores',
        value: pptxNumber(view.datastores.length, locale),
      },
    ],
    y,
  )
  // Named OS-family breakdown line (the donut had no legend on the slide).
  const os = view.osBreakdown
  const total = os.windows + os.linux + os.other
  const share = (k: number) =>
    total > 0 ? ` (${pptxNumber(Math.round((k / total) * 100), locale)} %)` : ''
  const w = strings['os.windows'] ?? 'Windows'
  const l = strings['os.linux'] ?? 'Linux'
  const ot = strings['os.other'] ?? 'Other'
  const osLine = `${w} ${pptxNumber(os.windows, locale)}${share(os.windows)}   ·   ${l} ${pptxNumber(os.linux, locale)}${share(os.linux)}   ·   ${ot} ${pptxNumber(os.other, locale)}${share(os.other)}`
  s.addText(pptxSafeFormat(osLine), {
    x: M,
    y: y2,
    w: CONTENT_W,
    h: 0.32,
    fontFace: 'Calibri',
    fontSize: 12,
    bold: true,
    color: PPTX_COLORS.inkMuted,
    margin: 0,
  })
  // Native OS-family bars (text guaranteed — the rasterized donut lost its
  // legend because resvg renders chart SVG with no font).
  const panelY = y2 + 0.5
  const panelH = 7.15 - panelY
  s.addShape('roundRect', {
    x: M,
    y: panelY,
    w: CONTENT_W,
    h: panelH,
    fill: { color: PPTX_COLORS.pageBg },
    line: { color: PPTX_COLORS.hairline, width: 0.75 },
    rectRadius: 0.06,
  })
  s.addText(pptxSafeFormat(strings['inventory.os'] ?? 'OS family'), {
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
  const fams = [
    { label: w, value: os.windows },
    { label: l, value: os.linux },
    { label: ot, value: os.other },
  ]
  const rowH = 0.52
  const labelW = 1.6
  const barX = M + 0.25 + labelW
  const barW = CONTENT_W - 0.5 - labelW - 1.4
  fams.forEach((f, i) => {
    const ry = panelY + 0.6 + i * rowH
    s.addText(pptxSafeFormat(f.label), {
      x: M + 0.25,
      y: ry,
      w: labelW,
      h: 0.34,
      fontFace: 'Calibri',
      fontSize: 12,
      color: PPTX_COLORS.ink,
      valign: 'middle',
      margin: 0,
    })
    s.addShape('roundRect', {
      x: barX,
      y: ry + 0.04,
      w: barW,
      h: 0.26,
      fill: { color: PPTX_COLORS.hairline },
      line: { type: 'none' },
      rectRadius: 0.04,
    })
    const ratio = total > 0 ? f.value / total : 0
    if (ratio > 0) {
      s.addShape('roundRect', {
        x: barX,
        y: ry + 0.04,
        w: Math.max(0.02, barW * ratio),
        h: 0.26,
        fill: { color: PPTX_COLORS.primary500 },
        line: { type: 'none' },
        rectRadius: 0.04,
      })
    }
    s.addText(`${pptxNumber(f.value, locale)}${share(f.value)}`, {
      x: barX + barW + 0.1,
      y: ry,
      w: 1.3,
      h: 0.34,
      fontFace: 'Consolas',
      fontSize: 12,
      color: PPTX_COLORS.ink,
      valign: 'middle',
      margin: 0,
    })
  })
}
