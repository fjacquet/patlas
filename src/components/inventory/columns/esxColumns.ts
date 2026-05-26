import type { ColumnDef } from '@tanstack/react-table'
import type { EsxAggregate } from '@/types/estate'
import { fmtGhz, fmtGhzValue, fmtInt, fmtMemMb, fmtPercentValue, fmtRatio } from '@/utils/format'

/**
 * INV-03 ESX table column definitions — consume `EstateView.hosts`
 * (`EsxAggregate`) VERBATIM: no projection, no re-aggregation (the
 * per-host rollup already happened in the Phase-2 `perEsx` pass). Pure
 * config: zero React, zero `useMemo`, zero `@/engines` import.
 *
 * Default-visible set ≈ 11 columns (`esxDefaultVisible`); the rest
 * (speed, vRAM allocated, ratios, CPU-Ready fields) are opt-in via the
 * ColumnPicker. The exported id list is the KISS approach (vs. a
 * `meta.defaultHidden` flag) — the wrapper builds the visibility map from
 * it. `hostName` is the identity column → `enableHiding: false`.
 *
 * Readiness number cells branch on `readinessAvailable` so an unreported
 * value renders the em-dash sentinel — NEVER `0 %` (same discipline as
 * the Phase-2 CpuReadyPanel; absence is not zero — ADR-0012). The CSV
 * export bypasses every display `cell` (it reads the RAW accessor value
 * via `row.getValue`) — two-path discipline (03-RESEARCH Pitfall 4).
 */
export const esxColumns: ColumnDef<EsxAggregate>[] = [
  {
    accessorKey: 'hostName',
    id: 'hostName',
    header: 'inventory.col.hostName',
    enableHiding: false,
  },
  {
    accessorKey: 'cluster',
    id: 'cluster',
    header: 'inventory.col.cluster',
  },
  {
    accessorKey: 'sockets',
    id: 'sockets',
    header: 'inventory.col.sockets',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
  {
    accessorKey: 'cores',
    id: 'cores',
    header: 'inventory.col.cores',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
  {
    accessorKey: 'speedMhz',
    id: 'speedMhz',
    header: 'inventory.col.speedMhz',
    cell: (ctx) => fmtGhz(ctx.getValue<number>()),
  },
  {
    accessorKey: 'physicalGhz',
    id: 'physicalGhz',
    header: 'inventory.col.physicalGhz',
    cell: (ctx) => fmtGhzValue(ctx.getValue<number>()),
  },
  {
    accessorKey: 'memoryMib',
    id: 'memoryMib',
    header: 'inventory.col.memoryMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'vmCount',
    id: 'vmCount',
    header: 'inventory.col.vmCount',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
  {
    accessorKey: 'vcpuAllocated',
    id: 'vcpuAllocated',
    header: 'inventory.col.vcpuAllocated',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
  {
    accessorKey: 'vramAllocatedMib',
    id: 'vramAllocatedMib',
    header: 'inventory.col.vramAllocatedMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'cpuRatio',
    id: 'cpuRatio',
    header: 'inventory.col.cpuRatio',
    cell: (ctx) => fmtRatio(ctx.getValue<number>()),
  },
  {
    accessorKey: 'ramRatio',
    id: 'ramRatio',
    header: 'inventory.col.ramRatio',
    cell: (ctx) => fmtRatio(ctx.getValue<number>()),
  },
  {
    accessorKey: 'meanCpuReadinessPercent',
    id: 'meanCpuReadinessPercent',
    header: 'inventory.col.meanCpuReadinessPercent',
    cell: (ctx) => {
      const v = ctx.getValue<number | null>()
      return ctx.row.original.readinessAvailable && v != null ? fmtPercentValue(v) : '—'
    },
  },
  {
    accessorKey: 'maxCpuReadinessPercent',
    id: 'maxCpuReadinessPercent',
    header: 'inventory.col.maxCpuReadinessPercent',
    cell: (ctx) => {
      const v = ctx.getValue<number | null>()
      return ctx.row.original.readinessAvailable && v != null ? fmtPercentValue(v) : '—'
    },
  },
  {
    accessorKey: 'vmsAboveReadinessWarning',
    id: 'vmsAboveReadinessWarning',
    header: 'inventory.col.vmsAboveReadinessWarning',
    cell: (ctx) => (ctx.row.original.readinessAvailable ? fmtInt(ctx.getValue<number>()) : '—'),
  },
  {
    accessorKey: 'serialNumber',
    id: 'serialNumber',
    header: 'inventory.col.serialNumber',
    // Display path shows the em-dash sentinel for an unreported serial; the
    // CSV export reads the RAW accessor ('') — two-path discipline.
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
  {
    accessorKey: 'model',
    id: 'model',
    header: 'inventory.col.model',
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
  {
    accessorKey: 'vendor',
    id: 'vendor',
    header: 'inventory.col.vendor',
    cell: (ctx) => ctx.getValue<string>() || '—',
  },
]

/**
 * The ≈11-column default-visible set restored by the ColumnPicker "Reset"
 * action. Columns absent from this list (speed, vRAM allocated, ratios,
 * CPU-Ready fields) start hidden and are opt-in. `hostName` is omitted
 * here only because it is never hideable (`enableHiding: false`) — it is
 * always visible regardless.
 */
export const esxDefaultVisible = [
  'hostName',
  'cluster',
  'sockets',
  'cores',
  'physicalGhz',
  'memoryMib',
  'vmCount',
  'vcpuAllocated',
  'serialNumber',
  'model',
  'vendor',
] as const
