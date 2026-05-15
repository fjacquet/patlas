import type {
  ParseError,
  Snapshot,
  VDatastoreRow,
  VHostRow,
  VInfoRow,
  VPartitionRow,
} from '@/types'
import { adaptRvtools } from './adapters/rvtools'
import type { ParsedWorkbook } from './parseXlsx'
import { VDatastoreRowSchema, VHostRowSchema, VInfoRowSchema, VPartitionRowSchema } from './schemas'
import { synthesizeOrphanClusters } from './synthesizeOrphanClusters'

/**
 * The row-extraction half of a `Snapshot`. The worker layer
 * (`parser.worker.ts`) glues on the metadata fields (`filename`, `fileSize`,
 * `capturedAt`, `vCenterLabel`, `rvtoolsVersion`, `id`, `parsedAt`).
 */
export type SnapshotRows = Pick<
  Snapshot,
  'vinfo' | 'vhost' | 'vdatastore' | 'vpartition' | 'viSdkUuid' | 'parseErrors'
>

/**
 * Generic per-row Zod validation collecting structured `ParseError`s.
 * Kept verbatim from vsizer's `validate<T>` (DRY — one helper for every
 * sheet) but adapted to vatlas' richer `ParseError` shape.
 */
const validate = <T>(
  rows: unknown[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  sheet: string,
): { rows: T[]; errors: ParseError[] } => {
  const out: T[] = []
  const errors: ParseError[] = []
  rows.forEach((row, index) => {
    const result = schema.safeParse(row)
    if (result.success && result.data !== undefined) {
      out.push(result.data)
    } else {
      errors.push({
        sheet,
        kind: 'invalid-row',
        rowIndex: index,
        message: `invalid ${sheet} row at index ${index}`,
      })
    }
  })
  return { rows: out, errors }
}

/**
 * Run the RVTools adapter against a parsed workbook, validate every row, and
 * bucket clusterless hosts. RVTools-only: vatlas ingests RVTools `.xlsx`
 * exclusively, so there is no source-format detection step and no
 * alternate-vendor adapter branch (unlike vsizer). Fatal problems (missing
 * REQUIRED sheet/column) propagate as a thrown `ParseError`; recoverable
 * ones are collected.
 */
export const parseSnapshot = (
  workbook: ParsedWorkbook,
): { snapshot: SnapshotRows; warnings: ParseError[] } => {
  const raw = adaptRvtools(workbook)

  const vinfo = validate<VInfoRow>(raw.vinfo, VInfoRowSchema, 'vInfo')
  const vhost = validate<VHostRow>(raw.vhost, VHostRowSchema, 'vHost')
  const vdatastore = validate<VDatastoreRow>(raw.vdatastore, VDatastoreRowSchema, 'vDatastore')
  const vpartition = validate<VPartitionRow>(raw.vpartition, VPartitionRowSchema, 'vPartition')

  // ADR-0014: bucket clusterless hosts under per-host synthetic cluster
  // names so the aggregator doesn't drop them. Runs after schema validation
  // so input rows are guaranteed typed; the synthesis is pure.
  const bucketed = synthesizeOrphanClusters({ vinfo: vinfo.rows, vhost: vhost.rows })

  const parseErrors = [...vinfo.errors, ...vhost.errors, ...vdatastore.errors, ...vpartition.errors]
  const viSdkUuid = bucketed.vinfo.find((r) => r.viSdkUuid)?.viSdkUuid ?? null

  return {
    snapshot: {
      vinfo: bucketed.vinfo,
      vhost: bucketed.vhost,
      vdatastore: vdatastore.rows,
      vpartition: vpartition.rows,
      viSdkUuid,
      parseErrors,
    },
    warnings: [...raw.warnings, ...parseErrors],
  }
}
