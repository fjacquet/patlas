import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useAllocationHash } from '@/hooks/useAllocationHash'
import { useEstateView } from '@/hooks/useEstateView'
import {
  selectActiveSnapshot,
  selectScenario,
  selectSetScenario,
  selectSetStretchedClusters,
  selectStretchedClusters,
  useSnapshotStore,
} from '@/store/snapshotStore'
import type { AccountingMode, DrMode } from '@/types/estate'
import { AllocationSliders } from '../allocation/AllocationSliders'
import { ClusterDetail } from '../cluster/ClusterDetail'
import { DrSimPanel } from '../dr/DrSimPanel'
import { AccountingModeToggle } from './AccountingModeToggle'
import { CpuReadyPanel } from './CpuReadyPanel'
import { GlobalSummaryCard } from './GlobalSummaryCard'
import { OperationalInsights } from './OperationalInsights'
import { OsBreakdownDonut } from './OsBreakdownDonut'
import { PerClusterColumns } from './PerClusterColumns'

/**
 * Inline error fallback scoped to the dashboard region (T-02-09 / Critical-2).
 * Mirrors `FallbackError.tsx`: reads ONLY `error.message`/`error.name` — never
 * the error object, `cause`, or `stack` (would leak VM names/hostnames). The
 * Phase-1 top-level `<ErrorBoundary>` still wraps `<App>` as the outer net.
 */
function DashboardError({ error }: FallbackProps) {
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

/**
 * Dashboard layout root (DSH-01..06). Owns the accounting-mode state — the
 * ONLY component-level state, a lifted `useState` (A3; NOT a memo hook) —
 * and is the SINGLE `useEstateView(mode)` caller; children receive the
 * derived `EstateView` as plain props.
 *
 * States replace ONLY this region (the Phase-1 sidebar + header stay
 * interactive — UI-SPEC §State scope). Empty state when no snapshot is
 * active; a local `<ErrorBoundary>` renders an inline message-only error.
 * A spurious loading state is intentionally omitted (the upload-in-flight
 * signal is not observable from here — KISS, plan-sanctioned).
 *
 * Layout per UI-SPEC §Layout Contract with `gap-6` region rhythm: toolbar
 * (title + AccountingModeToggle, top-right) → GlobalSummaryCard →
 * OsBreakdownDonut → PerClusterColumns (horizontal scroll) → CpuReadyPanel.
 */
export function GlobalDashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const { t: tStr } = useTranslation('str')
  const [mode, setMode] = useState<AccountingMode>('active')
  const [ratios, setRatios] = useAllocationHash()
  const view = useEstateView(mode, ratios)
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const stretchedClusters = useSnapshotStore(selectStretchedClusters)
  const setStretchedClusters = useSnapshotStore(selectSetStretchedClusters)
  const scenario = useSnapshotStore(selectScenario)
  const setScenario = useSnapshotStore(selectSetScenario)
  const [drMode, setDrMode] = useState<DrMode>('server')
  // RCI drill: in-app view state (like `mode`) — NOT a router, NOT a 2nd memo.
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  // Toggle one cluster's stretched membership. Set is REPLACED (never
  // mutated) so Zustand's Object.is fires and `useEstateView` recomputes.
  const onToggleStretched = (cluster: string) => {
    const next = new Set(stretchedClusters)
    if (next.has(cluster)) next.delete(cluster)
    else next.add(cluster)
    setStretchedClusters(next)
  }

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('states.emptyHeading')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('states.emptyBody')}</p>
        </section>
      </main>
    )
  }

  const capturedDate = snapshot.capturedAt.toLocaleDateString(i18n.language)

  // Drill: a cluster-detail screen replaces the dashboard body when a
  // cluster is selected (one-screen-fit, export-ready for Phase 10).
  const detail = selectedCluster ? view.clusterDetail.get(selectedCluster) : undefined
  if (detail) {
    return (
      <ErrorBoundary FallbackComponent={DashboardError}>
        <ClusterDetail detail={detail} onBack={() => setSelectedCluster(null)} />
      </ErrorBoundary>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={DashboardError}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('sections.summary')}
            </h2>
            <AccountingModeToggle value={mode} onChange={setMode} />
          </div>
          {/* G1: neutral factual estate echo of the user's stretched declarations. */}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {tStr('stretched.estateCount', { count: stretchedClusters.size })}
          </p>
          <AllocationSliders ratios={ratios} onChange={setRatios} />
          <GlobalSummaryCard globals={view.globals} mode={mode} capturedDate={capturedDate} />
          <OperationalInsights insights={view.operationalInsights} />
          <OsBreakdownDonut osBreakdown={view.osBreakdown} />
          <PerClusterColumns
            clusters={view.clusters}
            vmsByCluster={view.vmsByCluster}
            onToggleStretched={onToggleStretched}
            onSelectCluster={setSelectedCluster}
          />
          <CpuReadyPanel globals={view.globals} clusters={view.clusters} />
          {/* 2xl (48px) major break before the DR panel (gap-6 24px + mt-6 24px). */}
          <div className="mt-6">
            <DrSimPanel
              view={view}
              drMode={drMode}
              onDrMode={setDrMode}
              scenario={scenario}
              onScenario={setScenario}
            />
          </div>
        </div>
      </ErrorBoundary>
    </main>
  )
}
