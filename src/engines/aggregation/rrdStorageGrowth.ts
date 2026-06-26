/**
 * P8 Pack A — storage time-to-full analytics from the "RRD Storage"
 * time-series.
 *
 * Pure function (no React/Zustand/Zod/DOM, no clock). The source sheet is
 * LARGE (~36k rows), so this folds it in a SINGLE pass into per-storage
 * least-squares accumulators — it never materializes per-storage sample
 * arrays. For each `node/storage` it derives the used-capacity growth rate
 * (GiB/day) and projects days-to-full from the LATEST observed used/size.
 *
 * `daysToFull` is `null` when the storage is not growing (slope ≤ 0), already
 * full, or has too few samples to fit a line — never a fabricated number.
 * Neutral measurement only; the x axis is centred on each group's first serial
 * to keep the slope numerically stable against the large Excel serials.
 */
import type { RrdStorageGrowth, RrdStorageProjection } from '@/types/estate'
import type { RrdStorageRow } from '@/types/snapshot'

interface Acc {
  node: string
  storage: string
  n: number
  firstX: number
  sx: number
  sy: number
  sxy: number
  sxx: number
  maxX: number
  minX: number
  lastSize: number
  lastUsed: number
  lastRatio: number
}

const EMPTY: RrdStorageGrowth = Object.freeze({
  hasData: false,
  rows: Object.freeze([]) as never[],
  soonestDaysToFull: null,
  windowDays: 0,
})

// A flat-but-noisy series yields a microscopic positive least-squares slope
// (~1e-13 GiB/day), which would project an absurd ~10^14-day fill date. Any
// projection beyond a century is not actionable and is noise-driven, so it
// degrades to "not projectable" (null) — never a fabricated time-to-full.
const MAX_HORIZON_DAYS = 36525 // ~100 years

/**
 * Project per-storage days-to-full from RRD-Storage samples (concatenated
 * across the selected snapshots). Returns the frozen empty result when there
 * are no samples (factual-degrade).
 */
export const computeRrdStorageGrowth = (rows: RrdStorageRow[]): RrdStorageGrowth => {
  if (rows.length === 0) return EMPTY

  const byKey = new Map<string, Acc>()
  let globalMin = Number.POSITIVE_INFINITY
  let globalMax = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    const key = `${row.node}/${row.storage}`
    let acc = byKey.get(key)
    if (!acc) {
      acc = {
        node: row.node,
        storage: row.storage,
        n: 0,
        firstX: row.timeSerial,
        sx: 0,
        sy: 0,
        sxy: 0,
        sxx: 0,
        maxX: Number.NEGATIVE_INFINITY,
        minX: Number.POSITIVE_INFINITY,
        lastSize: row.sizeGib,
        lastUsed: row.usedGib,
        lastRatio: row.usageRatio,
      }
      byKey.set(key, acc)
    }
    // Centre x on the group's first serial — slope is shift-invariant, and
    // this avoids precision loss from squaring ~46 000-magnitude serials.
    const xc = row.timeSerial - acc.firstX
    const y = row.usedGib
    acc.n += 1
    acc.sx += xc
    acc.sy += y
    acc.sxy += xc * y
    acc.sxx += xc * xc
    if (row.timeSerial >= acc.maxX) {
      acc.maxX = row.timeSerial
      acc.lastSize = row.sizeGib
      acc.lastUsed = row.usedGib
      acc.lastRatio = row.usageRatio
    }
    if (row.timeSerial < acc.minX) acc.minX = row.timeSerial
    if (row.timeSerial < globalMin) globalMin = row.timeSerial
    if (row.timeSerial > globalMax) globalMax = row.timeSerial
  }

  const out: RrdStorageProjection[] = []
  let soonest: number | null = null
  for (const acc of byKey.values()) {
    const denom = acc.n * acc.sxx - acc.sx * acc.sx
    const slope = acc.n >= 2 && denom !== 0 ? (acc.n * acc.sxy - acc.sx * acc.sy) / denom : 0
    const remaining = acc.lastSize - acc.lastUsed
    const projected = slope > 0 && remaining > 0 ? remaining / slope : null
    // Cap the horizon: a projection beyond ~100 years is noise, not signal.
    const daysToFull = projected !== null && projected <= MAX_HORIZON_DAYS ? projected : null
    if (daysToFull !== null && (soonest === null || daysToFull < soonest)) soonest = daysToFull
    out.push({
      node: acc.node,
      storage: acc.storage,
      key: `${acc.node}/${acc.storage}`,
      sizeGib: acc.lastSize,
      usedGib: acc.lastUsed,
      usageRatio: acc.lastRatio,
      growthGibPerDay: slope,
      daysToFull,
      sampleCount: acc.n,
    })
  }

  // Soonest-to-full first (nulls sink to the bottom), then highest usage.
  out.sort((a, b) => {
    if (a.daysToFull === null && b.daysToFull === null) return b.usageRatio - a.usageRatio
    if (a.daysToFull === null) return 1
    if (b.daysToFull === null) return -1
    return a.daysToFull - b.daysToFull
  })

  return {
    hasData: true,
    rows: out,
    soonestDaysToFull: soonest,
    windowDays:
      Number.isFinite(globalMax) && Number.isFinite(globalMin) ? globalMax - globalMin : 0,
  }
}
