import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { extractProxmoxBundle } from './extractZip'

describe('extractProxmoxBundle', () => {
  it('extracts report.xlsx and network-diagram.svg from a zip', () => {
    const zip = zipSync({
      'report.xlsx': strToU8('FAKEXLSX'),
      'network-diagram.svg': strToU8('<svg/>'),
    })
    const out = extractProxmoxBundle(zip)
    expect(new TextDecoder().decode(out.xlsx)).toBe('FAKEXLSX')
    expect(out.networkSvg).toBe('<svg/>')
  })

  it('throws when no xlsx is inside the zip', () => {
    const zip = zipSync({ 'readme.txt': strToU8('hi') })
    expect(() => extractProxmoxBundle(zip)).toThrow(/xlsx/)
  })
})
