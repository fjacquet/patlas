import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { buildEosProjection } from './bucketEos'
import type { EosCatalogue } from './catalogueSchema'

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
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  path: '',
  ...over,
})

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
  esxVersion: 'VMware ESXi 8.0.3 build-24674464',
  ...over,
})

const r = (name: string, eolFrom: string | null, isEol = false) => ({
  name,
  label: name,
  releaseDate: null,
  isEol,
  eolFrom,
  isMaintained: !isEol,
})

const catalogue: EosCatalogue = {
  lastVerified: '2026-05-01',
  products: {
    rhel: { name: 'RHEL', releases: [r('8', '2029-05-31')] },
    'windows-server': { name: 'Windows Server', releases: [r('2012', '2023-10-10', true)] },
    debian: { name: 'Debian', releases: [r('12', '2026-07-15')] },
    centos: { name: 'CentOS', releases: [r('7', '2027-01-15')] },
    esxi: { name: 'VMware ESXi', releases: [r('8.0', '2027-10-11')] },
  },
}

const TODAY = new Date('2026-06-01T00:00:00Z')

describe('buildEosProjection — reconciliation invariant (D-06/D-10)', () => {
  it('the disjoint partition sums EXACTLY to the VM entity total', () => {
    const vinfo = [
      vm({ osConfig: 'Red Hat Enterprise Linux 8 (64-bit)' }), // beyond12
      vm({ osConfig: 'Microsoft Windows Server 2012 (64-bit)' }), // overdue
      vm({ osConfig: 'Debian GNU/Linux 12 (64-bit)' }), // w3
      vm({ osConfig: 'CentOS 7 (64-bit)' }), // w6to9 (~7mo)
      vm({ osConfig: 'Other (64-bit)' }), // unknown (unnormalized)
      vm({ osConfig: 'Oracle Linux 8' }), // unknown (no catalogue entry)
    ]
    const p = buildEosProjection({ vinfo, vhost: [], catalogue, today: TODAY })
    const sum =
      p.partition.overdue.length +
      p.partition.w3.length +
      p.partition.w3to6.length +
      p.partition.w6to9.length +
      p.partition.w9to12.length +
      p.partition.beyond12.length +
      p.partition.unknown.length
    expect(sum).toBe(vinfo.length)
  })
})

describe('buildEosProjection — overdue uses the injected today (D-07)', () => {
  it('an eolFrom strictly before the injected today buckets overdue', () => {
    const p = buildEosProjection({
      vinfo: [vm({ osConfig: 'Microsoft Windows Server 2012 (64-bit)' })],
      vhost: [],
      catalogue,
      today: TODAY,
    })
    expect(p.partition.overdue).toHaveLength(1)
    expect(p.reference.today).toBe('2026-06-01')
    expect(p.reference.lastVerified).toBe('2026-05-01')
  })
})

describe('buildEosProjection — unknown is first-class with verbatim raw (D-11/D-12)', () => {
  it('unnormalized + no-catalogue-EOL land in unknown; rawUnknown is verbatim + counted', () => {
    const p = buildEosProjection({
      vinfo: [
        vm({ osConfig: 'Other (64-bit)' }),
        vm({ osConfig: 'Other (64-bit)' }),
        vm({ osConfig: 'Oracle Linux 8' }), // normalizes but no catalogue entry → unknown
      ],
      vhost: [],
      catalogue,
      today: TODAY,
    })
    expect(p.partition.unknown).toHaveLength(3)
    const other = p.rawUnknown.find((u) => u.osString === 'Other (64-bit)')
    expect(other?.count).toBe(2)
    expect(p.rawUnknown.find((u) => u.osString === 'Oracle Linux 8')?.count).toBe(1)
  })
})

describe('buildEosProjection — cumulative derived from the disjoint partition', () => {
  it('cumulative tiers are monotonic supersets of the partition (no double count)', () => {
    const vinfo = [
      vm({ osConfig: 'Microsoft Windows Server 2012 (64-bit)' }), // overdue
      vm({ osConfig: 'Debian GNU/Linux 12 (64-bit)' }), // w3
      vm({ osConfig: 'CentOS 7 (64-bit)' }), // w6to9
      vm({ osConfig: 'Red Hat Enterprise Linux 8 (64-bit)' }), // beyond12
      vm({ osConfig: 'Other (64-bit)' }), // unknown
    ]
    const p = buildEosProjection({ vinfo, vhost: [], catalogue, today: TODAY })
    expect(p.cumulative.overdue).toBe(p.partition.overdue.length)
    expect(p.cumulative.le3).toBe(p.partition.overdue.length + p.partition.w3.length)
    expect(p.cumulative.le6).toBe(p.cumulative.le3 + p.partition.w3to6.length)
    expect(p.cumulative.le9).toBe(p.cumulative.le6 + p.partition.w6to9.length)
    expect(p.cumulative.le12).toBe(p.cumulative.le9 + p.partition.w9to12.length)
    expect(p.cumulative.unknown).toBe(p.partition.unknown.length)
  })
})

describe('buildEosProjection — host vs VM cardinality never conflated (D-09b)', () => {
  it('ESXi hosts are reported separately and never summed into the VM partition total', () => {
    const vinfo = [vm({ osConfig: 'Red Hat Enterprise Linux 8 (64-bit)' })]
    const vhost = [host({}), host({ hostName: 'esx-2' })]
    const p = buildEosProjection({ vinfo, vhost, catalogue, today: TODAY })
    const vmSum =
      p.partition.overdue.length +
      p.partition.w3.length +
      p.partition.w3to6.length +
      p.partition.w6to9.length +
      p.partition.w9to12.length +
      p.partition.beyond12.length +
      p.partition.unknown.length
    expect(vmSum).toBe(vinfo.length) // 1, NOT 1 + 2 hosts
    expect(p.esxi.hosts).toHaveLength(2)
    expect(p.esxi.hosts[0]?.major).toBe('8.0')
    expect(p.esxi.hosts[0]?.majorEol).toBe('2027-10-11')
    expect(p.esxi.hosts[0]?.patchEol).toBeNull()
  })
})

describe('buildEosProjection — month-boundary date math (CodeRabbit PR#1)', () => {
  // today = end-of-month (31st). The buggy monthsAfter overflowed the +3mo
  // boundary into the next month (Mar 31 + 3 → Date.UTC(2026,5,31) = Jul 1
  // instead of the clamped Jun 30). An eolFrom of 2026-07-01 then mis-bucketed
  // as `w3` (≤ overflowed boundary) instead of the correct `w3to6`.
  it('end-of-month input does not overflow the 3-month threshold', () => {
    const cat: EosCatalogue = {
      lastVerified: '2026-01-01',
      products: { debian: { name: 'Debian', releases: [r('12', '2026-07-01')] } },
    }
    const p = buildEosProjection({
      vinfo: [vm({ osConfig: 'Debian GNU/Linux 12 (64-bit)' })],
      vhost: [],
      catalogue: cat,
      today: new Date('2026-03-31T00:00:00Z'),
    })
    expect(p.partition.w3).toHaveLength(0)
    expect(p.partition.w3to6).toHaveLength(1)
  })

  it('a same-day EOL is not flipped to overdue by the injected clock time-of-day', () => {
    const cat: EosCatalogue = {
      lastVerified: '2026-01-01',
      products: { debian: { name: 'Debian', releases: [r('12', '2026-06-15')] } },
    }
    const p = buildEosProjection({
      vinfo: [vm({ osConfig: 'Debian GNU/Linux 12 (64-bit)' })],
      vhost: [],
      catalogue: cat,
      today: new Date('2026-06-15T14:30:00Z'), // same calendar day, afternoon
    })
    expect(p.partition.overdue).toHaveLength(0)
    expect(p.partition.w3).toHaveLength(1)
  })
})
