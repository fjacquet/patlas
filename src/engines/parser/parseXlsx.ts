import * as XLSX from 'xlsx'

/**
 * Normalized representation of a single sheet after SheetJS parsing.
 * Headers are trimmed but case is preserved (adapters lower-case for
 * matching). Rows are objects keyed by the trimmed header strings; missing
 * cells are `null` rather than `undefined` to keep downstream code from
 * having to disambiguate "absent" vs "blank".
 */
export interface ParsedSheet {
  name: string
  headers: string[]
  rows: Record<string, unknown>[]
}

export interface ParsedWorkbook {
  /** Sheets keyed by their original name, insertion order preserved. */
  sheets: Map<string, ParsedSheet>
}

/**
 * Reads a workbook from an `ArrayBuffer` (or `Uint8Array`) and returns a
 * format-agnostic representation. No locale or vendor-specific knowledge
 * lives here — that's the job of the adapters.
 *
 * `{ dense: true }` (RESEARCH.md L469, Critical-5) keeps SheetJS's in-memory
 * representation a 2-D array instead of a key-per-cell object, materially
 * lowering peak heap on the 30 MB workbooks vatlas must parse in a worker.
 *
 * NOTE: this module pulls SheetJS into whatever bundle imports it — it is
 * therefore only ever imported from `parser.worker.ts`, never the main
 * thread (Pitfall 9 / RESEARCH.md L1119).
 */
export const parseXlsx = (buffer: ArrayBuffer | Uint8Array): ParsedWorkbook => {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const workbook = XLSX.read(data, { type: 'array', dense: true })

  const sheets = new Map<string, ParsedSheet>()
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    if (!ws) continue

    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      blankrows: false,
    })

    if (aoa.length === 0) {
      sheets.set(name, { name, headers: [], rows: [] })
      continue
    }

    const headerRow = aoa[0] ?? []
    const bodyRows = aoa.slice(1)
    const headers = headerRow.map((h) => (h == null ? '' : String(h).trim()))

    const rows = bodyRows.map((row) => {
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => {
        if (h.length === 0) return
        obj[h] = row[i] ?? null
      })
      return obj
    })

    sheets.set(name, { name, headers, rows })
  }

  return { sheets }
}
