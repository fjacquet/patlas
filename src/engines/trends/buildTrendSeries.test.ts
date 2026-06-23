import { describe, expect, it } from 'vitest'
import { aggregateClusters, aggregateGlobals, perDatastore } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import type { TrendHeadline } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { buildTrendSeries } from './buildTrendSeries'

const host = (over: Partial<VHostRow>): VHostRow => ({
  hostName: 'esx-1',
  cluster: 'C1',
  sockets: sockets(2),
  cores: cores(12),
  speedMhz: mhz(2600),
  memoryMib: mib(262_144),
  cpuRatio: 0.3,
  ramRatio: 0.5,
  faultDomain: '',
  model: '',
  vendor: '',
  serialNumber: '',
  esxVersion: '',
  ...over,
})

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
  osConfig: 'Ubuntu Linux (64-bit)',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  guestType: 'qemu',
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
  ...over,
})

const snap = (over: Partial<Snapshot> & { id: string }): Snapshot => ({
  filename: `${over.id}.xlsx`,
  fileSize: bytes(1024),
  capturedAt: new Date('2026-01-01T00:00:00Z'),
  vCenterLabel: 'vc-a',
  rvtoolsVersion: '4.4',
  parsedAt: new Date('2026-01-02T00:00:00Z'),
  source: 'proxmox',
  viSdkUuid: null,
  vMetaData: [],
  vhost: [host({})],
  vmUsage: [],
  proxmoxSnapshots: [],
  vinfo: [
    vm({ vmName: 'on-1', poweredOn: true, powerState: 'poweredOn' }),
    vm({ vmName: 'off-1', poweredOn: false, powerState: 'poweredOff' }),
  ],
  vdatastore: [
    {
      name: 'ds-A',
      capacityMib: mib(1000),
      freeMib: mib(400),
      provisionedMib: mib(800),
      naa: 'naa.s',
      type: 'VMFS',
      hosts: '',
      clusterName: 'C1',
    },
  ],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  parseErrors: [],
  ...over,
})

const expectedHeadline = (snaps: Snapshot[]): Pick<TrendHeadline, 'vmCount' | 'poweredOnVms'> => {
  const m = mergeSnapshotsToEstate(snaps)
  const clusters = aggregateClusters({ vinfo: m.vinfo, vhost: m.vhost, mode: 'active' })
  const ds = perDatastore(m.vdatastore)
  const g = aggregateGlobals(clusters, ds.length, mib(0))
  return {
    vmCount: g.vmCount,
    poweredOnVms: m.vinfo.filter((v) => !v.template && v.powerState === 'poweredOn').length,
  }
}

describe('buildTrendSeries', () => {
  it('2 distinct dates -> 2 points sorted ascending; headline equals shipped aggregate', () => {
    const a = snap({
      id: 'a',
      capturedAt: new Date('2026-01-31'),
      parsedAt: new Date('2026-02-01'),
    })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-03-15'),
      parsedAt: new Date('2026-03-16'),
    })
    const out = buildTrendSeries([b, a], 'active', {})
    expect(out).not.toBeNull()
    expect(out?.points).toHaveLength(2)
    expect(out?.points[0]?.date.getTime()).toBeLessThan(out?.points[1]?.date.getTime() ?? 0)
    const exp = expectedHeadline([a])
    expect(out?.points[0]?.headline.vmCount).toBe(exp.vmCount)
    expect(out?.points[0]?.headline.poweredOnVms).toBe(exp.poweredOnVms)
    expect(out?.orderInferred).toBe(false)
  })

  it('2 same-day multi-vCenter snapshots merge into ONE point (DD-A A2; counts reconcile)', () => {
    const day = new Date('2026-02-15T09:00:00Z')
    const a = snap({ id: 'a', capturedAt: day, vCenterLabel: 'vc-a' })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-02-15T18:00:00Z'),
      vCenterLabel: 'vc-b',
      vinfo: [vm({ vmName: 'b-on', cluster: 'C2', host: 'esx-2' })],
      vhost: [host({ hostName: 'esx-2', cluster: 'C2' })],
    })
    const c = snap({ id: 'c', capturedAt: new Date('2026-03-20') })
    const out = buildTrendSeries([a, b, c], 'active', {})
    // a+b same calendar day -> one merged point; c -> a second point
    expect(out?.points).toHaveLength(2)
    const merged = out?.points[0]
    const exp = expectedHeadline([a, b])
    expect(merged?.headline.vmCount).toBe(exp.vmCount)
    expect(merged?.headline.poweredOnVms).toBe(exp.poweredOnVms)
  })

  it('point.metadata is an array with one entry per contributing snapshot', () => {
    const a = snap({
      id: 'a',
      capturedAt: new Date('2026-02-15T09:00:00Z'),
      vCenterLabel: 'vc-a',
      rvtoolsVersion: '4.4',
    })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-02-15T18:00:00Z'),
      vCenterLabel: 'vc-b',
      rvtoolsVersion: '4.7',
    })
    const c = snap({ id: 'c', capturedAt: new Date('2026-03-20') })
    const out = buildTrendSeries([a, b, c], 'active', {})
    expect(out?.points[0]?.metadata).toEqual(
      expect.arrayContaining([
        { vCenterLabel: 'vc-a', rvtoolsVersion: '4.4' },
        { vCenterLabel: 'vc-b', rvtoolsVersion: '4.7' },
      ]),
    )
    expect(out?.points[0]?.metadata).toHaveLength(2)
  })

  it('deltas length is points-1; consecutive signed branded differences', () => {
    const a = snap({
      id: 'a',
      capturedAt: new Date('2026-01-31'),
      parsedAt: new Date('2026-02-01'),
    })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-02-28'),
      parsedAt: new Date('2026-03-01'),
      vinfo: [
        vm({ vmName: 'on-1', powerState: 'poweredOn' }),
        vm({ vmName: 'on-2', powerState: 'poweredOn' }),
        vm({ vmName: 'off-1', powerState: 'poweredOff', poweredOn: false }),
      ],
    })
    const out = buildTrendSeries([a, b], 'active', {})
    expect(out?.deltas).toHaveLength(1)
    const d = out?.deltas[0]
    expect(d?.vmCount).toBe(
      (out?.points[1]?.headline.vmCount ?? 0) - (out?.points[0]?.headline.vmCount ?? 0),
    )
    expect(d?.poweredOnVms).toBe(
      (out?.points[1]?.headline.poweredOnVms ?? 0) - (out?.points[0]?.headline.poweredOnVms ?? 0),
    )
    expect(typeof d?.vramAllocatedGib).toBe('number')
  })

  it('DD-C: a rawReleased snapshot uses its carried releasedAggregate, not recomputed rows', () => {
    const frozen: TrendHeadline = {
      vmCount: 999,
      poweredOnVms: 777,
      hostCount: 42,
      clusterCount: 7,
      vcpuAllocated: cores(123),
      vramAllocatedMib: mib(456),
      totalStorageMib: mib(789),
    }
    const oldReleased = snap({
      id: 'old',
      capturedAt: new Date('2026-01-31'),
      parsedAt: new Date('2026-02-01'),
      vinfo: [], // rows released — empty
      vhost: [],
      vdatastore: [],
      rawReleased: true,
      releasedAggregate: { headline: frozen, byCluster: new Map([['C1', frozen]]) },
    })
    const recent = snap({
      id: 'new',
      capturedAt: new Date('2026-03-15'),
      parsedAt: new Date('2026-03-16'),
    })
    const out = buildTrendSeries([oldReleased, recent], 'active', {})
    expect(out?.points[0]?.headline).toEqual(frozen) // carried, NOT recomputed from []
    expect(out?.points[0]?.headline.vmCount).toBe(999)
    // the rest of the series is unaffected
    const exp = expectedHeadline([recent])
    expect(out?.points[1]?.headline.vmCount).toBe(exp.vmCount)
  })

  it('D-05: undeterminable-date snapshot becomes an ordinal point after dated points; orderInferred true', () => {
    const dated = snap({
      id: 'dated',
      capturedAt: new Date('2026-01-31'),
      parsedAt: new Date('2026-02-01'),
    })
    const epoch = snap({
      id: 'epoch',
      capturedAt: new Date(0), // mtime fallback absent -> undeterminable
      parsedAt: new Date('2026-02-05'),
      vinfo: [vm({ vmName: 'e1', powerState: 'poweredOn' })],
    })
    const out = buildTrendSeries([epoch, dated], 'active', {})
    expect(out?.orderInferred).toBe(true)
    expect(out?.points).toHaveLength(2)
    // dated point first (real axis), ordinal point after (D-05)
    expect(out?.points[0]?.ordinal).toBeNull()
    expect(out?.points[1]?.ordinal).not.toBeNull()
    expect(out?.points[1]?.headline.vmCount).toBe(expectedHeadline([epoch]).vmCount)
    expect(out?.deltas).toHaveLength(1)
  })

  it('fewer than 2 snapshots -> null (degenerate, like Phase 2)', () => {
    expect(buildTrendSeries([], 'active', {})).toBeNull()
    expect(buildTrendSeries([snap({ id: 'solo' })], 'active', {})).toBeNull()
  })

  it('is pure: no in-engine clock; repeat calls deeply equal', () => {
    const a = snap({
      id: 'a',
      capturedAt: new Date('2026-01-31'),
      parsedAt: new Date('2026-02-01'),
    })
    const b = snap({
      id: 'b',
      capturedAt: new Date('2026-02-28'),
      parsedAt: new Date('2026-03-01'),
    })
    const r1 = buildTrendSeries([a, b], 'active', {})
    const r2 = buildTrendSeries([a, b], 'active', {})
    expect(JSON.stringify(r1?.points.map((p) => p.headline))).toEqual(
      JSON.stringify(r2?.points.map((p) => p.headline)),
    )
    expect(r1?.deltas).toEqual(r2?.deltas)
  })
})
