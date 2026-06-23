import { describe, expect, it } from 'vitest'
import { cores, mhz, mib } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { computeSizing, DEFAULT_SIZING_THRESHOLDS, maxVmUsageAcrossSnapshots } from './sizing'

const vinfo = (over: Partial<VInfoRow> = {}): VInfoRow => ({
  vmName: 'web01',
  cluster: 'C1',
  host: 'h1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  powerState: 'poweredOn',
  template: false,
  poweredOn: true,
  osConfig: '',
  osTools: '',
  vmBiosUuid: 'b1',
  vmInstanceUuid: 'i1',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  path: '',
  ...over,
})

const host = (): VHostRow => ({
  hostName: 'h1',
  cluster: 'C1',
  sockets: 2 as never,
  cores: cores(16),
  speedMhz: mhz(2200),
  memoryMib: mib(262144),
  cpuRatio: 0.1,
  ramRatio: 0.1,
  faultDomain: '',
  model: '',
  vendor: '',
  serialNumber: '',
  esxVersion: '',
})

const snap = (vmUsage: Snapshot['vmUsage'], vi: VInfoRow[] = [vinfo()]): Snapshot =>
  ({ vinfo: vi, vmUsage }) as unknown as Snapshot

describe('computeSizing oversize', () => {
  it('flags CPU + memory oversized when usage is far below capacity', () => {
    // capacity = 4 * 2200 = 8800 MHz; usage 300 → 3.4% ≤ 10 → cpuOversized.
    // active 1024 / 8192 = 12.5% ≤ 20 → memOversized.
    const max = maxVmUsageAcrossSnapshots([
      snap([
        {
          vmName: 'web01',
          cluster: 'C1',
          vmBiosUuid: 'b1',
          vmInstanceUuid: 'i1',
          activeMib: mib(1024),
          consumedMib: mib(2048),
          balloonedMib: mib(0),
          swappedMib: mib(0),
          cpuUsageMhz: mhz(300),
        },
      ]),
    ])
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    const row = res.rows[0]
    expect(row?.cpuUtilPct).toBeCloseTo(3.41, 1)
    expect(row?.memActivePct).toBeCloseTo(12.5, 1)
    expect(row?.flags.cpuOversized).toBe(true)
    expect(row?.flags.memOversized).toBe(true)
    expect(res.counts.oversized).toBe(1)
  })
})

describe('computeSizing stress', () => {
  it('flags memStressed on ballooning and cpuStressed on CPU ready > 5%', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap(
        [
          {
            vmName: 'web01',
            cluster: 'C1',
            vmBiosUuid: 'b1',
            vmInstanceUuid: 'i1',
            activeMib: null,
            consumedMib: null,
            balloonedMib: mib(64),
            swappedMib: mib(0),
            cpuUsageMhz: null,
          },
        ],
        [vinfo({ cpuReadinessPercent: 7 })],
      ),
    ])
    const res = computeSizing(
      [vinfo({ cpuReadinessPercent: 7 })],
      [host()],
      max,
      DEFAULT_SIZING_THRESHOLDS,
      1,
    )
    expect(res.rows[0]?.flags.memStressed).toBe(true)
    expect(res.rows[0]?.flags.cpuStressed).toBe(true)
    expect(res.counts.stressed).toBe(1)
  })
})

describe('computeSizing null-discipline + guards', () => {
  it('null usage → util null, no flags, not counted', () => {
    const max = maxVmUsageAcrossSnapshots([snap([])])
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    expect(res.rows[0]?.cpuUtilPct).toBeNull()
    expect(res.rows[0]?.flags.cpuOversized).toBe(false)
    expect(res.counts.oversized).toBe(0)
  })

  it('vramMib 0 → memActivePct null (no divide-by-zero)', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap(
        [
          {
            vmName: 'web01',
            cluster: 'C1',
            vmBiosUuid: 'b1',
            vmInstanceUuid: 'i1',
            activeMib: mib(10),
            consumedMib: null,
            balloonedMib: null,
            swappedMib: null,
            cpuUsageMhz: null,
          },
        ],
        [vinfo({ vramMib: mib(0) })],
      ),
    ])
    const res = computeSizing(
      [vinfo({ vramMib: mib(0) })],
      [host()],
      max,
      DEFAULT_SIZING_THRESHOLDS,
      1,
    )
    expect(res.rows[0]?.memActivePct).toBeNull()
  })

  it('excludes powered-off VMs', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap(
        [
          {
            vmName: 'web01',
            cluster: 'C1',
            vmBiosUuid: 'b1',
            vmInstanceUuid: 'i1',
            activeMib: mib(1),
            consumedMib: null,
            balloonedMib: null,
            swappedMib: null,
            cpuUsageMhz: mhz(1),
          },
        ],
        [vinfo({ poweredOn: false, powerState: 'poweredOff' })],
      ),
    ])
    const res = computeSizing(
      [vinfo({ poweredOn: false, powerState: 'poweredOff' })],
      [host()],
      max,
      DEFAULT_SIZING_THRESHOLDS,
      1,
    )
    expect(res.rows).toHaveLength(0)
  })
})

describe('maxVmUsageAcrossSnapshots', () => {
  it('takes the per-identity max across snapshots and sets sampleBasis', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap([
        {
          vmName: 'web01',
          cluster: 'C1',
          vmBiosUuid: 'b1',
          vmInstanceUuid: 'i1',
          activeMib: mib(1000),
          consumedMib: null,
          balloonedMib: null,
          swappedMib: null,
          cpuUsageMhz: mhz(100),
        },
      ]),
      snap([
        {
          vmName: 'web01',
          cluster: 'C1',
          vmBiosUuid: 'b1',
          vmInstanceUuid: 'i1',
          activeMib: mib(3000),
          consumedMib: null,
          balloonedMib: null,
          swappedMib: null,
          cpuUsageMhz: mhz(50),
        },
      ]),
    ])
    expect(max.get('i1')?.activeMib).toBe(3000)
    expect(max.get('i1')?.cpuUsageMhz).toBe(100)
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 2)
    expect(res.rows[0]?.sampleBasis).toBe('max-of-N')
  })

  it('ignores powered-off samples when taking the max', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap(
        [
          {
            vmName: 'web01',
            cluster: 'C1',
            vmBiosUuid: 'b1',
            vmInstanceUuid: 'i1',
            activeMib: mib(9999),
            consumedMib: null,
            balloonedMib: null,
            swappedMib: null,
            cpuUsageMhz: null,
          },
        ],
        [vinfo({ poweredOn: false, powerState: 'poweredOff' })],
      ),
    ])
    expect(max.has('i1')).toBe(false)
  })
})
