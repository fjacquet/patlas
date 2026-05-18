import type { EChartsOption } from 'echarts/types/dist/shared'
import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, selectThresholds, useSnapshotStore } from '@/store/snapshotStore'
import { Chart } from '../Chart'
import { datastoreColumns } from '../inventory/columns/datastoreColumns'
import { DataTable } from '../inventory/DataTable'
import { DatastoreDetail } from './DatastoreDetail'
import { StorageLensToggle } from './StorageLensToggle'
import { ThresholdConfig } from './ThresholdConfig'
import { VmDetail } from './VmDetail'

type Scope = 'cluster' | 'esx' | 'vm' | 'datastore'
const SCOPES: ReadonlyArray<Scope> = ['cluster', 'esx', 'vm', 'datastore']

function StorageError({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:bg-surface-800">
      <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
    </div>
  )
}

/**
 * P9 Storage view shell (D-05..D-08). The single `useEstateView` consumer;
 * lifted `useState` for scope / lens / the drilled datastore-or-VM (the
 * `GlobalDashboard` pattern — NOT a router, NOT a second `useMemo`). The
 * lens toggle switches the treemap (consumption) ↔ stacked-bar (capacity)
 * through the single `<Chart>` SVG site. Threshold flags surface as a
 * FACTUAL count line + the gold row marker in the drill screens — no
 * status colour scale, no verdict (D-04). Unrelinkable blank-cluster datastores
 * render the em-dash in the drill (never a fabricated cluster).
 */
export function StorageView() {
  const { t } = useTranslation('storage')
  const { t: tA } = useTranslation('alerts')
  const view = useEstateView('active')
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const thresholds = useSnapshotStore(selectThresholds)
  const [lens, setLens] = useState<'consumption' | 'capacity'>('consumption')
  const [scope, setScope] = useState<Scope>('datastore')
  const [drilledDs, setDrilledDs] = useState<string | null>(null)
  const [drilledVm, setDrilledVm] = useState<string | null>(null)

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('detail.back')}</p>
        </section>
      </main>
    )
  }

  const dsDetail = drilledDs ? view.datastoreDetail.get(drilledDs) : undefined
  if (dsDetail) {
    return (
      <ErrorBoundary FallbackComponent={StorageError}>
        <DatastoreDetail detail={dsDetail} onBack={() => setDrilledDs(null)} />
      </ErrorBoundary>
    )
  }
  const vmDetail = drilledVm ? view.vmDetail.get(drilledVm) : undefined
  if (vmDetail) {
    return (
      <ErrorBoundary FallbackComponent={StorageError}>
        <VmDetail detail={vmDetail} onBack={() => setDrilledVm(null)} />
      </ErrorBoundary>
    )
  }

  const s = view.storage
  const consumptionGroups =
    scope === 'cluster'
      ? s.byCluster
      : scope === 'esx'
        ? s.byEsx
        : scope === 'vm'
          ? s.byVm
          : s.byDatastore

  const option: EChartsOption =
    lens === 'consumption'
      ? {
          tooltip: {},
          series: [
            {
              type: 'treemap',
              breadcrumb: { show: false },
              data: consumptionGroups.map((g) => ({
                name: g.key,
                value: g.provisionedMib as number,
              })),
            },
          ],
        }
      : {
          tooltip: {},
          legend: {},
          grid: { left: 80, right: 24, top: 24, bottom: 48 },
          xAxis: { type: 'category', data: s.capacityByDatastore.map((d) => d.name) },
          yAxis: { type: 'value' },
          series: [
            {
              name: t('detail.used'),
              type: 'bar',
              stack: 'cap',
              data: s.capacityByDatastore.map((d) => d.usedMib as number),
            },
            {
              name: t('detail.free'),
              type: 'bar',
              stack: 'cap',
              data: s.capacityByDatastore.map((d) => d.freeMib as number),
            },
          ],
        }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={StorageError}>
        <div className="flex flex-col gap-6">
          <ThresholdConfig />

          <div className="flex flex-wrap items-center gap-4">
            <StorageLensToggle value={lens} onChange={setLens} />
            <fieldset
              // biome-ignore lint/a11y/noRedundantRoles: explicit role="group" mirrors the shipped segmented-control idiom; CI grep gate asserts the literal
              role="group"
              aria-label={t('scope.label')}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <legend className="sr-only">{t('scope.label')}</legend>
              {SCOPES.map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setScope(sc)}
                  aria-pressed={scope === sc}
                  className={`flex h-10 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    scope === sc
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t(`scope.${sc}`)}
                </button>
              ))}
            </fieldset>
          </div>

          {/* Factual threshold counts (D-04) — no verdict, no colour. */}
          <p className="text-[12px] font-normal text-slate-500 dark:text-slate-400">
            {tA('fs.count', { count: view.flags.counts.fs, pct: thresholds.fsUsedPct })}
            {' · '}
            {tA('ds.count', { count: view.flags.counts.ds, pct: thresholds.dsUsedPct })}
            {' · '}
            {tA('lu.count', { count: view.flags.counts.lu, pct: thresholds.luUsedPct })}
          </p>

          <Chart option={option} style={{ height: 360 }} ariaLabel={t(`lens.${lens}`)} />

          {/* Drill entry points (the row/name IS the affordance, keyboard-activatable). */}
          {scope === 'vm' ? (
            <div className="flex flex-wrap gap-2">
              {consumptionGroups.slice(0, 200).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setDrilledVm(g.key)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:text-slate-300 dark:hover:bg-surface-800"
                >
                  {g.key}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {s.capacityByDatastore.slice(0, 200).map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDrilledDs(d.key)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:text-slate-300 dark:hover:bg-surface-800"
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          <DataTable
            data={view.datastores}
            columns={datastoreColumns}
            headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
            objectKind="datastore"
          />
        </div>
      </ErrorBoundary>
    </main>
  )
}
