import type { Bytes, MiB } from '@/engines/units'
import type { VHostRow } from './vhost'
import type { VInfoRow } from './vinfo'

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
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]
  parseErrors: ParseError[]
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
}

/** A guest-disk partition row from the RVTools `vPartition` sheet. */
export interface VPartitionRow {
  vmName: string
  disk: string
  capacityMib: MiB
  consumedMib: MiB
  freeMib: MiB
}

/** The RVTools `vMetaData` sheet, reduced to the two fields vatlas reads. */
export interface VMetaDataRow {
  exportedTimestamp: string | null
  rvtoolsVersion: string | null
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
