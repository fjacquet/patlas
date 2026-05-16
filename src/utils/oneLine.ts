/**
 * `oneLine` — collapse all internal whitespace runs to a single space and
 * trim the ends. This is the DISPLAY-ONLY boundary transform (03-PATTERNS
 * oneLine.ts / Minor-2): the inventory table renders multi-line cell text
 * (VM annotations, OS strings) on a single fixed-height row, with the
 * ORIGINAL untouched value kept in the cell `title` for hover.
 *
 * The CSV export path deliberately does NOT pass through `oneLine` — it
 * serialises the original value with newlines preserved (see `csv.ts`).
 * Two intentional, separate code paths: display collapses, data does not.
 *
 * Pure: no React, no i18n, no DOM. Net-new (the `format.ts` pure-module
 * idiom — provenance doc-comment + named export — is the template).
 */
export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()
