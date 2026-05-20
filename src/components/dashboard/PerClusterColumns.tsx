import { useTranslation } from 'react-i18next'
import { StretchedPill } from '@/components/stretched/StretchedPill'
import type { ClusterAggregate, OsBreakdown, TrendSeries } from '@/types/estate'
import { fmtInt, fmtPercentValue, fmtRatio } from '@/utils/format'

export interface PerClusterColumnsProps {
  clusters: ClusterAggregate[]
  /** Per-cluster OS breakdown (unused in the row layout; kept for the API). */
  vmsByCluster: Map<string, OsBreakdown>
  /** Forwarded to each row's stretched pill (STR-01). */
  onToggleStretched: (cluster: string) => void
  /** Forwarded to each row's drill affordance (RCI cluster detail). */
  onSelectCluster: (cluster: string) => void
  /** P8 trend series (unused in the row layout; kept for the API). */
  trends?: TrendSeries | null
}

/**
 * DSH-01 — per-cluster overview as a scannable TABLE (one row per cluster),
 * replacing the previous tall horizontal-scroll columns (user feedback: rows
 * are easier to read than vertical columns). Each row carries the headline
 * metrics + the stretched toggle + a drill link. Presentational prop-consumer
 * (no memo hooks, no engine/store imports — `useEstateView` output is passed
 * down by `GlobalDashboard`). Section keeps the `<h2>Clusters` title.
 */
export function PerClusterColumns({
  clusters,
  onToggleStretched,
  onSelectCluster,
}: PerClusterColumnsProps) {
  const { t, i18n } = useTranslation('dashboard')
  const { t: tRci } = useTranslation('rci')
  const { t: tStr } = useTranslation('str')
  const loc = i18n.language
  const notReported = t('cpuReadyNotReported')

  const num =
    'px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100'
  const th = 'px-3 py-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400'

  const stretchedCount = clusters.filter((c) => c.stretched).length

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
          {t('sections.clusters')}
        </h2>
        {/* Stretched count co-located with the per-row toggles (vsizer-style
            central management) — updates as you toggle a row. */}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {tStr('stretched.estateCount', { count: stretchedCount })}
        </p>
      </div>
      <div className="panel overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-surface-700">
              <th className={`${th} text-left`}>{t('sections.clusters')}</th>
              <th className={th}>{t('stats.esx')}</th>
              <th className={th}>{t('stats.vms')}</th>
              <th className={th}>{t('stats.cpuPct')}</th>
              <th className={th}>{t('stats.ramPct')}</th>
              <th className={th}>{t('stats.vcpuPerCore')}</th>
              <th className={th}>{t('stats.cpuReadyMean')}</th>
              <th className={`${th} text-center`}>{tStr('pill.label')}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => (
              <tr
                key={c.cluster}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
              >
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                  {c.cluster}
                </td>
                <td className={num}>{fmtInt(c.hostCount, loc)}</td>
                <td className={num}>{fmtInt(c.vmCount, loc)}</td>
                <td className={num}>{fmtPercentValue(c.meanCpuRatio * 100, loc)}</td>
                <td className={num}>{fmtPercentValue(c.meanRamRatio * 100, loc)}</td>
                <td className={num}>{fmtRatio(c.vcpuPerPcpu, loc)}</td>
                <td className={num}>
                  {c.readinessAvailable && c.meanCpuReadinessPercent !== null
                    ? fmtPercentValue(c.meanCpuReadinessPercent, loc)
                    : notReported}
                </td>
                <td className="px-3 py-2 text-center">
                  <StretchedPill
                    value={c.stretched}
                    onChange={() => onToggleStretched(c.cluster)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onSelectCluster(c.cluster)}
                    className="rounded px-2 py-0.5 text-xs font-semibold text-primary-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-surface-800"
                  >
                    {tRci('detail.title')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
