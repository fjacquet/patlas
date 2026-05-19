/**
 * Phase 10 — locale-parameterized number formatting for the PPTX deck
 * (PPT-04 / Moderate-8). Mirrors `src/utils/format.ts`'s contract: every
 * formatter takes `locale`, uses `toLocaleString(locale, ...)`, and returns
 * the em-dash sentinel on non-finite input (never `0` / `NaN`).
 *
 * NET-NEW vs `src/utils/format.ts`: FR thousands grouping from
 * `toLocaleString('fr-FR')` uses the NARROW NO-BREAK SPACE (code point
 * 202F hex). PowerPoint/pptxgenjs renders that glyph poorly, so after FR
 * formatting we substitute it with the regular NO-BREAK SPACE (00A0 hex).
 * This transform is intentionally absent from `src/utils/format.ts` — it
 * lives ONLY here (Moderate-8). All special code points are produced via
 * `String.fromCharCode` and control chars filtered via a numeric predicate
 * (no literal non-ASCII / no control-char regex literal in source —
 * grep-gate + Biome `noControlCharactersInRegex` safety).
 */
export type ExportLocale = 'en' | 'fr'

const NARROW_NBSP = String.fromCharCode(0x202f)
const NBSP = String.fromCharCode(0x00a0)
const EM_DASH = String.fromCharCode(0x2014)

/** True for C0 (00–1F) and C1 (7F–9F) control code points — stripped from
 *  any text reaching a pptx run (Moderate-8). A numeric predicate, NOT a
 *  control-char regex literal, keeps Biome's lint clean. */
const isControl = (cp: number): boolean => cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)

const bcp47 = (l: ExportLocale): string => (l === 'fr' ? 'fr-FR' : 'en-US')

/**
 * Replace every narrow-no-break space with the regular no-break space and
 * strip control characters (pptxgenjs autoFit/control-char safety —
 * Moderate-8). Applied to every string that reaches a slide text run.
 */
export function pptxSafeFormat(s: string): string {
  let out = ''
  for (const ch of s.split(NARROW_NBSP).join(NBSP)) {
    if (!isControl(ch.charCodeAt(0))) out += ch
  }
  return out
}

/**
 * Locale-formatted number for a slide. EN -> `12,345.6`; FR -> grouped
 * with the regular no-break space (post substitution) and `,` decimal.
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

/**
 * Human-readable binary capacity from a MiB value: GiB under 1024 GiB,
 * else TiB (1 decimal). Raw MiB integers (e.g. 19,142,444) are unreadable
 * and wrap on a slide — the deck shows "18.3 TiB" instead. Non-finite ->
 * em-dash sentinel.
 */
export function pptxMemMib(mib: number, locale: ExportLocale): string {
  if (!Number.isFinite(mib)) return EM_DASH
  const gib = mib / 1024
  if (gib < 1024) return `${pptxNumber(Math.round(gib), locale)} GiB`
  return `${pptxNumber(gib / 1024, locale, 1)} TiB`
}
