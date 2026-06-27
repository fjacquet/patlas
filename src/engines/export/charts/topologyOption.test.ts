import { describe, expect, it } from 'vitest'
import type { TopologyView } from '@/engines/aggregation/topologyTree'
import { type TopologyLabels, topologyTreeOption } from './topologyOption'

const LABELS: TopologyLabels = {
  estate: 'Estate',
  nodesWord: 'nodes',
  unconfigured: '+ {{count}} unconfigured NICs',
  vms: 'VMs',
  ofNodes: '{{withVms}}/{{total}} nodes',
}

const view = (leaves: number): TopologyView => ({
  hasData: true,
  groups: [
    {
      nodes: ['pve1', 'pve2'],
      unconfiguredNicCount: 0,
      signature: 's',
      roots: [
        {
          id: 'g0/bond0',
          name: 'bond0 · 802.3ad · eno1+eno2',
          kind: 'bond',
          children: [
            {
              id: 'g0/bond0/vmbr0',
              name: 'vmbr0 (VLAN-aware)',
              kind: 'bridge',
              children: Array.from({ length: leaves }, (_, i) => ({
                id: `g0/bond0/vmbr0/vlan${i}`,
                name: `VLAN ${i}`,
                kind: 'vlan' as const,
                vmCount: 4,
                vmNodeSpread: { withVms: 1, total: 2 },
              })),
            },
          ],
        },
      ],
    },
  ],
})

describe('topologyTreeOption', () => {
  it('emits one tree series, LR orient, SVG-safe, with a synthetic root', () => {
    const { option } = topologyTreeOption(view(2), LABELS)
    const series = (
      option.series as { type: string; layout: string; orient: string; data: unknown[] }[]
    )[0]
    expect(series?.type).toBe('tree')
    expect(series?.orient).toBe('LR')
    expect(series?.data).toHaveLength(1) // single synthetic estate root
  })

  it('leaf with vmCount undefined returns plain name (no suffix)', () => {
    // Covers topologyOption.ts line 26: `if (n.vmCount === undefined) return n.name`
    const noVmView: TopologyView = {
      hasData: true,
      groups: [
        {
          nodes: ['pve1'],
          unconfiguredNicCount: 0,
          signature: 's',
          roots: [
            {
              id: 'g0/eth0',
              name: 'eth0',
              kind: 'nic',
              children: [
                {
                  id: 'g0/eth0/vmbr0',
                  name: 'vmbr0',
                  kind: 'bridge',
                  children: [
                    // leaf with NO vmCount — undefined path
                    {
                      id: 'g0/eth0/vmbr0/untagged',
                      name: 'untagged',
                      kind: 'vlan' as const,
                      // vmCount intentionally omitted
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const { option } = topologyTreeOption(noVmView, LABELS)
    const raw = JSON.stringify(option.series)
    // The leaf must use its plain name ('untagged'), not the ' · N VMs' suffix.
    expect(raw).toContain('"untagged"')
    // Should NOT have the VMs suffix appended to 'untagged'.
    expect(raw).not.toContain('untagged · ')
  })

  it('grows height with leaf count and clamps at the bounds', () => {
    const small = topologyTreeOption(view(1), LABELS).height
    const big = topologyTreeOption(view(40), LABELS).height
    expect(big).toBeGreaterThan(small)
    expect(big).toBeLessThanOrEqual(2400) // MAX_H
    expect(small).toBeGreaterThanOrEqual(360) // MIN_H
  })

  it('interpolates label templates and applies leaf suffix; intermediate node uses plain name', () => {
    // Build a view whose leaf has vmCount + vmNodeSpread, and the group has
    // unconfiguredNicCount > 0 so the {{count}} branch executes.
    const leafView: TopologyView = {
      hasData: true,
      groups: [
        {
          nodes: ['pve1', 'pve2'],
          unconfiguredNicCount: 3,
          signature: 's',
          roots: [
            {
              id: 'g0/bond0',
              name: 'bond0 · 802.3ad · eno1+eno2',
              kind: 'bond',
              children: [
                {
                  id: 'g0/bond0/vmbr0',
                  name: 'vmbr0 (VLAN-aware)',
                  kind: 'bridge',
                  children: [
                    {
                      id: 'g0/bond0/vmbr0/vlan100',
                      name: 'VLAN 100',
                      kind: 'vlan' as const,
                      vmCount: 7,
                      vmNodeSpread: { withVms: 1, total: 2 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    const { option } = topologyTreeOption(leafView, LABELS)
    // Serialize the tree data to a string so we can inspect rendered names.
    const raw = JSON.stringify(option.series)

    // {{count}} replaced in group header
    expect(raw).toContain('3')
    expect(raw).not.toContain('{{count}}')

    // leaf carries vmCount (7) and ofNodes interpolation (1/2 nodes)
    expect(raw).toContain('7')
    expect(raw).not.toContain('{{withVms}}')
    expect(raw).not.toContain('{{total}}')

    // intermediate node (bridge) uses its plain name, not the leaf suffix
    expect(raw).toContain('vmbr0 (VLAN-aware)')

    // group header: no double space before '('
    expect(raw).not.toContain('  (×')
  })
})
