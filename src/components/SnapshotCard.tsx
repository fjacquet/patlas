import { useTranslation } from 'react-i18next'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'

export interface SnapshotCardProps {
  snapshot: Snapshot
  active: boolean
  onClick: () => void
  onRemove: () => void
}

/** Date → `yyyy-mm-dd` for the native date input (local calendar day). */
const toInputDate = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * One sidebar entry per loaded snapshot. Shows filename, vCenter label,
 * RVTools version (criterion 6), row counts, and an INLINE-EDITABLE
 * capture date (D-03). The edit commits straight to the shipped
 * `setCapturedAt` store action — NO new mutation, NO local date state that
 * bypasses the store (Pitfall 5: a bypass means the chart will not
 * reorder); the trend series recomputes through the single memo
 * automatically. When the snapshot's raw rows were released (DD-C) the
 * factual released note shows and it cannot be picked as the active
 * estate (its rows are gone).
 *
 * Every color utility carries its `dark:` counterpart (CLAUDE.md
 * class-strategy dark mode — a missing pair renders invisibly in one
 * theme).
 */
export function SnapshotCard({ snapshot, active, onClick, onRemove }: SnapshotCardProps) {
  const { t } = useTranslation('upload')
  const { t: tMvc } = useTranslation('mvc')
  const { t: tTrends } = useTranslation('trends')
  const setCapturedAt = useSnapshotStore((s) => s.setCapturedAt)
  const released = snapshot.rawReleased === true
  const clusterCount = new Set(snapshot.guests.map((v) => v.cluster)).size

  // MVC-04: a single RVTools 4.x workbook can embed N vCenters — the count
  // is the number of DISTINCT vCenter identities in this snapshot's rows
  // (NEVER 1-file-=-1-vCenter). `viSdkUuid` is the per-row identity; fall
  // back to the per-vCenter `vMetaData` Server list when uuids are absent.
  const vcenterCount =
    new Set(snapshot.guests.map((v) => v.viSdkUuid).filter((u) => u !== '')).size ||
    snapshot.vMetaData.filter((m) => m.server !== '').length ||
    1
  const serverLabels = snapshot.vMetaData.map((m) => m.server).filter((s) => s !== '')
  // RVTools version: prefer the parsed per-vCenter `vMetaData` value (now
  // correct via the Task-1 columnar fix), else the snapshot-level fallback.
  const rvtoolsVersion =
    snapshot.vMetaData.find((m) => m.rvtoolsVersion != null)?.rvtoolsVersion ??
    snapshot.rvtoolsVersion

  const onDateChange = (value: string): void => {
    if (value === '') return
    const next = new Date(value)
    if (!Number.isNaN(next.getTime())) setCapturedAt(snapshot.id, next)
  }

  return (
    <li className="relative">
      <button
        type="button"
        disabled={released}
        className={
          'panel block w-full text-left text-xs transition ' +
          (released
            ? 'cursor-not-allowed opacity-70'
            : 'cursor-pointer ' +
              (active
                ? 'ring-2 ring-accent-500 dark:ring-accent-400'
                : 'hover:bg-slate-50 dark:hover:bg-surface-800'))
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
            vms: snapshot.guests.length,
            hosts: snapshot.nodes.length,
            clusters: clusterCount,
            datastores: snapshot.storages.length,
          })}
        </p>
      </button>

      <div className="mt-1 flex items-center gap-2 px-3 pb-3 text-xs text-slate-500 dark:text-slate-400">
        <label htmlFor={`cap-${snapshot.id}`}>{t('snapshots.card.capturedAt')}:</label>
        <input
          id={`cap-${snapshot.id}`}
          type="date"
          value={toInputDate(snapshot.capturedAt)}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200"
        />
      </div>

      {released && (
        <p className="px-3 pb-3 text-xs text-slate-500 dark:text-slate-400">
          {tTrends('released')}
        </p>
      )}

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
