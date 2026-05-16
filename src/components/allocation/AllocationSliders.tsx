import { useTranslation } from 'react-i18next'
import { type AllocRatios, CPU_MAX, CPU_MIN, RAM_MAX, RAM_MIN } from '@/hooks/useAllocationHash'
import { fmtRatio } from '@/utils/format'

export interface AllocationSlidersProps {
  ratios: AllocRatios
  onChange: (next: AllocRatios) => void
}

interface Preset {
  key: string
  ratios: AllocRatios
}
const PRESETS: readonly Preset[] = [
  { key: '1to1', ratios: { cpu: 1, ram: 1 } },
  { key: '4to1', ratios: { cpu: 4, ram: 1 } },
  { key: '8to1', ratios: { cpu: 8, ram: 1 } },
  { key: 'vdi10to1', ratios: { cpu: 10, ram: 1 } },
]

const matchesPreset = (r: AllocRatios, p: Preset): boolean =>
  r.cpu === p.ratios.cpu && r.ram === p.ratios.ram

/**
 * ALC — single full-width allocation toolbar. Two native `<input
 * type="range">` (keyboard-operable by construction) + a named-preset
 * segmented group reusing the `AccountingModeToggle` `<fieldset
 * role="group"> + aria-pressed` idiom VERBATIM (no bespoke control). State
 * source is the URL hash (`useAllocationHash`), lifted via `ratios`/
 * `onChange` — one instance governs the whole estate (parallels the single
 * accounting-mode toggle). Moving a slider off a preset clears the active
 * preset (no preset pressed — factual, no error state). Every color
 * utility carries its `dark:` twin.
 *
 * The `biome-ignore` + literal `role="group"` are kept intentionally — the
 * CI grep gate asserts their presence (same contract as the other toggles).
 */
export function AllocationSliders({ ratios, onChange }: AllocationSlidersProps) {
  const { t, i18n } = useTranslation('alloc')
  const loc = i18n.language
  const groupLabel = t('title')

  return (
    <section className="panel flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('title')}</h2>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold">{t('cpu.label')}</span>
          <input
            type="range"
            min={CPU_MIN}
            max={CPU_MAX}
            step={1}
            value={ratios.cpu}
            onChange={(e) => onChange({ ...ratios, cpu: Number(e.target.value) })}
            aria-label={t('cpu.label')}
            aria-valuetext={fmtRatio(ratios.cpu, loc)}
            className="accent-primary-600"
          />
          <span className="font-mono tabular-nums">{fmtRatio(ratios.cpu, loc)}</span>
        </label>

        <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold">{t('ram.label')}</span>
          <input
            type="range"
            min={RAM_MIN}
            max={RAM_MAX}
            step={0.25}
            value={ratios.ram}
            onChange={(e) => onChange({ ...ratios, ram: Number(e.target.value) })}
            aria-label={t('ram.label')}
            aria-valuetext={fmtRatio(ratios.ram, loc)}
            className="accent-primary-600"
          />
          <span className="font-mono tabular-nums">{fmtRatio(ratios.ram, loc)}</span>
        </label>

        <fieldset
          // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §ALC mandates an explicit role="group" + the CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
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
                onClick={() => onChange(p.ratios)}
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
        {t('echo', { cpu: fmtRatio(ratios.cpu, loc), ram: fmtRatio(ratios.ram, loc) })}
      </p>
    </section>
  )
}
