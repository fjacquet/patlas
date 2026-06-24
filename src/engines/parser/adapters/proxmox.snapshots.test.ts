import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxSnapshots } from './proxmox'

const sheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Snapshots',
  headers: [
    'Node',
    'Vm Id',
    'Vm Name',
    'Vm Type',
    'Snapshot',
    'Parent',
    'Date',
    'Include Ram',
    'Size GB',
    'Description',
  ],
  rows,
  cells: [],
})

describe('adaptProxmoxSnapshots', () => {
  it('returns [] when the sheet is absent', () => {
    expect(adaptProxmoxSnapshots(undefined)).toEqual([])
  })

  it('parses a real checkpoint row with branded MiB size and serial date', () => {
    const rows = adaptProxmoxSnapshots(
      sheet([
        {
          Node: 'promox',
          'Vm Id': 100,
          'Vm Name': 'Debian',
          'Vm Type': 'Qemu',
          Snapshot: 'before-upgrade',
          Parent: 'no-parent',
          Date: 46196.31,
          'Include Ram': 'true',
          'Size GB': 4,
          Description: '',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r?.guestType).toBe('qemu')
    expect(r?.name).toBe('before-upgrade')
    expect(r?.dateSerial).toBe(46196.31)
    expect(r?.includeRam).toBe(true)
    expect(r?.sizeMib as number).toBe(4096) // 4 GiB → MiB, no raw 1.048576
  })

  it('maps Vm Type "Lxc" to guestType lxc and keeps the current marker row', () => {
    const rows = adaptProxmoxSnapshots(
      sheet([
        {
          Node: 'promox',
          'Vm Id': 104,
          'Vm Name': 'ct-a',
          'Vm Type': 'Lxc',
          Snapshot: 'current',
          Parent: 'no-parent',
          Date: null,
          'Include Ram': '',
          'Size GB': null,
          Description: 'You are here!',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.guestType).toBe('lxc')
    expect(rows[0]?.name).toBe('current')
    expect(rows[0]?.dateSerial).toBeNull()
    expect(rows[0]?.sizeMib as number).toBe(0)
  })

  it('drops rows with a blank Snapshot label', () => {
    const rows = adaptProxmoxSnapshots(sheet([{ Node: 'promox', Snapshot: '' }]))
    expect(rows).toEqual([])
  })
})
