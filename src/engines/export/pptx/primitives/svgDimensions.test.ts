import { describe, expect, it } from 'vitest'
import { cappedRenderWidth, isSvgOversized, parseSvgDimensions } from './svgDimensions'

const svgWith = (a: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${a}><rect/></svg>`

describe('parseSvgDimensions', () => {
  it('parses integer width/height attributes', () => {
    expect(parseSvgDimensions(svgWith('width="1762" height="14092"'))).toEqual({
      w: 1762,
      h: 14092,
    })
  })

  it('parses fractional width/height attributes', () => {
    expect(parseSvgDimensions(svgWith('width="100.5" height="200.75"'))).toEqual({
      w: 100.5,
      h: 200.75,
    })
  })

  it('falls back to viewBox when width/height are absent', () => {
    expect(parseSvgDimensions(svgWith('viewBox="0 0 1762 14092"'))).toEqual({
      w: 1762,
      h: 14092,
    })
  })

  it('prefers explicit width/height over viewBox', () => {
    expect(
      parseSvgDimensions(svgWith('width="800" height="600" viewBox="0 0 1762 14092"')),
    ).toEqual({ w: 800, h: 600 })
  })

  it('returns null when no dimensions are present', () => {
    expect(parseSvgDimensions('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull()
  })

  it('returns null for zero dimensions', () => {
    expect(parseSvgDimensions(svgWith('width="0" height="0"'))).toBeNull()
  })
})

describe('isSvgOversized — PPTX slide legibility gate', () => {
  it('flags the real 1762×14092 cv4pve-report SVG as oversized', () => {
    expect(isSvgOversized({ w: 1762, h: 14092 })).toBe(true)
  })

  it('does NOT flag a normal landscape diagram as oversized', () => {
    // 1920×1080 — wider than the slide, standard landscape
    expect(isSvgOversized({ w: 1920, h: 1080 })).toBe(false)
  })

  it('does NOT flag a square diagram as oversized', () => {
    expect(isSvgOversized({ w: 1000, h: 1000 })).toBe(false)
  })

  it('does NOT flag a mild portrait diagram as oversized (fills >15% content width)', () => {
    // 800×1200, AR=0.667. displayFraction = 0.667/2.183 ≈ 0.305 > 0.15
    expect(isSvgOversized({ w: 800, h: 1200 })).toBe(false)
  })

  it('flags an extreme portrait diagram (AR far below threshold)', () => {
    // 200×3000, AR=0.0667. displayFraction = 0.0667/2.183 ≈ 0.031 < 0.15
    expect(isSvgOversized({ w: 200, h: 3000 })).toBe(true)
  })
})

describe('cappedRenderWidth', () => {
  it('computes the width that caps PNG height at maxH for a tall SVG', () => {
    // 1762×14092, cap at 900: renderW = round(1762/14092 * 900) = round(112.5) = 113
    const w = cappedRenderWidth({ w: 1762, h: 14092 }, 900)
    expect(w).toBe(113)
    // Verify height would be ~900 when resvg scales proportionally at this width:
    // actual_h = 113 * (14092/1762) = 903 ≈ 900
    const resultH = w * (14092 / 1762)
    expect(resultH).toBeCloseTo(900, -1) // within 10 px
  })

  it('returns at least 1 even for pathological inputs', () => {
    expect(cappedRenderWidth({ w: 1, h: 10000 }, 900)).toBe(1)
  })
})
