import { describe, expect, it } from 'vitest'
import type { NodeInterfaceRow, VmNicRow } from '@/types/snapshot'
import { buildTopology } from './topologyTree'

const iface = (o: Partial<NodeInterfaceRow>): NodeInterfaceRow => ({
  node: 'pve1',
  name: '',
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
  ...o,
})

// A standard VLAN-aware node: eno1+eno2 → bond0 → vmbr0 (vlan-aware).
const standardNode = (node: string): NodeInterfaceRow[] => [
  iface({ node, name: 'eno1', type: 'eth', active: true }),
  iface({ node, name: 'eno2', type: 'eth', active: true }),
  iface({ node, name: 'bond0', type: 'bond', bondMode: '802.3ad', slaves: ['eno1', 'eno2'] }),
  iface({ node, name: 'vmbr0', type: 'bridge', bridgePorts: 'bond0', bridgeVlanAware: true }),
]

const vmNic = (o: Partial<VmNicRow>): VmNicRow => ({
  node: 'pve1',
  vmId: '100',
  vmName: 'vm',
  vmType: 'qemu',
  macAddress: '',
  bridge: 'vmbr0',
  tag: null,
  model: 'virtio',
  ...o,
})

describe('buildTopology', () => {
  it('returns hasData:false for empty input', () => {
    expect(buildTopology({}).hasData).toBe(false)
    expect(buildTopology({ nodeInterfaces: [] }).groups).toEqual([])
  })

  it('groups identical nodes into one group', () => {
    const nodeInterfaces = [...standardNode('pve1'), ...standardNode('pve2')]
    const v = buildTopology({ nodeInterfaces })
    expect(v.hasData).toBe(true)
    expect(v.groups).toHaveLength(1)
    expect(v.groups[0]?.nodes).toEqual(['pve1', 'pve2'])
  })

  it('roots at the uplink (bond) with slaves inline, bridge as child', () => {
    const v = buildTopology({ nodeInterfaces: standardNode('pve1') })
    const root = v.groups[0]?.roots[0]
    expect(root?.kind).toBe('bond')
    expect(root?.name).toContain('bond0')
    expect(root?.name).toContain('eno1') // slaves inline
    expect(root?.name).toContain('eno2')
    expect(root?.children?.[0]?.kind).toBe('bridge')
    expect(root?.children?.[0]?.name).toContain('vmbr0')
  })

  it('an inactive/standalone NIC does NOT split the group, raises unconfiguredNicCount', () => {
    const a = standardNode('pve1')
    const b = [
      ...standardNode('pve2'),
      iface({ node: 'pve2', name: 'eno9', type: 'eth', active: false }),
    ]
    const v = buildTopology({ nodeInterfaces: [...a, ...b] })
    expect(v.groups).toHaveLength(1) // not split by the inactive dongle
    expect(v.groups[0]?.unconfiguredNicCount).toBeGreaterThanOrEqual(1)
  })

  it('different bond slaves split into two groups', () => {
    const a = standardNode('pve1')
    const b = [
      iface({ node: 'pve2', name: 'eno1', type: 'eth' }),
      iface({ node: 'pve2', name: 'bond0', type: 'bond', bondMode: '802.3ad', slaves: ['eno1'] }),
      iface({
        node: 'pve2',
        name: 'vmbr0',
        type: 'bridge',
        bridgePorts: 'bond0',
        bridgeVlanAware: true,
      }),
    ]
    expect(buildTopology({ nodeInterfaces: [...a, ...b] }).groups).toHaveLength(2)
  })

  it('VLAN + untagged leaves carry summed VM count and vmNodeSpread', () => {
    const nodeInterfaces = [
      ...standardNode('pve1'),
      ...standardNode('pve2'),
      iface({ node: 'pve1', name: 'vmbr0.100', type: 'vlan', vlanId: 100, vlanRawDevice: 'vmbr0' }),
      iface({ node: 'pve2', name: 'vmbr0.100', type: 'vlan', vlanId: 100, vlanRawDevice: 'vmbr0' }),
    ]
    // 64 tagged VMs all on pve1; 10 untagged split across both
    const vmNics: VmNicRow[] = [
      ...Array.from({ length: 64 }, (_, i) =>
        vmNic({ node: 'pve1', vmId: String(i), bridge: 'vmbr0', tag: 100 }),
      ),
      vmNic({ node: 'pve1', bridge: 'vmbr0', tag: null }),
      vmNic({ node: 'pve2', bridge: 'vmbr0', tag: null }),
    ]
    const v = buildTopology({ nodeInterfaces, vmNics })
    const bridge = v.groups[0]?.roots[0]?.children?.[0]
    const vlan = bridge?.children?.find((c) => c.kind === 'vlan')
    expect(vlan?.vmCount).toBe(64)
    expect(vlan?.vmNodeSpread).toEqual({ withVms: 1, total: 2 }) // concentrated on 1 of 2
    const untagged = bridge?.children?.find((c) => c.name.toLowerCase().includes('untagged'))
    expect(untagged?.vmCount).toBe(2)
    expect(untagged?.vmNodeSpread).toEqual({ withVms: 2, total: 2 })
  })

  it('inactive non-eth (bond/vlan) does NOT raise unconfiguredNicCount; inactive eth does', () => {
    // Inactive bond — must NOT count as unconfigured NIC.
    const downBond = iface({ node: 'pve1', name: 'bond9', type: 'bond', active: false })
    // Inactive eth — must count as unconfigured NIC.
    const downEth = iface({ node: 'pve1', name: 'eno9', type: 'eth', active: false })
    // An active standard node to form a valid group.
    const rows = [...standardNode('pve1'), downBond, downEth]
    const v = buildTopology({ nodeInterfaces: rows })
    expect(v.groups).toHaveLength(1)
    const unconfigured = v.groups[0]?.unconfiguredNicCount ?? 0
    // downEth counts; downBond must NOT count.
    expect(unconfigured).toBe(1)
  })

  it('standalone NIC (no bond) bridge: root is nic kind with bridge child', () => {
    // Covers the `nic:${b.port}` branch in signatureOf and the `'nic'` kind in roots.
    const rows = [
      iface({ node: 'pve1', name: 'eth0', type: 'eth', active: true }),
      iface({
        node: 'pve1',
        name: 'vmbr0',
        type: 'bridge',
        bridgePorts: 'eth0',
        bridgeVlanAware: false,
      }),
    ]
    const v = buildTopology({ nodeInterfaces: rows })
    expect(v.hasData).toBe(true)
    const root = v.groups[0]?.roots[0]
    expect(root?.kind).toBe('nic')
    expect(root?.name).toContain('eth0')
    expect(root?.children?.[0]?.kind).toBe('bridge')
  })

  it('does not crash on unknown/SDN interface types', () => {
    const rows = [iface({ node: 'pve1', name: 'vxlan1', type: 'vxlan' })]
    expect(() => buildTopology({ nodeInterfaces: rows })).not.toThrow()
  })
})
