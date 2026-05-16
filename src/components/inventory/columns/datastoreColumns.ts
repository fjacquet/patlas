import type { ColumnDef } from '@tanstack/react-table'
import type { DatastoreAggregate } from '@/types/estate'
import { fmtInt, fmtMemMb, fmtPercent, fmtRatio } from '@/utils/format'

/**
 * INV-04 datastore table column definitions — consume
 * `EstateView.datastores` (`DatastoreAggregate`) VERBATIM. The NAA dedupe
 * (rows sharing a `naa` collapse to ONE key-aggregate, Moderate-11) was
 * already done by the Phase-2 `perDatastore` pass; this module NEVER
 * re-keys, re-groups, or re-derives it. Pure config: zero React, zero
 * `useMemo`, zero `@/engines` import.
 *
 * There is intentionally NO scoping column here (03-RESEARCH Open Q3 /
 * Anti-Pattern; UI-SPEC §Three object tables): `VDatastoreRow` carries no
 * such attribution, so the table is scope-agnostic. `key` (the
 * `naa ?? name` dedupe key) is the identity column → `enableHiding:
 * false`. Capacity/free/used/provisioned cells format for DISPLAY via the
 * inherited `format.ts` GiB/TiB tiering; the CSV export bypasses these
 * (raw accessor value via `row.getValue`) — two-path discipline
 * (03-RESEARCH Pitfall 4). `datastoreDefaultVisible` is the ≈8-column
 * default set the ColumnPicker "Reset" restores.
 */
export const datastoreColumns: ColumnDef<DatastoreAggregate>[] = [
  {
    accessorKey: 'key',
    id: 'key',
    header: 'inventory.col.key',
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    id: 'name',
    header: 'inventory.col.name',
  },
  {
    accessorKey: 'type',
    id: 'type',
    header: 'inventory.col.type',
  },
  {
    accessorKey: 'capacityMib',
    id: 'capacityMib',
    header: 'inventory.col.capacityMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'freeMib',
    id: 'freeMib',
    header: 'inventory.col.freeMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'usedMib',
    id: 'usedMib',
    header: 'inventory.col.usedMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'usedRatio',
    id: 'usedRatio',
    header: 'inventory.col.usedRatio',
    cell: (ctx) => fmtPercent(ctx.getValue<number>()),
  },
  {
    accessorKey: 'provisionedMib',
    id: 'provisionedMib',
    header: 'inventory.col.provisionedMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'overProvisionRatio',
    id: 'overProvisionRatio',
    header: 'inventory.col.overProvisionRatio',
    cell: (ctx) => fmtRatio(ctx.getValue<number>()),
  },
  {
    accessorKey: 'sharedDuplicateCount',
    id: 'sharedDuplicateCount',
    header: 'inventory.col.sharedDuplicateCount',
    cell: (ctx) => fmtInt(ctx.getValue<number>()),
  },
]

/**
 * The ≈8-column default-visible set restored by the ColumnPicker "Reset"
 * action. Columns absent (usedRatio, overProvisionRatio,
 * sharedDuplicateCount) start hidden and are opt-in. `key` is omitted
 * here only because it is never hideable (`enableHiding: false`) — always
 * visible regardless.
 */
export const datastoreDefaultVisible = [
  'key',
  'name',
  'type',
  'capacityMib',
  'freeMib',
  'usedMib',
  'provisionedMib',
] as const
