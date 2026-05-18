/**
 * Phase 10 — the two header export buttons (D-04). Pixel-identical to the
 * shipped `ThemeToggle`/`LanguageToggle` `<fieldset>` group idiom (no new
 * design mechanism — UI-SPEC). Busy: the triggering button is disabled +
 * `aria-busy`, its glyph swaps for a spinner, and the OTHER button is also
 * disabled (one synthesis at a time). No modal/overlay (D-06). Labels +
 * ARIA come from the `report` i18n namespace.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExport } from '@/hooks/useExport'

function DownloadGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function ExportButtons() {
  const { t } = useTranslation('report')
  const { run, busy } = useExport()
  const [pending, setPending] = useState<'html' | 'pptx' | null>(null)

  const click = async (kind: 'html' | 'pptx') => {
    setPending(kind)
    try {
      await run(kind)
    } finally {
      setPending(null)
    }
  }

  const Btn = ({ kind, label, aria }: { kind: 'html' | 'pptx'; label: string; aria: string }) => {
    const isPending = pending === kind
    return (
      <button
        type="button"
        onClick={() => click(kind)}
        disabled={busy}
        aria-busy={isPending}
        aria-label={aria}
        title={aria}
        className="flex items-center gap-1 rounded px-2 py-1 text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
      >
        {isPending ? <Spinner /> : <DownloadGlyph />}
        <span>{label}</span>
      </button>
    )
  }

  const groupLabel = `${t('action.html')} / ${t('action.pptx')}`
  return (
    <fieldset
      aria-label={groupLabel}
      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-surface-700 dark:bg-surface-900"
    >
      <legend className="sr-only">{groupLabel}</legend>
      <Btn kind="html" label={t('action.html')} aria={t('action.ariaHtml')} />
      <Btn kind="pptx" label={t('action.pptx')} aria={t('action.ariaPptx')} />
    </fieldset>
  )
}
