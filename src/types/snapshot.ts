import type { Bytes, MiB } from '@/engines/units'
import type { TrendHeadline } from './estate'
import type { VHostRow } from './vhost'
import type { VInfoRow, VmUsageRow } from './vinfo'

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
  vinfo: VInfoRow[]
  vhost: VHostRow[]
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
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]
  /** RVTools `vNetwork` rows (VM→portgroup). `[]` when the OPTIONAL sheet
   *  is absent — never undefined (P9 D-11 factual-degrade). */
  vnetwork: VNetworkRow[]
  /** RVTools `vSwitch` rows (standard switches). `[]` when absent. */
  vswitch: VSwitchRow[]
  /** RVTools `dvSwitch` rows (distributed switches). `[]` when absent. */
  dvswitch: VDvSwitchRow[]
  /** RVTools `dvPort` rows (distributed portgroups). `[]` when absent. */
  dvport: VDvPortRow[]
  parseErrors: ParseError[]
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
export interface VDatastoreRow {
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
 * A VM→portgroup row from the RVTools `vNetwork` sheet. Plain strings; no
 * branded units. Empty string when a column is absent. (P9 D-11.)
 */
export interface VNetworkRow {
  /** RVTools `vNetwork.VM`. */
  vm: string
  /** RVTools `vNetwork.Network` — the portgroup name. */
  network: string
  /** RVTools `vNetwork.Switch` — the owning vSwitch/dvSwitch name. */
  switch: string
  /** RVTools `vNetwork.Adapter` — the virtual NIC adapter type. */
  adapter: string
  /** RVTools `vNetwork.Connected` (raw text, e.g. `True`/`False`). */
  connected: string
  /** RVTools `vNetwork.Cluster`. */
  cluster: string
  /** RVTools `vNetwork.Host`. */
  host: string
}

/**
 * A standard-switch row from the RVTools `vSwitch` sheet. Port counts are
 * plain non-negative numbers (NOT MiB-branded). (P9 D-11.)
 */
export interface VSwitchRow {
  /** RVTools `vSwitch.Host`. */
  host: string
  /** RVTools `vSwitch.Cluster`. */
  cluster: string
  /** RVTools `vSwitch.Switch` — the standard vSwitch name. */
  switch: string
  /** RVTools `vSwitch.# Ports`. */
  ports: number
  /** RVTools `vSwitch.Free Ports`. */
  freePorts: number
  /** RVTools `vSwitch.MTU`. */
  mtu: number
}

/**
 * A distributed-switch row from the RVTools `dvSwitch` sheet. Counts are
 * plain non-negative numbers (NOT MiB-branded). (P9 D-11.)
 */
export interface VDvSwitchRow {
  /** RVTools `dvSwitch.Switch`. */
  switch: string
  /** RVTools `dvSwitch.Name`. */
  name: string
  /** RVTools `dvSwitch.Version`. */
  version: string
  /** RVTools `dvSwitch.Host members`. */
  hostMembers: string
  /** RVTools `dvSwitch.# Ports`. */
  ports: number
  /** RVTools `dvSwitch.# VMs`. */
  vms: number
  /** RVTools `dvSwitch.Max MTU`. */
  maxMtu: number
}

/**
 * A distributed-portgroup row from the RVTools `dvPort` sheet. Empty string
 * when a column is absent. (P9 D-11.)
 */
export interface VDvPortRow {
  /** RVTools `dvPort.Port` — the distributed portgroup name. */
  port: string
  /** RVTools `dvPort.Switch` — the owning dvSwitch name. */
  switch: string
  /** RVTools `dvPort.VLAN` (raw text — can be a range or trunk spec). */
  vlan: string
  /** RVTools `dvPort.Active Uplink`. */
  activeUplink: string
  /** RVTools `dvPort.Standby Uplink`. */
  standbyUplink: string
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
