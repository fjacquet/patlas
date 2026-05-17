import type { Snapshot } from '@/types/snapshot'

/**
 * Pure D-05 ordinal fallback. No I/O, no clock, no `crypto` — operates
 * solely on the passed snapshots. Establishes a deterministic stable load
 * order (ascending `parsedAt`, ties broken by `id` string compare) and
 * decides which snapshots have an undeterminable capture date so the
 * timeline can position them by ordinal instead of silently collapsing
 * them onto a fabricated real Date (CONTEXT D-05; RESEARCH Pattern 5).
 */

/**
 * A capture date is undeterminable when the parser exhausted its
 * inference chain (explicit -> filename ISO -> vMetaData -> mtime) and the
 * mtime fallback itself was absent — surfacing as the Unix epoch or an
 * invalid Date. Real dates are kept; nothing is fabricated.
 */
const isDeterminable = (d: Date): boolean => {
  const t = d.getTime()
  return !Number.isNaN(t) && t !== 0
}

export interface CaptureOrdinal {
  /** snapshotId -> 0-based stable load-order index. */
  loadOrder: Map<string, number>
  /**
   * snapshotId -> its load-order index when the snapshot's capture date
   * is undeterminable (positioned by ordinal, never a fake Date); `null`
   * when the snapshot has a usable real capture date.
   */
  ordinal: Map<string, number | null>
  /**
   * True when ANY selected snapshot has an undeterminable capture date —
   * the series ordering is partly inferred, so the UI surfaces the
   * factual D-05 caption.
   */
  orderInferred: boolean
}

/**
 * Compute the stable load order and the per-snapshot ordinal/undeterminable
 * assignment for the selected snapshots. Deterministic and pure: calling
 * twice with the same input yields a deeply-equal result and never mutates
 * the input array.
 */
export const captureDateOrdinal = (selected: Snapshot[]): CaptureOrdinal => {
  const stable = [...selected].sort((a, b) => {
    const byParsed = a.parsedAt.getTime() - b.parsedAt.getTime()
    if (byParsed !== 0) return byParsed
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const loadOrder = new Map<string, number>()
  const ordinal = new Map<string, number | null>()
  let orderInferred = false

  stable.forEach((snap, index) => {
    loadOrder.set(snap.id, index)
    if (isDeterminable(snap.capturedAt)) {
      ordinal.set(snap.id, null)
    } else {
      ordinal.set(snap.id, index)
      orderInferred = true
    }
  })

  return { loadOrder, ordinal, orderInferred }
}
