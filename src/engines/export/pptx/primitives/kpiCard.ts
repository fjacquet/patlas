/**
 * Phase 10 — KPI card primitive. A pure spec builder: returns the
 * pptxgenjs `addText` option objects for a label + a tabular metric value
 * (low text density, D-02; brand-free Midnight Executive). No pptxgenjs
 * import — the slide module applies these to its `slide.addText` calls.
 */
import { PPTX_THEME } from '../theme'

export interface KpiCardSpec {
  label: { text: string; options: Record<string, unknown> }
  value: { text: string; options: Record<string, unknown> }
}

export function kpiCard(
  label: string,
  value: string,
  at: { x: number; y: number; w: number },
): KpiCardSpec {
  return {
    label: {
      text: label,
      options: { ...PPTX_THEME.muted, x: at.x, y: at.y, w: at.w, h: 0.3 },
    },
    value: {
      text: value,
      options: { ...PPTX_THEME.metric, x: at.x, y: at.y + 0.3, w: at.w, h: 0.4 },
    },
  }
}
