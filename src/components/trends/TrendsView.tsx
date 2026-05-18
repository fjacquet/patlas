import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
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

export function TrendsView() {
  const { t } = useTranslation('trends')
  const view = useEstateView('active')
  const trends = view.trends

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={TrendsError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            {trends === null && (
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
        </div>
      </ErrorBoundary>
    </main>
  )
}
