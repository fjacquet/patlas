import { useTranslation } from 'react-i18next'
import type { AccountingMode } from '@/types/estate'

const MODES: ReadonlyArray<AccountingMode> = ['configured', 'active', 'storage-realistic']

/** Maps the union member to its i18n key segment (kebab → camel). */
const KEY: Record<AccountingMode, string> = {
  configured: 'configured',
  active: 'active',
  'storage-realistic': 'storageRealistic',
}

export interface AccountingModeToggleProps {
  value: AccountingMode
  onChange: (mode: AccountingMode) => void
}

/**
 * DSH-06 — controlled 3-option segmented control. Reuses the Phase-1
 * `ThemeToggle` `<fieldset> + <legend className="sr-only"> + map(button
 * aria-pressed)` idiom (DRY — same interaction language) but is CONTROLLED
 * (state lifted to `GlobalDashboard` via `value`/`onChange`).
 *
 * Keyboard: Tab into the group, Arrow Left/Right (or Up/Down) move + activate
 * the selection, Space/Enter activate the focused segment (native button
 * behavior). `role="group"` carries the localized "Accounting mode" label.
 * Active segment is `bg-primary-600 text-white` filled with
 * `aria-pressed="true"` — exactly one active treatment (no gold underline;
 * gold is the closed CPU-Ready-count list only). Focus ring
 * `ring-2 ring-primary-500`. Every color utility carries its `dark:` twin.
 */
export function AccountingModeToggle({ value, onChange }: AccountingModeToggleProps) {
  const { t } = useTranslation('dashboard')
  const label = t('accountingMode.label')

  const move = (delta: number) => {
    const idx = MODES.indexOf(value)
    const next = MODES[(idx + delta + MODES.length) % MODES.length]
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
      // biome-ignore lint/a11y/noRedundantRoles: UI-SPEC §Accounting-Mode Toggle mandates an explicit role="group" + the 02-03 CI grep gate asserts its literal presence; kept intentionally despite the implicit fieldset semantic
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{label}</legend>
      {MODES.map((mode) => {
        const active = value === mode
        const optLabel = t(`accountingMode.${KEY[mode]}`)
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`flex h-10 items-center rounded px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              active
                ? 'bg-primary-600 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={active}
            title={t(`accountingMode.describe.${KEY[mode]}`)}
          >
            {optLabel}
          </button>
        )
      })}
    </fieldset>
  )
}
