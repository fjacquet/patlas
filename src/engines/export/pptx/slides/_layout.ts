/**
 * Phase 10 — shared PPTX slide design system (Midnight Executive, brand-free
 * PPT-02/D-03). DRY: every slide composes the same header band + KPI-card
 * row + chart panel idiom (CLAUDE.md forbids per-slide copy-paste). Pure
 * spec application onto a pptxgenjs slide — no React/Zustand/i18next.
 *
 * Visual language mirrors the shipped screen-fit `ClusterDetail`: a navy
 * header band with a gold factual rule, surface KPI cards with mono tabular
 * values, and white chart panels — so the deck reads like the app, not a
 * default-white text dump.
 */
import type PptxGenJS from 'pptxgenjs'
import { pptxSafeFormat } from '../format'
import { addChartImage } from '../primitives/chartSvg'
import { PPTX_COLORS } from '../primitives/colors'
import { SLIDE } from '../theme'

const M = SLIDE.margin
const CONTENT_W = SLIDE.w - M * 2

/** Page background + the navy header band with the gold factual rule and a
 *  white title (+ optional subtitle). Returns the y where content starts. */
export function addHeader(s: PptxGenJS.Slide, title: string, subtitle?: string): number {
  s.background = { color: PPTX_COLORS.pageBg }
  s.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE.w,
    h: 1.0,
    fill: { color: PPTX_COLORS.primary500 },
    line: { type: 'none' },
  })
  // gold factual rule (the P9 marker colour — never a verdict)
  s.addShape('rect', {
    x: 0,
    y: 1.0,
    w: SLIDE.w,
    h: 0.04,
    fill: { color: PPTX_COLORS.accent },
    line: { type: 'none' },
  })
  s.addText(pptxSafeFormat(title), {
    x: M,
    y: 0.18,
    w: CONTENT_W,
    h: subtitle ? 0.5 : 0.64,
    color: 'ffffff',
    fontFace: 'Arial',
    fontSize: 26,
    bold: true,
    valign: 'middle',
  })
  if (subtitle) {
    s.addText(pptxSafeFormat(subtitle), {
      x: M,
      y: 0.62,
      w: CONTENT_W,
      h: 0.34,
      color: PPTX_COLORS.primary200,
      fontFace: 'Arial',
      fontSize: 12,
      valign: 'middle',
    })
  }
  return 1.35
}

export interface Kpi {
  label: string
  value: string
}

/** A row of surface KPI cards (label + big mono tabular value). Auto-widths
 *  across the content area. Returns the y below the row. */
export function addKpiRow(s: PptxGenJS.Slide, cards: ReadonlyArray<Kpi>, y: number): number {
  if (cards.length === 0) return y
  const gap = 0.2
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length
  const h = 1.05
  cards.forEach((c, i) => {
    const x = M + i * (w + gap)
    s.addShape('rect', {
      x,
      y,
      w,
      h,
      fill: { color: PPTX_COLORS.paper },
      line: { color: PPTX_COLORS.hairline, width: 0.75 },
      rectRadius: 0.04,
    })
    s.addText(pptxSafeFormat(c.label), {
      x: x + 0.12,
      y: y + 0.12,
      w: w - 0.24,
      h: 0.3,
      color: PPTX_COLORS.inkMuted,
      fontFace: 'Arial',
      fontSize: 11,
    })
    s.addText(pptxSafeFormat(c.value), {
      x: x + 0.12,
      y: y + 0.42,
      w: w - 0.24,
      h: 0.5,
      color: PPTX_COLORS.ink,
      fontFace: 'Arial',
      fontSize: 22,
      bold: true,
      valign: 'middle',
    })
  })
  return y + h + 0.25
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A white chart panel (hairline border) with an optional caption, holding
 *  a pre-rasterized PNG chart. Falls back to a factual "—" note when no
 *  chart is available (never a blank frame). */
export function addChartPanel(
  s: PptxGenJS.Slide,
  png: Uint8Array | undefined,
  box: Box,
  caption?: string,
): void {
  s.addShape('rect', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: PPTX_COLORS.paper },
    line: { color: PPTX_COLORS.hairline, width: 0.75 },
    rectRadius: 0.04,
  })
  const pad = 0.18
  const capH = caption ? 0.32 : 0
  if (caption) {
    s.addText(pptxSafeFormat(caption), {
      x: box.x + pad,
      y: box.y + 0.08,
      w: box.w - pad * 2,
      h: capH,
      color: PPTX_COLORS.inkMuted,
      fontFace: 'Arial',
      fontSize: 11,
      bold: true,
    })
  }
  const inner: Box = {
    x: box.x + pad,
    y: box.y + pad + capH,
    w: box.w - pad * 2,
    h: box.h - pad * 2 - capH,
  }
  if (png) {
    addChartImage(s, png, inner)
  } else {
    s.addText('—', {
      x: inner.x,
      y: inner.y,
      w: inner.w,
      h: inner.h,
      color: PPTX_COLORS.inkMuted,
      fontFace: 'Arial',
      fontSize: 18,
      align: 'center',
      valign: 'middle',
    })
  }
}

/** Plain factual body line (e.g. the "no DR scenario" note). */
export function addNote(s: PptxGenJS.Slide, text: string, y: number): void {
  s.addText(pptxSafeFormat(text), {
    x: M,
    y,
    w: CONTENT_W,
    h: 0.4,
    color: PPTX_COLORS.inkMuted,
    fontFace: 'Arial',
    fontSize: 12,
  })
}

export { CONTENT_W, M }
