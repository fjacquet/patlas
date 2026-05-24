/**
 * Phase 18 — pptxgenjs DRAWER primitives ported from vsizer's proven deck
 * (`vsizer/src/engines/export/pptx/primitives/{progressBar,kpiCard}.ts`),
 * rebrand-free per vatlas UI-SPEC §Color: NO verdict green/orange/red — the
 * bar fill is navy, the peak marker is the gold factual marker, labels are
 * neutral ink/grey. These DRAW onto a slide (vsizer style), distinct from the
 * legacy spec-builder `progressBar`/`kpiCard` (kept, unused).
 */
import type PptxGenJS from 'pptxgenjs'
import { PPTX_COLORS } from './colors'

type Slide = PptxGenJS.Slide

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(n, 1)) : 0)

export interface DrawProgressBarOpts {
  x: number
  y: number
  w: number
  h: number
  /** Fill ratio 0..1 (clamped). */
  ratio: number
  /** Optional 0..1 peak marker — drawn as the gold factual tick. */
  peak?: number
}

/** Track (hairline) + navy fill + optional gold peak tick. Brand-free. */
export function drawProgressBar(slide: Slide, o: DrawProgressBarOpts): void {
  slide.addShape('roundRect', {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    fill: { color: PPTX_COLORS.hairline },
    line: { type: 'none' },
    rectRadius: 0.05,
  })
  const filled = clamp01(o.ratio)
  if (filled > 0) {
    slide.addShape('roundRect', {
      x: o.x,
      y: o.y,
      w: o.w * filled,
      h: o.h,
      fill: { color: PPTX_COLORS.primary500 },
      line: { type: 'none' },
      rectRadius: 0.05,
    })
  }
  if (o.peak !== undefined && o.peak > 0) {
    slide.addShape('rect', {
      x: o.x + o.w * clamp01(o.peak) - 0.02,
      y: o.y - 0.04,
      w: 0.04,
      h: o.h + 0.08,
      fill: { color: PPTX_COLORS.accent },
      line: { type: 'none' },
    })
  }
}

export interface DrawKpiCardOpts {
  x: number
  y: number
  w: number
  h: number
  big: string
  small: string
  /** Accent rail + headline color. Defaults to navy (brand-free). */
  accent?: string
  /** Card body color. Defaults to the page surface. */
  background?: string
  /** Light text variant (for the navy KEY FIGURES banner tiles). */
  onDark?: boolean
}

/** Rounded card: accent left rail, big value, small label. Brand-free. */
export function drawKpiCard(slide: Slide, o: DrawKpiCardOpts): void {
  const accent = o.accent ?? PPTX_COLORS.primary500
  const bg = o.background ?? PPTX_COLORS.pageBg
  slide.addShape('roundRect', {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    fill: { color: bg },
    line: { color: PPTX_COLORS.hairline, width: 0.75 },
    rectRadius: 0.06,
  })
  slide.addShape('rect', {
    x: o.x,
    y: o.y,
    w: 0.1,
    h: o.h,
    fill: { color: accent },
    line: { type: 'none' },
  })
  slide.addText(o.big, {
    x: o.x + 0.22,
    y: o.y + 0.1,
    w: o.w - 0.3,
    h: 0.55,
    fontFace: 'Consolas',
    fontSize: 22,
    bold: true,
    color: o.onDark ? PPTX_COLORS.accent : accent,
    valign: 'top',
    margin: 0,
  })
  slide.addText(o.small, {
    x: o.x + 0.22,
    y: o.y + 0.64,
    w: o.w - 0.3,
    h: 0.34,
    fontFace: 'Arial',
    fontSize: 10,
    color: o.onDark ? PPTX_COLORS.primary200 : PPTX_COLORS.inkMuted,
    valign: 'top',
    margin: 0,
  })
}
