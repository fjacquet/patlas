import type { VisibilityState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import type { EsxAggregate } from '@/types/estate'
import { esxColumns, esxDefaultVisible } from './columns/esxColumns'
import { DataTable } from './DataTable'

/**
 * Default column-visibility seed: any hideable column NOT in
 * `esxDefaultVisible` starts hidden (opt-in via the ColumnPicker; its
 * "Reset" restores exactly this set). Pure data derived from the exported
 * id list — a module-scope constant, never a render-memo hook.
 */
const esxDefaultVisibility: VisibilityState = Object.fromEntries(
  esxColumns
    .map((c) => c.id as string)
    .filter((id) => !esxDefaultVisible.includes(id as (typeof esxDefaultVisible)[number]))
    .map((id) => [id, false]),
)

/**
 * INV-03 ESX table wrapper. Thin: receives `EstateView.hosts` verbatim as
 * a prop (the 03-03 InventoryView shell is the single estate-view caller).
 * Holds no render-memo hook, no estate-view call, no aggregation-engine
 * import. Composes the generic 03-01 `DataTable` with `esxColumns` and the
 * default-visibility seed built from `esxDefaultVisible`.
 */
export function EsxTable({ hosts }: { hosts: EsxAggregate[] }) {
  const { t } = useTranslation('inventory')
  return (
    <DataTable
      data={hosts}
      columns={esxColumns}
      headerFor={(id) => t(`col.${id}`)}
      objectKind="esx"
      defaultColumnVisibility={esxDefaultVisibility}
    />
  )
}
