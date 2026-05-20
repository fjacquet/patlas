import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useEstateView } from '@/hooks/useEstateView'
import { useSnapshotUpload } from '@/hooks/useSnapshotUpload'
import { useSnapshotStore } from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'
import { SnapshotCard } from './SnapshotCard'
import { UploadZone } from './UploadZone'

/**
 * Left rail listing every loaded snapshot, sorted by `capturedAt` ascending
 * (oldest at top — matches the monthly-trends mental model where newer
 * snapshots accrue at the bottom). Embeds a compact UploadZone so more files
 * can be dropped without leaving the view.
 *
 * The sort lives here behind `useMemo` (NOT in a store selector) — selectors
 * must return stable references or Zustand's `Object.is` equality loops.
 */
export function SnapshotListSidebar({ header }: { header?: React.ReactNode }) {
  const { t } = useTranslation('upload')
  const { t: tTrends, i18n } = useTranslation('trends')
  const loc = i18n.language
  const snapshots = useSnapshotStore((s) => s.snapshots)
  const activeId = useSnapshotStore((s) => s.activeSnapshotId)
  const setActive = useSnapshotStore((s) => s.setActiveSnapshot)
  const remove = useSnapshotStore((s) => s.removeSnapshot)
  const { upload, isUploading, done, total } = useSnapshotUpload()
  // Plain prop off the single memo (no new memo) — drives the factual
  // D-05 inferred-order caption.
  const trends = useEstateView('active').trends

  const sorted = useMemo(
    () => [...snapshots.values()].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()),
    [snapshots],
  )

  return (
    <aside
      className="flex flex-col gap-4 border-r border-slate-200 p-4 lg:w-80 lg:shrink-0 dark:border-surface-700"
      aria-label={t('snapshots.list')}
    >
      {/* Optional header slot — the primary nav lives here so the shell has
          ONE left column (nav + drop zone + snapshots), not two. */}
      {header ? (
        <div className="border-b border-slate-200 pb-4 dark:border-surface-700">{header}</div>
      ) : null}
      <UploadZone onFiles={upload} disabled={isUploading} variant="compact" />
      {done < total && (
        <p className="text-sm text-slate-500 dark:text-slate-400" role="status">
          {tTrends('warmup', { done: fmtInt(done, loc), total: fmtInt(total, loc) })}
        </p>
      )}
      {trends?.orderInferred && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{tTrends('orderInferred')}</p>
      )}
      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('snapshots.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((s) => (
            <SnapshotCard
              key={s.id}
              snapshot={s}
              active={s.id === activeId}
              onClick={() => setActive(s.id)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </ul>
      )}
    </aside>
  )
}
