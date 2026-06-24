import { describe, expect, it } from 'vitest'
import { svgToDataUri } from './svgDataUri'

describe('svgToDataUri', () => {
  it('produces a base64 svg data URI', () => {
    const uri = svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const b64 = uri.slice('data:image/svg+xml;base64,'.length)
    expect(atob(b64)).toContain('<svg')
  })

  it('round-trips non-ASCII content (utf-8 safe)', () => {
    const input = '<svg><text>nœud — réseau</text></svg>'
    const uri = svgToDataUri(input)
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const b64 = uri.slice('data:image/svg+xml;base64,'.length)
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe(input)
  })
})
