import type { Bytes, MiB } from '@/engines/units'
import type { TrendHeadline } from './estate'
import type { VHostRow } from './vhost'
import type { VInfoRow } from './vinfo'

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
  source: 'rvtools'
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
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]
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
