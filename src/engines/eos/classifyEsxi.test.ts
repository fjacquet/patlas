import { describe, expect, it } from 'vitest'
import type { EosCatalogue } from './catalogueSchema'
import { classifyEsxi } from './classifyEsxi'
import { REAL_ESX_VERSIONS } from './fixtures/real-os-strings'

const catalogue: EosCatalogue = {
  lastVerified: '2026-05-17',
  products: {
    esxi: {
      name: 'VMware ESXi',
      releases: [
        {
          name: '8.0',
          label: '8.0',
          releaseDate: '2022-10-11',
          isEol: false,
          eolFrom: '2027-10-11',
          isMaintained: true,
        },
        {
          name: '7.0',
          label: '7.0',
          releaseDate: '2020-04-02',
          isEol: true,
          eolFrom: '2025-10-02',
          isMaintained: false,
        },
      ],
    },
  },
}

describe('classifyEsxi', () => {
  it('maps an 8.0.3 build string to major 8.0 EOL; patch level is the null sentinel', () => {
    const r = classifyEsxi('VMware ESXi 8.0.3 build-24674464', catalogue)
    expect(r.major).toBe('8.0')
    expect(r.majorEol).toBe('2027-10-11')
    expect(r.patchEol).toBeNull()
  })

  it('every real 8.0.3 fixture host classifies identically (major 8.0, patch null)', () => {
    for (const v of REAL_ESX_VERSIONS) {
      const r = classifyEsxi(v, catalogue)
      expect(r.major).toBe('8.0')
      expect(r.majorEol).toBe('2027-10-11')
      expect(r.patchEol).toBeNull()
    }
  })

  it('maps a 7.0.x build to major 7.0 EOL (past, 2025-10-02)', () => {
    const r = classifyEsxi('VMware ESXi 7.0.3 build-21930508', catalogue)
    expect(r.major).toBe('7.0')
    expect(r.majorEol).toBe('2025-10-02')
    expect(r.patchEol).toBeNull()
  })

  it('returns null majorEol when the catalogue has no matching major (never invents)', () => {
    const r = classifyEsxi('VMware ESXi 5.5.0 build-1234567', catalogue)
    expect(r.major).toBe('5.5')
    expect(r.majorEol).toBeNull()
    expect(r.patchEol).toBeNull()
  })

  it('returns null major for an unparseable version string', () => {
    const r = classifyEsxi('VMware ESXi (unknown build)', catalogue)
    expect(r.major).toBeNull()
    expect(r.majorEol).toBeNull()
    expect(r.patchEol).toBeNull()
  })
})
