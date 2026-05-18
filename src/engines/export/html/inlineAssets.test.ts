import { describe, expect, it } from 'vitest'
import { assertSizeBudget, CSP_CONTENT, inlineAssets } from './inlineAssets'

describe('inlineAssets', () => {
  it('emits the exact restrictive CSP meta content', () => {
    expect(CSP_CONTENT).toBe(
      "default-src 'none'; img-src data:; style-src 'unsafe-inline' data:; font-src data:",
    )
    expect(inlineAssets().cspMeta).toContain(CSP_CONTENT)
  })

  it('embeds zero base64 font bytes by default (system-font stack)', () => {
    const { style } = inlineAssets()
    expect(style).not.toContain('@font-face')
    expect(style).not.toContain('base64')
    expect(style).toContain('system-ui')
  })

  it('style is a single inline <style> element with no network reference', () => {
    const { style } = inlineAssets()
    expect(style.startsWith('<style>')).toBe(true)
    expect(style.endsWith('</style>')).toBe(true)
    expect(style).not.toMatch(/https?:\/\//)
    // the factual gold threshold marker is present, no verdict colour
    expect(style).toContain('.metric-row.flagged')
  })
})

describe('assertSizeBudget', () => {
  const big = (mb: number) => 'x'.repeat(mb * 1024 * 1024)

  it('passes under the typical 5 MB budget', () => {
    expect(() => assertSizeBudget(big(4), 'typical')).not.toThrow()
  })

  it('throws at/over the typical 5 MB budget', () => {
    expect(() => assertSizeBudget(big(5), 'typical')).toThrow(/typical budget/)
  })

  it('passes under the 15 MB ceiling but over 5 MB', () => {
    expect(() => assertSizeBudget(big(14), 'ceiling')).not.toThrow()
  })

  it('throws at/over the 15 MB hard ceiling', () => {
    expect(() => assertSizeBudget(big(15), 'ceiling')).toThrow(/ceiling budget/)
  })
})
