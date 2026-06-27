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
    if (t === 'bond' || t === 'ovs_bond')
      bonds.set(r.name, { mode: r.bondMode, slaves: [...r.slaves].sort() })
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
      if (!r.active) return norm(r.type) === 'eth'
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

/** Unique key for a bridge+tag combination used in the VM count map. */
const vmKey = (bridge: string, tag: number | null): string => `${bridge}:${tag ?? 'untagged'}`

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

  // Group nodes by structural signature; accumulate unconfigured counts across all nodes.
  const groups = new Map<string, { nodes: string[]; model: NodeModel; totalUnconfigured: number }>()
  for (const [node, rows] of byNode) {
    const model = modelOf(rows)
    const sig = signatureOf(model)
    const g = groups.get(sig)
    if (g) {
      g.nodes.push(node)
      g.totalUnconfigured += model.unconfigured.length
    } else groups.set(sig, { nodes: [node], model, totalUnconfigured: model.unconfigured.length })
  }

  // VM-NIC counts keyed by node → bridge+tag key.
  const vmByNode = new Map<string, Map<string, number>>()
  for (const n of vmNics) {
    const m = vmByNode.get(n.node) ?? new Map<string, number>()
    const k = vmKey(n.bridge, n.tag)
    m.set(k, (m.get(k) ?? 0) + 1)
    vmByNode.set(n.node, m)
  }

  const out: TopologyGroup[] = []
  let gi = 0
  for (const [signature, { nodes, model, totalUnconfigured }] of groups) {
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
      unconfiguredNicCount: totalUnconfigured,
      signature,
    })
  }

  return { groups: out, hasData: out.length > 0 }
}
