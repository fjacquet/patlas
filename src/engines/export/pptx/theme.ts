/**
 * Phase 10 — the Midnight Executive PPTX theme (brand-free, PPT-02/D-03).
 *
 * Shaped like `src/theme/echartsTheme.ts`: a pure palette/spec const module
 * (no React, no DOM). A 16:9 deck on the shipped sRGB-hex palette. Slide
 * geometry in inches (pptxgenjs unit). Low text density (D-02): the deck is
 * a presentation, not the document — the HTML report carries exhaustive
 * detail.
 */
import { PPTX_COLORS } from './primitives/colors'

export const SLIDE = {
  /** pptxgenjs LAYOUT_WIDE = 13.333 × 7.5 in (16:9). */
  w: 13.333,
  h: 7.5,
  margin: 0.5,
} as const

export const PPTX_THEME = {
  layout: 'LAYOUT_WIDE',
  bg: PPTX_COLORS.paper,
  title: { color: PPTX_COLORS.ink, fontFace: 'Calibri', fontSize: 28, bold: true },
  heading: { color: PPTX_COLORS.ink, fontFace: 'Calibri', fontSize: 20, bold: true },
  body: { color: PPTX_COLORS.ink, fontFace: 'Calibri', fontSize: 12 },
  muted: { color: PPTX_COLORS.inkMuted, fontFace: 'Calibri', fontSize: 11 },
  /** Metric values: monospace-ish, tabular — mirrors the on-screen idiom. */
  metric: { color: PPTX_COLORS.ink, fontFace: 'Consolas', fontSize: 12, bold: true },
  series: [PPTX_COLORS.primary500, PPTX_COLORS.primary300, PPTX_COLORS.primary200],
  /** Factual threshold marker fill (gold tint) — never a verdict colour. */
  flagFill: PPTX_COLORS.accent,
} as const
