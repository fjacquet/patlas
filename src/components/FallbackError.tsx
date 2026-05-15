import type { FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

/**
 * Top-level fallback shown when any child of `<ErrorBoundary>` throws.
 *
 * SAFETY CONTRACT (PITFALLS.md Critical-2 + Pitfall 4):
 * - Read ONLY `error.message` and `error.name`.
 * - NEVER read `error.cause`, `error.stack`, `String(error)`, or
 *   `JSON.stringify(error)`. Any of these can leak nested objects that the
 *   original `throw new Error('x', { cause: { secret } })` site stuffed in.
 *
 * `react-error-boundary` types `error` as `unknown`, so we narrow before
 * printing. The Plan 05 leak-guard test exercises the
 * `new Error('x', { cause: { secret } })` shape.
 */
export function FallbackError({ error }: FallbackProps) {
  const { t } = useTranslation('common')
  const name = error instanceof Error ? error.name : 'Error'
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="m-8 rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <h2 className="mb-2 text-lg font-semibold text-util-high">{t('error.title')}</h2>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</p>
      <pre className="overflow-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
        {message}
      </pre>
    </div>
  )
}
