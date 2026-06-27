import type {
  GuestRow,
  NodeInterfaceRow,
  NodeRow,
  ProxmoxAccessAclRow,
  ProxmoxAccessRoleRow,
  ProxmoxAccessTokenRow,
  ProxmoxAccessUserRow,
  ProxmoxBackupJobRow,
  ProxmoxDiskRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
  ProxmoxIssueRow,
  ProxmoxPartitionRow,
  ProxmoxPoolMemberRow,
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  ProxmoxTaskRow,
  Snapshot,
  StorageRow,
  VmNicRow,
  VPartitionRow,
} from '@/types'
import { buildVCenterIndex, type VCenterEntry } from './vCenterIndex'

/**
 * The merged estate: flattened, deduped rows from the selected snapshots
 * plus the per-vCenter index. Every later Phase-4/5/6/7 capability reads
 * THIS, not raw snapshots.
 */
export interface MergedEstate {
  /** Proxmox guest rows (VMs + LXC containers) flattened across selected snapshots. */
  guests: GuestRow[]
  /** Proxmox node rows flattened across selected snapshots. */
  nodes: NodeRow[]
  /** Proxmox storage rows flattened across selected snapshots. */
  storages: StorageRow[]
  /** Concatenated guest-disk partitions of the selected snapshots (P5
   *  guest-data). Empty when no vPartition sheet was present. */
  vpartition: VPartitionRow[]
  /** Concatenated Proxmox node interface rows across selected snapshots
   *  (P5 — "Nodes Networks" sub-table of the Network sheet). Empty when the
   *  OPTIONAL Network sheet is absent — factual-degrade, never undefined. */
  nodeInterfaces: NodeInterfaceRow[]
  /** Concatenated Proxmox guest NIC rows across selected snapshots
   *  (P5 — "VM Networks" sub-table of the Network sheet). Empty when absent. */
  vmNics: VmNicRow[]
  /** Concatenated Proxmox guest snapshot rows across selected snapshots.
   *  Empty when the Snapshots sheet was absent — factual-degrade, never undefined. */
  proxmoxSnapshots: ProxmoxSnapshotRow[]
  /** Concatenated Proxmox storage content rows across selected snapshots.
   *  Empty when the Storage Content sheet was absent — factual-degrade, never undefined. */
  proxmoxStorageContent: ProxmoxStorageContentRow[]
  /** Concatenated Proxmox HA resource rows across selected snapshots.
   *  Empty when the Cluster HA Resources sub-table was absent — factual-degrade, never undefined. */
  proxmoxHaResources: ProxmoxHaResourceRow[]
  /** Concatenated Proxmox HA status rows across selected snapshots.
   *  Empty when the Cluster HA Status sub-table was absent — factual-degrade, never undefined. */
  proxmoxHaStatus: ProxmoxHaStatusRow[]
  /** Concatenated Proxmox backup job rows across selected snapshots.
   *  Empty when the Cluster Backup Jobs sub-table was absent — factual-degrade, never undefined. */
  proxmoxBackupJobs: ProxmoxBackupJobRow[]
  /** Concatenated Proxmox partition rows across selected snapshots.
   *  Empty when the Partitions sheet was absent — factual-degrade, never undefined. */
  proxmoxPartitions: ProxmoxPartitionRow[]
  /** Concatenated Proxmox disk rows across selected snapshots.
   *  Empty when the Disks sheet was absent — factual-degrade, never undefined. */
  proxmoxDisks: ProxmoxDiskRow[]
  /** Concatenated Proxmox task rows across selected snapshots.
   *  Empty when the Cluster Tasks sheet was absent — factual-degrade, never undefined. */
  proxmoxTasks: ProxmoxTaskRow[]
  /** Concatenated Proxmox issue rows (Pack C). `?? []` when absent. */
  proxmoxIssues: ProxmoxIssueRow[]
  /** Concatenated Proxmox access user rows (Pack C). `?? []` when absent. */
  proxmoxAccessUsers: ProxmoxAccessUserRow[]
  /** Concatenated Proxmox API token rows (Pack C). `?? []` when absent. */
  proxmoxAccessTokens: ProxmoxAccessTokenRow[]
  /** Concatenated Proxmox role rows (Pack C). `?? []` when absent. */
  proxmoxAccessRoles: ProxmoxAccessRoleRow[]
  /** Concatenated Proxmox ACL rows (Pack C). `?? []` when absent. */
  proxmoxAccessAcls: ProxmoxAccessAclRow[]
  /** Concatenated Proxmox pool member rows (Pack C). `?? []` when absent. */
  proxmoxPoolMembers: ProxmoxPoolMemberRow[]
  vcenters: VCenterEntry[]
}

const EMPTY_MERGED: MergedEstate = {
  guests: [],
  nodes: [],
  storages: [],
  vpartition: [],
  nodeInterfaces: [],
  vmNics: [],
  proxmoxSnapshots: [],
  proxmoxStorageContent: [],
  proxmoxHaResources: [],
  proxmoxHaStatus: [],
  proxmoxBackupJobs: [],
  proxmoxPartitions: [],
  proxmoxDisks: [],
  proxmoxTasks: [],
  proxmoxIssues: [],
  proxmoxAccessUsers: [],
  proxmoxAccessTokens: [],
  proxmoxAccessRoles: [],
  proxmoxAccessAcls: [],
  proxmoxPoolMembers: [],
  vcenters: [],
}

/**
 * First-occurrence-wins VM dedupe key (RESEARCH Pitfall 2 / Pattern 2):
 *   - `vmBiosUuid` (= RVTools `VM UUID`, the vCenter-assigned UNIQUE key —
 *     NEVER SMBIOS) when present, so a VM vMotioned across vCenters collapses
 *   - else `(viSdkUuid, vmName, cluster)` so distinct VMs are not merged
 * `vmInstanceUuid` is ABSENT in RVTools 4.7 — deliberately not a key path.
 */
const vmDedupeKey = (row: GuestRow): string =>
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

  // NodeRow has no `viSdkUuid` column. A host's vCenter is resolved
  // SNAPSHOT-SCOPED (never globally — a global cluster→vCenter map collapses
  // exactly the colliding-name case we must disambiguate):
  //   1. guest rows in the SAME snapshot whose `host` === h.hostName
  //   2. guest rows in the SAME snapshot whose `cluster` === h.cluster
  //   3. the snapshot's own `viSdkUuid`
  const hostVcenter = (snap: Snapshot, h: NodeRow): string => {
    const byHost = snap.guests.find((v) => v.host !== '' && v.host === h.hostName)
    if (byHost) return byHost.viSdkUuid
    const byCluster = snap.guests.find((v) => v.cluster === h.cluster)
    if (byCluster) return byCluster.viSdkUuid
    return snap.viSdkUuid ?? ''
  }

  // Step 1: collision map keyed on (clusterName → set of viSdkUuid). vinfo
  // rows carry `viSdkUuid` directly; hosts contribute their snapshot-scoped
  // vCenter. `size > 1` ⇒ the name spans distinct vCenters ⇒ colliding.
  const vcByCluster = new Map<string, Set<string>>()
  for (const snap of selected) {
    for (const v of snap.guests) {
      const set = vcByCluster.get(v.cluster) ?? new Set<string>()
      set.add(v.viSdkUuid)
      vcByCluster.set(v.cluster, set)
    }
    for (const h of snap.nodes) {
      const set = vcByCluster.get(h.cluster) ?? new Set<string>()
      set.add(hostVcenter(snap, h))
      vcByCluster.set(h.cluster, set)
    }
  }
  const isColliding = (cluster: string): boolean => (vcByCluster.get(cluster)?.size ?? 0) > 1

  // Step 2: rewrite-or-passthrough guests (deduped) + nodes.
  const outVinfo: GuestRow[] = []
  const seenVm = new Set<string>()
  for (const snap of selected) {
    for (const v of snap.guests) {
      const key = vmDedupeKey(v)
      if (seenVm.has(key)) continue
      seenVm.add(key)
      outVinfo.push(
        isColliding(v.cluster) ? { ...v, cluster: `${v.cluster} (${labelFor(v.viSdkUuid)})` } : v,
      )
    }
  }

  const outVhost: NodeRow[] = []
  for (const snap of selected) {
    for (const h of snap.nodes) {
      outVhost.push(
        isColliding(h.cluster)
          ? { ...h, cluster: `${h.cluster} (${labelFor(hostVcenter(snap, h))})` }
          : h,
      )
    }
  }

  const outVdatastore: StorageRow[] = []
  const outVpartition: VPartitionRow[] = []
  const outNodeInterfaces: NodeInterfaceRow[] = []
  const outVmNics: VmNicRow[] = []
  const outProxmoxSnapshots: ProxmoxSnapshotRow[] = []
  const outProxmoxStorageContent: ProxmoxStorageContentRow[] = []
  const outProxmoxHaResources: ProxmoxHaResourceRow[] = []
  const outProxmoxHaStatus: ProxmoxHaStatusRow[] = []
  const outProxmoxBackupJobs: ProxmoxBackupJobRow[] = []
  const outProxmoxPartitions: ProxmoxPartitionRow[] = []
  const outProxmoxDisks: ProxmoxDiskRow[] = []
  const outProxmoxTasks: ProxmoxTaskRow[] = []
  const outProxmoxIssues: ProxmoxIssueRow[] = []
  const outProxmoxAccessUsers: ProxmoxAccessUserRow[] = []
  const outProxmoxAccessTokens: ProxmoxAccessTokenRow[] = []
  const outProxmoxAccessRoles: ProxmoxAccessRoleRow[] = []
  const outProxmoxAccessAcls: ProxmoxAccessAclRow[] = []
  const outProxmoxPoolMembers: ProxmoxPoolMemberRow[] = []
  for (const snap of selected) {
    for (const d of snap.storages) outVdatastore.push(d)
    for (const p of snap.vpartition) outVpartition.push(p)
    // P5: Proxmox network arrays. `?? []` keeps the merge resilient to
    // Snapshot objects constructed before this phase landed.
    for (const ni of snap.nodeInterfaces ?? []) outNodeInterfaces.push(ni)
    for (const vn of snap.vmNics ?? []) outVmNics.push(vn)
    for (const ps of snap.proxmoxSnapshots ?? []) outProxmoxSnapshots.push(ps)
    for (const sc of snap.proxmoxStorageContent ?? []) outProxmoxStorageContent.push(sc)
    for (const hr of snap.proxmoxHaResources ?? []) outProxmoxHaResources.push(hr)
    for (const hs of snap.proxmoxHaStatus ?? []) outProxmoxHaStatus.push(hs)
    for (const bj of snap.proxmoxBackupJobs ?? []) outProxmoxBackupJobs.push(bj)
    for (const pp of snap.proxmoxPartitions ?? []) outProxmoxPartitions.push(pp)
    for (const pd of snap.proxmoxDisks ?? []) outProxmoxDisks.push(pd)
    for (const pt of snap.proxmoxTasks ?? []) outProxmoxTasks.push(pt)
    // Pack C governance — `?? []` for Snapshot objects pre-dating this phase.
    for (const is of snap.proxmoxIssues ?? []) outProxmoxIssues.push(is)
    for (const au of snap.proxmoxAccessUsers ?? []) outProxmoxAccessUsers.push(au)
    for (const at of snap.proxmoxAccessTokens ?? []) outProxmoxAccessTokens.push(at)
    for (const ar of snap.proxmoxAccessRoles ?? []) outProxmoxAccessRoles.push(ar)
    for (const aa of snap.proxmoxAccessAcls ?? []) outProxmoxAccessAcls.push(aa)
    for (const pm of snap.proxmoxPoolMembers ?? []) outProxmoxPoolMembers.push(pm)
  }

  return {
    guests: outVinfo,
    nodes: outVhost,
    storages: outVdatastore,
    vpartition: outVpartition,
    nodeInterfaces: outNodeInterfaces,
    vmNics: outVmNics,
    proxmoxSnapshots: outProxmoxSnapshots,
    proxmoxStorageContent: outProxmoxStorageContent,
    proxmoxHaResources: outProxmoxHaResources,
    proxmoxHaStatus: outProxmoxHaStatus,
    proxmoxBackupJobs: outProxmoxBackupJobs,
    proxmoxPartitions: outProxmoxPartitions,
    proxmoxDisks: outProxmoxDisks,
    proxmoxTasks: outProxmoxTasks,
    proxmoxIssues: outProxmoxIssues,
    proxmoxAccessUsers: outProxmoxAccessUsers,
    proxmoxAccessTokens: outProxmoxAccessTokens,
    proxmoxAccessRoles: outProxmoxAccessRoles,
    proxmoxAccessAcls: outProxmoxAccessAcls,
    proxmoxPoolMembers: outProxmoxPoolMembers,
    vcenters: [...vcenterIndex.values()],
  }
}
