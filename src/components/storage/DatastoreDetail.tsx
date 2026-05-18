import { useTranslation } from 'react-i18next'
import type { DatastoreDetailEntry } from '@/types/estate'
import { fmtInt, fmtMemMb, fmtPercent } from '@/utils/format'

export interface DatastoreDetailProps {
  detail: DatastoreDetailEntry
  onBack: () => void
}

/**
 * P9 LC-4 per-datastore drill screen. Reached by clicking a storage table
 * row. ONE-SCREEN-FIT by construction (`overflow-hidden`, fixed grid, no
 * internal scroll) so Phase 10 can snapshot it as one PPTX slide. Pure
 * presenter off `EstateView.datastoreDetail` — every value calculated
 * upstream; factual only, em-dash when not derivable; the threshold marker
 * is the faint gold tint + left rule (UI-SPEC LC-6 — a factual marker only,
 * no icon, no verdict text). `dark:` twin on every colour.
 */
export function DatastoreDetail({ detail: d, onBack }: DatastoreDetailProps) {
  const { t, i18n } = useTranslation('storage')
  const loc = i18n.language
  const na = '—'
  const flagged = d.dsFlagged || d.luFlagged

  const Row = ({
    label,
    value,
    flag = false,
  }: {
    label: string
    value: string
    flag?: boolean
  }) => (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-surface-800 ${
        flag ? 'border-l-2 border-l-accent-500 bg-accent-500/15 pl-2' : ''
      }`}
    >
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  )

  return (
    <main className="flex-1 overflow-hidden p-8">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="break-words text-2xl font-semibold text-slate-700 dark:text-slate-200">
            {t('detail.datastoreTitle', { name: d.name })}
          </h2>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded px-3 py-1 text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-surface-800"
          >
            ← {t('detail.back')}
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-x-10 gap-y-0 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Row label={t('detail.type')} value={d.type || na} />
            <Row label={t('detail.capacity')} value={fmtMemMb(d.capacityMib as number, loc)} />
            <Row
              label={t('detail.provisioned')}
              value={fmtMemMb(d.provisionedMib as number, loc)}
            />
            <Row
              label={t('detail.used')}
              value={fmtMemMb(d.usedMib as number, loc)}
              flag={flagged}
            />
            <Row label={t('detail.free')} value={fmtMemMb(d.freeMib as number, loc)} />
            <Row label={t('detail.used')} value={fmtPercent(d.usedRatio, loc)} flag={flagged} />
          </div>
          <div>
            <Row
              label={t('detail.hostCount')}
              value={d.hostCount === null ? na : fmtInt(d.hostCount, loc)}
            />
            <Row
              label={t('detail.vmsOnIt')}
              value={d.vms.length === 0 ? na : fmtInt(d.vms.length, loc)}
            />
            {d.sharedDuplicateCount > 1 && (
              <Row label={t('vsan.sharedAcross', { count: d.sharedDuplicateCount })} value="" />
            )}
          </div>
          <div className="overflow-hidden">
            <p className="pb-1 text-sm text-slate-600 dark:text-slate-400">{t('detail.vmsOnIt')}</p>
            <p className="break-words text-[12px] font-normal text-slate-500 dark:text-slate-400">
              {d.vms.length === 0 ? na : d.vms.join(', ')}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
