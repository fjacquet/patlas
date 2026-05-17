import type { MiB } from '@/engines/units'
import { mib } from '@/engines/units'
import type { AccountingMode, DatastoreAggregate } from '@/types/estate'
import type { VDatastoreRow } from '@/types/snapshot'
import type { VInfoRow } from '@/types/vinfo'
import { perDatastore } from './perDatastore'
import type { VsanRelinkResult } from './vsanRelink'

/**
 * P9 D-07 / D-08 — storage-by-X with two lenses.
 *
 *  - Consumption lens (treemap): `provisionedMib` vs `inUseMib` per
 *    Cluster / ESX / VM / Datastore. In-use rides on the shipped
 *    `vInfo.inUseMib`, which ALREADY includes `.vswp` + snapshots — never
 *    re-derived. VM cohort honours the accounting `mode` exactly like
 *    `perEsx` (configured keeps powered-off; active/storage-realistic
 *    powered-on only).
 *  - Capacity lens (stacked-bar): capacity / used / free per Datastore from
 *    the NAA-deduped `perDatastore` aggregate (first-row capacity rule —
 *    a shared LUN is counted ONCE, never re-summed).
 *
 * vSAN attribution (task-1 `VsanRelinkResult`): a blank-`Cluster name`
 * datastore lands on its relinked cluster; a shared-LUN datastore is
 * EXCLUDED from any single-cluster rollup but still counted once at estate
 * scope (D-10 minimal-inference — no proportional split, no double-count).
 *
 * Pure: no React/Zustand/Zod/DOM.
 */

/** Consumption-lens group (provisioned vs in-use). */
export interface StorageConsumptionGroup {
  key: string
  provisionedMib: MiB
  inUseMib: MiB
}

/** Capacity-lens group (capacity / used / free), per deduped datastore. */
export interface StorageCapacityGroup {
  key: string
  name: string
  capacityMib: MiB
  usedMib: MiB
  freeMib: MiB
}

export interface StorageByX {
  /** Consumption lens. */
  byCluster: StorageConsumptionGroup[]
  byEsx: StorageConsumptionGroup[]
  byVm: StorageConsumptionGroup[]
  byDatastore: StorageConsumptionGroup[]
  /** Capacity lens (datastore only). */
  capacityByDatastore: StorageCapacityGroup[]
  /** Datastore capacity attributed to a single cluster via vSAN relink +
   *  RVTools `Cluster name`; shared-LUN / unrelinkable excluded. */
  capacityByCluster: StorageCapacityGroup[]
  estate: {
    provisionedMib: MiB
    inUseMib: MiB
    capacityMib: MiB
    usedMib: MiB
    freeMib: MiB
  }
}

const sumGroup = (rows: VInfoRow[], keyOf: (vm: VInfoRow) => string): StorageConsumptionGroup[] => {
  const prov = new Map<string, number>()
  const used = new Map<string, number>()
  for (const vm of rows) {
    const k = keyOf(vm)
    prov.set(k, (prov.get(k) ?? 0) + (vm.provisionedMib as number))
    used.set(k, (used.get(k) ?? 0) + (vm.inUseMib as number))
  }
  const out: StorageConsumptionGroup[] = []
  for (const [k, p] of prov) {
    out.push({ key: k, provisionedMib: mib(p), inUseMib: mib(used.get(k) ?? 0) })
  }
  return out
}

export const storageByX = (
  merged: { vinfo: VInfoRow[]; vdatastore: VDatastoreRow[] },
  mode: AccountingMode,
  vsan: VsanRelinkResult,
): StorageByX => {
  // Mode-aware VM cohort (mirrors perEsx / vinfoMerge).
  const cohort = mode === 'configured' ? merged.vinfo : merged.vinfo.filter((vm) => vm.poweredOn)

  const byCluster = sumGroup(cohort, (vm) => vm.cluster)
  const byEsx = sumGroup(cohort, (vm) => vm.host)
  const byVm = sumGroup(cohort, (vm) => vm.vmName)

  // Datastore lenses — NAA-deduped (perDatastore collapses shared LUNs to
  // one key with first-row capacity, so no double-count by construction).
  const dsAgg: DatastoreAggregate[] = perDatastore(merged.vdatastore)

  const byDatastore: StorageConsumptionGroup[] = dsAgg.map((d) => ({
    key: d.key,
    provisionedMib: d.provisionedMib,
    inUseMib: d.usedMib,
  }))

  const capacityByDatastore: StorageCapacityGroup[] = dsAgg.map((d) => ({
    key: d.key,
    name: d.name,
    capacityMib: d.capacityMib,
    usedMib: d.usedMib,
    freeMib: d.freeMib,
  }))

  // Per-cluster datastore capacity: RVTools `Cluster name` when present,
  // else the vSAN relink. Shared-LUN / unrelinkable are EXCLUDED from any
  // single-cluster rollup (still in the estate total below). One raw row
  // per dedupe key is enough — the aggregate already deduped.
  const clusterByKey = new Map<string, string>()
  const excluded = new Set<string>()
  for (const row of merged.vdatastore) {
    const key = row.naa ?? row.name
    if (clusterByKey.has(key) || excluded.has(key)) continue
    if (row.clusterName.trim() !== '') {
      clusterByKey.set(key, row.clusterName.trim())
    } else if (vsan.attributed.has(key)) {
      clusterByKey.set(key, vsan.attributed.get(key) as string)
    } else {
      // shared-LUN (vsan.shared) or unrelinkable ⇒ no single cluster
      excluded.add(key)
    }
  }
  const capByCluster = new Map<string, StorageCapacityGroup>()
  for (const d of dsAgg) {
    const cl = clusterByKey.get(d.key)
    if (cl === undefined) continue
    const acc = capByCluster.get(cl) ?? {
      key: cl,
      name: cl,
      capacityMib: mib(0),
      usedMib: mib(0),
      freeMib: mib(0),
    }
    acc.capacityMib = mib((acc.capacityMib as number) + (d.capacityMib as number))
    acc.usedMib = mib((acc.usedMib as number) + (d.usedMib as number))
    acc.freeMib = mib((acc.freeMib as number) + (d.freeMib as number))
    capByCluster.set(cl, acc)
  }

  const estate = {
    provisionedMib: mib(cohort.reduce((a, vm) => a + (vm.provisionedMib as number), 0)),
    inUseMib: mib(cohort.reduce((a, vm) => a + (vm.inUseMib as number), 0)),
    capacityMib: mib(dsAgg.reduce((a, d) => a + (d.capacityMib as number), 0)),
    usedMib: mib(dsAgg.reduce((a, d) => a + (d.usedMib as number), 0)),
    freeMib: mib(dsAgg.reduce((a, d) => a + (d.freeMib as number), 0)),
  }

  return {
    byCluster,
    byEsx,
    byVm,
    byDatastore,
    capacityByDatastore,
    capacityByCluster: [...capByCluster.values()],
    estate,
  }
}
