import { useTranslation } from 'react-i18next'
import type { Snapshot } from '@/types/snapshot'

export interface SnapshotCardProps {
  snapshot: Snapshot
  active: boolean
  onClick: () => void
  onRemove: () => void
}

/**
 * One sidebar entry per loaded snapshot. Shows filename, vCenter label,
 * capture date (FND-05), RVTools version, and row counts. Clicking selects it
 * as the active snapshot; the ✕ removes it without selecting.
 *
 * Every color utility carries its `dark:` counterpart (CLAUDE.md class-strategy
 * dark mode — a missing pair would render invisibly in one theme).
 */
export function SnapshotCard({ snapshot, active, onClick, onRemove }: SnapshotCardProps) {
  const { t } = useTranslation('upload')
  const clusterCount = new Set(snapshot.vinfo.map((v) => v.cluster)).size

  return (
    <li className="relative">
      <button
        type="button"
        className={
          'panel block w-full cursor-pointer text-left text-xs transition ' +
          (active
            ? 'ring-2 ring-accent-500 dark:ring-accent-400'
            : 'hover:bg-slate-50 dark:hover:bg-surface-800')
        }
        onClick={onClick}
        aria-pressed={active}
      >
        <p className="break-all pr-6 font-semibold text-slate-700 dark:text-slate-200">
          {snapshot.filename}
        </p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          <span>
            {t('snapshots.card.vCenterLabel')}: {snapshot.vCenterLabel}
          </span>
          {' · '}
          <span>
            {t('snapshots.card.capturedAt')}: {snapshot.capturedAt.toLocaleDateString()}
          </span>
          {' · '}
          <span>
            {t('snapshots.card.rvtoolsVersion')}: {snapshot.rvtoolsVersion}
          </span>
        </p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {t('snapshots.card.rows', {
            vms: snapshot.vinfo.length,
            hosts: snapshot.vhost.length,
            clusters: clusterCount,
            datastores: snapshot.vdatastore.length,
          })}
        </p>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-3 right-3 text-slate-400 hover:text-util-high dark:text-slate-500"
        aria-label={t('fileLoaded.remove')}
      >
        ✕
      </button>
    </li>
  )
}
