import type { ColumnDef } from '@tanstack/react-table'
import type { StorageCapacityGroup } from '@/engines/aggregation'
import { fmtMemMb } from '@/utils/format'

/**
 * P9 storage table column definitions over `StorageByX.capacityByDatastore`
 * (`StorageCapacityGroup`). Modeled on `datastoreColumns.ts` VERBATIM (pure
 * config: zero React, zero `useMemo`, zero `@/engines` runtime import — the
 * type import is erased). Every `id` reuses an EXISTING `inventory:col.<id>`
 * key (`key`/`name`/`capacityMib`/`usedMib`/`freeMib`) so the Pitfall-3
 * header-key requirement holds with no new i18n keys. Display cells tier via
 * the shipped `fmtMemMb`; the CSV path bypasses these (raw accessor value).
 */
export const storageColumns: ColumnDef<StorageCapacityGroup>[] = [
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
    accessorKey: 'capacityMib',
    id: 'capacityMib',
    header: 'inventory.col.capacityMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'usedMib',
    id: 'usedMib',
    header: 'inventory.col.usedMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
  {
    accessorKey: 'freeMib',
    id: 'freeMib',
    header: 'inventory.col.freeMib',
    cell: (ctx) => fmtMemMb(ctx.getValue<number>()),
  },
]

/** Default-visible set restored by the ColumnPicker "Reset" (all columns
 *  are visible by default — the set is small). `key` is never hideable. */
export const storageDefaultVisible = ['key', 'name', 'capacityMib', 'usedMib', 'freeMib'] as const
