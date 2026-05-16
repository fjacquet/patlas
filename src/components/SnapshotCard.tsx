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
  const { t: tMvc } = useTranslation('mvc')
  const clusterCount = new Set(snapshot.vinfo.map((v) => v.cluster)).size

  // MVC-04: a single RVTools 4.x workbook can embed N vCenters — the count
  // is the number of DISTINCT vCenter identities in this snapshot's rows
  // (NEVER 1-file-=-1-vCenter). `viSdkUuid` is the per-row identity; fall
  // back to the per-vCenter `vMetaData` Server list when uuids are absent.
  const vcenterCount =
    new Set(snapshot.vinfo.map((v) => v.viSdkUuid).filter((u) => u !== '')).size ||
    snapshot.vMetaData.filter((m) => m.server !== '').length ||
    1
  const serverLabels = snapshot.vMetaData.map((m) => m.server).filter((s) => s !== '')
  // RVTools version: prefer the parsed per-vCenter `vMetaData` value (now
  // correct via the Task-1 columnar fix), else the snapshot-level fallback.
  const rvtoolsVersion =
    snapshot.vMetaData.find((m) => m.rvtoolsVersion != null)?.rvtoolsVersion ??
    snapshot.rvtoolsVersion

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
        </p>
        <p className="mt-1 text-[12px] font-normal text-slate-500 dark:text-slate-400">
          <span>
            {vcenterCount === 1
              ? tMvc('snapshot.vcenter.one')
              : tMvc('snapshot.vcenters', { count: vcenterCount })}
          </span>
          {serverLabels.map((label) => (
            <span key={label} className="block break-all">
              {label}
            </span>
          ))}
          <span className="block">
            {tMvc('snapshot.rvtoolsVersion', { version: rvtoolsVersion })}
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
