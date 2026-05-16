import { useTranslation } from 'react-i18next'
import type { VmDisplayRow } from '@/types/estate'
import { vmColumns } from './columns/vmColumns'
import { DataTable } from './DataTable'

/**
 * INV-02 VM table wrapper. Thin: receives the projected `vmRows` slice as
 * a prop (the 03-03 InventoryView shell is the single estate-view caller —
 * same lift discipline as `GlobalDashboard`). Holds no render-memo hook,
 * no estate-view call, no aggregation-engine import. Composes the generic
 * 03-01 `DataTable` with `vmColumns`. Every `VmDisplayRow` field is
 * default-visible (it is already the lean 8-field projection), so no
 * default-visibility seed is needed. `headerFor` resolves the
 * `inventory.col.<id>` keys (namespace registered + exercised in 03-03).
 */
export function VmTable({ rows }: { rows: VmDisplayRow[] }) {
  const { t } = useTranslation('inventory')
  return (
    <DataTable data={rows} columns={vmColumns} headerFor={(id) => t(`col.${id}`)} objectKind="vm" />
  )
}
