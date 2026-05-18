import { useTranslation } from 'react-i18next'
import { selectSetThresholds, selectThresholds, useSnapshotStore } from '@/store/snapshotStore'

/**
 * Threshold-line bounds (0..100 %) — the single source of truth shared by
 * the `<input>` `min`/`max`/`step` AND the on-commit `safeNum` sanitizer,
 * so the attributes and the guard cannot disagree. Native
 * `<input type="number">` `min`/`max` are NOT enforced on manual entry, so
 * `safeNum` is the real guard: any non-finite / out-of-range value falls
 * back to the last valid threshold (factual — no error state, D-04).
 */
const PCT_MIN = 0
const PCT_MAX = 100
const PCT_STEP = 1

const safeNum = (raw: string, fallback: number): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= PCT_MIN && n <= PCT_MAX ? n : fallback
}

/**
 * P9 D-01/D-02/D-04 — the in-memory threshold editor. The
 * `PlannedRatiosControl` shell VERBATIM (panel section, `safeNum`,
 * shared-bounds, the `<input type="number">` class, the factual echo
 * line). Three numeric fields (filesystem / datastore / LU used %); state
 * source is the in-memory Zustand `thresholds` slice ONLY — no localStorage,
 * refresh restores defaults. No verdict, no preset judgement: editing a
 * line just moves the factual flag marker.
 */
export function ThresholdConfig() {
  const { t } = useTranslation('alerts')
  const thresholds = useSnapshotStore(selectThresholds)
  const setThresholds = useSnapshotStore(selectSetThresholds)

  return (
    <section className="panel flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('config.heading')}
      </h2>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('config.fs')}
          <input
            type="number"
            min={PCT_MIN}
            max={PCT_MAX}
            step={PCT_STEP}
            value={thresholds.fsUsedPct}
            onChange={(e) =>
              setThresholds({
                ...thresholds,
                fsUsedPct: safeNum(e.target.value, thresholds.fsUsedPct),
              })
            }
            aria-label={t('config.fs')}
            className="h-9 w-20 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100"
          />
        </label>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('config.ds')}
          <input
            type="number"
            min={PCT_MIN}
            max={PCT_MAX}
            step={PCT_STEP}
            value={thresholds.dsUsedPct}
            onChange={(e) =>
              setThresholds({
                ...thresholds,
                dsUsedPct: safeNum(e.target.value, thresholds.dsUsedPct),
              })
            }
            aria-label={t('config.ds')}
            className="h-9 w-20 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100"
          />
        </label>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('config.lu')}
          <input
            type="number"
            min={PCT_MIN}
            max={PCT_MAX}
            step={PCT_STEP}
            value={thresholds.luUsedPct}
            onChange={(e) =>
              setThresholds({
                ...thresholds,
                luUsedPct: safeNum(e.target.value, thresholds.luUsedPct),
              })
            }
            aria-label={t('config.lu')}
            className="h-9 w-20 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100"
          />
        </label>
      </div>

      <p className="text-[12px] font-normal text-slate-500 dark:text-slate-400">
        {t('config.echo', {
          fs: thresholds.fsUsedPct,
          ds: thresholds.dsUsedPct,
          lu: thresholds.luUsedPct,
        })}
      </p>
    </section>
  )
}
