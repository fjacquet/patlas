import { describe, expect, it } from 'vitest'
import { loadEosCatalogue } from './catalogue'
import catalogueJson from './catalogue.json'
import { EosCatalogueSchema } from './catalogueSchema'

const validRelease = {
  name: '8.0',
  label: 'ESXi 8.0',
  releaseDate: '2022-10-11',
  isEol: false,
  eolFrom: '2027-10-11',
  isMaintained: true,
}

const validSnapshot = {
  lastVerified: '2026-05-17',
  products: {
    esxi: { name: 'VMware ESXi', releases: [validRelease] },
  },
}

describe('EosCatalogueSchema', () => {
  it('accepts a well-formed snapshot and returns a typed catalogue', () => {
    const parsed = EosCatalogueSchema.parse(validSnapshot)
    expect(parsed.lastVerified).toBe('2026-05-17')
    expect(parsed.products.esxi?.releases[0]?.eolFrom).toBe('2027-10-11')
  })

  it('throws on a missing lastVerified', () => {
    const { lastVerified: _omit, ...noVerified } = validSnapshot
    expect(() => EosCatalogueSchema.parse(noVerified)).toThrow()
  })

  it('throws on a release missing required fields', () => {
    const bad = {
      lastVerified: '2026-05-17',
      products: { esxi: { name: 'x', releases: [{ name: '8.0' }] } },
    }
    expect(() => EosCatalogueSchema.parse(bad)).toThrow()
  })

  it('throws on a wrong field type', () => {
    const bad = {
      lastVerified: 20260517,
      products: {},
    }
    expect(() => EosCatalogueSchema.parse(bad)).toThrow()
  })

  it('models no paid extended-support fields (D-04)', () => {
    const shape = JSON.stringify(EosCatalogueSchema.parse(validSnapshot))
    expect(shape).not.toContain('eoesFrom')
    expect(shape).not.toContain('isEoes')
  })
})

describe('loadEosCatalogue (parse-once boundary)', () => {
  it('returns the parsed committed catalogue', () => {
    const cat = loadEosCatalogue()
    expect(cat.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Object.keys(cat.products).length).toBeGreaterThan(0)
  })

  it('returns a stable reference (Zod runs once at module scope)', () => {
    expect(loadEosCatalogue()).toBe(loadEosCatalogue())
  })

  it('the committed catalogue.json round-trips through the schema', () => {
    const parsed = EosCatalogueSchema.parse(catalogueJson)
    expect(parsed.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Object.keys(parsed.products).length).toBeGreaterThan(0)
  })
})

describe('proxmox-ve catalogue entry', () => {
  it('contains proxmox-ve with major releases and EOL dates', () => {
    const cat = loadEosCatalogue()
    const pve = cat.products['proxmox-ve']
    expect(pve).toBeDefined()
    const majors = pve?.releases.map((r) => r.name) ?? []
    expect(majors).toEqual(expect.arrayContaining(['7', '8']))
    // every release carries an eolFrom (proxmox-ve has firm EOLs)
    for (const r of pve?.releases ?? []) expect(typeof r.eolFrom).toBe('string')
  })

  it('lastVerified was refreshed for this release', () => {
    const cat = loadEosCatalogue()
    expect(cat.lastVerified >= '2026-06-24').toBe(true)
  })
})
