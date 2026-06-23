import type {
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  Snapshot,
  VDatastoreRow,
  VDvPortRow,
  VDvSwitchRow,
  VHostRow,
  VInfoRow,
  VNetworkRow,
  VPartitionRow,
  VSwitchRow,
} from '@/types'
import { buildVCenterIndex, type VCenterEntry } from './vCenterIndex'

/**
 * The merged estate: flattened, deduped rows from the selected snapshots
 * plus the per-vCenter index. Every later Phase-4/5/6/7 capability reads
 * THIS, not raw snapshots.
 */
export interface MergedEstate {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  /** Concatenated guest-disk partitions of the selected snapshots (P5
   *  guest-data). Empty when no vPartition sheet was present. */
  vpartition: VPartitionRow[]
  /** Concatenated network rows (P9 D-11). Empty when the OPTIONAL network
   *  sheets were absent — factual-degrade, never undefined. */
  vnetwork: VNetworkRow[]
  vswitch: VSwitchRow[]
  dvswitch: VDvSwitchRow[]
  dvport: VDvPortRow[]
  /** Concatenated Proxmox guest snapshot rows across selected snapshots.
   *  Empty when the Snapshots sheet was absent — factual-degrade, never undefined. */
  proxmoxSnapshots: ProxmoxSnapshotRow[]
  /** Concatenated Proxmox storage content rows across selected snapshots.
   *  Empty when the Storage Content sheet was absent — factual-degrade, never undefined. */
  proxmoxStorageContent: ProxmoxStorageContentRow[]
  vcenters: VCenterEntry[]
}

const EMPTY_MERGED: MergedEstate = {
  vinfo: [],
  vhost: [],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  proxmoxSnapshots: [],
  proxmoxStorageContent: [],
  vcenters: [],
}

/**
 * First-occurrence-wins VM dedupe key (RESEARCH Pitfall 2 / Pattern 2):
 *   - `vmBiosUuid` (= RVTools `VM UUID`, the vCenter-assigned UNIQUE key —
 *     NEVER SMBIOS) when present, so a VM vMotioned across vCenters collapses
 *   - else `(viSdkUuid, vmName, cluster)` so distinct VMs are not merged
 * `vmInstanceUuid` is ABSENT in RVTools 4.7 — deliberately not a key path.
 */
const vmDedupeKey = (row: VInfoRow): string =>
  row.vmBiosUuid.trim() !== ''
    ? `uuid:${row.vmBiosUuid}`
    : `fallback:${row.viSdkUuid} ${row.vmName} ${row.cluster}`

/**
 * Merge N selected snapshots into one logical estate.
 *
 * Ported from vsizer `resolveClusterCollisions.ts:41-74`, with the core
 * Phase-4 generalization: collisions key on ROW `viSdkUuid`, NOT filename —
 * so N separately-dropped files AND one workbook embedding N vCenters take
 * the identical path (RESEARCH Pitfall 1 / Pattern 1).
 *
 * Algorithm:
 *   1. Build `Map<clusterName, Set<viSdkUuid>>` from host rows. `size > 1`
 *      ⇒ the cluster name collides across distinct vCenters.
 *   2. For a colliding cluster, rewrite `cluster` on BOTH vinfo + vhost rows
 *      to `"<cluster> (<vCenterLabel>)"`; non-colliding rows pass through as
 *      the SAME reference (input never mutated — vsizer rule preserved).
 *   3. Dedupe VMs first-occurrence-wins on `vmDedupeKey` (vMotion collapse).
 *
 * Pure: no React/Zustand/Zod (PROJECT.md line 52).
 */
export const mergeSnapshotsToEstate = (selected: Snapshot[]): MergedEstate => {
  if (selected.length === 0) return EMPTY_MERGED

  const vcenterIndex = buildVCenterIndex(selected)
  const labelFor = (viSdkUuid: string): string => vcenterIndex.get(viSdkUuid)?.label ?? viSdkUuid

  // VHostRow has no `viSdkUuid` column. A host's vCenter is resolved
  // SNAPSHOT-SCOPED (never globally — a global cluster→vCenter map collapses
  // exactly the colliding-name case we must disambiguate):
  //   1. vinfo rows in the SAME snapshot whose `host` === h.hostName
  //   2. vinfo rows in the SAME snapshot whose `cluster` === h.cluster
  //   3. the snapshot's own `viSdkUuid`
  const hostVcenter = (snap: Snapshot, h: VHostRow): string => {
    const byHost = snap.vinfo.find((v) => v.host !== '' && v.host === h.hostName)
    if (byHost) return byHost.viSdkUuid
    const byCluster = snap.vinfo.find((v) => v.cluster === h.cluster)
    if (byCluster) return byCluster.viSdkUuid
    return snap.viSdkUuid ?? ''
  }

  // Step 1: collision map keyed on (clusterName → set of viSdkUuid). vinfo
  // rows carry `viSdkUuid` directly; hosts contribute their snapshot-scoped
  // vCenter. `size > 1` ⇒ the name spans distinct vCenters ⇒ colliding.
  const vcByCluster = new Map<string, Set<string>>()
  for (const snap of selected) {
    for (const v of snap.vinfo) {
      const set = vcByCluster.get(v.cluster) ?? new Set<string>()
      set.add(v.viSdkUuid)
      vcByCluster.set(v.cluster, set)
    }
    for (const h of snap.vhost) {
      const set = vcByCluster.get(h.cluster) ?? new Set<string>()
      set.add(hostVcenter(snap, h))
      vcByCluster.set(h.cluster, set)
    }
  }
  const isColliding = (cluster: string): boolean => (vcByCluster.get(cluster)?.size ?? 0) > 1

  // Step 2: rewrite-or-passthrough vinfo (deduped) + vhost.
  const outVinfo: VInfoRow[] = []
  const seenVm = new Set<string>()
  for (const snap of selected) {
    for (const v of snap.vinfo) {
      const key = vmDedupeKey(v)
      if (seenVm.has(key)) continue
      seenVm.add(key)
      outVinfo.push(
        isColliding(v.cluster) ? { ...v, cluster: `${v.cluster} (${labelFor(v.viSdkUuid)})` } : v,
      )
    }
  }

  const outVhost: VHostRow[] = []
  for (const snap of selected) {
    for (const h of snap.vhost) {
      outVhost.push(
        isColliding(h.cluster)
          ? { ...h, cluster: `${h.cluster} (${labelFor(hostVcenter(snap, h))})` }
          : h,
      )
    }
  }

  const outVdatastore: VDatastoreRow[] = []
  const outVpartition: VPartitionRow[] = []
  const outVnetwork: VNetworkRow[] = []
  const outVswitch: VSwitchRow[] = []
  const outDvswitch: VDvSwitchRow[] = []
  const outDvport: VDvPortRow[] = []
  const outProxmoxSnapshots: ProxmoxSnapshotRow[] = []
  const outProxmoxStorageContent: ProxmoxStorageContentRow[] = []
  for (const snap of selected) {
    for (const d of snap.vdatastore) outVdatastore.push(d)
    for (const p of snap.vpartition) outVpartition.push(p)
    // P9 D-11: the four network arrays are new required Snapshot fields.
    // `?? []` keeps the merge resilient to Snapshot objects constructed
    // before they existed (older synthetic fixtures / future callers) —
    // an absent array is the same factual-degrade as an empty one.
    for (const n of snap.vnetwork ?? []) outVnetwork.push(n)
    for (const s of snap.vswitch ?? []) outVswitch.push(s)
    for (const ds of snap.dvswitch ?? []) outDvswitch.push(ds)
    for (const dp of snap.dvport ?? []) outDvport.push(dp)
    for (const ps of snap.proxmoxSnapshots ?? []) outProxmoxSnapshots.push(ps)
    for (const sc of snap.proxmoxStorageContent ?? []) outProxmoxStorageContent.push(sc)
  }

  return {
    vinfo: outVinfo,
    vhost: outVhost,
    vdatastore: outVdatastore,
    vpartition: outVpartition,
    vnetwork: outVnetwork,
    vswitch: outVswitch,
    dvswitch: outDvswitch,
    dvport: outDvport,
    proxmoxSnapshots: outProxmoxSnapshots,
    proxmoxStorageContent: outProxmoxStorageContent,
    vcenters: [...vcenterIndex.values()],
  }
}
