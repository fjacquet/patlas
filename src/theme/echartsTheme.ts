/**
 * Midnight Executive ECharts theme — light + dark variants (VIZ-03).
 *
 * This is a PURE DATA module: no React, no DOM, no Zustand, no Zod. It maps
 * the shipped `src/index.css` `@theme` tokens (the single source of truth —
 * Phase 2 adds NO new palette tokens) into ECharts theme objects, per the
 * UI-SPEC §Color "Chart series → token mapping" table.
 *
 * The tokens in `index.css` are `oklch(...)` strings; the ECharts SVG
 * renderer accepts any CSS color string, so we emit the same oklch values
 * verbatim (no conversion — fidelity over reformatting). Tailwind `slate-*`
 * defaults are resolved to their canonical hex (axis/grid text only — never
 * pure black/white, per the UI-SPEC contrast contract).
 *
 * Both variants are registered once at module load by `<Chart>`:
 *   echarts.registerTheme('midnight-executive', MIDNIGHT_EXECUTIVE_LIGHT)
 *   echarts.registerTheme('midnight-executive-dark', MIDNIGHT_EXECUTIVE_DARK)
 */

// --- Concrete token values resolved from src/index.css @theme ---------------
const PRIMARY_500 = 'oklch(45% 0.18 270)'
const PRIMARY_300 = 'oklch(70% 0.12 270)'
const PRIMARY_200 = 'oklch(82% 0.08 270)'
const SURFACE_200 = 'oklch(88% 0.01 260)'
const SURFACE_700 = 'oklch(28% 0.02 260)'
const SURFACE_800 = 'oklch(20% 0.02 260)'
const UTIL_LOW = 'oklch(64% 0.16 142)' // green
const UTIL_MID = 'oklch(72% 0.18 65)' // orange
const UTIL_HIGH = 'oklch(58% 0.22 25)' // red

// Tailwind default slate scale (axis/grid/label text — never pure b/w).
const SLATE_500 = '#64748b'
const SLATE_400 = '#94a3b8'
const SLATE_200 = '#e2e8f0'

/**
 * A gauge utilization band: `[upperBound (0..1), color]`. Bands are
 * 0–0.6 / 0.6–0.8 / 0.8–1.0 = util-low / util-mid / util-high (status only,
 * NEVER a verdict). The vCPU-allocation gauge uses a single brand color and
 * does NOT consume `gaugeBands` (a ratio is not a utilization — Moderate-4).
 */
type GaugeBand = readonly [number, string]

export interface MidnightExecutiveTheme {
  /** ECharts global palette. color[0..2] = OS donut Windows/Linux/Other. */
  readonly color: readonly string[]
  readonly backgroundColor: string
  readonly textStyle: { readonly color: string }
  readonly categoryAxis: {
    readonly axisLine: { readonly lineStyle: { readonly color: string } }
    readonly splitLine: { readonly lineStyle: { readonly color: string } }
    readonly axisLabel: { readonly color: string }
  }
  readonly valueAxis: {
    readonly axisLine: { readonly lineStyle: { readonly color: string } }
    readonly splitLine: { readonly lineStyle: { readonly color: string } }
    readonly axisLabel: { readonly color: string }
  }
  readonly tooltip: {
    readonly backgroundColor: string
    readonly borderColor: string
    readonly textStyle: { readonly color: string }
  }
  /** vCPU-allocation gauge single color (ratio, NOT util-banded). */
  readonly allocationGaugeColor: string
  /** CPU%/RAM% gauge utilization bands (0–60 / 60–80 / 80–100). */
  readonly gaugeBands: readonly [GaugeBand, GaugeBand, GaugeBand]
}

/**
 * Light variant. OS donut Windows/Linux/Other = primary-500 / primary-300 /
 * surface-200; axis text slate-500 / grid slate-200; tooltip = `.panel`
 * (white / slate-200). vCPU-alloc gauge solid primary-500.
 */
export const MIDNIGHT_EXECUTIVE_LIGHT: MidnightExecutiveTheme = {
  color: [PRIMARY_500, PRIMARY_300, SURFACE_200],
  backgroundColor: 'transparent',
  textStyle: { color: SLATE_500 },
  categoryAxis: {
    axisLine: { lineStyle: { color: SLATE_500 } },
    splitLine: { lineStyle: { color: SLATE_200 } },
    axisLabel: { color: SLATE_500 },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: SLATE_500 } },
    splitLine: { lineStyle: { color: SLATE_200 } },
    axisLabel: { color: SLATE_500 },
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: SLATE_200,
    textStyle: { color: SLATE_500 },
  },
  allocationGaugeColor: PRIMARY_500,
  gaugeBands: [
    [0.6, UTIL_LOW],
    [0.8, UTIL_MID],
    [1, UTIL_HIGH],
  ],
}

/**
 * Dark variant — genuinely resolved from the same token bank (NOT aliased to
 * light). OS donut Windows/Linux/Other = primary-300 / primary-200 /
 * surface-700; axis text slate-400 / grid surface-700; tooltip = `.dark
 * .panel` (surface-800 / surface-700). vCPU-alloc gauge solid primary-300.
 * Utilization bands are identical (status semantics don't change by theme).
 */
export const MIDNIGHT_EXECUTIVE_DARK: MidnightExecutiveTheme = {
  color: [PRIMARY_300, PRIMARY_200, SURFACE_700],
  backgroundColor: 'transparent',
  textStyle: { color: SLATE_400 },
  categoryAxis: {
    axisLine: { lineStyle: { color: SLATE_400 } },
    splitLine: { lineStyle: { color: SURFACE_700 } },
    axisLabel: { color: SLATE_400 },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: SLATE_400 } },
    splitLine: { lineStyle: { color: SURFACE_700 } },
    axisLabel: { color: SLATE_400 },
  },
  tooltip: {
    backgroundColor: SURFACE_800,
    borderColor: SURFACE_700,
    textStyle: { color: SLATE_400 },
  },
  allocationGaugeColor: PRIMARY_300,
  gaugeBands: [
    [0.6, UTIL_LOW],
    [0.8, UTIL_MID],
    [1, UTIL_HIGH],
  ],
}
