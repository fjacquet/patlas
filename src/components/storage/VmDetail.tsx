import { useTranslation } from 'react-i18next'
import type { VmDetailEntry } from '@/types/estate'
import { fmtInt, fmtMemMb } from '@/utils/format'

export interface VmDetailProps {
  detail: VmDetailEntry
  onBack: () => void
}

/**
 * P9 LC-4 per-VM drill screen. Reached by clicking a VM row. ONE-SCREEN-FIT
 * (`overflow-hidden`, no internal scroll) — export-ready for Phase 10. Pure
 * presenter off `EstateView.vmDetail`; factual only, em-dash when not
 * derivable; each partition over the filesystem line carries the faint
 * gold tint + left rule (UI-SPEC LC-6 — a factual marker, no icon, no
 * verdict). `dark:` twin on every colour.
 */
export function VmDetail({ detail: d, onBack }: VmDetailProps) {
  const { t, i18n } = useTranslation('storage')
  const loc = i18n.language
  const na = '—'

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-surface-800">
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
            {t('detail.vmTitle', { name: d.vmName })}
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
            <Row label={t('detail.cluster')} value={d.cluster || na} />
            <Row label="OS" value={d.os || na} />
            <Row label={t('detail.vcpu')} value={fmtInt(d.vcpu as number, loc)} />
            <Row label={t('detail.vram')} value={fmtMemMb(d.vramMib as number, loc)} />
            <Row
              label={t('detail.provisioned')}
              value={fmtMemMb(d.provisionedMib as number, loc)}
            />
            <Row label={t('detail.inUse')} value={fmtMemMb(d.inUseMib as number, loc)} />
          </div>
          <div className="overflow-hidden">
            <p className="pb-1 text-sm text-slate-600 dark:text-slate-400">
              {t('detail.partitions')}
            </p>
            {d.partitions.length === 0 ? (
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{na}</p>
            ) : (
              d.partitions.map((p) => (
                <div
                  key={p.disk}
                  className={`flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 dark:border-surface-800 ${
                    p.flagged ? 'border-l-2 border-l-accent-500 bg-accent-500/15 pl-2' : ''
                  }`}
                >
                  <span className="break-words text-sm text-slate-600 dark:text-slate-400">
                    {p.disk}
                  </span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {fmtMemMb(p.consumedMib as number, loc)} /{' '}
                    {fmtMemMb(p.capacityMib as number, loc)}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="overflow-hidden">
            <p className="pb-1 text-sm text-slate-600 dark:text-slate-400">{t('detail.bridges')}</p>
            <p className="break-words pb-2 text-[12px] font-normal text-slate-500 dark:text-slate-400">
              {d.bridges.length === 0
                ? na
                : d.bridges.map((b) => (b.tag ? `${b.bridge} (${b.tag})` : b.bridge)).join(', ')}
            </p>
            <p className="pb-1 text-sm text-slate-600 dark:text-slate-400">
              {t('detail.datastores')}
            </p>
            <p className="break-words text-[12px] font-normal text-slate-500 dark:text-slate-400">
              {d.datastores.length === 0 ? na : d.datastores.join(', ')}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
