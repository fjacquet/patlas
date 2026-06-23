import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import type { BackupFileRow, StorageContentTypeGroup, StorageGroup } from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * Plan 3B — Storage Content: read-only presenter of `view.storageContent`
 * (produced in the single `buildEstateView` pass). Neutral measurement — no
 * verdict (ADR-0012).
 */

const MIB_PER_GIB = 1024

function ViewError({ error }: FallbackProps) {
  const { t } = useTranslation('dashboard')
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">{t('states.error', { message })}</p>
    </div>
  )
}

export function StorageContentView() {
  const { t, i18n } = useTranslation('storagecontent')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const sc = view.storageContent

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('heading')}
          </h2>
          <strong className="block text-slate-700 dark:text-slate-200">{t('empty.heading')}</strong>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.body')}</p>
        </section>
      </main>
    )
  }

  const gib = (m: number) => fmtInt(Math.round(m / MIB_PER_GIB), loc)

  const contentColumns: ColumnDef<StorageContentTypeGroup>[] = [
    { accessorKey: 'content', id: 'content', header: 'col.content', enableHiding: false },
    {
      accessorKey: 'count',
      id: 'count',
      header: 'col.count',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      id: 'sizeGib',
      accessorFn: (r) => r.totalSizeMib,
      header: 'col.sizeGib',
      cell: (c) => gib(c.getValue() as number),
    },
  ]

  const storageColumns: ColumnDef<StorageGroup>[] = [
    { accessorKey: 'storage', id: 'storage', header: 'col.storage', enableHiding: false },
    {
      accessorKey: 'count',
      id: 'count',
      header: 'col.count',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      id: 'sizeGib',
      accessorFn: (r) => r.totalSizeMib,
      header: 'col.sizeGib',
      cell: (c) => gib(c.getValue() as number),
    },
  ]

  const backupColumns: ColumnDef<BackupFileRow>[] = [
    { accessorKey: 'guestName', id: 'guestName', header: 'col.guestName', enableHiding: false },
    { accessorKey: 'storage', id: 'storage', header: 'col.storage' },
    { accessorKey: 'fileName', id: 'fileName', header: 'col.fileName' },
    {
      accessorKey: 'ageDays',
      id: 'ageDays',
      header: 'col.ageDays',
      cell: (c) => {
        const v = c.getValue<number | null>()
        return v === null ? '—' : fmtInt(v, loc)
      },
    },
    {
      id: 'sizeGib',
      accessorFn: (r) => r.sizeMib,
      header: 'col.sizeGib',
      cell: (c) => gib(c.getValue() as number),
    },
  ]

  const kpis: { key: string; value: string }[] = [
    { key: 'totalSize', value: gib(sc.totalSizeMib) },
    { key: 'files', value: fmtInt(sc.fileCount, loc) },
    { key: 'contentTypes', value: fmtInt(sc.byContent.length, loc) },
    { key: 'backups', value: fmtInt(sc.backups.count, loc) },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={ViewError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </section>

          <section className="panel">
            <div className="flex flex-wrap items-end gap-8">
              {kpis.map((k) => (
                <div key={k.key} className="flex flex-col">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t(`kpi.${k.key}`)}
                  </span>
                  <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                    {k.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('byContent')}
            </h3>
            <DataTable
              data={sc.byContent}
              columns={contentColumns}
              headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
              objectKind="vm"
            />
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('byStorage')}
            </h3>
            <DataTable
              data={sc.byStorage}
              columns={storageColumns}
              headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
              objectKind="vm"
            />
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('backups.heading')}
            </h3>
            {sc.backups.count === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('backups.none')}</p>
            ) : (
              <DataTable
                data={sc.backups.rows}
                columns={backupColumns}
                headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
                objectKind="vm"
              />
            )}
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
