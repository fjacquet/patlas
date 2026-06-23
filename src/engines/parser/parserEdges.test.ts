import { describe, expect, it } from 'vitest'
import { readNumber, readString, toRatio } from './adapters/columnMap'

describe('columnMap coercion branches', () => {
  it('readNumber handles booleans, non-finite, and locale strings', () => {
    expect(readNumber(true)).toBe(1)
    expect(readNumber(false)).toBe(0)
    expect(readNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(readNumber('not-a-number')).toBe(0)
    expect(readNumber({})).toBe(0)
    expect(readNumber("1'234,5")).toBe(1234.5)
  })

  it('readString trims and null-collapses', () => {
    expect(readString(null)).toBe('')
    expect(readString('  x  ')).toBe('x')
    expect(readString(42)).toBe('42')
  })

  it('toRatio passes ratios through and divides percentages', () => {
    expect(toRatio(0.42)).toBe(0.42)
    expect(toRatio(42)).toBe(0.42)
  })
})
