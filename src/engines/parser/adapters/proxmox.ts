import type { ParsedSheet } from '../parseXlsx'
import { mapColumns, readCol, readString } from './columnMap'
import { CLUSTER_COLS } from './proxmoxColumns'

export const extractClusterName = (sheet: ParsedSheet | undefined): string => {
  if (!sheet || sheet.rows.length === 0) return ''
  const cols = mapColumns(sheet.headers, CLUSTER_COLS)
  const row = sheet.rows[0]
  return readString(readCol(row ?? {}, cols.name))
}
