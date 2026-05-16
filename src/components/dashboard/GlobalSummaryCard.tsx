import { useTranslation } from 'react-i18next'
import type { AccountingMode, GlobalSummary } from '@/types/estate'
import { fmtInt, fmtMemMb } from '@/utils/format'

export interface GlobalSummaryCardProps {
  globals: GlobalSummary
  mode: AccountingMode
  /** Already-localized capture date string (formatted by the caller). */
  capturedDate: string
}

/** Maps the accounting union member to its i18n key segment. */
const MODE_KEY: Record<AccountingMode, string> = {
  configured: 'configured',
  active: 'active',
  'storage-realistic': 'storageRealistic',
}

/**
 * DSH-02 — full-width `.panel` estate stat-block. Presentational: consumes
 * `EstateView.globals` as plain props (no memo hooks, no engine/store imports).
 * Labels at 14px with `font-semibold` (the .label→600 override — the shipped
 * `.label` is font-medium/500; inheriting it would introduce a forbidden 3rd
 * weight). Numeric values `font-mono tabular-nums`, rendered via
 * `utils/format.ts` with brands unwrapped at the call site. Every color
 * utility carries its `dark:` twin.
 */
export function GlobalSummaryCard({ globals, mode, capturedDate }: GlobalSummaryCardProps) {
  const { t, i18n } = useTranslation('dashboard')
  const loc = i18n.language

  const tiles: ReadonlyArray<{ label: string; value: string }> = [
    { label: t('stats.clusters'), value: fmtInt(globals.clusterCount, loc) },
    { label: t('stats.esx'), value: fmtInt(globals.hostCount, loc) },
    { label: t('stats.vms'), value: fmtInt(globals.vmCount, loc) },
    { label: t('stats.datastores'), value: fmtInt(globals.datastoreCount, loc) },
    { label: t('stats.vcpu'), value: fmtInt(globals.vcpuAllocated as number, loc) },
    { label: t('stats.vram'), value: fmtMemMb(globals.vramAllocatedMib as number, loc) },
    { label: t('stats.storage'), value: fmtMemMb(globals.totalStorageMib as number, loc) },
  ]

  const modeLabel = t(`accountingMode.${MODE_KEY[mode]}`)

  return (
    <section className="panel">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
          {t('sections.summary')}
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('accountingMode.echo', { mode: modeLabel })}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('capturedAt', { date: capturedDate })}
      </p>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col">
            <dt className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {tile.label}
            </dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
