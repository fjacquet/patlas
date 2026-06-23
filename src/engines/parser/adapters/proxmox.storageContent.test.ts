import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxStorageContent } from './proxmox'

const sheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Storage Content',
  headers: [
    'Node',
    'Storage',
    'Content',
    'File Name',
    'Format',
    'Size GB',
    'Storage Usage %',
    'Vm Id',
    'Guest Name',
    'Creation Date',
    'Notes',
    'Parent',
  ],
  rows,
})

describe('adaptProxmoxStorageContent', () => {
  it('returns [] when the sheet is absent', () => {
    expect(adaptProxmoxStorageContent(undefined)).toEqual([])
  })

  it('parses a disk image row with branded MiB size and serial date', () => {
    const rows = adaptProxmoxStorageContent(
      sheet([
        {
          Node: 'promox',
          Storage: 'DATA',
          Content: 'images',
          'File Name': '100/vm-100-disk-0.qcow2',
          Format: 'qcow2',
          'Size GB': 32,
          'Storage Usage %': 0.035,
          'Vm Id': '100',
          'Guest Name': 'Debian',
          'Creation Date': 46190.36,
          Notes: '',
          Parent: '',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r?.node).toBe('promox')
    expect(r?.storage).toBe('DATA')
    expect(r?.content).toBe('images')
    expect(r?.fileName).toBe('100/vm-100-disk-0.qcow2')
    expect(r?.format).toBe('qcow2')
    expect(r?.sizeMib as number).toBe(32768) // 32 GiB → MiB
    expect(r?.usagePercent).toBeCloseTo(0.035)
    expect(r?.guestId).toBe('100')
    expect(r?.guestName).toBe('Debian')
    expect(r?.creationSerial).toBe(46190.36)
  })

  it('handles ISO row with blank guestId and guestName', () => {
    const rows = adaptProxmoxStorageContent(
      sheet([
        {
          Node: 'promox',
          Storage: 'DATA',
          Content: 'iso',
          'File Name': 'iso/debian-13.5.0-amd64-netinst.iso',
          Format: 'iso',
          'Size GB': 0.737,
          'Storage Usage %': 0.0008,
          'Vm Id': '',
          'Guest Name': '',
          'Creation Date': 46178.29,
          Notes: '',
          Parent: '',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.guestId).toBe('')
    expect(rows[0]?.guestName).toBe('')
    expect(rows[0]?.content).toBe('iso')
  })

  it('drops rows with a blank File Name', () => {
    const rows = adaptProxmoxStorageContent(sheet([{ Node: 'promox', 'File Name': '' }]))
    expect(rows).toEqual([])
  })

  it('treats a blank Creation Date and blank usage as null (not 0)', () => {
    const rows = adaptProxmoxStorageContent(
      sheet([
        {
          Node: 'promox',
          Storage: 'DATA',
          Content: 'images',
          'File Name': 'some-file.raw',
          Format: 'raw',
          'Size GB': 1,
          'Storage Usage %': null,
          'Vm Id': '101',
          'Guest Name': 'Test',
          'Creation Date': null,
          Notes: '',
          Parent: '',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.creationSerial).toBeNull()
    expect(rows[0]?.usagePercent).toBeNull()
  })
})
