import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

/** Subscribe to the browser's online/offline transitions. */
const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Shield-check glyph (inline, matching the ThemeToggle SVG idiom). */
const ShieldGlyph = () => (
  <svg
    role="img"
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <title>Privacy</title>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

/**
 * Persistent privacy / offline trust badge in the header. The confidentiality
 * guarantee is already ENFORCED — CSP `connect-src 'self'`, the runtime fetch
 * guard (`privacy/fetchGuard`), and no dataset persistence — but it is
 * invisible. This badge makes it visible, and the live online/offline state
 * lets a user verify it themselves: disconnect the network and pAtlas keeps
 * working, which is itself proof nothing is being sent.
 */
export function PrivacyBadge() {
  const { t } = useTranslation('common')
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )

  return (
    <span
      role="status"
      aria-label={online ? t('privacy.badge') : `${t('privacy.badge')} — ${t('privacy.offline')}`}
      title={t('privacy.tooltip')}
      className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 sm:inline-flex dark:border-surface-700 dark:bg-surface-900 dark:text-slate-300"
    >
      <span className="text-emerald-600 dark:text-emerald-400">
        <ShieldGlyph />
      </span>
      <span>{t('privacy.badge')}</span>
      {online ? null : (
        <span className="rounded bg-emerald-100 px-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {t('privacy.offline')}
        </span>
      )}
    </span>
  )
}
