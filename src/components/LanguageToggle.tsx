import { useTranslation } from 'react-i18next'
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n'

const switchLanguage = (lang: SupportedLanguage): void => {
  void i18n.changeLanguage(lang)
}

/**
 * Language toggle (FR / EN). Mirrors `ThemeToggle`'s `<fieldset>` +
 * `aria-pressed` idiom for visual + a11y consistency. Extracted out of
 * vsizer's `Header.tsx` so it can be composed independently.
 */
export function LanguageToggle() {
  const { t, i18n: i18nApi } = useTranslation('common')
  const currentLang = i18nApi.resolvedLanguage as SupportedLanguage | undefined

  return (
    <fieldset
      aria-label={t('lang.label')}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{t('lang.label')}</legend>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = currentLang === lang
        return (
          <button
            key={lang}
            type="button"
            onClick={() => switchLanguage(lang)}
            className={`rounded px-2 py-1 transition-colors ${
              active
                ? 'bg-primary-100 text-primary-900 dark:bg-primary-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            aria-pressed={active}
          >
            {t(`lang.${lang}`)}
          </button>
        )
      })}
    </fieldset>
  )
}
