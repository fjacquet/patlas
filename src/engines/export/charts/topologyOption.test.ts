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

  it('grows height with leaf count and clamps at the bounds', () => {
    const small = topologyTreeOption(view(1), LABELS).height
    const big = topologyTreeOption(view(40), LABELS).height
    expect(big).toBeGreaterThan(small)
    expect(big).toBeLessThanOrEqual(2400) // MAX_H
    expect(small).toBeGreaterThanOrEqual(360) // MIN_H
  })
})
