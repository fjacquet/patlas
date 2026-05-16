import type { VisibilityState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import type { DatastoreAggregate } from '@/types/estate'
import { datastoreColumns, datastoreDefaultVisible } from './columns/datastoreColumns'
import { DataTable } from './DataTable'

/**
 * Default column-visibility seed: any hideable column NOT in
 * `datastoreDefaultVisible` starts hidden (opt-in via the ColumnPicker;
 * its "Reset" restores exactly this set). Pure data derived from the
 * exported id list — a module-scope constant, never a render-memo hook.
 */
const datastoreDefaultVisibility: VisibilityState = Object.fromEntries(
  datastoreColumns
    .map((c) => c.id as string)
    .filter(
      (id) => !datastoreDefaultVisible.includes(id as (typeof datastoreDefaultVisible)[number]),
    )
    .map((id) => [id, false]),
)

/**
 * INV-04 datastore table wrapper. Thin: passes `EstateView.datastores`
 * straight through as a prop — the Phase-2 NAA dedupe is consumed
 * verbatim, NEVER re-derived. The 03-03 InventoryView shell is the single
 * estate-view caller. Holds no render-memo hook, no estate-view call, no
 * aggregation-engine import. Composes the generic 03-01 `DataTable` with
 * `datastoreColumns` and the default-visibility seed.
 */
export function DatastoreTable({ datastores }: { datastores: DatastoreAggregate[] }) {
  const { t } = useTranslation('inventory')
  return (
    <DataTable
      data={datastores}
      columns={datastoreColumns}
      headerFor={(id) => t(`col.${id}`)}
      objectKind="datastore"
      defaultColumnVisibility={datastoreDefaultVisibility}
    />
  )
}
