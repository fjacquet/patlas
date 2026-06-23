import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import { StatTile } from '@/components/StatTile'
import type { SnapshotSprawlRow } from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * Snapshot Sprawl view — neutral read-only presenter of guest checkpoints
 * still held across the estate. No verdict, no severity (ADR-0012).
 * Reads `view.snapshotSprawl` produced by the single `buildEstateView` pass.
 */

const MIB_PER_GIB = 1024

function SprawlError({ error }: FallbackProps) {
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

export function SnapshotSprawlView() {
  const { t, i18n } = useTranslation('snapshots')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const sprawl = view.snapshotSprawl

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

  const totalSizeGib = Math.round((sprawl.totalSizeMib as number) / MIB_PER_GIB)

  const columns: ColumnDef<SnapshotSprawlRow>[] = [
    { accessorKey: 'guestName', id: 'guestName', header: 'col.guestName', enableHiding: false },
    { accessorKey: 'guestType', id: 'guestType', header: 'col.guestType' },
    { accessorKey: 'node', id: 'node', header: 'col.node' },
    { accessorKey: 'name', id: 'name', header: 'col.name' },
    {
      accessorKey: 'ageDays',
      id: 'ageDays',
      header: 'col.ageDays',
      cell: (c) => {
        const v = c.getValue() as number | null
        return v === null ? '—' : fmtInt(v, loc)
      },
    },
    {
      id: 'sizeGib',
      accessorFn: (r) => Math.round((r.sizeMib as number) / MIB_PER_GIB),
      header: 'col.sizeGib',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      accessorKey: 'includeRam',
      id: 'includeRam',
      header: 'col.includeRam',
      cell: (c) => (c.getValue() ? '✓' : '—'),
    },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={SprawlError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </section>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label={t('kpi.checkpoints')}
              value={fmtInt(sprawl.count, loc)}
              accent="neutral"
            />
            <StatTile
              label={t('kpi.guests')}
              value={fmtInt(sprawl.guestsWithSnapshots, loc)}
              accent="neutral"
            />
            <StatTile
              label={t('kpi.totalSizeGib')}
              value={fmtInt(totalSizeGib, loc)}
              accent="neutral"
            />
            <StatTile
              label={t('kpi.oldestDays')}
              value={sprawl.oldestAgeDays === null ? '—' : fmtInt(sprawl.oldestAgeDays, loc)}
              accent="neutral"
            />
          </section>

          <section className="panel">
            {sprawl.count === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('none')}</p>
            ) : (
              <DataTable
                data={sprawl.rows}
                columns={columns}
                headerFor={(id) => t(`col.${id}`)}
                objectKind="vm"
              />
            )}
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
