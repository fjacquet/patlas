import type { ProxmoxSnapshotRow } from '@/types/snapshot'

/**
 * Pure snapshot-sprawl extract — how many guest snapshots ("checkpoints") the
 * estate still holds, how old, how big. Neutral measurement only — no verdict,
 * no severity (ADR-0012). No React/Zustand/Zod/DOM.
 *
 * The Proxmox report emits a per-guest live-state marker row (`name ===
 * 'current'`, `parent === 'no-parent'`) that is NOT a checkpoint — it is
 * excluded from sprawl. `today` is the injected reference clock (same
 * discipline as the EOS forecast) so this stays a pure function.
 */

const MS_PER_DAY = 86_400_000
// Days between the Excel epoch (1899-12-30) and the Unix epoch (1970-01-01).
const EXCEL_UNIX_OFFSET_DAYS = 25_569

/** Convert an Excel serial date to Unix epoch milliseconds. */
export const excelSerialToUnixMs = (serial: number): number =>
  Math.round((serial - EXCEL_UNIX_OFFSET_DAYS) * MS_PER_DAY)

export interface SnapshotSprawlRow {
  guestName: string
  guestId: string
  guestType: 'qemu' | 'lxc'
  node: string
  name: string
  /** Whole days since creation; `null` when the source date was blank. */
  ageDays: number | null
  sizeMib: number
  includeRam: boolean
}

export interface SnapshotSprawl {
  /** Real checkpoints only (the `current` marker excluded), oldest first. */
  rows: SnapshotSprawlRow[]
  count: number
  guestsWithSnapshots: number
  totalSizeMib: number
  /** Oldest checkpoint age in days; `null` when no dated checkpoint exists. */
  oldestAgeDays: number | null
}

const isCurrentMarker = (name: string): boolean => name.trim().toLowerCase() === 'current'

export const computeSnapshotSprawl = (
  snapshots: ProxmoxSnapshotRow[],
  today: Date,
): SnapshotSprawl => {
  const real = snapshots.filter((s) => !isCurrentMarker(s.name))
  const rows: SnapshotSprawlRow[] = real.map((s) => ({
    guestName: s.guestName,
    guestId: s.guestId,
    guestType: s.guestType,
    node: s.node,
    name: s.name,
    ageDays:
      s.dateSerial === null
        ? null
        : Math.max(
            0,
            Math.floor((today.getTime() - excelSerialToUnixMs(s.dateSerial)) / MS_PER_DAY),
          ),
    sizeMib: s.sizeMib as number,
    includeRam: s.includeRam,
  }))
  // Oldest first; rows with no date (null age) sort last.
  rows.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1))

  const guests = new Set(real.map((s) => s.guestId))
  const totalSizeMib = real.reduce((acc, s) => acc + (s.sizeMib as number), 0)
  const ages = rows.map((r) => r.ageDays).filter((a): a is number => a !== null)
  const oldestAgeDays = ages.length === 0 ? null : Math.max(...ages)

  return {
    rows,
    count: real.length,
    guestsWithSnapshots: guests.size,
    totalSizeMib,
    oldestAgeDays,
  }
}
