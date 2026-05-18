import { useTranslation } from 'react-i18next'

export type StorageLens = 'consumption' | 'capacity'

const LENSES: ReadonlyArray<StorageLens> = ['consumption', 'capacity']

export interface StorageLensToggleProps {
  value: StorageLens
  onChange: (lens: StorageLens) => void
}

/**
 * P9 D-07 — controlled 2-option segmented control switching the storage
 * lens (consumption ↔ capacity). The `AccountingModeToggle` idiom VERBATIM
 * (DRY — same interaction language): `<fieldset role="group"> + <legend
 * sr-only> + map(button aria-pressed)`, Arrow wraparound, active
 * `bg-primary-600 text-white` (navy — NOT accent gold; gold is the closed
 * ViewToggle/threshold-marker list per UI-SPEC §Color). Focus ring
 * `ring-2 ring-primary-500`; every colour utility has its `dark:` twin.
 */
export function StorageLensToggle({ value, onChange }: StorageLensToggleProps) {
  const { t } = useTranslation('storage')
  const label = t('lens.label')

  const move = (delta: number) => {
    const idx = LENSES.indexOf(value)
    const next = LENSES[(idx + delta + LENSES.length) % LENSES.length]
    if (next) onChange(next)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    }
  }

  return (
    <fieldset
      // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §LC-5 mandates an explicit role="group" + the CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{label}</legend>
      {LENSES.map((lens) => {
        const active = value === lens
        return (
          <button
            key={lens}
            type="button"
            onClick={() => onChange(lens)}
            className={`flex h-10 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              active
                ? 'bg-primary-600 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={active}
          >
            {t(`lens.${lens}`)}
          </button>
        )
      })}
    </fieldset>
  )
}
