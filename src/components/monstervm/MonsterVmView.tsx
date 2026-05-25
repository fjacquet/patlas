import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import type { MonsterThresholds, MonsterVm } from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import {
  selectActiveSnapshot,
  selectMonsterThresholds,
  selectSetMonsterThresholds,
  useSnapshotStore,
} from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * P-RS — Monster VMs: read-only presenter of the largest VMs by CONFIGURED
 * allocation (D-00: the extract is `view.monsters`, produced in the single
 * `buildEstateView` pass). Neutral measurement against user-editable vCPU/vRAM
 * lines — no verdict (ADR-0012). Templates excluded; powered-off kept.
 */

const MIB_PER_GIB = 1024

const FIELDS: { key: keyof MonsterThresholds; labelKey: string }[] = [
  { key: 'minVcpu', labelKey: 'thresholds.minVcpu' },
  { key: 'minVramGib', labelKey: 'thresholds.minVramGib' },
]

function MonsterError({ error }: FallbackProps) {
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

export function MonsterVmView() {
  const { t, i18n } = useTranslation('monstervm')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const thresholds = useSnapshotStore(selectMonsterThresholds)
  const setThresholds = useSnapshotStore(selectSetMonsterThresholds)
  const view = useEstateView('active')
  const monsters = view.monsters

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

  const columns: ColumnDef<MonsterVm>[] = [
    { accessorKey: 'vmName', id: 'vmName', header: 'col.vmName', enableHiding: false },
    { accessorKey: 'cluster', id: 'cluster', header: 'col.cluster' },
    { accessorKey: 'host', id: 'host', header: 'col.host' },
    { accessorKey: 'vcpu', id: 'vcpu', header: 'col.vcpu' },
    {
      id: 'vramGib',
      accessorFn: (r) => Math.round(r.vramMib / MIB_PER_GIB),
      header: 'col.vramGib',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      accessorKey: 'poweredOn',
      id: 'poweredOn',
      header: 'col.poweredOn',
      cell: (c) => (c.getValue() ? '✓' : '—'),
    },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={MonsterError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('thresholds.heading')}
            </h3>
            <div className="flex flex-wrap items-end gap-6">
              {FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  {t(f.labelKey)}
                  <input
                    type="number"
                    min={0}
                    value={thresholds[f.key]}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, [f.key]: Number(e.target.value) })
                    }
                    className="w-24 rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900"
                  />
                </label>
              ))}
              <div className="flex flex-col">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('count')}</span>
                <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                  {fmtInt(monsters.count, loc)}
                </span>
              </div>
            </div>
          </section>

          <section className="panel">
            {monsters.count === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('none')}</p>
            ) : (
              <DataTable
                data={monsters.rows}
                columns={columns}
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
