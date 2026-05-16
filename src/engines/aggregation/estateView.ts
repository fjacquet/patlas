import { mib } from '@/engines/units'
import type { AccountingMode, EstateView, OsBreakdown, VmDisplayRow } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import { aggregateClusters } from './aggregateClusters'
import { aggregateGlobals, emptySummary } from './globals'
import { classifyOsFamily } from './osFamily'
import { perDatastore } from './perDatastore'
import { perEsx } from './perEsx'

/**
 * Pure estate-view assembler — the single composition every dashboard
 * component and export consumes (via the `useEstateView` hook). No React,
 * no Zustand, no Zod.
 *
 * Stretched-cluster handling is dormant in Phase 2: `stretchedClusters`
 * is always an empty set (the ported math stays for Phase 4). The
 * NAA-deduped `perDatastore` count + first-row capacity sum feed
 * `globals.datastoreCount`/`totalStorageMib` (no double-count, Moderate-11).
 * `trends` is `null` — Phase-4 forward-compat (RESEARCH Pattern 3).
 *
 * A1 (fixture-verified during planning): Phase-1 `VDatastoreRow` carries
 * no cluster field, so datastore attribution is GLOBAL only —
 * `ClusterAggregate` carries no datastore count (02-03 renders em-dash
 * per cluster). Scoped simplification, not a gap.
 */

const emptyBreakdown = (): OsBreakdown => ({ windows: 0, linux: 0, other: 0 })

export function buildEstateView(snapshot: Snapshot, mode: AccountingMode): EstateView {
  const stretchedClusters = new Set<string>()
  const clusters = aggregateClusters({
    vinfo: snapshot.vinfo,
    vhost: snapshot.vhost,
    mode,
    stretchedClusters,
  })

  const datastores = perDatastore(snapshot.vdatastore)
  const datastoreCount = datastores.length
  const totalStorageMib = mib(datastores.reduce((acc, d) => acc + (d.capacityMib as number), 0))

  const globals = aggregateGlobals(clusters, datastoreCount, totalStorageMib)
  const hosts = perEsx(snapshot.vhost, snapshot.vinfo, mode)

  // OS breakdown — global + per-cluster. `other` is always present even
  // at 0 (a real, visible donut bucket). The accounting mode does not
  // change OS classification; it counts every VM the snapshot carries.
  const osBreakdown = emptyBreakdown()
  const vmsByCluster = new Map<string, OsBreakdown>()
  const vmRows: VmDisplayRow[] = []
  for (const vm of snapshot.vinfo) {
    const family = classifyOsFamily(vm.osConfig, vm.osTools)
    osBreakdown[family] += 1
    const perCluster = vmsByCluster.get(vm.cluster) ?? emptyBreakdown()
    perCluster[family] += 1
    vmsByCluster.set(vm.cluster, perCluster)
    // 1:1 projection (NEVER group/sum) — same operation-class as the
    // classifyOsFamily call above; rides this single existing pass.
    vmRows.push({
      vmName: vm.vmName,
      cluster: vm.cluster,
      host: vm.host,
      vcpu: vm.vcpu,
      vramMib: vm.vramMib,
      os: vm.osTools || vm.osConfig,
      poweredOn: vm.poweredOn,
      provisionedMib: vm.provisionedMib,
    })
  }

  return {
    globals,
    clusters,
    hosts,
    datastores,
    vmRows,
    vmsByCluster,
    osBreakdown,
    accountingMode: mode,
    trends: null,
  }
}

/**
 * The valid empty-but-typed view `useEstateView` returns when no snapshot
 * is active. Frozen (modeled on `globals.ts:emptySummary`) so consumers
 * can rely on referential stability.
 */
export const EMPTY_VIEW: EstateView = Object.freeze({
  globals: emptySummary,
  clusters: Object.freeze([]) as never[],
  hosts: Object.freeze([]) as never[],
  datastores: Object.freeze([]) as never[],
  vmRows: Object.freeze([]) as never[],
  vmsByCluster: new Map(),
  osBreakdown: Object.freeze({ windows: 0, linux: 0, other: 0 }),
  accountingMode: 'active',
  trends: null,
})
