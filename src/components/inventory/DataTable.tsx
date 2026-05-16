import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toCsv } from '@/utils/csv'
import { oneLine } from '@/utils/oneLine'
import { ColumnPicker } from './ColumnPicker'

const ROW_HEIGHT = 36
const FILTER_DEBOUNCE_MS = 150

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  /** Maps a leaf column id to its localized header text (for the CSV header row). */
  headerFor: (id: string) => string
  /** Drives the CSV filename: `vatlas-{objectKind}-{YYYYMMDD}.csv`. */
  objectKind: 'vm' | 'esx' | 'datastore'
  /** Optional default column-visibility seed (ColumnPicker "Reset" restores it). */
  defaultColumnVisibility?: VisibilityState
}

const yyyymmdd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

/**
 * Generic headless, virtualised, sortable + globally-filterable +
 * column-hideable table — the single primitive every Phase-3 object table
 * (VM / ESX / datastore, all wired in 03-02) reuses. DRY-justified by 3 real
 * consumers; no per-object bespoke variant. No in-repo analog
 * (03-PATTERNS "No Analog Found"); built from 03-RESEARCH §Pattern 1 +
 * §Virtualised rows + §Pattern 3 (CSV-of-current-view) + §Pattern 4
 * (debounced global filter, single density).
 *
 * State (sorting / global filter / column visibility) is component `useState`
 * — never a render-memo hook (the lone project memo lives in `useEstateView`;
 * 03-PATTERNS Shared Pattern) and never browser-persisted (column visibility
 * is ephemeral by the privacy invariant; 03-RESEARCH Anti-Pattern).
 *
 * Cell text is rendered as React text children only (auto-escaped — never a
 * raw-HTML sink; T-03-01). Multi-line source values are `oneLine()`-collapsed
 * for the fixed-height row with the ORIGINAL preserved in the cell `title`
 * (Minor-2). The CSV export deliberately uses the RAW row value (no locale,
 * newlines preserved) over `getFilteredRowModel × getVisibleLeafColumns`
 * (INV-05 × INV-06).
 *
 * Not wired into any consumer at 03-01 (App / InventoryView land in 03-03);
 * the `inventory` i18n namespace it references is registered by 03-03, so a
 * missing-namespace at this stage is expected and exercised end-to-end there.
 *
 * Header text is resolved through a SINGLE source of truth — `t('col.'+id)`
 * (the `inventory` namespace bound below) — used identically by the visible
 * `<thead>` and the CSV header row (`headerFor`). The column defs carry the
 * `inventory.col.<id>` key as documentation only; the `<thead>` deliberately
 * does NOT `flexRender(columnDef.header)` (that printed the raw key string —
 * the UAT bug). A column whose `columnDef.header` is a render function (not
 * a string key) keeps the `flexRender` fallback.
 */
export function DataTable<T>({
  data,
  columns,
  headerFor,
  objectKind,
  defaultColumnVisibility = {},
}: DataTableProps<T>) {
  const { t } = useTranslation('inventory')

  // Single header-resolution path shared by the visible <thead> and the
  // CSV header row: `t('col.<id>')`. A column whose def.header is a render
  // function (not a string key) is left to flexRender (none of the current
  // inventory column sets use one — the unified path covers them all).
  const resolveHeader = (columnId: string): string => t(`col.${columnId}`)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility)

  // Debounced reflection of the filter input onto the table's globalFilter
  // state (Pattern 4 — keep filtering off the keystroke path).
  const [filterInput, setFilterInput] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setGlobalFilter(filterInput), FILTER_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [filterInput])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const { rows } = table.getRowModel()
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const exportCsv = () => {
    const cols = table.getVisibleLeafColumns()
    // Same `t('col.<id>')` source of truth as the visible <thead>. The
    // `headerFor` prop is kept for the rare non-`col.*` column (none today)
    // and as the explicit, testable contract the consumers wire.
    const headers = cols.map((c) => headerFor(c.id))
    const csvRows = table.getFilteredRowModel().rows.map((r) =>
      cols.map((c) => {
        const v = r.getValue(c.id)
        return v == null ? '' : String(v)
      }),
    )
    const csv = toCsv(headers, csvRows)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `vatlas-${objectKind}-${yyyymmdd(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleColumns = table.getVisibleLeafColumns()
  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          placeholder={t('filter.placeholder')}
          aria-label={t('filter.placeholder')}
          className="h-10 flex-1 rounded border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <ColumnPicker table={table} onReset={() => setColumnVisibility(defaultColumnVisibility)} />
        <button
          type="button"
          onClick={exportCsv}
          className="flex h-10 items-center rounded bg-primary-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          {t('export.csv')}
        </button>
      </div>

      <div
        ref={scrollRef}
        className="panel relative max-h-[70vh] overflow-auto rounded-md border border-slate-200 dark:border-surface-700"
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-surface-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  // Unified header text: string-key defs resolve via the
                  // shared `t('col.<id>')` path (NEVER the raw key string);
                  // a function header keeps flexRender.
                  const headerDef = header.column.columnDef.header
                  const headerNode =
                    typeof headerDef === 'function'
                      ? flexRender(headerDef, header.getContext())
                      : resolveHeader(header.column.id)
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 dark:border-surface-700 dark:text-slate-300 ${
                        idx === 0 ? 'sticky left-0 z-20 bg-white dark:bg-surface-900' : ''
                      } ${sorted ? 'text-accent-500 dark:text-accent-500' : ''}`}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          {headerNode}
                          <span aria-hidden="true">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        headerNode
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualItems.map((virtualItem) => {
              const row = rows[virtualItem.index]
              if (!row) return null
              return (
                <tr
                  key={row.id}
                  data-index={virtualItem.index}
                  className="absolute flex w-full border-b border-slate-100 dark:border-surface-800"
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell, idx) => {
                    const raw = cell.getValue()
                    const text = raw == null ? '' : String(raw)
                    const display = oneLine(text)
                    return (
                      <td
                        key={cell.id}
                        title={text}
                        className={`flex flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap px-3 text-slate-800 dark:text-slate-200 ${
                          idx === 0 ? 'sticky left-0 z-10 bg-white dark:bg-surface-900' : ''
                        }`}
                      >
                        {cell.column.columnDef.cell
                          ? flexRender(cell.column.columnDef.cell, cell.getContext())
                          : display}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('rows.count', { count: rows.length })} / {visibleColumns.length}
      </p>
    </div>
  )
}
