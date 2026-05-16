import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type { AccountingMode, EsxAggregate, VmDisplayRow } from '@/types/estate'
import { DatastoreTable } from './DatastoreTable'
import { EsxTable } from './EsxTable'
import { InventoryTree, type TreeSelection } from './InventoryTree'
import { VmTable } from './VmTable'

/**
 * Inline error fallback scoped to the inventory region (T-03-12 / privacy).
 * Mirrors `GlobalDashboard.tsx`'s `DashboardError`: reads ONLY
 * `error.message`/`error.name` — never the error object, `cause`, or `stack`
 * (would leak VM names/hostnames). The Phase-1 top-level `<ErrorBoundary>`
 * stays the outer net.
 */
function InventoryError({ error }: FallbackProps) {
  const { t } = useTranslation('inventory')
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {t('tree.error')} {message}
      </p>
    </div>
  )
}

type ObjectTab = 'vm' | 'esx' | 'datastore'
const TABS: ReadonlyArray<ObjectTab> = ['vm', 'esx', 'datastore']

/** Group hosts by cluster — plain projection, NOT a render-memo (the only
 *  estate projection already happened inside `useEstateView`). */
function indexHostsByCluster(hosts: EsxAggregate[]): Map<string, EsxAggregate[]> {
  const m = new Map<string, EsxAggregate[]>()
  for (const h of hosts) {
    const list = m.get(h.cluster)
    if (list) list.push(h)
    else m.set(h.cluster, [h])
  }
  return m
}

/** Group projected VM rows by host — plain projection, not a render-memo. */
function indexVmsByHost(vmRows: VmDisplayRow[]): Map<string, VmDisplayRow[]> {
  const m = new Map<string, VmDisplayRow[]>()
  for (const v of vmRows) {
    const list = m.get(v.host)
    if (list) list.push(v)
    else m.set(v.host, [v])
  }
  return m
}

/** Cluster order = first-seen order of `EstateView.clusters` (already the
 *  canonical ordering produced by the single aggregation pass). */
function orderClusters(clusters: { cluster: string }[]): string[] {
  return clusters.map((c) => c.cluster)
}

/**
 * Inventory layout root (INV-01..06). The SINGLE `useEstateView(mode)` caller
 * for the inventory region — children receive derived data as plain props
 * (same lift discipline as `GlobalDashboard`; the project's only `useMemo`
 * lives in `useEstateView`). Owns: accounting mode, tree-selection scope,
 * active object-tab — all component `useState`, none browser-persisted
 * (T-03-11).
 *
 * Two-pane layout: left virtualised tree (`.panel`), right tabbed VM/ESX/
 * Datastore tables, 32px (xl) gap (UI-SPEC §Inventory layout). Tree selection
 * scopes the active table to the selected node's subtree; root/null =
 * unscoped. The Datastore table is cluster-agnostic (Phase-2 NAA dedupe), so
 * tree scoping never narrows it. The inner tab strip reuses the
 * `AccountingModeToggle` `<fieldset role="group"> + aria-pressed` idiom (DRY).
 */
export function InventoryView() {
  const { t } = useTranslation('inventory')
  const [mode] = useState<AccountingMode>('active')
  const [activeTab, setActiveTab] = useState<ObjectTab>('vm')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selection, setSelection] = useState<TreeSelection>({ kind: 'root' })
  const view = useEstateView(mode)
  const snapshot = useSnapshotStore(selectActiveSnapshot)

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('tree.empty')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('tree.emptyBody')}</p>
        </section>
      </main>
    )
  }

  const clustersOrdered = orderClusters(view.clusters)
  const hostsByCluster = indexHostsByCluster(view.hosts)
  const vmsByHost = indexVmsByHost(view.vmRows)

  const onSelect = (id: string, sel: TreeSelection) => {
    setSelectedId(id)
    setSelection(sel)
  }

  // Tree selection scopes VM/ESX tables to the chosen node's subtree; root/
  // null = unscoped. Datastore is cluster-agnostic — never narrowed.
  const scopedVms: VmDisplayRow[] =
    selection.kind === 'host' && selection.host
      ? view.vmRows.filter((v) => v.host === selection.host)
      : selection.kind === 'cluster' && selection.cluster
        ? view.vmRows.filter((v) => v.cluster === selection.cluster)
        : view.vmRows
  const scopedHosts: EsxAggregate[] =
    selection.kind === 'host' && selection.host
      ? view.hosts.filter((h) => h.hostName === selection.host)
      : selection.kind === 'cluster' && selection.cluster
        ? view.hosts.filter((h) => h.cluster === selection.cluster)
        : view.hosts

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={InventoryError}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('nav.inventory')}
            </h2>
            <fieldset
              // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §Three object tables mandates an explicit role="group" + the 03-PATTERNS CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
              role="group"
              aria-label={t('tab.label')}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
            >
              <legend className="sr-only">{t('tab.label')}</legend>
              {TABS.map((tab) => {
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex h-10 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      active
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    aria-pressed={active}
                  >
                    {t(`tab.${tab}`)}
                  </button>
                )
              })}
            </fieldset>
          </div>

          <div className="flex flex-col gap-8 xl:flex-row">
            <section className="panel w-full shrink-0 xl:w-80">
              <h3 className="label mb-2 text-slate-600 dark:text-slate-300">{t('tree.label')}</h3>
              <InventoryTree
                rootLabel={snapshot.vCenterLabel ?? t('tree.root')}
                clustersOrdered={clustersOrdered}
                hostsByCluster={hostsByCluster}
                vmsByHost={vmsByHost}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </section>

            <div className="min-w-0 flex-1">
              {activeTab === 'vm' && <VmTable rows={scopedVms} />}
              {activeTab === 'esx' && <EsxTable hosts={scopedHosts} />}
              {activeTab === 'datastore' && <DatastoreTable datastores={view.datastores} />}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </main>
  )
}
