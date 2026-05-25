import type { ColumnDef } from '@tanstack/react-table'
import type { EChartsOption } from 'echarts/types/dist/shared'
import { useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Chart } from '@/components/Chart'
import { DataTable } from '@/components/inventory/DataTable'
import type { SizingThresholds, VmSizing } from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import {
  selectActiveSnapshot,
  selectSetSizingThresholds,
  selectSizingThresholds,
  useSnapshotStore,
} from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * P-RS — VM right-sizing & stress, read-only presenter (D-00: no computation,
 * no second memo; the extract is `view.sizing`, produced in the single
 * `buildEstateView` pass). Neutral measurement against user-editable
 * thresholds — no verdict/severity/colour (ADR-0012). `—` is the only
 * "not derivable" marker. Powered-on VMs only; values are the max across
 * the loaded snapshots.
 */

type Filter = 'all' | 'oversized' | 'undersized' | 'stressed'
const FILTERS: Filter[] = ['all', 'oversized', 'undersized', 'stressed']

const THRESHOLD_FIELDS: { key: keyof SizingThresholds; labelKey: string }[] = [
  { key: 'cpuOversizePct', labelKey: 'thresholds.cpuOversize' },
  { key: 'memOversizePct', labelKey: 'thresholds.memOversize' },
  { key: 'cpuUndersizePct', labelKey: 'thresholds.cpuUndersize' },
  { key: 'memUndersizePct', labelKey: 'thresholds.memUndersize' },
  { key: 'balloonMib', labelKey: 'thresholds.balloon' },
  { key: 'swapMib', labelKey: 'thresholds.swap' },
]

const matchesFilter = (r: VmSizing, f: Filter): boolean => {
  switch (f) {
    case 'oversized':
      return r.flags.cpuOversized || r.flags.memOversized
    case 'undersized':
      return r.flags.cpuUndersized || r.flags.memUndersized
    case 'stressed':
      return r.flags.memStressed || r.flags.cpuStressed
    default:
      return true
  }
}

/** Inline error fallback — reads ONLY `error.message` (never the object/cause/
 *  stack: would leak VM/host names). Mirrors EosView's scoped fallback. */
function RsError({ error }: FallbackProps) {
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

export function RightSizingView() {
  const { t, i18n } = useTranslation('rightsizing')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const thresholds = useSnapshotStore(selectSizingThresholds)
  const setThresholds = useSnapshotStore(selectSetSizingThresholds)
  const view = useEstateView('active')
  const sizing = view.sizing
  const [filter, setFilter] = useState<Filter>('all')

  if (!snapshot || !sizing.hasUsageData) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('heading')}
          </h2>
          <strong className="block text-slate-700 dark:text-slate-200">{t('empty.heading')}</strong>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.body')}</p>
        </section>
      </main>
    )
  }

  const counts = sizing.counts
  const filterCount: Record<Filter, number> = {
    all: sizing.rows.length,
    oversized: counts.oversized,
    undersized: counts.undersized,
    stressed: counts.stressed,
  }
  const rows = sizing.rows.filter((r) => matchesFilter(r, filter))

  const pct = (n: number | null): string => (n === null ? '—' : `${n.toFixed(1)} %`)
  const mibCell = (n: number | null): string => (n === null ? '—' : fmtInt(n, loc))

  const columns: ColumnDef<VmSizing>[] = [
    { accessorKey: 'vmName', id: 'vmName', header: 'col.vmName', enableHiding: false },
    { accessorKey: 'cluster', id: 'cluster', header: 'col.cluster' },
    { accessorKey: 'host', id: 'host', header: 'col.host' },
    { accessorKey: 'vcpu', id: 'vcpu', header: 'col.vcpu' },
    {
      accessorKey: 'cpuUtilPct',
      id: 'cpuUtilPct',
      header: 'col.cpuUtilPct',
      cell: (c) => pct(c.getValue() as number | null),
    },
    {
      accessorKey: 'vramMib',
      id: 'vramMib',
      header: 'col.vramMib',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      accessorKey: 'memActivePct',
      id: 'memActivePct',
      header: 'col.memActivePct',
      cell: (c) => pct(c.getValue() as number | null),
    },
    {
      accessorKey: 'memConsumedPct',
      id: 'memConsumedPct',
      header: 'col.memConsumedPct',
      cell: (c) => pct(c.getValue() as number | null),
    },
    {
      accessorKey: 'balloonedMib',
      id: 'balloonedMib',
      header: 'col.balloonedMib',
      cell: (c) => mibCell(c.getValue() as number | null),
    },
    {
      accessorKey: 'swappedMib',
      id: 'swappedMib',
      header: 'col.swappedMib',
      cell: (c) => mibCell(c.getValue() as number | null),
    },
    {
      accessorKey: 'cpuReadinessPercent',
      id: 'cpuReadinessPercent',
      header: 'col.cpuReadinessPercent',
      cell: (c) => pct(c.getValue() as number | null),
    },
  ]

  const chartOption: EChartsOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: [
        t('chart.labels.cpuOver'),
        t('chart.labels.memOver'),
        t('chart.labels.cpuUnder'),
        t('chart.labels.memUnder'),
        t('chart.labels.memStress'),
        t('chart.labels.cpuReady'),
      ],
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: [
          counts.cpuOversized,
          counts.memOversized,
          counts.cpuUndersized,
          counts.memUndersized,
          counts.memStressed,
          counts.cpuStressed,
        ],
      },
    ],
  }

  const basis =
    sizing.snapshotCount >= 2 ? t('basis.max', { count: sizing.snapshotCount }) : t('basis.single')

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={RsError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {basis} · {t('poweredOnOnly')} · {t('notDerivable')}
            </p>
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('thresholds.heading')}
            </h3>
            <div className="flex flex-wrap gap-4">
              {THRESHOLD_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                >
                  {t(f.labelKey)}
                  <input
                    type="number"
                    min={0}
                    value={thresholds[f.key]}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, [f.key]: Number(e.target.value) })
                    }
                    className="w-20 rounded border border-slate-200 bg-white px-2 py-1 font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <fieldset
              // biome-ignore lint/a11y/noRedundantRoles: explicit role="group" matches the project's ViewToggle/ThemeToggle filter idiom
              role="group"
              aria-label={t('filter.label')}
              className="flex flex-wrap gap-3"
            >
              <legend className="sr-only">{t('filter.label')}</legend>
              {FILTERS.map((f) => {
                const active = filter === f
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={active}
                    className={`flex h-20 min-w-[9rem] flex-col items-start justify-center rounded-md border px-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                      active
                        ? 'border-primary-500 bg-slate-100 ring-2 ring-primary-500 dark:bg-surface-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t(`filter.${f}`)}
                    </span>
                    <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtInt(filterCount[f], loc)}
                    </span>
                  </button>
                )
              })}
            </fieldset>
          </section>

          <section className="panel">
            <Chart option={chartOption} ariaLabel={t('chart.title')} />
          </section>

          <section className="panel">
            <DataTable
              data={rows}
              columns={columns}
              headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}
              objectKind="vm"
            />
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
