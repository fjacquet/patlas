import type { Bytes, MiB } from '@/engines/units'
import type { TrendHeadline } from './estate'
import type { GuestRow, VmUsageRow } from './guest'
import type { NodeRow } from './node'

/**
 * The aggregated trend facts that SURVIVE when a snapshot's raw rows are
 * released (DD-C / Critical-5). Once the rows are gone this is the only
 * remaining INPUT fact for that timeline point — not a cached derivation
 * of live state (A3 resolved interpretation). In-memory only; never
 * persisted (privacy invariant). Populated by the `releaseRawRows` store
 * mutation (plan 08-02); consumed by `buildTrendSeries` (plan 08-01).
 */
export interface ReleasedTrendAggregate {
  headline: TrendHeadline
  byCluster: Map<string, TrendHeadline>
}

/**
 * A guest snapshot row from the Proxmox report `Snapshots` sheet. The report
 * always emits a per-guest live-state marker (`name === 'current'`,
 * `parent === 'no-parent'`) which is NOT a checkpoint — the snapshot-sprawl
 * engine excludes it. `dateSerial` is the raw Excel serial (parseXlsx does
 * not convert dates); `null` when the cell is blank ("not derivable").
 */
export interface ProxmoxSnapshotRow {
  node: string
  /** Proxmox VMID (Vm Id). */
  guestId: string
  guestName: string
  /** 'qemu' (KVM VM) or 'lxc' (container), from the report `Vm Type` column. */
  guestType: 'qemu' | 'lxc'
  /** The snapshot label; `'current'` for the live-state marker row. */
  name: string
  /** Parent snapshot label; `'no-parent'` for a root/marker row. */
  parent: string
  /** Excel serial date of creation; `null` when the cell is blank. */
  dateSerial: number | null
  /** Whether the snapshot captured guest RAM (Include Ram). */
  includeRam: boolean
  /** Snapshot size. `Size GB` reinterpreted as GiB → MiB; 0 when blank. */
  sizeMib: MiB
}

/** A HA-managed resource row from the `Cluster HA` sheet "Resources" sub-table. */
export interface ProxmoxHaResourceRow {
  /** Service id, e.g. "vm:100" / "ct:104". */
  sid: string
  type: string
  state: string
  group: string
  failback: string
  /** Max restart attempts; `null` when blank. */
  maxRestart: number | null
  /** Max relocate attempts; `null` when blank. */
  maxRelocate: number | null
  comment: string
}

/** A HA service/status row from the `Cluster HA` sheet "Status" sub-table. */
export interface ProxmoxHaStatusRow {
  id: string
  /** "quorum" | "fencing" | "service" | … */
  type: string
  status: string
  node: string
  sid: string
  state: string
  crmState: string
  requestState: string
  /** Raw quorate flag (e.g. "X" / ""); kept as text. */
  quorate: string
}

/** A scheduled backup job from the `Cluster` sheet "Backup Jobs" sub-table. */
export interface ProxmoxBackupJobRow {
  id: string
  enabled: boolean
  /** "All guests" flag. */
  all: boolean
  /** Comma-separated VMIDs targeted (empty when `all`). */
  vmId: string
  mode: string
  storage: string
  startTime: string
  schedule: string
  dayOfWeek: string
  compress: string
  type: string
  node: string
}

/**
 * A storage content row from the Proxmox report `Storage Content` sheet.
 * Each row describes a single file stored in Proxmox storage: VM disk images,
 * ISO images, container templates, backups, etc. `guestId`/`guestName` are
 * blank for non-VM content (ISOs, templates). `creationSerial` is the raw
 * Excel serial; `null` when the cell is blank ("not derivable").
 */
export interface ProxmoxStorageContentRow {
  node: string
  /** Proxmox storage name (e.g. "DATA", "local", "local-lvm"). */
  storage: string
  /** Proxmox content class: "images" | "rootdir" | "iso" | "vztmpl" | "backup" | "snippets" | "import" | … */
  content: string
  /** File path within the storage (e.g. "100/vm-100-disk-0.qcow2"). */
  fileName: string
  /** Disk/file format (e.g. "qcow2", "raw", "iso", "tzst"). */
  format: string
  /** File size. `Size GB` reinterpreted as GiB → MiB. */
  sizeMib: MiB
  /** `Storage Usage %` (already a percentage); `null` when the cell is blank
   *  ("not derivable"; ADR-0012, never coerced to 0). */
  usagePercent: number | null
  /** Proxmox VMID owning this content; `''` for non-VM content. */
  guestId: string
  /** Guest display name; `''` for non-VM content (ISO, template, etc.). */
  guestName: string
  /** Excel serial date of creation; `null` when the cell is blank. */
  creationSerial: number | null
}

/**
 * A single parsed RVTools workbook, normalized to vatlas' canonical shape.
 *
 * The parser worker produces everything except `id` and `parsedAt` — those
 * are stamped by the main-thread store (Plan 05) so the worker stays a pure
 * transform with no `crypto`/clock dependency.
 *
 * `viSdkUuid` is carried even though Phase 1 never reads it: Phase 4's
 * multi-vCenter merge keys on `(VI SDK UUID, vm_bios_uuid)` and must not have
 * to re-parse to recover the identity.
 */
export interface Snapshot {
  id: string
  filename: string
  fileSize: Bytes
  capturedAt: Date
  vCenterLabel: string
  /** 'unknown' | '3.10' | '3.11' | '4.0' | '4.4' | '4.4.0' | future builds. */
  rvtoolsVersion: string
  parsedAt: Date
  source: 'proxmox'
  /** vCenter instance UUID from `vInfo.VI SDK UUID`; null when absent. */
  viSdkUuid: string | null
  /**
   * Per-vCenter `vMetaData` entries. RVTools 4.x emits one row per vCenter
   * in a columnar sheet (so a single workbook with 3 vCenters yields 3
   * entries); legacy Property/Value exports collapse to a single entry.
   * Empty when the `vMetaData` sheet is absent. (Phase 4 MVC-04.)
   */
  vMetaData: VMetaDataEntry[]
  /** Proxmox guest rows (VMs + LXC containers) from the report `VMs` + `Containers` sheets. */
  guests: GuestRow[]
  /** Proxmox node rows from the report `Nodes` sheet. */
  nodes: NodeRow[]
  /** Per-VM runtime/perf metrics from `vMemory`+`vCPU` (right-sizing/stress).
   *  `[]` when both OPTIONAL sheets are absent (factual-degrade). Never
   *  undefined. */
  vmUsage: VmUsageRow[]
  /** Proxmox guest snapshots from the report `Snapshots` sheet. `[]` when the
   *  sheet is absent — never undefined (factual-degrade). */
  proxmoxSnapshots: ProxmoxSnapshotRow[]
  /** Proxmox storage content rows from the report `Storage Content` sheet.
   *  `[]` when the sheet is absent — never undefined (factual-degrade). */
  proxmoxStorageContent: ProxmoxStorageContentRow[]
  /** Proxmox HA-managed resources (`Cluster HA` → Resources). `[]` when absent. */
  proxmoxHaResources: ProxmoxHaResourceRow[]
  /** Proxmox HA service status (`Cluster HA` → Status). `[]` when absent. */
  proxmoxHaStatus: ProxmoxHaStatusRow[]
  /** Proxmox scheduled backup jobs (`Cluster` → Backup Jobs). `[]` when absent. */
  proxmoxBackupJobs: ProxmoxBackupJobRow[]
  /** Proxmox storage rows from the report `Storages` sheet. */
  storages: StorageRow[]
  vpartition: VPartitionRow[]
  /** Proxmox node interface rows from the "Network" sheet "Nodes Networks"
   *  sub-table. `[]` when the OPTIONAL Network sheet is absent — never
   *  undefined (P5 factual-degrade). */
  nodeInterfaces: NodeInterfaceRow[]
  /** Proxmox guest NIC attachment rows from the "Network" sheet "VM Networks"
   *  sub-table. `[]` when absent — never undefined (P5 factual-degrade). */
  vmNics: VmNicRow[]
  parseErrors: ParseError[]
  /** Proxmox issue rows from the `Issues` sheet. `undefined` when sheet is absent. */
  proxmoxIssues?: ProxmoxIssueRow[]
  /** Proxmox access user rows from the `Cluster Access` sheet "Users" sub-table. */
  proxmoxAccessUsers?: ProxmoxAccessUserRow[]
  /** Proxmox API token rows from the `Cluster Access` sheet "API Tokens" sub-table. */
  proxmoxAccessTokens?: ProxmoxAccessTokenRow[]
  /** Proxmox role definition rows from the `Cluster Access` sheet "Roles" sub-table. */
  proxmoxAccessRoles?: ProxmoxAccessRoleRow[]
  /** Proxmox ACL entries from the `Cluster Access` sheet "ACL" sub-table. */
  proxmoxAccessAcls?: ProxmoxAccessAclRow[]
  /** Proxmox pool member rows from the `Cluster Pools` sheet. `undefined` when absent. */
  proxmoxPoolMembers?: ProxmoxPoolMemberRow[]
  /**
   * The `network-diagram.svg` from a Proxmox `.zip` bundle, as a raw SVG
   * string. `null` for a bare `.xlsx` (no bundle). Per-active-snapshot asset;
   * NOT merged into `EstateView`. Rendered only via a sandboxed `<img>`
   * data-URI (never raw-injected). In-memory only (PAR-05).
   */
  networkSvg?: string | null
  /**
   * DD-C: `true` once this snapshot's raw rows have been released to cap
   * memory when > 4 snapshots are loaded. The active/latest snapshot is
   * never released. Set by `releaseRawRows` (plan 08-02).
   */
  rawReleased?: boolean
  /**
   * The surviving aggregated trend facts for a released snapshot. `null`/
   * absent while raw rows are present; populated by `releaseRawRows` so
   * `buildTrendSeries` keeps the point without re-aggregating absent rows
   * (DD-C / Pitfall 4).
   */
  releasedAggregate?: ReleasedTrendAggregate | null
}

/** A datastore row from the RVTools `vDatastore` sheet. */
export interface StorageRow {
  name: string
  capacityMib: MiB
  freeMib: MiB
  provisionedMib: MiB
  /** NAA / UUID identity key (null when the column is absent). */
  naa: string | null
  /** VMFS, NFS, vSAN, … */
  type: string
  /**
   * RVTools `Hosts` — the host-name list this datastore is mounted on.
   * Empty string when the column is absent. Consumed by Plan 04-02 to
   * attribute vSAN/host-local datastores (blank `clusterName`) to their
   * cluster via the `vHost.hostName → vHost.cluster` map (Pitfall 6).
   */
  hosts: string
  /** Owning cluster from RVTools vDatastore `Cluster name`. Empty string
   *  when the datastore is host-local / not cluster-attributed (the column
   *  IS present in real RVTools exports — never assume absent). */
  clusterName: string
}

/** A guest-disk partition row from the RVTools `vPartition` sheet. */
export interface VPartitionRow {
  vmName: string
  disk: string
  capacityMib: MiB
  consumedMib: MiB
  freeMib: MiB
}

/**
 * A per-node network interface row from the Proxmox "Network" sheet,
 * "Nodes Networks" sub-table.
 *
 * `type` ∈ {'eth', 'bond', 'bridge', 'vlan', 'ovs_bridge', 'ovs_bond',
 * 'ovs_port', 'ovs_intport', 'vxlan'} — the Proxmox network primitives.
 * `mtu`/`vlanId` are `null` when the column cell is blank ("not derivable").
 * `slaves` is always an array (empty when not a bond). Parsed via the
 * stacked-section helper, same pattern as Cluster HA. (P5.)
 */
export interface NodeInterfaceRow {
  /** Proxmox node hostname. */
  node: string
  /** Interface name (e.g. eno1, bond0, vmbr0, COROSYNC). */
  name: string
  /** Proxmox interface type: eth | bond | bridge | vlan | ovs* | vxlan. */
  type: string
  /** True when the interface is currently active ('X' in the sheet). */
  active: boolean
  /** True when the interface is set to auto-start on boot. */
  autostart: boolean
  /** IPv4 method: 'static' | 'dhcp' | 'manual' | ''. */
  method: string
  /** IPv4 CIDR (e.g. '10.4.32.1/28'). Empty when absent. */
  cidr: string
  /** IPv4 address. Empty when absent. */
  address: string
  /** IPv4 gateway. Empty when absent. */
  gateway: string
  /** MTU in bytes; `null` when the cell is blank. */
  mtu: number | null
  /** Bond mode (e.g. '802.3ad', 'active-backup'). Empty for non-bond. */
  bondMode: string
  /** Bond slave interface names. Empty array for non-bond. */
  slaves: string[]
  /** Linux bridge port(s), e.g. 'bond1'. Empty for non-bridge. */
  bridgePorts: string
  /** True when the bridge has VLAN-awareness enabled. */
  bridgeVlanAware: boolean
  /** VLAN id; `null` when absent (non-VLAN iface). */
  vlanId: number | null
  /** The device this VLAN is sliced from (e.g. 'bond0'). Empty for non-VLAN. */
  vlanRawDevice: string
  /** Freeform comments from the "Comments" column. */
  comments: string
}

/**
 * A guest NIC attachment row from the Proxmox "Network" sheet,
 * "VM Networks" sub-table. One row per NIC per guest. (P5.)
 */
export interface VmNicRow {
  /** Node hosting the guest. */
  node: string
  /** Proxmox VMID (numeric string). */
  vmId: string
  /** Guest display name. */
  vmName: string
  /** Guest type: 'qemu' (KVM VM) or 'lxc' (container). */
  vmType: string
  /** MAC address. */
  macAddress: string
  /** Linux bridge the NIC is attached to (e.g. 'vmbr1'). */
  bridge: string
  /** VLAN tag; `null` when the NIC is untagged. */
  tag: number | null
  /** NIC model (e.g. 'virtio', 'e1000'). */
  model: string
}

/**
 * One `vMetaData` entry — per vCenter. RVTools 4.x exports a columnar
 * `vMetaData` sheet with one row per vCenter (`Server`, `RVTools version`,
 * `xlsx creation datetime`); pre-4.x exports a single Property/Value sheet
 * which collapses to a single entry with an empty `server`.
 */
export interface VMetaDataEntry {
  /** RVTools `Server` (vCenter FQDN/IP). `''` for legacy Property/Value. */
  server: string
  /** RVTools `RVTools version` (e.g. `4.7.1.4`). `null` when absent. */
  rvtoolsVersion: string | null
  /** RVTools `xlsx creation datetime` / `Exported Timestamp`. `null` absent. */
  exportedTimestamp: string | null
}

/**
 * The RVTools `vMetaData` sheet, normalized to a per-vCenter entry list
 * (one entry per vCenter for 4.x columnar; a single entry for legacy
 * Property/Value). `entries` is never `undefined` — `[]` when the sheet is
 * absent.
 */
export interface VMetaDataRow {
  entries: VMetaDataEntry[]
}

/** A row from the Proxmox report `Issues` sheet. */
export interface ProxmoxIssueRow {
  severity: string
  section: string
  message: string
  /** Excel serial date; `null` when the cell is blank. */
  timestampSerial: number | null
  linkKey: string
}

/** A user row from the `Cluster Access` sheet "Users" sub-table. */
export interface ProxmoxAccessUserRow {
  id: string
  enabled: boolean
  firstname: string
  lastname: string
  email: string
  groups: string
  keys: string
  totpLocked: boolean
  expire: string
  comment: string
}

/** An API token row from the `Cluster Access` sheet "API Tokens" sub-table. */
export interface ProxmoxAccessTokenRow {
  user: string
  tokenId: string
  expire: string
  privSeparated: boolean
  comment: string
}

/** A role definition row from the `Cluster Access` sheet "Roles" sub-table. */
export interface ProxmoxAccessRoleRow {
  id: string
  privileges: string
  /** True when this is a built-in Proxmox role. */
  special: boolean
}

/** An ACL entry row from the `Cluster Access` sheet "ACL" sub-table. */
export interface ProxmoxAccessAclRow {
  path: string
  usersOrGroup: string
  /** 'user' | 'group' | 'token' */
  type: string
  /** Role id (e.g. 'Administrator', 'PVEAuditor'). */
  roleId: string
  propagate: boolean
}

/** A pool member row from the `Cluster Pools` sheet "Pools" sub-table. */
export interface ProxmoxPoolMemberRow {
  pool: string
  /** 'qemu' | 'lxc' | 'storage' */
  type: string
  node: string
  vmId: string
  storage: string
  status: string
  description: string
  comment: string
}

/**
 * A non-fatal parsing problem. Fatal problems (missing REQUIRED sheet/column)
 * are thrown as an `Error` whose `name === 'ParseError'`; this interface
 * describes the collected, recoverable ones surfaced to the UI as a count.
 */
export interface ParseError {
  sheet: string
  column?: string
  kind: 'missing-sheet' | 'missing-column' | 'invalid-row'
  message: string
  rowIndex?: number
}
