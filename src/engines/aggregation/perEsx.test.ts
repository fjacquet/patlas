import { describe, expect, it } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import { first } from '@/test/arrays'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { perEsx } from './perEsx'

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
  esxVersion: '',
  ...over,
})

const vm = (over: Partial<VInfoRow>): VInfoRow => ({
  vmName: 'vm-1',
  cluster: 'C1',
  host: 'esx-1',
  vcpu: cores(4),
  vramMib: mib(8192),
  cpuReadinessPercent: null,
  poweredOn: true,
  powerState: 'poweredOn',
  template: false,
  osConfig: '',
  osTools: '',
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  ...over,
})

describe('perEsx', () => {
  it('attaches VMs via VInfoRow.host === hostName; cores is physical (Moderate-4)', () => {
    const d = first(
      perEsx(
        [host({ hostName: 'esx-1', cores: cores(12) })],
        [vm({ host: 'esx-1' }), vm({ host: 'esx-2' })],
        'active',
      ),
    )
    expect(d.cores as number).toBe(12)
    expect(d.vmCount).toBe(1) // only the esx-1 VM
    expect(d.physicalGhz as number).toBeCloseTo((2600 * 12) / 1000)
  })

  it('vmCount/vcpuAllocated honor the accounting mode', () => {
    const vinfo = [
      vm({ vmName: 'on', host: 'esx-1', poweredOn: true, vcpu: cores(4) }),
      vm({ vmName: 'off', host: 'esx-1', poweredOn: false, vcpu: cores(8) }),
    ]
    const cfg = first(perEsx([host({})], vinfo, 'configured'))
    const act = first(perEsx([host({})], vinfo, 'active'))
    expect(cfg.vmCount).toBe(2)
    expect(cfg.vcpuAllocated as number).toBe(12)
    expect(act.vmCount).toBe(1)
    expect(act.vcpuAllocated as number).toBe(4)
  })

  it('reuses the shared readinessStats (DRY) — always powered-on-only', () => {
    const d = first(
      perEsx(
        [host({})],
        [
          vm({ host: 'esx-1', poweredOn: true, cpuReadinessPercent: 12 }),
          vm({ host: 'esx-1', poweredOn: false, cpuReadinessPercent: 99 }),
        ],
        'active',
      ),
    )
    expect(d.meanCpuReadinessPercent).toBeCloseTo(12)
    expect(d.readinessAvailable).toBe(true)
  })
})
