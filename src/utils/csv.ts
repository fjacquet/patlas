/**
 * Minimal RFC-4180 CSV serializer for the inventory "Export current view"
 * primitive (INV-05). Net-new — there is no in-repo CSV module; the
 * `format.ts` pure-module idiom (provenance doc-comment + named export,
 * zero React/i18n imports) is the structural template.
 *
 * DELIBERATE CONTRAST WITH `format.ts` (03-PATTERNS csv.ts deviation;
 * 03-RESEARCH Anti-Pattern "Formatting numbers in the CSV"):
 *   - `format.ts` is DISPLAY: locale-aware `toLocaleString`, em-dash
 *     sentinels — for the human reading the screen.
 *   - `csv.ts` is DATA: RAW values, NO `toLocaleString`, no locale
 *     grouping, no sentinels. Newlines inside a field are PRESERVED
 *     (quoted), never collapsed — a spreadsheet reopens the exact value.
 *
 * Security (T-03-02 / 03-RESEARCH Security): a cell whose text begins with
 * `=`, `+`, `-` or `@` is a CSV/Excel formula-injection vector. We prefix
 * such values with a single quote `'` so Excel/Sheets treats them as text.
 *
 * Pure: no React, no i18n, no DOM.
 */

/**
 * Serialise one cell. `null`/`undefined` → `''`; everything else is
 * `String(v)` raw (so `0` → `'0'`, numbers/booleans un-formatted). Leading
 * `=+-@` is single-quote-guarded. The value is double-quote-wrapped (with
 * internal `"` doubled) iff it contains a comma, quote, CR or LF.
 */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Serialise a header row + body rows into an RFC-4180 string: fields joined
 * by `,`, rows joined by CRLF (`\r\n`). Empty headers + no rows → `''`.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}
