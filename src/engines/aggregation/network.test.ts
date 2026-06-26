import { describe, expect, it } from 'vitest'
import type { NodeInterfaceRow, VmNicRow } from '@/types/snapshot'
import { networkRollup } from './network'

const iface = (over: Partial<NodeInterfaceRow>): NodeInterfaceRow => ({
  node: 'pve-01',
  name: 'eno1',
  type: 'eth',
  active: true,
  autostart: true,
  method: 'manual',
  cidr: '',
  address: '',
  gateway: '',
  mtu: null,
  bondMode: '',
  slaves: [],
  bridgePorts: '',
  bridgeVlanAware: false,
  vlanId: null,
  vlanRawDevice: '',
  comments: '',
  ...over,
})

const nic = (over: Partial<VmNicRow>): VmNicRow => ({
  node: 'pve-01',
  vmId: '100',
  vmName: 'web-01',
  vmType: 'qemu',
  macAddress: 'BC:24:11:00:00:01',
  bridge: 'vmbr1',
  tag: 3,
  model: 'virtio',
  ...over,
})

describe('networkRollup — populated topology (P5)', () => {
  it('counts eth/bond/bridge/vlan interfaces per node and estate-wide', () => {
    const out = networkRollup({
      nodeInterfaces: [
        iface({ type: 'eth', name: 'eno1' }),
        iface({ type: 'eth', name: 'eno2' }),
        iface({ type: 'bond', name: 'bond0' }),
        iface({ type: 'bridge', name: 'vmbr0' }),
        iface({ type: 'vlan', name: 'COROSYNC' }),
        iface({ type: 'vlan', name: 'MGMT' }),
        iface({ node: 'pve-02', type: 'eth', name: 'eno1' }),
        iface({ node: 'pve-02', type: 'bridge', name: 'vmbr0' }),
      ],
      vmNics: [nic({}), nic({ vmId: '101', vmName: 'db-01' })],
    })

    expect(out.totalNics).toBe(3) // 2 on pve-01 + 1 on pve-02
    expect(out.totalBonds).toBe(1)
    expect(out.totalBridges).toBe(2) // 1 on pve-01 + 1 on pve-02
    expect(out.totalVlans).toBe(2)
    expect(out.vmNicCount).toBe(2)

    const n1 = out.byNode.find((n) => n.node === 'pve-01')
    expect(n1?.nics).toBe(2)
    expect(n1?.bonds).toBe(1)
    expect(n1?.bridges).toBe(1)
    expect(n1?.vlans).toBe(2)

    const n2 = out.byNode.find((n) => n.node === 'pve-02')
    expect(n2?.nics).toBe(1)
    expect(n2?.bridges).toBe(1)
  })

  it('OVS/VXLAN types are tolerated but not counted in the four totals', () => {
    const out = networkRollup({
      nodeInterfaces: [
        iface({ type: 'ovs_bridge', name: 'ovsbr0' }),
        iface({ type: 'vxlan', name: 'vxlan10' }),
        iface({ type: 'eth', name: 'eno1' }),
      ],
    })
    expect(out.totalNics).toBe(1)
    expect(out.totalBonds).toBe(0)
    expect(out.totalBridges).toBe(0)
    expect(out.totalVlans).toBe(0)
  })

  it('sorts byNode alphabetically', () => {
    const out = networkRollup({
      nodeInterfaces: [
        iface({ node: 'pve-03', type: 'eth' }),
        iface({ node: 'pve-01', type: 'eth' }),
        iface({ node: 'pve-02', type: 'eth' }),
      ],
    })
    expect(out.byNode.map((n) => n.node)).toEqual(['pve-01', 'pve-02', 'pve-03'])
  })
})

describe('networkRollup — empty input tolerated (factual-degrade, no throw)', () => {
  it('returns all-zero aggregates for empty arrays', () => {
    const out = networkRollup({ nodeInterfaces: [], vmNics: [] })
    expect(out.byNode).toEqual([])
    expect(out.totalNics).toBe(0)
    expect(out.totalBonds).toBe(0)
    expect(out.totalBridges).toBe(0)
    expect(out.totalVlans).toBe(0)
    expect(out.vmNicCount).toBe(0)
  })

  it('returns all-zero aggregates when arrays are entirely absent', () => {
    const out = networkRollup({})
    expect(out.totalNics).toBe(0)
    expect(out.vmNicCount).toBe(0)
  })
})
