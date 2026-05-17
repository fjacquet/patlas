import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type { AccountingMode } from '@/types/estate'
import { PlannedRatiosControl } from './PlannedRatiosControl'

/**
 * Inline error fallback scoped to the Planning region. Mirrors the dashboard
 * fallback: reads ONLY `error.message` — never the error object, `cause`, or
 * `stack` (would leak VM names/hostnames).
 */
function PlanningError({ error }: FallbackProps) {
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
 * D-04 / D-03 — the explicitly-"planned" Capacity-planning what-if surface.
 * A new top-level ViewToggle branch (no router; view-state is App-shell
 * component state, like P5 Hosts). Hosts the planned-ratios control ABOVE a
 * `2xl` (48px) vertical break, then the reworked DR-sim slot (Plan 03 fills
 * it). Structurally separated from the realized "measured" value (D-03):
 * this surface carries the "planned" qualifier; the measured ratio stays
 * read-only on the Dashboard › Operational Insights (referenced via a
 * read-only caption, never rebuilt or overwritten here — D-01/D-02).
 *
 * Single-memo invariant: `useEstateView` is consumed exactly ONCE here; no
 * second memoization hook, no component-level recompute (presenter only).
 * The `applyPlannedToDr` flag is lifted here as component state (default
 * false) for Plan 03's "Apply planned ratios to this scenario" affordance
 * (D-11).
 */
export function PlanningView() {
  const { t } = useTranslation('alloc')
  const [mode] = useState<AccountingMode>('active')
  const view = useEstateView(mode)
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  // D-11: lifted here for Plan 03's "Apply planned ratios to this scenario"
  // affordance to consume; the DR slot below is wired in Plan 03.
  const [applyPlannedToDr] = useState(false)
  void applyPlannedToDr
  void view

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('planned.emptyHeading')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('planned.emptyBody')}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={PlanningError}>
        <div className="flex flex-col gap-6">
          <PlannedRatiosControl />
          {/* 2xl (48px) major break: D-03 structural separation between the
              planned-ratios block and the DR-sim block. */}
          <div className="mt-12">
            <section className="panel">
              <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                {t('planned.drSlotHeading')}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('planned.drSlotPending')}
              </p>
            </section>
          </div>
        </div>
      </ErrorBoundary>
    </main>
  )
}
