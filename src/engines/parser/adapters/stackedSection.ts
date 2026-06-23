/**
 * Pure extractor for Proxmox "stacked" composite sheets (`Cluster`,
 * `Cluster HA`), which pack several titled sub-tables into one sheet:
 *
 *   <Section Title>            (a row with ONE non-empty cell)
 *   <col1> <col2> <col3> ...   (the sub-table's header row)
 *   <data> ...                 (zero or more data rows)
 *   <Next Section Title>       (one non-empty cell -> boundary)
 *
 * `parseXlsx`'s header-keyed `rows` is useless here (row 0 is a 1-cell title),
 * so this works off the raw `cells` grid. Returns the sub-table's header
 * strings and its data rows keyed by those headers. No React/Zustand/Zod/DOM.
 *
 * Boundary rule: a section starts at the first row whose first cell equals
 * `title` AND has exactly one non-empty cell (so multi-cell TOC/index rows are
 * skipped); data ends at the next row with <=1 non-empty cell (next title or a
 * blank row). Sub-tables in these sheets always have >=2 populated columns per
 * data row, so this is unambiguous for the Proxmox layout.
 */

const norm = (v: unknown): string => (v == null ? '' : String(v).trim())
const nonEmptyCount = (row: unknown[]): number =>
  row.reduce<number>((n, c) => (norm(c) !== '' ? n + 1 : n), 0)

export const extractStackedSection = (
  cells: unknown[][],
  title: string,
): { headers: string[]; rows: Record<string, unknown>[] } => {
  const want = title.trim().toLowerCase()
  let start = -1
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (norm(row[0]).toLowerCase() === want && nonEmptyCount(row) === 1) {
      start = r
      break
    }
  }
  if (start === -1) return { headers: [], rows: [] }

  const headers = (cells[start + 1] ?? []).map(norm)
  const rows: Record<string, unknown>[] = []
  for (let r = start + 2; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (nonEmptyCount(row) <= 1) break
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (h !== '') obj[h] = row[i] ?? null
    })
    rows.push(obj)
  }
  return { headers, rows }
}
