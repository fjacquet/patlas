import { describe, expect, it } from 'vitest'
import { fmtGhzValue, fmtInt, fmtMemMb, fmtPercentValue, fmtRatio } from './format'

describe('fmtInt', () => {
  it('formats locale-aware integers', () => {
    expect(fmtInt(1234, 'en-US')).toBe('1,234')
  })
  it('returns the em-dash sentinel for non-finite input', () => {
    expect(fmtInt(Number.NaN)).toBe('—')
    expect(fmtInt(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('fmtGhzValue', () => {
  it('adaptive precision + GHz suffix', () => {
    expect(fmtGhzValue(230, 'en-US')).toBe('230 GHz')
    expect(fmtGhzValue(0.24, 'en-US')).toBe('0.2 GHz')
  })
  it('em-dash for non-finite', () => {
    expect(fmtGhzValue(Number.NaN)).toBe('—')
  })
})

describe('fmtPercentValue', () => {
  it('formats an already-percent value with one decimal + %', () => {
    expect(fmtPercentValue(12.34, 'en-US')).toBe('12.3 %')
  })
  it('em-dash for non-finite (never 0 / N/A)', () => {
    expect(fmtPercentValue(Number.NaN)).toBe('—')
  })
})

describe('fmtRatio', () => {
  it('formats X.X : 1, locale-aware separator', () => {
    expect(fmtRatio(4.2, 'en-US')).toBe('4.2 : 1')
    expect(fmtRatio(4.2, 'fr-FR')).toBe('4,2 : 1')
  })
  it('em-dash for non-finite or zero', () => {
    expect(fmtRatio(0)).toBe('—')
    expect(fmtRatio(Number.NaN)).toBe('—')
  })
})

describe('fmtMemMb — ADR-0010 GiB/TiB suffixes, base-2 math unchanged', () => {
  it('renders GiB (not GB) with /1024 math', () => {
    expect(fmtMemMb(2048, 'en-US')).toBe('2.0 GiB')
  })
  it('renders TiB (not TB) with /1024/1024 math', () => {
    expect(fmtMemMb(1024 * 1024 * 3, 'en-US')).toBe('3.0 TiB')
  })
  it('renders MiB (not MB) below 1024', () => {
    expect(fmtMemMb(512, 'en-US')).toBe('512 MiB')
  })
  it('em-dash for non-finite', () => {
    expect(fmtMemMb(Number.NaN)).toBe('—')
  })
})
