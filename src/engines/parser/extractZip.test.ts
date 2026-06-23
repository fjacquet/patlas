import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { extractProxmoxBundle } from './extractZip'

describe('extractProxmoxBundle', () => {
  it('extracts report.xlsx and network-diagram.svg from a Proxmox bundle zip', () => {
    const zip = zipSync({
      'report.xlsx': strToU8('FAKEXLSX'),
      'network-diagram.svg': strToU8('<svg/>'),
    })
    const out = extractProxmoxBundle(zip)
    expect(out.xlsx).not.toBeNull()
    if (out.xlsx) expect(new TextDecoder().decode(out.xlsx)).toBe('FAKEXLSX')
    expect(out.networkSvg).toBe('<svg/>')
  })

  it('returns xlsx:null when zip contains no inner .xlsx (bare .xlsx case)', () => {
    // A bare .xlsx is itself a ZIP whose entries look like:
    // '[Content_Types].xml', 'xl/workbook.xml', '_rels/...', etc. — no .xlsx entry.
    const zip = zipSync({
      '[Content_Types].xml': strToU8('<x/>'),
      'xl/workbook.xml': strToU8('<x/>'),
    })
    const out = extractProxmoxBundle(zip)
    expect(out.xlsx).toBeNull()
    expect(out.networkSvg).toBeNull()
  })

  it('returns xlsx non-null when an inner .xlsx is present alongside other entries', () => {
    const zip = zipSync({
      '[Content_Types].xml': strToU8('<x/>'),
      'report.xlsx': strToU8('BUNDLEXLSX'),
    })
    const out = extractProxmoxBundle(zip)
    expect(out.xlsx).not.toBeNull()
    if (out.xlsx) expect(new TextDecoder().decode(out.xlsx)).toBe('BUNDLEXLSX')
  })
})
