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

/** Case-insensitive cell lookup by header name (RVTools varies casing). */
const cell = (row: Record<string, unknown>, ...names: string[]): string => {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase()
    if (names.includes(kl) && v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/**
 * True when the `vMetaData` sheet is the RVTools 4.x COLUMNAR shape (an
 * explicit `RVTools version` column / key on the first row), as opposed to
 * the legacy 2-column Property/Value sheet (RESEARCH Pitfall 3).
 */
const isColumnarMeta = (meta: { rows: Record<string, unknown>[] }): boolean => {
  const first = meta.rows[0]
  if (!first) return false
  return Object.keys(first).some((k) => k.toLowerCase() === 'rvtools version')
}

/**
 * Read the `Value` for a legacy `vMetaData` Property row whose key matches
 * `pred`. Returns `null` for the columnar 4.x shape (callers handle that via
 * `columnarMeta`).
 */
const metaValue = (sheets: ParsedWorkbook, pred: (property: string) => boolean): string | null => {
  const meta = findSheet(sheets, 'vMetaData')
  if (!meta || isColumnarMeta(meta)) return null
  for (const r of meta.rows) {
    const property = String(r.Property ?? r.property ?? '').toLowerCase()
    if (!pred(property)) continue
    const value = r.Value ?? r.value
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return null
}

/**
 * The RVTools 4.x columnar `vMetaData` rows as `{server,version,timestamp}`,
 * one per vCenter. `null` when the sheet is absent or legacy Property/Value.
 */
const columnarMeta = (
  sheets: ParsedWorkbook,
): { server: string; version: string; timestamp: string }[] | null => {
  const meta = findSheet(sheets, 'vMetaData')
  if (!meta || !isColumnarMeta(meta)) return null
  return meta.rows
    .map((r) => ({
      server: cell(r, 'server', 'vcenter server', 'vcenter'),
      version: cell(r, 'rvtools version'),
      timestamp: cell(r, 'xlsx creation datetime', 'exported timestamp', 'creation date'),
    }))
    .filter((e) => e.version !== '' || e.server !== '')
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

  // RVTools 4.x columnar: `xlsx creation datetime` (first vCenter row).
  const columnar = columnarMeta(sheets)
  const columnarTs = columnar?.find((e) => e.timestamp !== '')?.timestamp
  if (columnarTs != null) {
    const d = new Date(columnarTs)
    if (!Number.isNaN(d.getTime())) return d
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
export const inferVCenterLabel = (
  vinfo: VInfoRow[],
  filename: string,
  sheets?: ParsedWorkbook,
): string => {
  // RVTools 4.x columnar `Server` is the most precise per-vCenter label;
  // for a single-vCenter file it is the one Server, for a multi-vCenter
  // file the merge engine (Plan task 2) keys per-vCenter — the snapshot
  // label is the first Server as a sensible default.
  if (sheets) {
    const fromMeta = columnarMeta(sheets)?.find((e) => e.server !== '')?.server
    if (fromMeta) return fromMeta
  }
  const fromRow = vinfo.find((r) => r.viSdkServer.trim().length > 0)?.viSdkServer.trim()
  if (fromRow) return fromRow
  const stem = filename.replace(/\.xlsx$/i, '').replace(/^RVTools_export_(all|hosts|vms)_/i, '')
  return stem || filename
}

/**
 * RVTools generation. PRIMARY source is the authoritative `RVTools version`:
 *   1. RVTools 4.x columnar `vMetaData.RVTools version` (e.g. `4.7.1.4`)
 *   2. legacy `vMetaData` Property/Value `RVTools Version`
 *   3. `vInfo` marker-column sniffing (Pattern 3 / Pitfall 5) — drops the
 *      misleading `'3.11+'` fallback to a SECONDARY role (RESEARCH Pitfall 3)
 *   4. `'unknown'`
 */
export const inferRvtoolsVersion = (sheets: ParsedWorkbook): string => {
  const columnarVersion = columnarMeta(sheets)?.find((e) => e.version !== '')?.version
  if (columnarVersion != null) return columnarVersion

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
