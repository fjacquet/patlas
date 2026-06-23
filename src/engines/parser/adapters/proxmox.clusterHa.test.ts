import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxBackupJobs, adaptProxmoxHaResources, adaptProxmoxHaStatus } from './proxmox'

const sheet = (cells: unknown[][]): ParsedSheet => ({
  name: 'x',
  headers: cells[0]?.map((c) => (c == null ? '' : String(c))) ?? [],
  rows: [],
  cells,
})

const HA: unknown[][] = [
  ['Index'],
  ['Resources', 'Status'],
  ['Resources'],
  ['Sid', 'Type', 'State', 'Group', 'Failback', 'Max Restart', 'Max Relocate', 'Comment'],
  ['vm:100', 'vm', 'started', 'grp1', '', 1, 1, 'note'],
  ['Status'],
  ['Id', 'Type', 'Status', 'Node', 'Sid', 'State', 'Crm State', 'Request State', 'Quorate'],
  ['quorum', 'quorum', 'OK', 'promox', null, null, null, null, 'X'],
]

describe('adaptProxmox HA + backup-job adapters', () => {
  it('return [] when the sheet is absent', () => {
    expect(adaptProxmoxHaResources(undefined)).toEqual([])
    expect(adaptProxmoxHaStatus(undefined)).toEqual([])
    expect(adaptProxmoxBackupJobs(undefined)).toEqual([])
  })

  it('parses HA resources (Sid-keyed) with null numerics when blank', () => {
    const rows = adaptProxmoxHaResources(sheet(HA))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sid).toBe('vm:100')
    expect(rows[0]?.state).toBe('started')
    expect(rows[0]?.maxRestart).toBe(1)
    const blank = adaptProxmoxHaResources(
      sheet([['Resources'], ['Sid', 'Type', 'Max Restart'], ['vm:9', 'vm', '']]),
    )
    expect(blank[0]?.maxRestart).toBeNull()
  })

  it('parses HA status rows', () => {
    const rows = adaptProxmoxHaStatus(sheet(HA))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.type).toBe('quorum')
    expect(rows[0]?.status).toBe('OK')
    expect(rows[0]?.quorate).toBe('X')
  })

  it('parses backup jobs with boolean Enabled/All', () => {
    const cells: unknown[][] = [
      ['Backup Jobs'],
      ['Id', 'Enabled', 'All', 'Vm Id', 'Mode', 'Storage', 'Schedule', 'Node'],
      ['job-1', true, false, '100,101', 'snapshot', 'DATA', '02:00', 'promox'],
    ]
    const rows = adaptProxmoxBackupJobs(sheet(cells))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('job-1')
    expect(rows[0]?.enabled).toBe(true)
    expect(rows[0]?.all).toBe(false)
    expect(rows[0]?.vmId).toBe('100,101')
    expect(rows[0]?.storage).toBe('DATA')
  })

  it('drops identity-less rows', () => {
    expect(adaptProxmoxHaStatus(sheet([['Status'], ['Id', 'Type'], ['', '']]))).toEqual([])
  })
})
