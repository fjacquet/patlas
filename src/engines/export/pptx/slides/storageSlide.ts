/**
 * Phase 18-03 — Storage: estate KPI cards (readable TiB, not raw GiB) + a
 * factual per-cluster storage table (Cluster · Provisioned · In use). The
 * old rasterized treemap rendered as a meaningless solid block on the slide;
 * a text table is denser, reliable, and brand-free (navy/gold/grey).
 */
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxMemMib, pptxNumber, pptxSafeFormat } from '../format'
import { PPTX_COLORS } from '../primitives/colors'
import { drawKpiCard } from '../primitives/draw'
import { addHeader, CONTENT_W, M } from './_layout'

export function addStorageSlide(
  pptx: PptxGenJS,
  view: EstateView,
  _chartPng: Uint8Array | undefined,
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const e = view.storage.estate
  const t = (k: string, fallback: string) => strings[`storage.${k}`] ?? fallback
  const y = addHeader(s, t('title', 'Storage'))

  const gap = 0.15
  const cw = (CONTENT_W - gap * 3) / 4
  const cards = [
    { big: pptxMemMib(Number(e.provisionedMib), locale), small: t('provisioned', 'Provisioned') },
    { big: pptxMemMib(Number(e.inUseMib), locale), small: t('inUse', 'In use') },
    { big: pptxMemMib(Number(e.capacityMib), locale), small: t('capacity', 'Capacity') },
    {
      big: pptxNumber(view.flags.counts.ds + view.flags.counts.lu, locale),
      small: t('flagged', 'Flagged datastores'),
    },
  ]
  cards.forEach((c, i) => {
    drawKpiCard(s, { x: M + i * (cw + gap), y, w: cw, h: 1.05, big: c.big, small: c.small })
  })

  // Per-cluster storage table (top by provisioned).
  const rows = [...view.storage.byCluster]
    .map((g) => ({
      cluster: g.key,
      prov: Number(g.provisionedMib),
      inUse: Number(g.inUseMib),
    }))
    .sort((a, b) => b.prov - a.prov)
    .slice(0, 12)

  const tableY = y + 1.4
  const colCluster = M
  const colW = CONTENT_W
  const c1 = colCluster
  const c2 = colCluster + colW * 0.5
  const c3 = colCluster + colW * 0.75
  const head = (x: number, w: number, txt: string, align: 'left' | 'right') =>
    s.addText(pptxSafeFormat(txt), {
      x,
      y: tableY,
      w,
      h: 0.3,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
      color: PPTX_COLORS.inkMuted,
      align,
      margin: 0,
    })
  head(c1, colW * 0.5, t('colCluster', 'Cluster'), 'left')
  head(c2, colW * 0.25 - 0.1, t('colProvisioned', 'Provisioned'), 'right')
  head(c3, colW * 0.25, t('colInUse', 'In use'), 'right')
  s.addShape('rect', {
    x: M,
    y: tableY + 0.32,
    w: CONTENT_W,
    h: 0.012,
    fill: { color: PPTX_COLORS.hairline },
    line: { type: 'none' },
  })

  const rowH = 0.34
  rows.forEach((r, i) => {
    const ry = tableY + 0.42 + i * rowH
    s.addText(pptxSafeFormat(r.cluster), {
      x: c1,
      y: ry,
      w: colW * 0.5,
      h: rowH,
      fontFace: 'Arial',
      fontSize: 11,
      color: PPTX_COLORS.ink,
      margin: 0,
    })
    s.addText(pptxMemMib(r.prov, locale), {
      x: c2,
      y: ry,
      w: colW * 0.25 - 0.1,
      h: rowH,
      fontFace: 'Arial',
      fontSize: 11,
      color: PPTX_COLORS.ink,
      align: 'right',
      margin: 0,
    })
    s.addText(pptxMemMib(r.inUse, locale), {
      x: c3,
      y: ry,
      w: colW * 0.25,
      h: rowH,
      fontFace: 'Arial',
      fontSize: 11,
      color: PPTX_COLORS.ink,
      align: 'right',
      margin: 0,
    })
  })
}
