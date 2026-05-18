/**
 * Phase 10 — horizontal bar primitive (factual magnitude only — never a
 * verdict colour). Pure spec builder: returns the pptxgenjs `addShape`
 * option objects (track + fill) for a 0..1 ratio. The slide module applies
 * them. Fill is the navy primary; over-threshold uses the gold factual
 * marker fill (NOT red/amber/green — UI-SPEC §Color).
 */
import { PPTX_COLORS } from './colors'

export interface BarSpec {
  track: Record<string, unknown>
  fill: Record<string, unknown>
}

export function progressBar(
  ratio: number,
  at: { x: number; y: number; w: number; h: number },
  flagged = false,
): BarSpec {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
  return {
    track: {
      shape: 'rect',
      x: at.x,
      y: at.y,
      w: at.w,
      h: at.h,
      fill: { color: PPTX_COLORS.hairline },
      line: { type: 'none' },
    },
    fill: {
      shape: 'rect',
      x: at.x,
      y: at.y,
      w: Math.max(0.001, at.w * r),
      h: at.h,
      fill: { color: flagged ? PPTX_COLORS.accent : PPTX_COLORS.primary500 },
      line: { type: 'none' },
    },
  }
}
