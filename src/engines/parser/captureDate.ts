import type { VInfoRow } from '@/types'
import type { ParsedWorkbook } from './parseXlsx'

/**
 * Pure capture-metadata inference. No I/O, no clock, no `crypto` — the worker
 * passes in `filename` + `mtime`; everything else is read off the parsed
 * workbook. Locked inference order per 01-RESEARCH.md.
 */

// `2026-01-07` or `2026-01-07_10.23.35` / `2026-01-07T10:23:35`.
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})(?:[_T](\d{2})[.:](\d{2})[.:](\d{2}))?/

const findSheet = (sheets: ParsedWorkbook, name: string) =>
  sheets.sheets.get(name) ?? sheets.sheets.get(name.toLowerCase())

/** Read the `Value` for a `vMetaData` Property row whose key matches `pred`. */
const metaValue = (sheets: ParsedWorkbook, pred: (property: string) => boolean): string | null => {
  const meta = findSheet(sheets, 'vMetaData')
  if (!meta) return null
  for (const r of meta.rows) {
    const property = String(r.Property ?? r.property ?? '').toLowerCase()
    if (!pred(property)) continue
    const value = r.Value ?? r.value
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return null
}

/**
 * Capture date, in priority order:
 *   1. explicit user input (Phase 6 hook)
 *   2. ISO date(+time) embedded in the filename
 *   3. `vMetaData.Exported Timestamp`
 *   4. file `lastModified` mtime
 */
export const inferCaptureDate = (
  filename: string,
  mtime: number,
  sheets: ParsedWorkbook,
  explicit?: Date,
): Date => {
  if (explicit) return explicit

  const m = filename.match(ISO_DATE_RE)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    const iso = `${y}-${mo}-${d}T${h ?? '00'}:${mi ?? '00'}:${s ?? '00'}Z`
    const parsed = new Date(iso)
    // Reject overflow (`new Date('2026-13-45')` parses to a real but wrong
    // Date; round-trip the ISO to detect the rollover).
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(`${y}-${mo}-${d}`)) {
      return parsed
    }
  }

  const exported = metaValue(sheets, (p) => p.includes('exported'))
  if (exported != null) {
    const d = new Date(exported)
    if (!Number.isNaN(d.getTime())) return d
  }

  return new Date(mtime)
}

/**
 * vCenter display label: the first non-empty `viSdkServer` from vInfo, else
 * the filename stem with the `RVTools_export_<scope>_` prefix stripped.
 */
export const inferVCenterLabel = (vinfo: VInfoRow[], filename: string): string => {
  const fromRow = vinfo.find((r) => r.viSdkServer.trim().length > 0)?.viSdkServer.trim()
  if (fromRow) return fromRow
  const stem = filename.replace(/\.xlsx$/i, '').replace(/^RVTools_export_(all|hosts|vms)_/i, '')
  return stem || filename
}

/**
 * RVTools generation: `vMetaData.RVTools Version` if present, else sniff the
 * `vInfo` marker columns (Pattern 3 / Pitfall 5), else `'unknown'`.
 */
export const inferRvtoolsVersion = (sheets: ParsedWorkbook): string => {
  const version = metaValue(sheets, (p) => p.includes('rvtools') && p.includes('version'))
  if (version != null) return version

  const vinfo = findSheet(sheets, 'vInfo')
  if (vinfo) {
    const headers = vinfo.headers.map((h) => h.toLowerCase())
    if (headers.includes('virtual machine tags')) return '4.0+'
    if (headers.includes('creation date')) return '3.11+'
  }
  return 'unknown'
}
