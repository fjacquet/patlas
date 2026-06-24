import { describe, expect, it } from 'vitest'
import { extractStackedSection } from './stackedSection'

// Mirrors the real Cluster HA layout: Index/TOC, an empty Resources section,
// then a Status section with two service rows.
const HA_CELLS: unknown[][] = [
  ['Index'],
  ['Resources', 'Status'],
  ['Resources'],
  ['Sid', 'Type', 'State', 'Group', 'Failback', 'Max Restart', 'Max Relocate', 'Comment'],
  ['Status'],
  ['Id', 'Type', 'Status', 'Node', 'Sid', 'State', 'Crm State', 'Request State', 'Quorate'],
  ['quorum', 'quorum', 'OK', 'promox', null, null, null, null, 'X'],
  ['fencing', 'fencing', 'standby (CRM watchdog standby)', 'promox', null, null, null, null, ''],
]

describe('extractStackedSection', () => {
  it('returns empty when the section title is absent', () => {
    expect(extractStackedSection(HA_CELLS, 'Nope')).toEqual({ headers: [], rows: [] })
  })

  it('reads a section header row and stops at the next section', () => {
    // "Resources" has a header row but zero data rows (Status starts next).
    const res = extractStackedSection(HA_CELLS, 'Resources')
    expect(res.headers).toContain('Sid')
    expect(res.rows).toEqual([])
  })

  it('extracts data rows keyed by the sub-table header row', () => {
    const res = extractStackedSection(HA_CELLS, 'Status')
    expect(res.headers[0]).toBe('Id')
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0]?.Type).toBe('quorum')
    expect(res.rows[0]?.Status).toBe('OK')
    expect(res.rows[1]?.Type).toBe('fencing')
    expect(res.rows[1]?.Quorate).toBe('')
  })

  it('matches a single-cell title row, not a multi-cell TOC row', () => {
    // row 1 is ['Resources','Status'] (TOC, 2 cells) — must NOT be matched as
    // the Resources section; row 2 (single cell) is the real section.
    const res = extractStackedSection(HA_CELLS, 'Resources')
    // The header row directly after the real section title is the Sid… row.
    expect(res.headers[0]).toBe('Sid')
  })
})
