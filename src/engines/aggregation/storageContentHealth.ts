import type { ProxmoxStorageContentRow } from '@/types/snapshot'
import { excelSerialToUnixMs } from './snapshotSprawl'

/**
 * Pure storage-content health extract — what occupies each Proxmox storage,
 * by content type and by storage, plus a backup-file inventory (content
 * 'backup') with per-guest recency. Neutral measurement only — no verdict
 * (ADR-0012). No React/Zustand/Zod/DOM. `today` is the injected reference
 * clock (same discipline as the EOS forecast / snapshot sprawl).
 */

const MS_PER_DAY = 86_400_000

export interface StorageContentTypeGroup {
  content: string
  count: number
  totalSizeMib: number
}

export interface StorageGroup {
  storage: string
  count: number
  totalSizeMib: number
}

export interface BackupFileRow {
  guestName: string
  guestId: string
  storage: string
  fileName: string
  /** Whole days since creation; `null` when the source date was blank. */
  ageDays: number | null
  sizeMib: number
}

export interface StorageContentHealth {
  /** Per content type, sorted by total size desc. */
  byContent: StorageContentTypeGroup[]
  /** Per storage, sorted by total size desc. */
  byStorage: StorageGroup[]
  backups: {
    /** content === 'backup' files, newest first. */
    rows: BackupFileRow[]
    count: number
    guestsCovered: number
    totalSizeMib: number
    /** Smallest age among dated backups; `null` when none dated. */
    newestAgeDays: number | null
    /** Largest age among dated backups; `null` when none dated. */
    oldestAgeDays: number | null
  }
  totalSizeMib: number
  fileCount: number
}

const ageDaysOf = (serial: number | null, today: Date): number | null =>
  serial === null
    ? null
    : Math.max(0, Math.floor((today.getTime() - excelSerialToUnixMs(serial)) / MS_PER_DAY))

const groupBy = <K extends string>(
  rows: ProxmoxStorageContentRow[],
  keyOf: (r: ProxmoxStorageContentRow) => K,
): Map<K, { count: number; totalSizeMib: number }> => {
  const out = new Map<K, { count: number; totalSizeMib: number }>()
  for (const r of rows) {
    const k = keyOf(r)
    const acc = out.get(k) ?? { count: 0, totalSizeMib: 0 }
    acc.count += 1
    acc.totalSizeMib += r.sizeMib as number
    out.set(k, acc)
  }
  return out
}

export const computeStorageContentHealth = (
  rows: ProxmoxStorageContentRow[],
  today: Date,
): StorageContentHealth => {
  const byContent: StorageContentTypeGroup[] = [...groupBy(rows, (r) => r.content)]
    .map(([content, v]) => ({ content, count: v.count, totalSizeMib: v.totalSizeMib }))
    .sort((a, b) => b.totalSizeMib - a.totalSizeMib)

  const byStorage: StorageGroup[] = [...groupBy(rows, (r) => r.storage)]
    .map(([storage, v]) => ({ storage, count: v.count, totalSizeMib: v.totalSizeMib }))
    .sort((a, b) => b.totalSizeMib - a.totalSizeMib)

  const backupRows: BackupFileRow[] = rows
    .filter((r) => r.content.trim().toLowerCase() === 'backup')
    .map((r) => ({
      guestName: r.guestName,
      guestId: r.guestId,
      storage: r.storage,
      fileName: r.fileName,
      ageDays: ageDaysOf(r.creationSerial, today),
      sizeMib: r.sizeMib as number,
    }))
  // Newest first; undated (null age) last.
  backupRows.sort(
    (a, b) => (a.ageDays ?? Number.POSITIVE_INFINITY) - (b.ageDays ?? Number.POSITIVE_INFINITY),
  )

  const dated = backupRows.map((r) => r.ageDays).filter((a): a is number => a !== null)
  const guests = new Set(backupRows.map((r) => r.guestId).filter((g) => g !== ''))

  return {
    byContent,
    byStorage,
    backups: {
      rows: backupRows,
      count: backupRows.length,
      guestsCovered: guests.size,
      totalSizeMib: backupRows.reduce((acc, r) => acc + r.sizeMib, 0),
      newestAgeDays: dated.length === 0 ? null : Math.min(...dated),
      oldestAgeDays: dated.length === 0 ? null : Math.max(...dated),
    },
    totalSizeMib: rows.reduce((acc, r) => acc + (r.sizeMib as number), 0),
    fileCount: rows.length,
  }
}
