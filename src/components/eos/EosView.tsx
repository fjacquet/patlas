import type { ColumnDef } from '@tanstack/react-table'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { DataTable } from '@/components/inventory/DataTable'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type { EosRow } from '@/types/estate'
import { fmtDate, fmtInt } from '@/utils/format'

const DAY_MS = 86_400_000
const STALE_DAYS = 90

/** The six peer tiles (cumulative ≤+N overlay + overdue + unknown). */
type TileKey = 'overdue' | 'w3' | 'w6' | 'w9' | 'w12' | 'unknown'
const TILES: TileKey[] = ['overdue', 'w3', 'w6', 'w9', 'w12', 'unknown']

/**
 * Inline error fallback scoped to the EOS region. Reads ONLY
 * `error.message` (never the error object/cause/stack — would leak VM
 * names/hostnames). Mirrors the PlanningView fallback.
 */
function EosError({ error }: FallbackProps) {
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
 * P7 OS End-of-Support forecast — read-only presenter (D-00: no
 * computation, no second memo site; the projection is `view.eos`,
 * produced in the single `buildEstateView` pass). Factual only: no
 * editorial verb, no verdict colour, no status icon; the em-dash sentinel
 * is the only "not determinable" marker (D-09c). The bucket strip is the
 * primary visual; the chart is secondary; host vs VM cardinality is never
 * conflated (D-09b).
 */
export function EosView() {
  const { t, i18n } = useTranslation('eos')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const eos = view.eos
  const [selected, setSelected] = useState<TileKey>('overdue')

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('heading')}
          </h2>
        </section>
      </main>
    )
  }

  const p = eos.partition
  const vmTotal =
    p.overdue.length +
    p.w3.length +
    p.w3to6.length +
    p.w6to9.length +
    p.w9to12.length +
    p.beyond12.length +
    p.unknown.length

  const todayMs = Date.parse(eos.reference.today)
  const verifiedMs = Date.parse(eos.reference.lastVerified)
  const isStale =
    !Number.isNaN(todayMs) &&
    !Number.isNaN(verifiedMs) &&
    (todayMs - verifiedMs) / DAY_MS > STALE_DAYS

  // Cumulative ≤+N display counts, derived from the disjoint partition
  // (Open Item 2 — reconciliation uses the partition, never this overlay).
  const tileCount: Record<TileKey, number> = {
    overdue: eos.cumulative.overdue,
    w3: eos.cumulative.le3,
    w6: eos.cumulative.le6,
    w9: eos.cumulative.le9,
    w12: eos.cumulative.le12,
    unknown: eos.cumulative.unknown,
  }

  // Drill rows for an entity tile = the cumulative ≤+N set, assembled from
  // the disjoint partition (overdue ⊆ ≤3 ⊆ ≤6 ⊆ ≤9 ⊆ ≤12).
  const drillRows = (key: TileKey): EosRow[] => {
    switch (key) {
      case 'overdue':
        return p.overdue
      case 'w3':
        return [...p.overdue, ...p.w3]
      case 'w6':
        return [...p.overdue, ...p.w3, ...p.w3to6]
      case 'w9':
        return [...p.overdue, ...p.w3, ...p.w3to6, ...p.w6to9]
      case 'w12':
        return [...p.overdue, ...p.w3, ...p.w3to6, ...p.w6to9, ...p.w9to12]
      default:
        return []
    }
  }

  const eosColumns: ColumnDef<EosRow>[] = [
    { accessorKey: 'vmName', id: 'vmName', header: 'col.vmName', enableHiding: false },
    { accessorKey: 'cluster', id: 'cluster', header: 'col.cluster' },
    { accessorKey: 'host', id: 'host', header: 'col.host' },
    { accessorKey: 'os', id: 'os', header: 'col.os' },
    {
      accessorKey: 'eolFrom',
      id: 'eolFrom',
      header: 'col.eolFrom',
      cell: (c) => fmtDate(String(c.getValue() ?? ''), loc),
    },
  ]

  const chartOption: EChartsOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: [
        t('bucket.overdue'),
        t('bucket.w3'),
        t('bucket.w6'),
        t('bucket.w9'),
        t('bucket.w12'),
        t('bucket.unknown'),
      ],
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: [
          p.overdue.length,
          p.w3.length,
          p.w3to6.length,
          p.w6to9.length,
          p.w9to12.length,
          p.unknown.length,
        ],
      },
    ],
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={EosError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('asOf', { today: fmtDate(eos.reference.today, loc) })}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('verified', { date: fmtDate(eos.reference.lastVerified, loc) })}
            </p>
            {isStale && <p className="text-sm text-slate-500 dark:text-slate-400">{t('stale')}</p>}
          </section>

          <section className="panel">
            <div className="flex flex-wrap gap-3">
              {TILES.map((key) => {
                const label = t(`bucket.${key}`)
                const count = tileCount[key]
                const active = selected === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    aria-pressed={active}
                    aria-label={t('drill', { label, count })}
                    className={`flex h-20 min-w-[8rem] flex-col items-start justify-center rounded-md border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      active
                        ? 'border-primary-500 bg-slate-100 ring-2 ring-primary-500 dark:bg-surface-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {label}
                    </span>
                    <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtInt(count, loc)}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {t('reconcile', { total: fmtInt(vmTotal, loc), bucketed: fmtInt(vmTotal, loc) })}
              {' · '}
              {t('split', {
                vms: fmtInt(vmTotal, loc),
                hosts: fmtInt(eos.nodes.hosts.length, loc),
              })}
            </p>
          </section>

          <section className="panel">
            <Chart option={chartOption} ariaLabel={t('heading')} />
          </section>

          <section className="panel">
            {selected === 'unknown' ? (
              <>
                <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
                  {t('unknownHeading')}
                </h3>
                <table className="w-full text-left text-sm">
                  <tbody className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {eos.rawUnknown.map((u) => (
                      <tr
                        key={u.osString}
                        className="border-t border-slate-100 dark:border-surface-800"
                      >
                        <td className="break-all py-1 pr-4">{u.osString}</td>
                        <td className="py-1 text-slate-500 dark:text-slate-400">
                          {t('occurrences', { count: u.count })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <DataTable
                data={drillRows(selected)}
                columns={eosColumns}
                headerFor={(id) => t(`col.${id}`)}
                objectKind="vm"
              />
            )}
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('nodesHeading')}
            </h3>
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 pr-4">{t('col.host')}</th>
                  <th className="py-1 pr-4">{t('col.pveVersion')}</th>
                  <th className="py-1 pr-4">{t('col.major')}</th>
                  <th className="py-1 pr-4">{t('col.majorEol')}</th>
                  <th className="py-1">{t('col.patchEol')}</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {eos.nodes.hosts.map((h) => (
                  <tr
                    key={h.hostName}
                    className="border-t border-slate-100 dark:border-surface-800"
                  >
                    <td className="break-all py-1 pr-4 font-sans">{h.hostName}</td>
                    <td className="py-1 pr-4 font-sans">{h.pveVersion || '—'}</td>
                    <td className="py-1 pr-4">{h.major ?? '—'}</td>
                    <td className="py-1 pr-4">{fmtDate(h.majorEol ?? '', loc)}</td>
                    <td className="py-1">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
