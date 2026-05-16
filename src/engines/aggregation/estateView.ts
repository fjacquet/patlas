import type { MergedEstate } from '@/engines/snapshotMerge'
import { mib } from '@/engines/units'
import type { AccountingMode, EstateView, OsBreakdown, VmDisplayRow } from '@/types/estate'
import { aggregateClusters } from './aggregateClusters'
import { aggregateGlobals, emptySummary } from './globals'
import { classifyOsFamily } from './osFamily'
import { datastoreCountByCluster, perDatastore } from './perDatastore'
import { perEsx } from './perEsx'

/**
 * Pure estate-view assembler — the single composition every dashboard
 * component and export consumes (via the `useEstateView` hook). No React,
 * no Zustand, no Zod.
 *
 * Stretched-cluster handling is ACTIVE in Phase 4: `opts.stretchedClusters`
 * (the user's in-memory selection) drives the per-site reservation; absent
 * ⇒ empty set ⇒ no reservation (the Phase-2 behaviour). The
 * NAA-deduped `perDatastore` count + first-row capacity sum feed
 * `globals.datastoreCount`/`totalStorageMib` (no double-count, Moderate-11).
 * `trends` is `null` — Phase-4 forward-compat (RESEARCH Pattern 3).
 *
 * Datastore→cluster attribution: real RVTools exports DO carry a
 * `Cluster name` column on vDatastore (the earlier "A1: no cluster field"
 * premise was false — UAT-confirmed). `datastoreCountByCluster` feeds the
 * per-cluster count, NAA-deduped WITHIN each cluster (Moderate-11: a
 * shared LUN counts once per cluster it appears in). When the vDatastore
 * sheet is absent the map is `undefined` ⇒ `ClusterAggregate.datastoreCount`
 * is `null` and the column renders the em-dash sentinel; a cluster with
 * the sheet present but no matching datastore renders a real `0`.
 */

const emptyBreakdown = (): OsBreakdown => ({ windows: 0, linux: 0, other: 0 })

/**
 * Phase 4 contract change: `buildEstateView` now consumes the MERGED row
 * bundle (`MergedEstate` from `engines/snapshotMerge`) instead of one raw
 * `Snapshot`. The merge already flattened + deduped + collision-suffixed the
 * selected snapshots' rows, so every aggregation below operates on the
 * single logical estate (multi-FILE merge is the primary path). The row
 * shapes (`vinfo`/`vhost`/`vdatastore`) are unchanged — only the source is.
 */
export function buildEstateView(
  merged: MergedEstate,
  mode: AccountingMode,
  opts?: { stretchedClusters?: ReadonlySet<string> },
): EstateView {
  const stretchedClusters = opts?.stretchedClusters ?? new Set<string>()
  // No vDatastore rows ⇒ sheet absent/empty ⇒ per-cluster count is
  // genuinely unknown (undefined → em-dash). Rows present ⇒ attribute
  // them; an unmatched cluster legitimately gets 0, never em-dash.
  // vHost.hostName → vHost.cluster (single pass) so blank-clusterName
  // vSAN/host-local datastores attribute to their hosts' cluster(s)
  // instead of being dropped (Pitfall 6 / Plan 04-02).
  const hostClusterMap = new Map<string, string>()
  for (const hrow of merged.vhost) {
    if (hrow.hostName !== '' && hrow.cluster !== '') hostClusterMap.set(hrow.hostName, hrow.cluster)
  }
  const dsByCluster =
    merged.vdatastore.length === 0
      ? undefined
      : datastoreCountByCluster(merged.vdatastore, hostClusterMap)
  const clusters = aggregateClusters({
    vinfo: merged.vinfo,
    vhost: merged.vhost,
    mode,
    stretchedClusters,
    datastoreCountByCluster: dsByCluster,
  })

  const datastores = perDatastore(merged.vdatastore)
  const datastoreCount = datastores.length
  const totalStorageMib = mib(datastores.reduce((acc, d) => acc + (d.capacityMib as number), 0))

  const globals = aggregateGlobals(clusters, datastoreCount, totalStorageMib)
  const hosts = perEsx(merged.vhost, merged.vinfo, mode)

  // OS breakdown — global + per-cluster. `other` is always present even
  // at 0 (a real, visible donut bucket). The accounting mode does not
  // change OS classification; it counts every VM the snapshot carries.
  const osBreakdown = emptyBreakdown()
  const vmsByCluster = new Map<string, OsBreakdown>()
  const vmRows: VmDisplayRow[] = []
  for (const vm of merged.vinfo) {
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
