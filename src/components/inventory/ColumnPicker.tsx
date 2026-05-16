import type { Table } from '@tanstack/react-table'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface ColumnPickerProps<T> {
  table: Table<T>
  /**
   * The default-visible set to restore on "Reset" — a map of leaf column id →
   * visible boolean. Visibility is owned by `DataTable`'s ephemeral component
   * state, never browser-persisted (03-RESEARCH Anti-Pattern / privacy invariant).
   */
  onReset: () => void
}

/**
 * INV-06 show/hide column popover. Anchored on 03-RESEARCH §Column visibility
 * (lines 293-300); the a11y / Tailwind idiom (`<fieldset>`-free button +
 * keyboard + `dark:`-paired colors + `focus-visible:ring-2 ring-primary-500`)
 * is lifted from `ThemeToggle.tsx` / `AccountingModeToggle.tsx`.
 *
 * A "Columns" toolbar button (icon + label) opens a popover listing every
 * hideable leaf column (`getCanHide()` — identity columns set
 * `enableHiding:false` in their ColumnDef, added by 03-02, and are excluded
 * automatically) as a checkbox calling `column.toggleVisibility()`. Applies
 * immediately. Closes on Escape or outside click. "Reset" restores the
 * default visible set via the `onReset` callback owned by `DataTable`.
 *
 * Visibility state is ephemeral component state in `DataTable` — this
 * component is a pure controlled view over `table`; it persists nothing.
 */
export function ColumnPicker<T>({ table, onReset }: ColumnPickerProps<T>) {
  const { t } = useTranslation('inventory')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide())

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className="flex h-10 items-center gap-1.5 rounded border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <svg
          role="img"
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{t('columns.button')}</title>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </svg>
        <span>{t('columns.button')}</span>
      </button>
      {open && (
        <fieldset
          id={popoverId}
          aria-label={t('columns.label')}
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-surface-700 dark:bg-surface-900"
        >
          <legend className="sr-only">{t('columns.label')}</legend>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {hideableColumns.map((column) => (
              <li key={column.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-surface-800">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={() => column.toggleVisibility()}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-600"
                  />
                  <span>{t(`columns.${column.id}`, column.id)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onReset}
            className="mt-1.5 w-full rounded px-2 py-1.5 text-left text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-surface-800"
          >
            {t('columns.reset')}
          </button>
        </fieldset>
      )}
    </div>
  )
}
