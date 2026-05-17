import { useTranslation } from 'react-i18next'
import {
  selectPlannedRatios,
  selectSetPlannedRatios,
  useSnapshotStore,
} from '@/store/snapshotStore'
import { fmtRatio } from '@/utils/format'

/** Planned CPU/RAM overcommit ratios — the explicitly-"planned" what-if lens. */
interface PlannedRatios {
  cpu: number
  ram: number
}

interface Preset {
  key: string
  ratios: PlannedRatios
}

/**
 * D-05 preset values (carried verbatim from the retired ALC slider
 * `PRESETS` const): 1:1, 4:1, 8:1, VDI 10:1. Default state CPU 4:1 / RAM 1:1
 * (the carried ALC-02 intent — defaulted in the Zustand slice, not here).
 */
const PRESETS: readonly Preset[] = [
  { key: '1to1', ratios: { cpu: 1, ram: 1 } },
  { key: '4to1', ratios: { cpu: 4, ram: 1 } },
  { key: '8to1', ratios: { cpu: 8, ram: 1 } },
  { key: 'vdi10to1', ratios: { cpu: 10, ram: 1 } },
]

/**
 * Planned-ratio bounds (WR-03) — the single source of truth shared by the
 * `<input>` `min`/`max`/`step` attributes AND the on-commit sanitizer
 * (CR-01), so the input attributes and the guard cannot disagree on what a
 * valid ratio is. Values mirror the now-retired measured-slider contract
 * (`CPU_MIN=1`/`CPU_MAX=16`, `RAM_MIN=0.5`/`RAM_MAX=4`) so the planned lens
 * stays consistent with the historical measured bounds without depending on
 * the dead URL-hash codec (WR-01). The native `<input type="number">`
 * `min`/`max` are NOT enforced on manual entry, so `safeNum` is the real
 * guard: any non-finite / out-of-range value falls back to the last valid
 * ratio (CPU 4:1 / RAM 1:1 by store default — CR-01).
 */
const CPU_MIN = 1
const CPU_MAX = 16
const RAM_MIN = 0.5
const RAM_MAX = 4
const CPU_STEP = 1
const RAM_STEP = 0.25

const safeNum = (raw: string, min: number, max: number, fallback: number): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

const matchesPreset = (r: PlannedRatios, p: Preset): boolean =>
  r.cpu === p.ratios.cpu && r.ram === p.ratios.ram

/**
 * PLN-03 / D-05 — the planned-ratios control on the Planning surface.
 * Named-preset segmented group (reuses the `<fieldset role="group"> +
 * aria-pressed` idiom VERBATIM from the retired ALC slider control,
 * INCLUDING the `biome-ignore` + literal `role="group"` the CI grep gate
 * asserts) that FILLS an editable native `<input type="number">` — no
 * slider widget. Clicking a preset fills the numeric field; typing an
 * off-preset value clears the active preset (the existing
 * `matchesPreset`→no-active behaviour — factual, no error state).
 *
 * D-06 / privacy: state source is the in-memory Zustand `plannedRatios`
 * slice ONLY — the killed URL-hash codec and any browser-storage write are
 * structurally excluded; refresh = data gone. This is the
 * explicitly-"planned" lens, structurally
 * separate from the realized "measured" value (D-03); the preset active
 * style is `bg-primary-600 text-white` (NOT accent — accent is reserved for
 * the ViewToggle segment + the single DR headline figure, UI-SPEC §Color).
 */
export function PlannedRatiosControl() {
  const { t, i18n } = useTranslation('alloc')
  const loc = i18n.language
  const ratios = useSnapshotStore(selectPlannedRatios)
  const setRatios = useSnapshotStore(selectSetPlannedRatios)
  const groupLabel = t('planned.presetGroup')

  return (
    <section className="panel flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
        {t('planned.heading')}
      </h2>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('planned.cpuLabel')}
          <input
            type="number"
            min={CPU_MIN}
            max={CPU_MAX}
            step={CPU_STEP}
            value={ratios.cpu}
            onChange={(e) =>
              setRatios({ ...ratios, cpu: safeNum(e.target.value, CPU_MIN, CPU_MAX, ratios.cpu) })
            }
            aria-label={t('planned.cpuLabel')}
            className="h-9 w-20 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100"
          />
        </label>

        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('planned.ramLabel')}
          <input
            type="number"
            min={RAM_MIN}
            max={RAM_MAX}
            step={RAM_STEP}
            value={ratios.ram}
            onChange={(e) =>
              setRatios({ ...ratios, ram: safeNum(e.target.value, RAM_MIN, RAM_MAX, ratios.ram) })
            }
            aria-label={t('planned.ramLabel')}
            className="h-9 w-20 rounded border border-slate-200 bg-white px-2 font-mono tabular-nums text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100"
          />
        </label>

        <fieldset
          // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §Planned-ratios control mandates an explicit role="group" + the CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
          role="group"
          aria-label={groupLabel}
          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <legend className="sr-only">{groupLabel}</legend>
          {PRESETS.map((p) => {
            const active = matchesPreset(ratios, p)
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setRatios(p.ratios)}
                className={`flex h-8 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                aria-pressed={active}
              >
                {t(`preset.${p.key}`)}
              </button>
            )
          })}
        </fieldset>
      </div>

      <p className="text-[12px] font-normal text-slate-500 dark:text-slate-400">
        {t('planned.echo', { cpu: fmtRatio(ratios.cpu, loc), ram: fmtRatio(ratios.ram, loc) })}
      </p>

      <p className="text-[12px] font-normal text-slate-500 dark:text-slate-400">
        {t('planned.measuredCaption')}
      </p>
    </section>
  )
}
