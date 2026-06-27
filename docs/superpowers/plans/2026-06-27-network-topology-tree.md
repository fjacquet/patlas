# Network Topology Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a Proxmox-native network topology tree (bond/NIC → bridge → VLAN, deduplicated by config) from `nodeInterfaces` + `vmNics`, across the web view, HTML report, and PPTX slide — independent of the upstream `network-diagram.svg`.

**Architecture:** One pure aggregation (`topologyTree.ts`) builds a deduplicated `TopologyView`; one pure builder (`topologyOption.ts`) turns it into an ECharts `tree` option + a computed render height. `view.topology` is threaded through the single `buildEstateView` pass. Three render targets consume the shared builder: web `<Chart>`, HTML SSR inline-SVG, PPTX SVG→PNG. `TreeChart` is registered in the (non-gated) worker SSR registry for exports and in the gated `Chart.tsx` for the web (measure, lazy-split only if the index chunk exceeds 300 KiB).

**Tech Stack:** TypeScript (strict), Apache ECharts `tree` series (SVG renderer), resvg-wasm (PPTX raster), pptxgenjs, react-i18next (en/fr/de/it), Vitest, Biome.

## Global Constraints

- Engines are **pure** — no React/Zustand/DOM/i18n; Zod only at the parser boundary. The aggregation and option builder are pure functions. Coverage gate **≥75%** on `engines/`.
- **Pure builder localization:** `topologyTreeOption` cannot call i18n; it takes a `labels: TopologyLabels` struct so each render site passes localized strings.
- ECharts: **SVG renderer only** (project mandate); register via `echarts/core` + per-feature subpaths + `echarts.use([...])` — the top-level `echarts` barrel import is forbidden (bundle gate).
- **Bundle gate:** the web `index` chunk must stay **≤300 KiB gz** (`check:bundle-size`). The export-worker chunk is excluded from the gate.
- i18n keys land in **all four** locales (en/fr/de/it) with identical paths (`keyParity` gate). Web labels → `network.json`; export labels → `pptx.json` (the export bag merges `report`+`pptx`+`protection`). No pre-formatted numbers in strings; counts are interpolated at render.
- Branded units unaffected (network is structural). Privacy invariant intact: no network calls; derived in-memory from parsed rows.
- `lint` via `npx @biomejs/biome check .` (NOT `npm run lint`). Test-file type errors surface only under full `npm run typecheck` (app + `tsconfig.test.json`).
- Commit prefix `fix(...)`/`feat(...)`. **Squash merge is forbidden.**
- Branch: `feat/network-topology-tree` (off `main` @ 9d0fe51).

## Decisions (from the spec + user)

- Depth: infra-only + VM counts (no per-VM leaves). Scope: deduplicated by config. Render: ECharts `TreeChart`.
- Hierarchy: **bond/standalone-NIC → bridge → VLAN/untagged(VM count)**; bond slaves inline in the bond label; physical NICs never leaves.
- Signature ignores inactive/unconfigured/standalone interfaces (surfaced as `unconfiguredNicCount`). VM counts carry a `vmNodeSpread` distribution descriptor. Path-based node ids. Dynamic SSR height.
- **(A)** Keep the upstream SVG on the web as a secondary collapsible section. **(B)** Register `TreeChart` in `Chart.tsx`, measure `check:bundle-size`, lazy-split the web topology chart only if the index chunk exceeds 300 KiB.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/engines/aggregation/topologyTree.ts` (new) | Pure: rows → deduplicated `TopologyView` | 1 |
| `src/engines/aggregation/topologyTree.test.ts` (new) | Aggregation tests | 1 |
| `src/engines/export/charts/topologyOption.ts` (new) | Pure: `TopologyView` + labels → `{ option, height }` | 2 |
| `src/engines/export/charts/topologyOption.test.ts` (new) | Builder tests | 2 |
| `src/types/estate.ts` (modify) | Add `topology: TopologyView` to `EstateView` | 3 |
| `src/engines/aggregation/estateView.ts` (modify) | Build `topology`; `EMPTY_TOPOLOGY` | 3 |
| `src/engines/export/html/renderCharts.ts` (modify) | Register `TreeChart` in the worker SSR registry | 3 |
| `src/i18n/locales/{en,fr,de,it}/network.json` + `pptx.json` (modify) | `TopologyLabels` keys (web + export) | 3 |
| `src/components/Chart.tsx` (modify) | Register `TreeChart` (web); measure/lazy-split | 4 |
| `src/components/network/NetworkView.tsx` (modify) | Topology section + collapsible upstream SVG | 4 |
| `src/engines/export/html/renderReport.tsx` (modify) | Inline topology SVG in the network section | 5 |
| `src/engines/export/export.worker.ts` (modify) | Render topology option → PNG | 6 |
| `src/engines/export/pptx/slides/networkSlide.ts` (modify) | Embed topology PNG; drop oversized branch | 6 |
| `src/engines/export/pptx/builder.ts` (modify) | Thread topology PNG to the network slide | 6 |

## Wave plan (for parallel sonnet execution)

- **Wave 0 (foundation, sequential):** Task 1 → Task 2 → Task 3. Each lands on the branch before the next.
- **Wave 1 (parallel, worktrees off Task 3's commit):** Task 4 (web) ∥ Task 5 (HTML) ∥ Task 6 (PPTX) — fully file-disjoint.
- **Wave 2 (sequential):** Task 7 — final integration gates, realfile test, remove dead `networkOversized` plumbing.

---

### Task 1: Topology aggregation (pure engine)

**Files:**
- Create: `src/engines/aggregation/topologyTree.ts`
- Test: `src/engines/aggregation/topologyTree.test.ts`

**Interfaces:**
- Consumes: `NodeInterfaceRow` (`node,name,type,active,bondMode,slaves[],bridgePorts,bridgeVlanAware,vlanId,vlanRawDevice`), `VmNicRow` (`node,bridge,tag`) from `@/types/snapshot`.
- Produces: `TopologyKind`, `TopologyNode`, `TopologyGroup`, `TopologyView`, `buildTopology(merged)`.

- [ ] **Step 1: Write the failing tests**

Create `src/engines/aggregation/topologyTree.test.ts`:

```ts
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
    const b = [...standardNode('pve2'), iface({ node: 'pve2', name: 'eno9', type: 'eth', active: false })]
    const v = buildTopology({ nodeInterfaces: [...a, ...b] })
    expect(v.groups).toHaveLength(1) // not split by the inactive dongle
    expect(v.groups[0]?.unconfiguredNicCount).toBeGreaterThanOrEqual(1)
  })

  it('different bond slaves split into two groups', () => {
    const a = standardNode('pve1')
    const b = [
      iface({ node: 'pve2', name: 'eno1', type: 'eth' }),
      iface({ node: 'pve2', name: 'bond0', type: 'bond', bondMode: '802.3ad', slaves: ['eno1'] }),
      iface({ node: 'pve2', name: 'vmbr0', type: 'bridge', bridgePorts: 'bond0', bridgeVlanAware: true }),
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
      ...Array.from({ length: 64 }, (_, i) => vmNic({ node: 'pve1', vmId: String(i), bridge: 'vmbr0', tag: 100 })),
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

  it('does not crash on unknown/SDN interface types', () => {
    const rows = [iface({ node: 'pve1', name: 'vxlan1', type: 'vxlan' })]
    expect(() => buildTopology({ nodeInterfaces: rows })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engines/aggregation/topologyTree.test.ts`
Expected: FAIL — `buildTopology` not found.

- [ ] **Step 3: Implement `topologyTree.ts`**

Create `src/engines/aggregation/topologyTree.ts`:

```ts
import type { NodeInterfaceRow, VmNicRow } from '@/types/snapshot'

/**
 * P-NT — Proxmox network topology tree, deduplicated by config. Pure: no
 * React/Zustand/Zod/DOM. Empty input ⇒ hasData:false, never a throw.
 *
 * Hierarchy roots at the physical uplink (bond / standalone bridge-ported NIC)
 * so every node has exactly one parent and the VM-bearing VLAN/untagged nodes
 * are the spacious leaves. Bond slaves are inline in the bond label.
 */
export type TopologyKind = 'bridge' | 'bond' | 'nic' | 'vlan'

export interface TopologyNode {
  /** Path-based unique id (`g0/bond0/vmbr0/vlan100`). */
  id: string
  name: string
  kind: TopologyKind
  /** VLAN/untagged leaves only: VM count summed across grouped nodes. */
  vmCount?: number
  /** VLAN/untagged leaves only: how many grouped nodes carry VMs here. */
  vmNodeSpread?: { withVms: number; total: number }
  children?: TopologyNode[]
}

export interface TopologyGroup {
  nodes: string[]
  roots: TopologyNode[]
  unconfiguredNicCount: number
  signature: string
}

export interface TopologyView {
  groups: TopologyGroup[]
  hasData: boolean
}

const norm = (s: string): string => s.trim().toLowerCase()

/** A per-node structural model used for both signature + tree building. */
interface NodeModel {
  bridges: { name: string; port: string; vlanAware: boolean }[]
  bonds: Map<string, { mode: string; slaves: string[] }>
  vlans: { name: string; id: number | null; raw: string }[]
  /** active eth names reachable from a bridge (slaves or direct ports). */
  reachableNics: Set<string>
  /** active interfaces NOT reachable from any bridge. */
  unconfigured: string[]
}

const modelOf = (rows: NodeInterfaceRow[]): NodeModel => {
  const bonds = new Map<string, { mode: string; slaves: string[] }>()
  const bridges: NodeModel['bridges'] = []
  const vlans: NodeModel['vlans'] = []
  const nics: string[] = []
  for (const r of rows) {
    if (!r.active) continue
    const t = norm(r.type)
    if (t === 'bond' || t === 'ovs_bond') bonds.set(r.name, { mode: r.bondMode, slaves: [...r.slaves].sort() })
    else if (t === 'bridge' || t === 'ovs_bridge')
      bridges.push({ name: r.name, port: r.bridgePorts, vlanAware: r.bridgeVlanAware })
    else if (t === 'vlan') vlans.push({ name: r.name, id: r.vlanId, raw: r.vlanRawDevice })
    else if (t === 'eth') nics.push(r.name)
  }
  const reachableNics = new Set<string>()
  for (const b of bridges) {
    const bond = bonds.get(b.port)
    if (bond) for (const s of bond.slaves) reachableNics.add(s)
    else if (nics.includes(b.port)) reachableNics.add(b.port)
  }
  const unconfigured = rows
    .filter((r) => {
      if (!r.active) return true
      const t = norm(r.type)
      if (t === 'eth') return !reachableNics.has(r.name)
      return false
    })
    .map((r) => r.name)
  return { bridges, bonds, vlans, reachableNics, unconfigured }
}

const signatureOf = (m: NodeModel): string => {
  const parts = m.bridges
    .map((b) => {
      const bond = m.bonds.get(b.port)
      const uplink = bond ? `bond:${bond.mode}:${bond.slaves.join('+')}` : `nic:${b.port}`
      const vlans = m.vlans
        .filter((v) => v.raw === b.name || v.raw === b.port)
        .map((v) => `vlan:${v.id ?? '?'}`)
        .sort()
      return `br:${b.name}:va${b.vlanAware ? 1 : 0}:${uplink}:[${vlans.join(',')}]`
    })
    .sort()
  return parts.join('|')
}

export const buildTopology = (merged: {
  nodeInterfaces?: NodeInterfaceRow[]
  vmNics?: VmNicRow[]
}): TopologyView => {
  const interfaces = merged.nodeInterfaces ?? []
  const vmNics = merged.vmNics ?? []
  if (interfaces.length === 0) return { groups: [], hasData: false }

  const byNode = new Map<string, NodeInterfaceRow[]>()
  for (const r of interfaces) {
    const arr = byNode.get(r.node) ?? []
    arr.push(r)
    byNode.set(r.node, arr)
  }

  // Group nodes by structural signature.
  const groups = new Map<string, { nodes: string[]; model: NodeModel }>()
  for (const [node, rows] of byNode) {
    const model = modelOf(rows)
    const sig = signatureOf(model)
    const g = groups.get(sig)
    if (g) g.nodes.push(node)
    else groups.set(sig, { nodes: [node], model })
  }

  // VM-NIC counts keyed by node → `${bridge} ${tag ?? ''}`.
  const vmKey = (bridge: string, tag: number | null) => `${bridge} ${tag ?? ''}`
  const vmByNode = new Map<string, Map<string, number>>()
  for (const n of vmNics) {
    const m = vmByNode.get(n.node) ?? new Map<string, number>()
    const k = vmKey(n.bridge, n.tag)
    m.set(k, (m.get(k) ?? 0) + 1)
    vmByNode.set(n.node, m)
  }

  const out: TopologyGroup[] = []
  let gi = 0
  for (const [signature, { nodes, model }] of groups) {
    const sortedNodes = [...nodes].sort()
    const gid = `g${gi++}`
    const sumSpread = (bridge: string, tag: number | null) => {
      let vmCount = 0
      let withVms = 0
      for (const node of sortedNodes) {
        const c = vmByNode.get(node)?.get(vmKey(bridge, tag)) ?? 0
        vmCount += c
        if (c > 0) withVms += 1
      }
      return { vmCount, vmNodeSpread: { withVms, total: sortedNodes.length } }
    }

    const roots: TopologyNode[] = model.bridges.map((b) => {
      const bond = model.bonds.get(b.port)
      const rootId = `${gid}/${b.port}`
      const rootName = bond
        ? `${b.port} · ${bond.mode || 'bond'} · ${bond.slaves.join('+')}`
        : b.port || '(no uplink)'
      const bridgeId = `${rootId}/${b.name}`
      const vlanLeaves: TopologyNode[] = model.vlans
        .filter((v) => v.raw === b.name || v.raw === b.port)
        .map((v) => {
          const s = sumSpread(b.name, v.id)
          return {
            id: `${bridgeId}/vlan${v.id ?? v.name}`,
            name: `VLAN ${v.id ?? '?'}`,
            kind: 'vlan' as const,
            vmCount: s.vmCount,
            vmNodeSpread: s.vmNodeSpread,
          }
        })
      const u = sumSpread(b.name, null)
      const untagged: TopologyNode = {
        id: `${bridgeId}/untagged`,
        name: 'untagged',
        kind: 'vlan',
        vmCount: u.vmCount,
        vmNodeSpread: u.vmNodeSpread,
      }
      const bridgeNode: TopologyNode = {
        id: bridgeId,
        name: b.vlanAware ? `${b.name} (VLAN-aware)` : b.name,
        kind: 'bridge',
        children: [...vlanLeaves, untagged],
      }
      return {
        id: rootId,
        name: rootName,
        kind: bond ? 'bond' : 'nic',
        children: [bridgeNode],
      }
    })

    out.push({
      nodes: sortedNodes,
      roots,
      unconfiguredNicCount: model.unconfigured.length,
      signature,
    })
  }

  return { groups: out, hasData: out.length > 0 }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engines/aggregation/topologyTree.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Lint + commit**

```bash
npx @biomejs/biome check src/engines/aggregation/topologyTree.ts src/engines/aggregation/topologyTree.test.ts
git add src/engines/aggregation/topologyTree.ts src/engines/aggregation/topologyTree.test.ts
git commit -m "feat(network): pure deduplicated topology-tree aggregation"
```

---

### Task 2: ECharts option builder (pure)

**Files:**
- Create: `src/engines/export/charts/topologyOption.ts`
- Test: `src/engines/export/charts/topologyOption.test.ts`

**Interfaces:**
- Consumes: `TopologyView`, `TopologyNode` from `@/engines/aggregation/topologyTree`.
- Produces: `TopologyLabels` interface; `topologyTreeOption(view, labels): { option: EChartsOption; height: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/engines/export/charts/topologyOption.test.ts`:

```ts
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
    const series = (option.series as { type: string; layout: string; orient: string; data: unknown[] }[])[0]
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engines/export/charts/topologyOption.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `topologyOption.ts`**

Create `src/engines/export/charts/topologyOption.ts`:

```ts
import type { TopologyNode, TopologyView } from '@/engines/aggregation/topologyTree'
import type { EChartsOption } from 'echarts/types/dist/shared'

/** Translatable annotations passed in by each render site (the builder is
 *  pure and cannot call i18n). Numbers are interpolated here via `replace`. */
export interface TopologyLabels {
  estate: string
  nodesWord: string
  /** carries `{{count}}` */
  unconfigured: string
  vms: string
  /** carries `{{withVms}}` and `{{total}}` */
  ofNodes: string
}

const MIN_H = 360
const MAX_H = 2400
const PX_PER_LEAF = 46

interface EchartsTreeDatum {
  name: string
  children?: EchartsTreeDatum[]
}

const leafLabel = (n: TopologyNode, l: TopologyLabels): string => {
  if (n.vmCount === undefined) return n.name
  const spread = n.vmNodeSpread
    ? ` · ${l.ofNodes.replace('{{withVms}}', String(n.vmNodeSpread.withVms)).replace('{{total}}', String(n.vmNodeSpread.total))}`
    : ''
  return `${n.name} · ${n.vmCount} ${l.vms}${spread}`
}

const toDatum = (n: TopologyNode, l: TopologyLabels): EchartsTreeDatum => ({
  name: n.children && n.children.length > 0 ? n.name : leafLabel(n, l),
  ...(n.children && n.children.length > 0
    ? { children: n.children.map((c) => toDatum(c, l)) }
    : {}),
})

const countLeaves = (n: TopologyNode): number =>
  !n.children || n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0)

export function topologyTreeOption(
  view: TopologyView,
  l: TopologyLabels,
): { option: EChartsOption; height: number } {
  const groupData: EchartsTreeDatum[] = view.groups.map((g) => {
    const head =
      g.unconfiguredNicCount > 0
        ? ` · ${l.unconfigured.replace('{{count}}', String(g.unconfiguredNicCount))}`
        : ''
    return {
      name: `${g.nodes.join(', ')}  (× ${g.nodes.length} ${l.nodesWord}${head})`,
      children: g.roots.map((r) => toDatum(r, l)),
    }
  })

  const totalLeaves = view.groups.reduce(
    (s, g) => s + g.roots.reduce((rs, r) => rs + countLeaves(r), 0),
    0,
  )
  const height = Math.min(MAX_H, Math.max(MIN_H, totalLeaves * PX_PER_LEAF))

  const option: EChartsOption = {
    series: [
      {
        type: 'tree',
        layout: 'orthogonal',
        orient: 'LR',
        data: [{ name: l.estate, children: groupData }],
        top: 16,
        bottom: 16,
        left: 24,
        right: 220,
        symbolSize: 8,
        label: { position: 'right', align: 'left', fontSize: 12 },
        leaves: { label: { position: 'right', align: 'left' } },
        expandAndCollapse: false,
        initialTreeDepth: -1,
      },
    ],
  }
  return { option, height }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/engines/export/charts/topologyOption.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npx @biomejs/biome check src/engines/export/charts/topologyOption.ts src/engines/export/charts/topologyOption.test.ts
git add src/engines/export/charts/topologyOption.ts src/engines/export/charts/topologyOption.test.ts
git commit -m "feat(network): pure ECharts tree-option builder with dynamic height"
```

---

### Task 3: Foundation wiring — view field, empty default, SSR registry, i18n

**Files:**
- Modify: `src/types/estate.ts` (add `topology: TopologyView` to `EstateView`)
- Modify: `src/engines/aggregation/estateView.ts` (build `topology`; `EMPTY_TOPOLOGY`)
- Modify: `src/engines/export/html/renderCharts.ts` (register `TreeChart`)
- Modify: `src/i18n/locales/{en,fr,de,it}/network.json` + `pptx.json` (`TopologyLabels` keys)
- Test: existing `estateView` tests must still pass; add an `EMPTY_VIEW.topology` assertion.

**Interfaces:**
- Consumes: `buildTopology` (Task 1), `TopologyView` (Task 1).
- Produces: `EstateView.topology: TopologyView`; the `network.topology.*` / `pptx topology.*` i18n keys (the exact `TopologyLabels` fields: `estate`, `nodesWord`, `unconfigured`, `vms`, `ofNodes`, plus a `heading`).

- [ ] **Step 1: Add the type field**

In `src/types/estate.ts`, add the import and the field on `EstateView` (next to `network: NetworkRollup` at ~line 584):

```ts
import type { TopologyView } from '@/engines/aggregation/topologyTree'
// …
  network: NetworkRollup
  /** P-NT deduplicated network topology tree (D-11). */
  topology: TopologyView
```

- [ ] **Step 2: Build it + empty default in `estateView.ts`**

In `src/engines/aggregation/estateView.ts`: import `buildTopology`, build it next to `const network = networkRollup(merged)` (~line 143) and add `topology` to the returned view object:

```ts
import { buildTopology } from './topologyTree'
// …
  const network = networkRollup(merged)
  const topology = buildTopology(merged)
```

Add `topology` to the assembled view object (wherever `network,` appears in the returned literal), and add the empty default to `EMPTY_VIEW` (~line 633, next to `network: EMPTY_NETWORK`):

```ts
  network: EMPTY_NETWORK,
  topology: { groups: [], hasData: false },
```

- [ ] **Step 3: Register `TreeChart` in the SSR registry (worker chunk — non-gated)**

In `src/engines/export/html/renderCharts.ts`, add `TreeChart` to the imports and the `echarts.use([...])` list:

```ts
import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  PieChart,
  TreeChart,
  TreemapChart,
} from 'echarts/charts'
// …
echarts.use([
  BarChart,
  PieChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  TreemapChart,
  TreeChart,
  GridComponent,
  // …rest unchanged
])
```

- [ ] **Step 4: Add i18n keys (all four locales)**

In each `src/i18n/locales/<loc>/network.json`, add a `topology` object; in each `pptx.json`, add a `topology` object with the SAME leaf keys (the export bag reads `pptx`). Use these values:

`en` (both files): `{ "topology": { "heading": "Topology", "estate": "Estate", "nodesWord": "nodes", "unconfigured": "+ {{count}} unconfigured NICs", "vms": "VMs", "ofNodes": "{{withVms}}/{{total}} nodes" } }`
`fr`: `{ "topology": { "heading": "Topologie", "estate": "Parc", "nodesWord": "nœuds", "unconfigured": "+ {{count}} NIC non configurées", "vms": "VM", "ofNodes": "{{withVms}}/{{total}} nœuds" } }`
`de`: `{ "topology": { "heading": "Topologie", "estate": "Bestand", "nodesWord": "Knoten", "unconfigured": "+ {{count}} unkonfigurierte NICs", "vms": "VMs", "ofNodes": "{{withVms}}/{{total}} Knoten" } }`
`it`: `{ "topology": { "heading": "Topologia", "estate": "Parco", "nodesWord": "nodi", "unconfigured": "+ {{count}} NIC non configurate", "vms": "VM", "ofNodes": "{{withVms}}/{{total}} nodi" } }`

Validate each edited JSON parses.

- [ ] **Step 5: Run gates**

Run: `npm run typecheck && npx vitest run src/i18n/keyParity.test.ts src/engines/aggregation/estateView.test.ts && npx @biomejs/biome check src/types/estate.ts src/engines/aggregation/estateView.ts src/engines/export/html/renderCharts.ts`
Expected: PASS — `EstateView` compiles with the new field, keyParity green (topology keys parallel across all four locales in both namespaces), estateView tests green.

- [ ] **Step 6: Commit**

```bash
git add src/types/estate.ts src/engines/aggregation/estateView.ts src/engines/export/html/renderCharts.ts src/i18n/locales/*/network.json src/i18n/locales/*/pptx.json
git commit -m "feat(network): thread view.topology, SSR TreeChart registry, topology i18n"
```

---

### Task 4: Web render — NetworkView topology section (parallel)

**Files:**
- Modify: `src/components/Chart.tsx` (register `TreeChart`; measure/lazy-split)
- Modify: `src/components/network/NetworkView.tsx` (topology section + collapsible upstream SVG)

**Interfaces:**
- Consumes: `view.topology` (Task 3), `topologyTreeOption` (Task 2), `network.topology.*` i18n keys (Task 3).

- [ ] **Step 1: Register `TreeChart` in `Chart.tsx`**

Add `TreeChart` to the `echarts/charts` import and the `echarts.use([...])` list in `src/components/Chart.tsx` (mirror Task 3 Step 3's edit shape).

- [ ] **Step 2: Add the topology section to `NetworkView.tsx`**

Above the existing `section.interfaces` block, add a topology section that renders the tree when `n.topology.hasData` (where `n.topology` is `view.topology`). Build the option with localized labels:

```tsx
import { Chart } from '@/components/Chart'
import { topologyTreeOption } from '@/engines/export/charts/topologyOption'
// inside the component, after `const n = view.network` add:
const topology = view.topology
const topoLabels = {
  estate: t('topology.estate'),
  nodesWord: t('topology.nodesWord'),
  unconfigured: t('topology.unconfigured'),
  vms: t('topology.vms'),
  ofNodes: t('topology.ofNodes'),
}
// …in the JSX, before the interfaces section:
{topology.hasData && (
  <section className="flex flex-col gap-2">
    <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
      {t('topology.heading')}
    </h2>
    {(() => {
      const { option, height } = topologyTreeOption(topology, topoLabels)
      return <Chart option={option} style={{ height }} />
    })()}
  </section>
)}
```

Wrap the **existing** upstream-SVG `section.diagram` block in a `<details>` (collapsed by default) so it becomes the secondary "raw upstream diagram" (decision A):

```tsx
{svg && (
  <details className="flex flex-col gap-2">
    <summary className="cursor-pointer text-xl font-semibold text-slate-700 dark:text-slate-200">
      {t('section.diagram')}
    </summary>
    <div className="overflow-auto rounded border border-slate-200 dark:border-slate-700" style={{ maxHeight: '70vh' }}>
      <img src={svgToDataUri(svg)} alt={t('img.alt')} className="max-w-full" />
    </div>
  </details>
)}
```

- [ ] **Step 3: Verify typecheck + build + measure the bundle**

Run: `npm run typecheck && npm run build && npm run check:bundle-size`
Expected: build OK. **If `check:bundle-size` reports the index chunk > 300 KiB**, apply the lazy-split fallback (Step 4); otherwise skip Step 4.

- [ ] **Step 4 (CONDITIONAL — only if Step 3's gate failed): Lazy-split the web topology chart**

Revert the `Chart.tsx` `TreeChart` registration. Create `src/components/network/TopologyChart.tsx` that registers `TreeChart` in its own module and renders `<ReactEChartsCore>` (mirror `Chart.tsx`'s registry + render), then in `NetworkView.tsx` import it lazily: `const TopologyChart = lazy(() => import('./TopologyChart'))` and wrap usage in `<Suspense>`. Re-run `npm run build && npm run check:bundle-size` — the split chunk passes the per-chunk gate. Log in the commit which path was taken.

- [ ] **Step 5: Commit**

```bash
git add src/components/Chart.tsx src/components/network/NetworkView.tsx
# include src/components/network/TopologyChart.tsx if Step 4 was needed
git commit -m "feat(network): web topology-tree section + collapsible upstream SVG"
```

---

### Task 5: HTML report render — inline topology SVG (parallel)

**Files:**
- Modify: `src/engines/export/html/renderReport.tsx` (network section)

**Interfaces:**
- Consumes: `view.topology` (Task 3), `topologyTreeOption` (Task 2), `chartToSvg` (`renderCharts.ts`, registry now has `TreeChart` from Task 3), `strings['topology.*']`.

- [ ] **Step 1: Render the tree SVG into the network section**

In `src/engines/export/html/renderReport.tsx`, inside the `<Section id="network" …>` block (~line 225), after the KPI stat tiles and before/in place of the upstream-SVG embed, inline the topology tree when `view.topology.hasData`:

```tsx
import { chartToSvg } from './renderCharts'
import { topologyTreeOption } from '@/engines/export/charts/topologyOption'
// …inside the network Section:
{view.topology.hasData && (() => {
  const labels = {
    estate: strings['topology.estate'] ?? 'Estate',
    nodesWord: strings['topology.nodesWord'] ?? 'nodes',
    unconfigured: strings['topology.unconfigured'] ?? '+ {{count}} unconfigured NICs',
    vms: strings['topology.vms'] ?? 'VMs',
    ofNodes: strings['topology.ofNodes'] ?? '{{withVms}}/{{total}} nodes',
  }
  const { option, height } = topologyTreeOption(view.topology, labels)
  const svg = chartToSvg(option, 1100, height)
  // renderReport already inlines chart SVGs elsewhere via dangerouslySetInnerHTML;
  // mirror that exact idiom here (the SVG is engine-generated, not user content).
  return (
    <div
      className="topology-tree"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: engine-rendered ECharts SVG, same idiom as the other report charts
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
})()}
```

(Match the existing report's inline-SVG idiom — grep `renderReport.tsx` for how `eosBar`/other chart SVG strings are inlined and reuse that exact pattern + any existing helper. Keep the upstream `networkSvg` `<img>` if it is currently rendered here — replace it with the topology tree per the spec, but verify against the current code.)

- [ ] **Step 2: Typecheck + a render assertion**

Add/extend a renderReport test (or `assembleHtml` test) asserting the SSR HTML for a topology-bearing view contains a known bridge name (e.g. `vmbr0`). Run: `npm run typecheck && npx vitest run src/engines/export/html`
Expected: PASS.

- [ ] **Step 3: Lint + commit**

```bash
npx @biomejs/biome check src/engines/export/html/renderReport.tsx
git add src/engines/export/html/renderReport.tsx
git commit -m "feat(network): inline topology tree in the HTML report network section"
```

---

### Task 6: PPTX render — topology PNG on the network slide (parallel)

**Files:**
- Modify: `src/engines/export/export.worker.ts` (render topology option → PNG)
- Modify: `src/engines/export/pptx/builder.ts` (thread the topology PNG)
- Modify: `src/engines/export/pptx/slides/networkSlide.ts` (embed PNG)
- Test: `src/engines/export/pptx/builder.test.ts`

**Interfaces:**
- Consumes: `view.topology` (Task 3), `topologyTreeOption` (Task 2), `chartToSvg` + `chartSvgToPng` (registry has `TreeChart` from Task 3), `strings['topology.*']`.
- Produces: `addNetworkSlide` consumes a `topologyPng: Uint8Array | null` in place of the oversized-SVG plumbing.

- [ ] **Step 1: Render the topology PNG in the worker**

In `src/engines/export/export.worker.ts`, replace the upstream-`networkSvg` rasterization block (~lines 140-165) with a topology-tree render when `view.topology.hasData`:

```ts
let topologyPng: Uint8Array | null = null
if (view.topology.hasData) {
  try {
    const labels = {
      estate: req.strings['topology.estate'] ?? 'Estate',
      nodesWord: req.strings['topology.nodesWord'] ?? 'nodes',
      unconfigured: req.strings['topology.unconfigured'] ?? '+ {{count}} unconfigured NICs',
      vms: req.strings['topology.vms'] ?? 'VMs',
      ofNodes: req.strings['topology.ofNodes'] ?? '{{withVms}}/{{total}} nodes',
    }
    const { option, height } = topologyTreeOption(view.topology, labels)
    topologyPng = await chartSvgToPng(chartToSvg(option, CHART_W, height), CHART_W, height, wasmSource())
  } catch {
    topologyPng = null
  }
}
```

(Import `topologyTreeOption` + `chartToSvg`. Remove `networkOversized`/`parseSvgDimensions`/`isSvgOversized`/`cappedRenderWidth` usage *for the network slide*; leave shared helpers if used elsewhere — verify with grep. Pass `topologyPng` into `buildPptx` opts instead of `networkPng`/`networkOversized`.)

- [ ] **Step 2: Thread it through `builder.ts`**

In `src/engines/export/pptx/builder.ts`, replace `networkPng`/`networkOversized` in `BuildPptxOpts` and the `addNetworkSlide(...)` call with a single `topologyPng?: Uint8Array | null`, passed to the network slide.

- [ ] **Step 3: Update `networkSlide.ts`**

Replace the whole `networkPng`/`oversized` body with: render the 4 KPI cards (unchanged), then embed `topologyPng` below them (fit-to-box, preserve aspect) when present; else the existing `network.absent` note. Drop the `oversized` parameter entirely.

- [ ] **Step 4: Update `builder.test.ts`**

Replace the Spec-1 "Fix 4 — oversized network slide" test with a topology test: a view with `topology.hasData` + a real `topologyPng` (build via `chartSvgToPng(chartToSvg(topologyTreeOption(view.topology, LABELS).option, 800, 400), …, wasmBytes)`) → deck embeds the PNG (deck-with-png larger than deck-without). Assert the slide no longer references the removed oversized path.

- [ ] **Step 5: Run + commit**

Run: `npm run typecheck && npx vitest run src/engines/export/pptx/builder.test.ts && npx @biomejs/biome check src/engines/export/export.worker.ts src/engines/export/pptx/builder.ts src/engines/export/pptx/slides/networkSlide.ts`
Expected: PASS.

```bash
git add src/engines/export/export.worker.ts src/engines/export/pptx/builder.ts src/engines/export/pptx/slides/networkSlide.ts src/engines/export/pptx/builder.test.ts
git commit -m "feat(network): PPTX network slide renders the topology tree (drops oversized raster)"
```

---

### Task 7: Integration gates + realfile test + dead-code sweep

**Files:**
- Test: new `src/engines/aggregation/topologyTree.realfile.test.ts` (or extend `proxmox-estate.realfile.test.ts`)
- Sweep: remove any now-unused `networkOversized`/`networkPng` plumbing left after Tasks 4-6.

- [ ] **Step 1: Realfile test**

Add a realfile test gated on the staged workbook: `buildTopology` over the real `nodeInterfaces` → `groups.length` matches the cluster's distinct configs, a known bridge/bond/slave path is present, and `vmNodeSpread.total` equals the grouped node count. Use the existing realfile harness (mirror `proxmox-estate.realfile.test.ts`'s workbook-load + skip-if-absent guard).

- [ ] **Step 2: Dead-code sweep**

`git grep -n "networkOversized\|isSvgOversized\|cappedRenderWidth"` — remove any now-orphaned references/exports introduced for the Spec-1 interim that no caller uses. Keep `parseSvgDimensions` only if the collapsible web SVG still needs it (it doesn't — the `<img>` uses the raw SVG); remove if orphaned.

- [ ] **Step 3: Full gate run**

```bash
npm run typecheck
npx @biomejs/biome check .
npm run test:run
npm run build
npm run check:bundle-size
npm run test:coverage -- --testTimeout=60000
```

Expected: all green; `engines/` ≥75%; web index ≤300 KiB; keyParity green.

- [ ] **Step 4: Manual E2E**

`npm run dev`, drop the real cv4pve export, confirm: legible topology tree on NetworkView (uplink-rooted, slaves inline, VLAN leaves with VM counts + spread), the upstream SVG collapsed below it, the HTML report inlines the same tree, and the PPTX network slide shows KPI cards + the tree PNG (no blur, no "see HTML report" note). Bare `.xlsx` still renders the tree.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(network): realfile topology test + remove interim oversized-SVG plumbing"
```

---

## Self-Review

**Spec coverage:**

| Spec item | Task |
|---|---|
| Pure aggregation `buildTopology` / `TopologyView` / dedup signature / unconfiguredNicCount / vmNodeSpread / path ids / inline slaves / uplink-rooted hierarchy | 1 |
| Pure `topologyTreeOption` → `{option, height}`, dynamic height, LR orient | 2 |
| `view.topology` on EstateView + empty default + SSR `TreeChart` registry + i18n (network + pptx, 4 locales) | 3 |
| Web `<Chart>` topology section + collapsible upstream SVG (decision A) + bundle measure/lazy-split (decision B) | 4 |
| HTML report inline topology SVG (replaces upstream embed) | 5 |
| PPTX topology PNG (replaces Spec-1 oversized note/raster) | 6 |
| Realfile test; dead-code sweep; all gates | 7 |
| Error handling / factual-degrade (`hasData:false`) | 1 (empty), 4/5/6 (guards), 3 (EMPTY_TOPOLOGY) |

**Placeholder scan:** No TBD/TODO; tasks 4/5/6 reference the existing inline-SVG/registry idioms with explicit "mirror this" instructions and concrete code.

**Type consistency:** `buildTopology(merged) → TopologyView` (Task 1) consumed by Task 3's `estateView.ts` and Task 2's builder. `topologyTreeOption(view, labels) → { option, height }` (Task 2) consumed identically by Tasks 4/5/6. `TopologyLabels` fields (`estate, nodesWord, unconfigured, vms, ofNodes`) match the i18n keys added in Task 3 and every call site. `TopologyNode` shape (`id, name, kind, vmCount?, vmNodeSpread?, children?`) is consistent across the aggregation, the builder, and the tests.

## Execution Handoff

Wave 0 (Tasks 1→2→3) sequential; Wave 1 (Tasks 4∥5∥6) parallel in worktrees off Task 3's commit (file-disjoint); Wave 2 (Task 7) sequential. Parallel implementers use **sonnet**.
