import { useTranslation } from 'react-i18next'
import type { EsxAggregate } from '@/types/estate'

export interface EsxDetailData {
  host: EsxAggregate
}

export interface EsxDetailProps {
  detail: EsxDetailData
  onBack: () => void
}

/**
 * P9 LC-4 per-host drill. Shows cluster, PVE version, and a factual
 * note about datastore names. Interface-level network detail lives in
 * the dedicated NetworkView — no vSwitch/dvSwitch panels here (Proxmox
 * does not have those constructs). Screen-fit ClusterDetail idiom.
 */
export function EsxDetail({ detail: d, onBack }: EsxDetailProps) {
  const { t } = useTranslation('network')
  const na = t('na')
  const h = d.host

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
            {t('detail.title', { name: h.hostName })}
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
            <Row label={t('detail.cluster')} value={h.cluster || na} />
            <Row label={t('detail.esxVersion')} value={h.esxVersion || na} />
            <Row label={t('detail.datastores')} value={na} />
            <p className="pt-1 text-[12px] font-normal text-slate-500 dark:text-slate-400">
              {t('detail.datastoresNote')}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
