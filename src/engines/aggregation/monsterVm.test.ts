import { describe, expect, it } from 'vitest'
import { cores, mib } from '@/engines/units'
import type { VInfoRow } from '@/types/vinfo'
import { computeMonsters, DEFAULT_MONSTER_THRESHOLDS } from './monsterVm'

const vm = (over: Partial<VInfoRow> = {}): VInfoRow => ({
  vmName: 'vm',
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
  vmBiosUuid: '',
  vmInstanceUuid: '',
  viSdkUuid: '',
  viSdkServer: '',
  provisionedMib: mib(0),
  inUseMib: mib(0),
  path: '',
  ...over,
})

describe('computeMonsters', () => {
  it('flags a VM that meets the vCPU line OR the vRAM line', () => {
    const res = computeMonsters(
      [
        vm({ vmName: 'small' }),
        vm({ vmName: 'wide', vcpu: cores(32) }),
        vm({ vmName: 'fat', vramMib: mib(256 * 1024) }),
      ],
      DEFAULT_MONSTER_THRESHOLDS,
    )
    expect(res.count).toBe(2)
    expect(res.rows.map((r) => r.vmName)).toEqual(['wide', 'fat'])
    expect(res.rows[0]?.byVcpu).toBe(true)
    expect(res.rows[1]?.byVram).toBe(true)
  })

  it('compares the vRAM line in GiB (×1024 MiB)', () => {
    // 128 GiB line = 131072 MiB; exactly-on is included (≥).
    const res = computeMonsters(
      [vm({ vmName: 'edge', vramMib: mib(131_072) })],
      DEFAULT_MONSTER_THRESHOLDS,
    )
    expect(res.count).toBe(1)
    expect(res.rows[0]?.byVram).toBe(true)
  })

  it('excludes templates but keeps powered-off VMs', () => {
    const res = computeMonsters(
      [
        vm({ vmName: 'tmpl', vcpu: cores(64), template: true }),
        vm({ vmName: 'off', vcpu: cores(64), poweredOn: false, powerState: 'poweredOff' }),
      ],
      DEFAULT_MONSTER_THRESHOLDS,
    )
    expect(res.rows.map((r) => r.vmName)).toEqual(['off'])
  })

  it('sorts desc by vCPU then vRAM', () => {
    const res = computeMonsters(
      [
        vm({ vmName: 'a', vcpu: cores(16), vramMib: mib(8192) }),
        vm({ vmName: 'b', vcpu: cores(32), vramMib: mib(8192) }),
        vm({ vmName: 'c', vcpu: cores(16), vramMib: mib(262_144) }),
      ],
      DEFAULT_MONSTER_THRESHOLDS,
    )
    expect(res.rows.map((r) => r.vmName)).toEqual(['b', 'c', 'a'])
  })

  it('honors a custom threshold', () => {
    const res = computeMonsters([vm({ vmName: 'mid', vcpu: cores(8) })], {
      minVcpu: 8,
      minVramGib: 9999,
    })
    expect(res.count).toBe(1)
  })
})
