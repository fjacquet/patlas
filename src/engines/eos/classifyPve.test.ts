import { describe, expect, it } from 'vitest'
import catalogueJson from './catalogue.json'
import { EosCatalogueSchema } from './catalogueSchema'
import { classifyPve } from './classifyPve'

const catalogue = EosCatalogueSchema.parse(catalogueJson)

describe('classifyPve', () => {
  it('parses a bare PVE version (8.2) to major 8', () => {
    const r = classifyPve('8.2', catalogue)
    expect(r.major).toBe('8')
    expect(typeof r.majorEol).toBe('string') // proxmox-ve 8 has a known EOL
    expect(r.patchEol).toBeNull()
  })

  it('parses a pve-manager build string', () => {
    expect(classifyPve('pve-manager/8.2.2/abc', catalogue).major).toBe('8')
  })

  it('parses 7.x to major 7', () => {
    expect(classifyPve('7.4-3', catalogue).major).toBe('7')
  })

  it('returns null major for an unparseable string', () => {
    const r = classifyPve('not-a-version', catalogue)
    expect(r.major).toBeNull()
    expect(r.majorEol).toBeNull()
  })
})
