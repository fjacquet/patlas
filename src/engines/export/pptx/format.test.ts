import { describe, expect, it } from 'vitest'
import { pptxNumber, pptxSafeFormat } from './format'

const NARROW_NBSP = String.fromCharCode(0x202f)
const NBSP = String.fromCharCode(0x00a0)
const EM_DASH = String.fromCharCode(0x2014)

describe('pptxNumber — locale-correct, PowerPoint-safe', () => {
  it('EN: comma thousands, dot decimal', () => {
    expect(pptxNumber(12_345.6, 'en', 1)).toBe('12,345.6')
    expect(pptxNumber(1_000_000, 'en')).toBe('1,000,000')
  })

  it('FR: grouped with U+00A0 (post U+202F substitution), comma decimal', () => {
    const fr = pptxNumber(12_345.6, 'fr', 1)
    expect(fr).toContain(NBSP) // regular no-break space
    expect(fr).not.toContain(NARROW_NBSP) // narrow no-break space substituted
    expect(fr.endsWith(',6')).toBe(true) // comma decimal
  })

  it('non-finite input returns the em-dash sentinel (never 0/NaN)', () => {
    expect(pptxNumber(Number.NaN, 'en')).toBe(EM_DASH)
    expect(pptxNumber(Number.POSITIVE_INFINITY, 'fr')).toBe(EM_DASH)
  })

  it('pptxSafeFormat strips control chars and substitutes the narrow space', () => {
    const dirty = `a${String.fromCharCode(0x07)}b${NARROW_NBSP}c`
    const clean = pptxSafeFormat(dirty)
    expect(clean).toBe(`ab${NBSP}c`)
  })
})
