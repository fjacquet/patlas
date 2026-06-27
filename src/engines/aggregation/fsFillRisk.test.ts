import { describe, expect, it } from 'vitest'
import type { ProxmoxPartitionRow } from '@/types/snapshot'
import { computeFsFillRisk, FS_FILL_DEFAULT_THRESHOLD } from './fsFillRisk'

const row = (over: Partial<ProxmoxPartitionRow>): ProxmoxPartitionRow => ({
  node: 'pve1',
  vmId: '100',
  vmName: 'vm100',
  vmType: 'qemu',
  vmStatus: 'running',
  mountPoint: '/',
  fsType: 'ext4',
  totalGb: 100,
  usedGb: 50,
  usedFraction: 0.5,
  error: '',
  name: 'root',
  disks: 'scsi0',
  ...over,
})

describe('computeFsFillRisk', () => {
  it('returns zero counts for empty input', () => {
    const r = computeFsFillRisk([])
    expect(r.overThresholdCount).toBe(0)
    expect(r.totalMounts).toBe(0)
    expect(r.totalVms).toBe(0)
    expect(r.threshold).toBe(FS_FILL_DEFAULT_THRESHOLD)
  })

  it('identifies mounts at or above the threshold', () => {
    const rows = [
      row({ vmId: '100', mountPoint: '/', usedFraction: 0.9 }),
      row({ vmId: '101', mountPoint: '/data', usedFraction: 0.5 }),
      row({ vmId: '102', mountPoint: '/var', usedFraction: 0.8 }),
    ]
    const r = computeFsFillRisk(rows, 0.8)
    expect(r.overThresholdCount).toBe(2)
    expect(r.totalMounts).toBe(3)
    expect(r.totalVms).toBe(3)
  })

  it('converts usedFraction to usedPct (× 100)', () => {
    const r = computeFsFillRisk([row({ usedFraction: 0.95 })], 0.8)
    const over = r.overThreshold[0]
    expect(over?.usedPct).toBeCloseTo(95)
    expect(over?.overThreshold).toBe(true)
  })

  it('sets usedPct to null when usedFraction is null', () => {
    const r = computeFsFillRisk([row({ usedFraction: null })], 0.8)
    expect(r.overThreshold).toHaveLength(0)
    expect(r.overThreshold[0]?.usedPct ?? null).toBeNull()
  })

  it('sorts over-threshold rows descending by usedPct, null last', () => {
    const rows = [
      row({ vmId: '101', mountPoint: '/b', usedFraction: 0.82 }),
      row({ vmId: '102', mountPoint: '/c', usedFraction: null }),
      row({ vmId: '103', mountPoint: '/a', usedFraction: 0.95 }),
    ]
    const r = computeFsFillRisk(rows, 0.8)
    expect(r.overThreshold[0]?.usedPct).toBeCloseTo(95)
    expect(r.overThreshold[1]?.usedPct).toBeCloseTo(82)
  })

  it('counts distinct VMs by node:vmId', () => {
    const rows = [
      row({ node: 'pve1', vmId: '100', mountPoint: '/' }),
      row({ node: 'pve1', vmId: '100', mountPoint: '/data' }),
      row({ node: 'pve2', vmId: '100', mountPoint: '/' }),
    ]
    const r = computeFsFillRisk(rows, 0)
    expect(r.totalVms).toBe(2)
  })

  it('accepts a custom threshold', () => {
    const rows = [row({ usedFraction: 0.6 }), row({ mountPoint: '/tmp', usedFraction: 0.4 })]
    expect(computeFsFillRisk(rows, 0.5).overThresholdCount).toBe(1)
    expect(computeFsFillRisk(rows, 0.9).overThresholdCount).toBe(0)
  })

  it('excludes squashfs/iso9660/erofs from every figure', () => {
    const rows = [
      row({ vmId: '100', mountPoint: '/', fsType: 'ext4', usedFraction: 0.9 }),
      row({ vmId: '100', mountPoint: '/snap/core', fsType: 'squashfs', usedFraction: 1 }),
      row({ vmId: '101', mountPoint: '/cdrom', fsType: 'ISO9660', usedFraction: 1 }),
      row({ vmId: '102', mountPoint: '/boot', fsType: ' erofs ', usedFraction: 1 }),
    ]
    const r = computeFsFillRisk(rows, 0.8)
    // Only the ext4 row survives the filter.
    expect(r.totalMounts).toBe(1)
    expect(r.overThresholdCount).toBe(1)
    expect(r.totalVms).toBe(1)
    expect(r.overThreshold.every((m) => m.fsType.toLowerCase().trim() !== 'squashfs')).toBe(true)
  })
})
