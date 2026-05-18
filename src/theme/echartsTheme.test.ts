import { describe, expect, it } from 'vitest'
import { MIDNIGHT_EXECUTIVE_DARK, MIDNIGHT_EXECUTIVE_LIGHT } from './echartsTheme'

// Behavior contract (02-01-PLAN Task 2 <behavior>):
// - Both variants exported as objects with a `color` array whose first three
//   entries are the OS-donut Windows/Linux/Other colors from the UI-SPEC map.
//   light: primary-500 / primary-300 / surface-200
//   dark:  primary-300 / primary-200 / surface-700
// - Light and dark are distinct objects (the dark variant is genuinely
//   resolved, not aliased to light).
// - Axis/grid label color is the slate token (never pure black/white) in both.

// Concrete token values: accurate sRGB hex conversions of the src/index.css
// @theme oklch() tokens — the theme MUST emit zrender-parseable hex (an
// oklch() string falls back to #000000 in the bundled ECharts renderer), so
// these expectations also guard that no token regresses to a raw oklch string.
const PRIMARY_500 = '#3245b7' // oklch(45% 0.18 270)
const PRIMARY_300 = '#819ae9' // oklch(70% 0.12 270)
const PRIMARY_200 = '#b0c2f9' // oklch(82% 0.08 270)
const SURFACE_200 = '#d4d8de' // oklch(88% 0.01 260)
const SURFACE_700 = '#232933' // oklch(28% 0.02 260)

describe('MIDNIGHT_EXECUTIVE_LIGHT', () => {
  it('is an exported object', () => {
    expect(typeof MIDNIGHT_EXECUTIVE_LIGHT).toBe('object')
    expect(MIDNIGHT_EXECUTIVE_LIGHT).not.toBeNull()
  })

  it('color[0..2] are Windows/Linux/Other = primary-500 / primary-300 / surface-200', () => {
    expect(MIDNIGHT_EXECUTIVE_LIGHT.color.slice(0, 3)).toEqual([
      PRIMARY_500,
      PRIMARY_300,
      SURFACE_200,
    ])
  })

  it('axis/grid label color is the slate token (not pure black/white)', () => {
    const axisColor = MIDNIGHT_EXECUTIVE_LIGHT.categoryAxis.axisLabel.color
    expect(axisColor).not.toBe('#000')
    expect(axisColor).not.toBe('#000000')
    expect(axisColor).not.toBe('black')
    expect(axisColor.toLowerCase()).toContain('#') // a slate hex
  })
})

describe('MIDNIGHT_EXECUTIVE_DARK', () => {
  it('is an exported object', () => {
    expect(typeof MIDNIGHT_EXECUTIVE_DARK).toBe('object')
    expect(MIDNIGHT_EXECUTIVE_DARK).not.toBeNull()
  })

  it('color[0..2] are Windows/Linux/Other = primary-300 / primary-200 / surface-700', () => {
    expect(MIDNIGHT_EXECUTIVE_DARK.color.slice(0, 3)).toEqual([
      PRIMARY_300,
      PRIMARY_200,
      SURFACE_700,
    ])
  })

  it('axis/grid label color is the slate token (not pure black/white)', () => {
    const axisColor = MIDNIGHT_EXECUTIVE_DARK.categoryAxis.axisLabel.color
    expect(axisColor).not.toBe('#fff')
    expect(axisColor).not.toBe('#ffffff')
    expect(axisColor).not.toBe('white')
    expect(axisColor.toLowerCase()).toContain('#') // a slate hex
  })
})

describe('light vs dark', () => {
  it('are distinct objects (dark genuinely resolved, not aliased)', () => {
    expect(MIDNIGHT_EXECUTIVE_DARK).not.toBe(MIDNIGHT_EXECUTIVE_LIGHT)
    expect(MIDNIGHT_EXECUTIVE_DARK.color).not.toEqual(MIDNIGHT_EXECUTIVE_LIGHT.color)
    expect(MIDNIGHT_EXECUTIVE_DARK.categoryAxis.axisLabel.color).not.toEqual(
      MIDNIGHT_EXECUTIVE_LIGHT.categoryAxis.axisLabel.color,
    )
  })

  it('both expose gauge utilization bands util-low/mid/high', () => {
    for (const theme of [MIDNIGHT_EXECUTIVE_LIGHT, MIDNIGHT_EXECUTIVE_DARK]) {
      expect(Array.isArray(theme.gaugeBands)).toBe(true)
      expect(theme.gaugeBands).toHaveLength(3)
      // bands cover 0-0.6 / 0.6-0.8 / 0.8-1.0
      expect(theme.gaugeBands[0][0]).toBeCloseTo(0.6)
      expect(theme.gaugeBands[1][0]).toBeCloseTo(0.8)
      expect(theme.gaugeBands[2][0]).toBeCloseTo(1)
    }
  })
})
