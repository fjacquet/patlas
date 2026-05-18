/**
 * Phase 10 — shared slide layout helpers (DRY: every metric slide uses the
 * same heading + metric-row idiom; CLAUDE.md forbids copy-paste). Pure spec
 * application onto a pptxgenjs slide. Low text density (D-02), factual-only.
 * Not in the plan's files_modified — a small justified shared presenter
 * (Rule-17): the alternative is the same ~6 lines copied into 7 slides.
 */
import type PptxGenJS from 'pptxgenjs'
import { pptxSafeFormat } from '../format'
import { PPTX_THEME, SLIDE } from '../theme'

export function addHeading(s: PptxGenJS.Slide, text: string): void {
  s.background = { color: PPTX_THEME.bg }
  s.addText(pptxSafeFormat(text), {
    ...PPTX_THEME.heading,
    x: SLIDE.margin,
    y: 0.4,
    w: SLIDE.w - SLIDE.margin * 2,
    h: 0.6,
  })
}

/** A vertical list of label / value metric rows starting below the heading. */
export function addMetricList(
  s: PptxGenJS.Slide,
  rows: ReadonlyArray<{ label: string; value: string }>,
): void {
  let y = 1.3
  for (const r of rows) {
    s.addText(pptxSafeFormat(r.label), {
      ...PPTX_THEME.muted,
      x: SLIDE.margin,
      y,
      w: 5,
      h: 0.35,
    })
    s.addText(pptxSafeFormat(r.value), {
      ...PPTX_THEME.metric,
      x: SLIDE.margin + 5,
      y,
      w: 4,
      h: 0.35,
      align: 'right',
    })
    y += 0.45
  }
}
