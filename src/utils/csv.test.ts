import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csvCell', () => {
  it('returns empty string for null and undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('stringifies 0 (not falsy-collapsed to empty)', () => {
    expect(csvCell(0)).toBe('0')
  })

  it('stringifies numbers and booleans raw — no toLocaleString', () => {
    expect(csvCell(1234567)).toBe('1234567')
    expect(csvCell(true)).toBe('true')
    expect(csvCell(false)).toBe('false')
  })

  it('wraps a value with a comma in double quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
  })

  it('doubles internal double-quotes and wraps', () => {
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""')
  })

  it('preserves an embedded newline inside the quoted field', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('prefixes a leading = + - @ with a single quote (injection guard)', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@cmd')).toBe("'@cmd")
  })

  it('quotes a guarded value that also contains a comma', () => {
    // leading '=' guarded → "'=a,b" then comma forces quoting
    expect(csvCell('=a,b')).toBe('"\'=a,b"')
  })

  it('leaves a plain string untouched', () => {
    expect(csvCell('plain')).toBe('plain')
  })
})

describe('toCsv', () => {
  it('returns empty string for empty headers and no rows', () => {
    expect(toCsv([], [])).toBe('')
  })

  it('joins fields with comma and rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2')
  })

  it('serialises multiple rows', () => {
    expect(toCsv(['h'], [['1'], ['2']])).toBe('h\r\n1\r\n2')
  })

  it('applies csvCell escaping per field', () => {
    expect(toCsv(['name'], [['a,b']])).toBe('name\r\n"a,b"')
  })
})
