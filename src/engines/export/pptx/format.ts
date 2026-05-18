/**
 * Phase 10 — locale-parameterized number formatting for the PPTX deck
 * (PPT-04 / Moderate-8). Mirrors `src/utils/format.ts`'s contract: every
 * formatter takes `locale`, uses `toLocaleString(locale, ...)`, and returns
 * the em-dash sentinel on non-finite input (never `0` / `NaN`).
 *
 * NET-NEW vs `src/utils/format.ts`: the FR thousands grouping that
 * `Intl`/`toLocaleString('fr-FR')` emits uses the NARROW NO-BREAK SPACE
 * (code point 202F hex). PowerPoint/pptxgenjs renders that glyph poorly, so
 * after FR formatting we substitute it with the regular NO-BREAK SPACE
 * (00A0 hex). This transform is intentionally absent from
 * `src/utils/format.ts` (web rendering handles the narrow space fine) — it
 * lives ONLY here (Moderate-8). Special code points are produced via
 * `String.fromCharCode`/`RegExp(string)` so no literal non-ASCII or
 * control character appears in source (grep-gate / hook safety).
 */
export type ExportLocale = 'en' | 'fr'

const NARROW_NBSP = String.fromCharCode(0x202f)
const NBSP = String.fromCharCode(0x00a0)
const EM_DASH = String.fromCharCode(0x2014)
// C0 + C1 control ranges — stripped from any text reaching a pptx run.
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

const bcp47 = (l: ExportLocale): string => (l === 'fr' ? 'fr-FR' : 'en-US')

/**
 * Replace every narrow-no-break space with the regular no-break space and
 * strip control characters (pptxgenjs autoFit/control-char safety —
 * Moderate-8). Applied to every string that reaches a slide text run.
 */
export function pptxSafeFormat(s: string): string {
  return s.split(NARROW_NBSP).join(NBSP).replace(CONTROL_CHARS, '')
}

/**
 * Locale-formatted number for a slide. EN -> `12,345.6`; FR -> grouped with
 * the regular no-break space (post substitution) and `,` decimal.
 * Non-finite -> the em-dash sentinel.
 */
export function pptxNumber(n: number, locale: ExportLocale, fractionDigits = 0): string {
  if (!Number.isFinite(n)) return EM_DASH
  const s = n.toLocaleString(bcp47(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })
  return pptxSafeFormat(s)
}
