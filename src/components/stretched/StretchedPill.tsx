import { useTranslation } from 'react-i18next'

export interface StretchedPillProps {
  /** True when this cluster is in the store's `stretchedClusters` set. */
  value: boolean
  onChange: (next: boolean) => void
}

/**
 * STR-01 — controlled 2-state stretched toggle. Reuses the
 * `AccountingModeToggle` `<fieldset role="group"> + <legend
 * className="sr-only"> + button aria-pressed` idiom VERBATIM (DRY-locked —
 * no bespoke toggle). Pressed = the cluster is flagged stretched; state is
 * lifted to the store via `value`/`onChange` (parallels the accounting-mode
 * toggle). Active = `bg-primary-600 text-white`; focus ring
 * `ring-2 ring-primary-500`. Every color utility carries its `dark:` twin.
 *
 * The `biome-ignore` + literal `role="group"` are kept intentionally — the
 * 02-03 CI grep gate asserts their presence (same contract as the
 * accounting-mode toggle).
 */
export function StretchedPill({ value, onChange }: StretchedPillProps) {
  const { t } = useTranslation('str')
  const label = t('pill.group')

  return (
    <fieldset
      // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §STR mandates an explicit role="group" + the CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{label}</legend>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`flex h-8 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          value
            ? 'bg-primary-600 text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
        aria-pressed={value}
      >
        {t('pill.label')}
      </button>
    </fieldset>
  )
}
