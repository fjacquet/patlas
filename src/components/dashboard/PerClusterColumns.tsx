import { useTranslation } from 'react-i18next'
import type { ClusterAggregate, OsBreakdown, TrendSeries } from '@/types/estate'
import { ClusterColumn } from './ClusterColumn'

const EMPTY_OS: OsBreakdown = { windows: 0, linux: 0, other: 0 }

export interface PerClusterColumnsProps {
  clusters: ClusterAggregate[]
  /** Per-cluster OS breakdown keyed by cluster name (EstateView.vmsByCluster). */
  vmsByCluster: Map<string, OsBreakdown>
  /** Forwarded to each column's stretched pill (STR-01). */
  onToggleStretched: (cluster: string) => void
  /** Forwarded to each column's drill affordance (RCI cluster detail). */
  onSelectCluster: (cluster: string) => void
  /** P8 trend series, forwarded to each column for its sparkline. */
  trends?: TrendSeries | null
}

/**
 * DSH-01 — single horizontal-scroll flex row, one `<ClusterColumn>` per
 * cluster in the engine's stable localeCompare order. Does NOT reflow to a
 * vertical list (UI-SPEC §Layout — RVTools-admin headline reading pattern).
 * Presentational prop-consumer (no memo hooks, no engine/store imports — the
 * `useEstateView` output is passed down by `GlobalDashboard`).
 */
export function PerClusterColumns({
  clusters,
  vmsByCluster,
  onToggleStretched,
  onSelectCluster,
  trends,
}: PerClusterColumnsProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('sections.clusters')}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {clusters.map((cluster) => (
          <ClusterColumn
            key={cluster.cluster}
            cluster={cluster}
            os={vmsByCluster.get(cluster.cluster) ?? EMPTY_OS}
            onToggleStretched={onToggleStretched}
            onSelectCluster={onSelectCluster}
            trends={trends}
          />
        ))}
      </div>
    </section>
  )
}
