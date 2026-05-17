import { describe, expect, it } from 'vitest'
import type { VDvPortRow, VDvSwitchRow, VNetworkRow, VSwitchRow } from '@/types/snapshot'
import { networkRollup } from './network'

const net = (over: Partial<VNetworkRow>): VNetworkRow => ({
  vm: 'vm-1',
  network: 'PG-Prod',
  switch: 'vSwitch0',
  adapter: 'vmxnet3',
  connected: 'True',
  cluster: 'CL_1',
  host: 'esx-1',
  ...over,
})

const sw = (over: Partial<VSwitchRow>): VSwitchRow => ({
  host: 'esx-1',
  cluster: 'CL_1',
  switch: 'vSwitch0',
  ports: 128,
  freePorts: 96,
  mtu: 1500,
  ...over,
})

const dvs = (over: Partial<VDvSwitchRow>): VDvSwitchRow => ({
  switch: 'DVS-1',
  name: 'prod-dvs',
  version: '8.0.0',
  hostMembers: 'esx-1, esx-2',
  ports: 512,
  vms: 40,
  maxMtu: 9000,
  ...over,
})

const dvp = (over: Partial<VDvPortRow>): VDvPortRow => ({
  port: 'dvpg-10',
  switch: 'DVS-1',
  vlan: '10',
  activeUplink: 'uplink1',
  standbyUplink: 'uplink2',
  ...over,
})

describe('networkRollup — populated topology (D-11)', () => {
  it('rolls up vSwitch with the VM count from vNetwork', () => {
    const out = networkRollup({
      vnetwork: [net({ vm: 'a' }), net({ vm: 'b' })],
      vswitch: [sw({})],
      dvswitch: [],
      dvport: [],
    })
    expect(out.vswitches).toHaveLength(1)
    expect(out.vswitches[0]?.ports).toBe(128)
    expect(out.vswitches[0]?.vmCount).toBe(2)
    expect(out.portgroups[0]).toMatchObject({ network: 'PG-Prod', switch: 'vSwitch0', vmCount: 2 })
    expect(out.vmPortgroupCount).toBe(2)
  })

  it('groups dvPort portgroups under the owning dvSwitch', () => {
    const out = networkRollup({
      vnetwork: [],
      vswitch: [],
      dvswitch: [dvs({})],
      dvport: [dvp({ port: 'pg-a' }), dvp({ port: 'pg-b', vlan: '20' })],
    })
    expect(out.dvswitches).toHaveLength(1)
    expect(out.dvswitches[0]?.maxMtu).toBe(9000)
    expect(out.dvswitches[0]?.portgroups).toHaveLength(2)
    expect(out.dvswitches[0]?.portgroups[1]).toMatchObject({ port: 'pg-b', vlan: '20' })
  })
})

describe('networkRollup — empty input tolerated (Pitfall 1, no throw)', () => {
  it('returns empty aggregates for all-empty input', () => {
    const out = networkRollup({ vnetwork: [], vswitch: [], dvswitch: [], dvport: [] })
    expect(out.vswitches).toEqual([])
    expect(out.dvswitches).toEqual([])
    expect(out.portgroups).toEqual([])
    expect(out.vmPortgroupCount).toBe(0)
  })

  it('returns empty aggregates when the arrays are entirely absent', () => {
    const out = networkRollup({})
    expect(out.vswitches).toEqual([])
    expect(out.dvswitches).toEqual([])
    expect(out.portgroups).toEqual([])
    expect(out.vmPortgroupCount).toBe(0)
  })
})
