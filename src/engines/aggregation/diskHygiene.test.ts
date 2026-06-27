import { describe, expect, it } from 'vitest'
import type { ProxmoxDiskRow } from '@/types/snapshot'
import { computeDiskHygiene } from './diskHygiene'

const row = (over: Partial<ProxmoxDiskRow>): ProxmoxDiskRow => ({
  node: 'pve1',
  vmId: '100',
  vmName: 'myvm',
  vmType: 'qemu',
  vmStatus: 'running',
  kind: 'Disk',
  id: 'scsi0',
  storage: 'local-lvm',
  storageType: 'lvmthin',
  storageShared: false,
  fileName: 'vm-100-disk-0.raw',
  sizeGb: 50,
  storageUsageFraction: null,
  cache: '',
  backup: 'X',
  isUnused: false,
  device: '',
  mountPoint: '',
  ...over,
})

describe('computeDiskHygiene', () => {
  it('returns all-zero counts for empty input', () => {
    const h = computeDiskHygiene([])
    expect(h.unusedCount).toBe(0)
    expect(h.reclaimableGb).toBe(0)
    expect(h.strayIsoCount).toBe(0)
    expect(h.noBackupCount).toBe(0)
    expect(h.riskyCacheCount).toBe(0)
  })

  it('identifies unused disks and sums reclaimable GB', () => {
    const rows = [
      row({ id: 'unused0', sizeGb: 30, isUnused: true, backup: '' }),
      row({ id: 'unused1', sizeGb: 20, isUnused: true, backup: '' }),
      row({ id: 'scsi0', sizeGb: 50, isUnused: false, backup: 'X' }),
    ]
    const h = computeDiskHygiene(rows)
    expect(h.unusedCount).toBe(2)
    expect(h.reclaimableGb).toBe(50)
    expect(h.unusedDisks).toHaveLength(2)
  })

  it('identifies stray mounted ISOs (Cdrom with non-blank fileName)', () => {
    const rows = [
      row({ kind: 'Cdrom', id: 'ide2', fileName: 'ubuntu.iso', sizeGb: 1 }),
      row({ kind: 'Cdrom', id: 'ide3', fileName: '', sizeGb: 0 }),
    ]
    const h = computeDiskHygiene(rows)
    expect(h.strayIsoCount).toBe(1)
    expect(h.strayIsos[0]?.fileName).toBe('ubuntu.iso')
  })

  it('identifies disks without backup (Disk kind, not unused, backup != X)', () => {
    const rows = [
      row({ kind: 'Disk', backup: '', isUnused: false }),
      row({ kind: 'Disk', id: 'scsi1', backup: 'X', isUnused: false }),
      row({ kind: 'Disk', id: 'scsi2', backup: 'x', isUnused: false }),
    ]
    const h = computeDiskHygiene(rows)
    // '' and 'x' (not uppercase X) are without backup
    expect(h.noBackupCount).toBe(2)
  })

  it('does not flag unused disks as no-backup', () => {
    const rows = [row({ kind: 'Disk', backup: '', isUnused: true })]
    expect(computeDiskHygiene(rows).noBackupCount).toBe(0)
  })

  it('identifies risky cache modes (non-empty, not in safe set)', () => {
    const rows = [
      row({ kind: 'Disk', cache: 'unsafe' }),
      row({ kind: 'Disk', id: 'scsi1', cache: 'none' }),
      row({ kind: 'Disk', id: 'scsi2', cache: 'writeback' }),
      row({ kind: 'Disk', id: 'scsi3', cache: '' }),
    ]
    const h = computeDiskHygiene(rows)
    expect(h.riskyCacheCount).toBe(1)
    expect(h.riskyCacheDisks[0]?.cache).toBe('unsafe')
  })

  it('handles mixed rows correctly', () => {
    const rows = [
      row({ id: 'unused0', isUnused: true, sizeGb: 10, backup: '' }),
      row({ kind: 'Cdrom', id: 'ide2', fileName: 'focal.iso', sizeGb: 1 }),
      row({ kind: 'Disk', id: 'scsi1', backup: '', cache: 'unsafe', isUnused: false }),
    ]
    const h = computeDiskHygiene(rows)
    expect(h.unusedCount).toBe(1)
    expect(h.strayIsoCount).toBe(1)
    expect(h.noBackupCount).toBe(1)
    expect(h.riskyCacheCount).toBe(1)
  })
})
