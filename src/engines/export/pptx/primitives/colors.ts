/**
 * Phase 10 — Midnight Executive palette for pptxgenjs (PPT-02 / D-03).
 *
 * pptxgenjs convention: hex WITHOUT the leading `#`. Values are the SAME
 * sRGB hex as `src/theme/echartsTheme.ts` (the Phase-9 oklch→sRGB fix —
 * single source of truth for the brand palette). Brand-free: no client
 * logo, no editorial colour — gold is the factual marker only, never a
 * verdict (UI-SPEC §Color). No React, no DOM — a pure palette module.
 */
export const PPTX_COLORS = {
  primary500: '3245b7',
  primary300: '819ae9',
  primary200: 'b0c2f9',
  surface200: 'd4d8de',
  surface700: '232933',
  surface800: '11161f',
  /** Gold — the factual threshold marker only (index.css ≈ #F9B935). */
  accent: 'f9b935',
  /** Document text / background neutrals. */
  ink: '0f172a',
  inkMuted: '475569',
  paper: 'ffffff',
  pageBg: 'f8fafc',
  hairline: 'e2e8f0',
} as const

export type PptxColor = (typeof PPTX_COLORS)[keyof typeof PPTX_COLORS]
