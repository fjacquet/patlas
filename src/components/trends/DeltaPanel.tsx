import { useTranslation } from 'react-i18next'
import type { TrendDelta } from '@/types/estate'
import { fmtDate, fmtInt } from '@/utils/format'

/**
 * Factual consecutive-pair delta rows (DD-B B1 / TRD-04). Signed branded
 * numbers, em-dash sentinel when a value is not finite; NO colour, NO
 * editorial verb, NO up/down arrow (UI-SPEC §Color/Copywriting). Plain
 * prop-consumer of the memoized series.
 */
const signed = (n: number, loc: string): string =>
  Number.isFinite(n) ? `${n >= 0 ? '+' : '−'}${fmtInt(Math.abs(n), loc)}` : '—'

export function DeltaPanel({ deltas }: { deltas: TrendDelta[] }) {
  const { t, i18n } = useTranslation('trends')
  const loc = i18n.language
  if (deltas.length === 0) return null

  const metrics: { key: string; of: (d: TrendDelta) => number }[] = [
    { key: 'vmCount', of: (d) => d.vmCount },
    { key: 'poweredOnVms', of: (d) => d.poweredOnVms },
    { key: 'hostCount', of: (d) => d.hostCount },
    { key: 'clusterCount', of: (d) => d.clusterCount },
    { key: 'vcpuAllocated', of: (d) => d.vcpuAllocated },
    { key: 'vramAllocated', of: (d) => d.vramAllocatedGib as number },
    { key: 'totalStorage', of: (d) => d.totalStorageGib as number },
  ]

  return (
    <section className="panel">
      <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
        {t('delta.heading')}
      </h3>
      <div className="flex flex-col gap-4">
        {deltas.map((d) => (
          <div key={`${d.from.toISOString()}-${d.to.toISOString()}`}>
            <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">
              {fmtDate(d.from.toISOString(), loc)} → {fmtDate(d.to.toISOString(), loc)}
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-baseline justify-between gap-2">
                  <dt className="text-sm text-slate-700 dark:text-slate-300">
                    {t(`delta.${m.key}`)}
                  </dt>
                  <dd className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
                    {signed(m.of(d), loc)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
