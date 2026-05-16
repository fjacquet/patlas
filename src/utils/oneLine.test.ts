import { describe, expect, it } from 'vitest'
import { oneLine } from './oneLine'

describe('oneLine', () => {
  it('collapses newlines and tabs to single spaces', () => {
    expect(oneLine('a\n  b\tc')).toBe('a b c')
  })

  it('trims leading/trailing whitespace', () => {
    expect(oneLine('  trim me  ')).toBe('trim me')
  })

  it('returns empty string for empty input', () => {
    expect(oneLine('')).toBe('')
  })

  it('collapses runs of mixed whitespace', () => {
    expect(oneLine('x\r\n\t   y')).toBe('x y')
  })

  it('leaves an already single-line string unchanged', () => {
    expect(oneLine('hello world')).toBe('hello world')
  })
})
