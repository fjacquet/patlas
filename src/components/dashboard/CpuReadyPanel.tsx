import { useTranslation } from 'react-i18next'
import type { ClusterAggregate, GlobalSummary } from '@/types/estate'
import { fmtInt, fmtPercentValue } from '@/utils/format'

export interface CpuReadyPanelProps {
  globals: GlobalSummary
  /** Clusters drive the estate mean/max rollup (presentational only). */
  clusters: ClusterAggregate[]
}

/**
 * DSH-05 — estate CPU Ready roll-up `.panel`. Presentational prop-consumer
 * (no memo hooks, no engine/store imports).
 *
 * Report-integrity rule (Pitfall 6 / ADR-0012): readiness ABSENCE is
 * branched explicitly.
 * When no cluster reports readiness (`globals.vmsAboveReadinessWarning` is
 * `null` — never collapsed to 0), the localized "not reported" (12px micro,
 * slate-500) is rendered — NEVER `0 %`, NEVER a status color, NEVER a hidden
 * row.
 *
 * The "VMs > 5% CPU Ready" count is THE single accent-gold figure (UI-SPEC
 * §Color closed list — 16px semibold mono). The 5% line is a neutral factual
 * VMware-documented reference, NOT a verdict: factual labels only per
 * ADR-0003, no pass/fail color framing.
 */
export function CpuReadyPanel({ globals, clusters }: CpuReadyPanelProps) {
  const { t, i18n } = useTranslation('dashboard')
  const loc = i18n.language

  const reporting = clusters.filter((c) => c.readinessAvailable)
  const available = globals.vmsAboveReadinessWarning !== null && reporting.length > 0

  const means = reporting
    .map((c) => c.meanCpuReadinessPercent)
    .filter((v): v is number => v !== null)
  const maxes = reporting
    .map((c) => c.maxCpuReadinessPercent)
    .filter((v): v is number => v !== null)

  const meanVal = means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : null
  const maxVal = maxes.length > 0 ? maxes.reduce((a, b) => (b > a ? b : a), -Infinity) : null

  const notReported = (
    <span className="text-xs text-slate-500 dark:text-slate-400">{t('cpuReadyNotReported')}</span>
  )

  return (
    <section className="panel">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('sections.cpuReady')}
      </h2>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('stats.cpuReadyMean')}
          </dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {available && meanVal !== null ? fmtPercentValue(meanVal, loc) : notReported}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('stats.cpuReadyMax')}
          </dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {available && maxVal !== null ? fmtPercentValue(maxVal, loc) : notReported}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('stats.vmsAboveReady')}
          </dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-accent-500">
            {available ? fmtInt(globals.vmsAboveReadinessWarning as number, loc) : notReported}
          </dd>
        </div>
      </dl>
    </section>
  )
}
