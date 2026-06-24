import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type { ProxmoxBackupJobRow, ProxmoxHaResourceRow, ProxmoxHaStatusRow } from '@/types'

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

const haResourceColumns: ColumnDef<ProxmoxHaResourceRow>[] = [
  { accessorKey: 'sid', id: 'sid', header: 'col.sid', enableHiding: false },
  { accessorKey: 'type', id: 'type', header: 'col.type' },
  { accessorKey: 'state', id: 'state', header: 'col.state' },
  { accessorKey: 'group', id: 'group', header: 'col.group' },
]

const haServiceColumns: ColumnDef<ProxmoxHaStatusRow>[] = [
  { accessorKey: 'id', id: 'id', header: 'col.id', enableHiding: false },
  { accessorKey: 'type', id: 'type', header: 'col.type' },
  { accessorKey: 'status', id: 'status', header: 'col.status' },
  { accessorKey: 'node', id: 'node', header: 'col.node' },
]

const backupJobColumns: ColumnDef<ProxmoxBackupJobRow>[] = [
  { accessorKey: 'id', id: 'id', header: 'col.id', enableHiding: false },
  {
    accessorKey: 'enabled',
    id: 'enabled',
    header: 'col.enabled',
    cell: (c) => (c.getValue() ? '✓' : '—'),
  },
  { accessorKey: 'mode', id: 'mode', header: 'col.mode' },
  { accessorKey: 'storage', id: 'storage', header: 'col.storage' },
  { accessorKey: 'schedule', id: 'schedule', header: 'col.schedule' },
  { accessorKey: 'node', id: 'node', header: 'col.node' },
]

export function ClusterHealthView() {
  const { t } = useTranslation('clusterhealth')
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const ch = view.clusterHealth

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

  const kpis: { key: string; value: string }[] = [
    { key: 'quorum', value: ch.ha.quorumStatus ?? t('na') },
    { key: 'fencing', value: ch.ha.fencingStatus ?? t('na') },
    { key: 'managed', value: String(ch.ha.managedCount) },
    { key: 'jobs', value: String(ch.backups.jobCount) },
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
              {t('services.heading')}
            </h3>
            <DataTable
              data={ch.ha.services}
              columns={haServiceColumns}
              headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
              objectKind="vm"
            />
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('ha.heading')}
            </h3>
            {ch.ha.managedCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('ha.none')}</p>
            ) : (
              <DataTable
                data={ch.ha.resources}
                columns={haResourceColumns}
                headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
                objectKind="vm"
              />
            )}
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('backups.heading')}
            </h3>
            {ch.backups.jobCount === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('backups.none')}</p>
            ) : (
              <DataTable
                data={ch.backups.jobs}
                columns={backupJobColumns}
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
