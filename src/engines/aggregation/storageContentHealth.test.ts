import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { ProxmoxStorageContentRow } from '@/types/snapshot'
import { computeStorageContentHealth } from './storageContentHealth'

const row = (over: Partial<ProxmoxStorageContentRow>): ProxmoxStorageContentRow => ({
  node: 'n1',
  storage: 'DATA',
  content: 'images',
  fileName: 'f',
  format: 'qcow2',
  sizeMib: mib(1024),
  usagePercent: null,
  guestId: '100',
  guestName: 'A',
  creationSerial: null,
  ...over,
})

const TODAY = new Date('2026-06-23T00:00:00Z') // Excel serial 46196

describe('computeStorageContentHealth', () => {
  it('is empty for no rows', () => {
    const h = computeStorageContentHealth([], TODAY)
    expect(h.byContent).toEqual([])
    expect(h.byStorage).toEqual([])
    expect(h.fileCount).toBe(0)
    expect(h.totalSizeMib).toBe(0)
    expect(h.backups.count).toBe(0)
    expect(h.backups.oldestAgeDays).toBeNull()
  })

  it('groups by content type and by storage, sorted by size desc', () => {
    const h = computeStorageContentHealth(
      [
        row({ content: 'images', storage: 'DATA', fileName: 'a', sizeMib: mib(2048) }),
        row({ content: 'iso', storage: 'DATA', fileName: 'b', sizeMib: mib(512) }),
        row({ content: 'images', storage: 'local-lvm', fileName: 'c', sizeMib: mib(1024) }),
      ],
      TODAY,
    )
    expect(h.fileCount).toBe(3)
    expect(h.totalSizeMib).toBe(3584)
    // byContent: images 3072, iso 512
    expect(h.byContent.map((g) => [g.content, g.count, g.totalSizeMib])).toEqual([
      ['images', 2, 3072],
      ['iso', 1, 512],
    ])
    // byStorage: DATA 2560, local-lvm 1024
    expect(h.byStorage.map((g) => [g.storage, g.count, g.totalSizeMib])).toEqual([
      ['DATA', 2, 2560],
      ['local-lvm', 1, 1024],
    ])
  })

  it('builds the backup-file inventory (content === backup) newest first with age', () => {
    const h = computeStorageContentHealth(
      [
        row({ content: 'images', fileName: 'img', guestId: '100' }),
        row({
          content: 'backup',
          fileName: 'b-old',
          guestId: '100',
          guestName: 'A',
          sizeMib: mib(4096),
          creationSerial: 46100, // ~96d
        }),
        row({
          content: 'backup',
          fileName: 'b-new',
          guestId: '200',
          guestName: 'B',
          sizeMib: mib(2048),
          creationSerial: 46190, // ~6d
        }),
      ],
      TODAY,
    )
    expect(h.backups.count).toBe(2)
    expect(h.backups.guestsCovered).toBe(2)
    expect(h.backups.totalSizeMib).toBe(6144)
    expect(h.backups.newestAgeDays).toBe(6)
    expect(h.backups.oldestAgeDays).toBe(96)
    // newest first
    expect(h.backups.rows.map((r) => r.fileName)).toEqual(['b-new', 'b-old'])
    expect(h.backups.rows[0]?.ageDays).toBe(6)
  })
})
