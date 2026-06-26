import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { singleFileTrendOption } from '@/components/rrd/rrdChartOptions'
import { useEstateView } from '@/hooks/useEstateView'
import type { RrdHeadroom } from '@/types/estate'
import { DeltaPanel } from './DeltaPanel'
import { TrendChart } from './TrendChart'

/**
 * P8 In-Session Trends — read-only presenter (D-00: no computation, no
 * second memo site; `view.trends` is produced in the single
 * `buildEstateView` pass). Factual only: no editorial verb, no verdict
 * colour. Verbatim EosView shell + message-only region error boundary.
 */
function TrendsError({ error }: FallbackProps) {
  const { t } = useTranslation('trends')
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-slate-300 bg-white p-6 dark:border-surface-700 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">{t('error', { message })}</p>
    </div>
  )
}

/**
 * Single-file trends (P8 Pack A): when fewer than two snapshots are loaded the
 * cross-snapshot series is `null`, but a single export's RRD time-series still
 * yields an intra-file estate-utilization trend. Rendered from
 * `view.rrdHeadroom.timeline` — guards the multi-snapshot path (it only shows
 * when that path produced nothing). Uses the `rrd` namespace.
 */
function SingleFileTrends({ headroom }: { headroom: RrdHeadroom }) {
  const { t } = useTranslation('rrd')
  const option = singleFileTrendOption(headroom.timeline, {
    cpu: t('single.series.cpu'),
    mem: t('single.series.mem'),
  })
  return (
    <>
      <section className="panel">
        <h3 className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('single.heading')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('single.note')}</p>
      </section>
      <section className="panel">
        <Chart option={option} ariaLabel={t('single.chartTitle')} />
      </section>
    </>
  )
}

export function TrendsView() {
  const { t } = useTranslation('trends')
  const view = useEstateView('active')
  const trends = view.trends
  // Single-file fallback only when the cross-snapshot series is absent AND the
  // export carries an RRD timeline (never both — the multi-snapshot path wins).
  const singleFile =
    trends === null && view.rrdHeadroom.timeline.length > 0 ? view.rrdHeadroom : null

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={TrendsError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            {trends === null && singleFile === null && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
            )}
            {trends?.orderInferred && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('orderInferred')}</p>
            )}
          </section>

          {trends !== null && (
            <>
              <section className="panel">
                <TrendChart trends={trends} />
              </section>
              <DeltaPanel deltas={trends.deltas} />
            </>
          )}

          {singleFile !== null && <SingleFileTrends headroom={singleFile} />}
        </div>
      </ErrorBoundary>
    </main>
  )
}
