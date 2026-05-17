/**
 * Locale-aware display formatters — ported verbatim from vsizer
 * `src/utils/format.ts` (RESEARCH A4: zero-change port). Two vatlas deltas:
 *
 * 1. `fmtMemMb` suffixes `GB`/`TB` → `GiB`/`TiB` (ADR-0010 — the values
 *    are base-2; the suffix must say so. The `/1024/1024` arithmetic is
 *    already base-2-correct and is left untouched).
 * 2. `locale` is a passed parameter (callers pass `i18n.language` in
 *    02-03); the `'fr-FR'` default is kept for the port's own tests.
 *
 * Functions take bare `number` — unwrap the brand at the call site
 * (`fmtGhzValue(view.globals.physicalGhz as number)`). The em-dash
 * sentinel on non-finite input is mandatory (never 0 / "N/A").
 */

/**
 * Locale-aware integer formatter. Returns an em-dash for non-finite inputs
 * so the dashboard can render placeholders without ad-hoc null guards.
 */
export const fmtInt = (n: number, locale = 'fr-FR'): string =>
  Number.isFinite(n) ? n.toLocaleString(locale, { maximumFractionDigits: 0 }) : '—'

/**
 * Renders a unit-bearing GHz value from MHz (RVTools' native speed unit).
 * One decimal of precision is enough for cluster-level reporting.
 */
export const fmtGhz = (mhz: number, locale = 'fr-FR'): string => {
  if (!Number.isFinite(mhz)) return '—'
  const ghz = mhz / 1000
  return `${ghz.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} GHz`
}

/**
 * Locale-aware unitless GHz formatter with **adaptive precision**: one
 * decimal for sub-10 values, integer otherwise. Returns em-dash for
 * non-finite inputs.
 */
export const fmtGhzNumber = (ghz: number, locale = 'fr-FR'): string => {
  if (!Number.isFinite(ghz)) return '—'
  const opts =
    Math.abs(ghz) < 10
      ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 }
  return ghz.toLocaleString(locale, opts)
}

/**
 * Renders an already-GHz value as a unit-bearing string. Adaptive
 * precision (see `fmtGhzNumber`).
 */
export const fmtGhzValue = (ghz: number, locale = 'fr-FR'): string =>
  Number.isFinite(ghz) ? `${fmtGhzNumber(ghz, locale)} GHz` : '—'

/**
 * Renders an already-MHz value as a unit-bearing string (`"385 MHz"`).
 * `0` is a sentinel ("no powered-on vCPUs to divide by") → em-dash.
 */
export const fmtMhzValue = (mhz: number, locale = 'fr-FR'): string => {
  if (!Number.isFinite(mhz) || mhz === 0) return '—'
  return `${Math.round(mhz).toLocaleString(locale, { maximumFractionDigits: 0 })} MHz`
}

/**
 * Renders a 0..1 ratio as a localized percent (one decimal). Inputs
 * outside [0, 1] pass through unmodified — clamp upstream if needed.
 */
export const fmtPercent = (ratio: number, locale = 'fr-FR'): string =>
  Number.isFinite(ratio)
    ? ratio.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
    : '—'

/** Same as `fmtPercent` but with no decimals — `"23 %"`. */
export const fmtPercentWhole = (ratio: number, locale = 'fr-FR'): string =>
  Number.isFinite(ratio)
    ? ratio.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 0 })
    : '—'

/**
 * Format an already-percentage value (0..200) with one decimal and a
 * trailing `%`. Distinct from `fmtPercent` (which expects a 0..1 ratio).
 * Used for CPU Ready (already in percent units — ADR-0012).
 */
export const fmtPercentValue = (percent: number, locale = 'fr-FR'): string =>
  Number.isFinite(percent)
    ? `${percent.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
    : '—'

/**
 * Render a vCPU/pCPU consolidation ratio as `"X.X : 1"`. Locale-aware
 * decimal separator. Em-dash for non-finite or zero ratios.
 */
export const fmtRatio = (ratio: number, locale = 'fr-FR'): string => {
  if (!Number.isFinite(ratio) || ratio === 0) return '—'
  const formatted = ratio.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${formatted} : 1`
}

/**
 * Formats a memory amount given in MiB with TiB / GiB / MiB tiering
 * (ADR-0010 — RVTools "MB" IS base-2 MiB; the suffix says so, the math is
 * unchanged from vsizer's base-2 `/1024/1024`).
 *   ≥ 1 048 576 MiB → `"X.X TiB"`
 *   ≥ 1 024 MiB     → `"X.X GiB"`
 *   else            → `"X MiB"`
 */
export const fmtMemMb = (mb: number, locale = 'fr-FR'): string => {
  if (!Number.isFinite(mb)) return '—'
  const opts = { maximumFractionDigits: 1, minimumFractionDigits: 1 } as const
  const abs = Math.abs(mb)
  if (abs >= 1024 * 1024) return `${(mb / 1024 / 1024).toLocaleString(locale, opts)} TiB`
  if (abs >= 1024) return `${(mb / 1024).toLocaleString(locale, opts)} GiB`
  return `${Math.round(mb).toLocaleString(locale, { maximumFractionDigits: 0 })} MiB`
}

/**
 * Locale-aware date formatter for the bundled EOS catalogue dates (P7
 * D-03). Takes an ISO `YYYY-MM-DD` string; returns the em-dash sentinel
 * for any unparseable input (never `0`/"N/A" — D-00). Callers pass
 * `i18n.language`; the `'fr-FR'` default mirrors the other formatters.
 */
export const fmtDate = (iso: string, locale = 'fr-FR'): string => {
  // Parse the YYYY-MM-DD components into a LOCAL-time date. `Date.parse` would
  // read the bare ISO date as UTC midnight, which `toLocaleDateString` then
  // shifts back a day for UTC-negative hosts (e.g. '2026-05-17' → "May 16").
  // The round-trip check rejects overflow (e.g. '2026-02-30') → '—' sentinel.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m === null) return '—'
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const date = new Date(year, month, day)
  return date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day
    ? '—'
    : date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}
