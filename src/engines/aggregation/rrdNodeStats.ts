/**
 * P8 Pack A — node-headroom analytics from the "RRD Nodes" time-series.
 *
 * Pure function (no React/Zustand/Zod/DOM, no clock). Turns the per-node
 * sample stream into peak / avg / p95 CPU & memory plus PSI memory-pressure,
 * IO-wait, loadavg and net throughput, and an estate-wide utilization timeline
 * (the mean across nodes at each timestamp) that drives the single-file trends
 * view. Neutral measurement only — no verdict, no severity, no colour.
 *
 * All `*Ratio` inputs are 0-1 fractions (the report's "%" columns). The
 * timeline is keyed on a fixed-precision serial so the per-node samples taken
 * at the same minute collapse into one point.
 */
import type { RrdEstateTimePoint, RrdHeadroom, RrdNodeStat } from '@/types/estate'
import type { RrdNodeRow } from '@/types/snapshot'

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

const peak = (xs: number[]): number => (xs.length === 0 ? 0 : Math.max(...xs))

/** Nearest-rank p95 over an UNSORTED array (sorts a copy). 0 when empty. */
const p95 = (xs: number[]): number => {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1))
  return sorted[idx] ?? 0
}

const statOf = (node: string, rows: RrdNodeRow[]): RrdNodeStat => {
  const cpu = rows.map((r) => r.cpuRatio)
  const mem = rows.map((r) => r.memRatio)
  const ioWait = rows.map((r) => r.ioWaitRatio)
  const load = rows.map((r) => r.loadavg)
  const netIn = rows.map((r) => r.netInMb)
  const netOut = rows.map((r) => r.netOutMb)
  const psiMem = rows.map((r) => r.psiMemSomeRatio)
  return {
    node,
    cpuPeak: peak(cpu),
    cpuAvg: mean(cpu),
    cpuP95: p95(cpu),
    memPeak: peak(mem),
    memAvg: mean(mem),
    memP95: p95(mem),
    ioWaitPeak: peak(ioWait),
    ioWaitAvg: mean(ioWait),
    loadavgPeak: peak(load),
    loadavgAvg: mean(load),
    netInPeakMb: peak(netIn),
    netInAvgMb: mean(netIn),
    netOutPeakMb: peak(netOut),
    netOutAvgMb: mean(netOut),
    psiMemPeak: peak(psiMem),
    psiMemAvg: mean(psiMem),
    sampleCount: rows.length,
  }
}

export const EMPTY_RRD_HEADROOM: RrdHeadroom = Object.freeze({
  hasData: false,
  perNode: Object.freeze([]) as never[],
  estate: Object.freeze({
    cpuPeak: 0,
    cpuAvg: 0,
    memPeak: 0,
    memAvg: 0,
    ioWaitPeak: 0,
    loadavgPeak: 0,
    psiMemPeak: 0,
  }),
  timeline: Object.freeze([]) as never[],
  windowStartSerial: null,
  windowEndSerial: null,
})

/**
 * Build the node-headroom rollup from RRD-Nodes samples (concatenated across
 * the selected snapshots — peak/avg/p95 over the loaded window). Returns the
 * frozen empty result when there are no samples (factual-degrade).
 */
export const computeRrdNodeStats = (rows: RrdNodeRow[]): RrdHeadroom => {
  if (rows.length === 0) return EMPTY_RRD_HEADROOM

  // Group by node (single pass) and build per-timestamp accumulators for the
  // estate-wide timeline at the same time.
  const byNode = new Map<string, RrdNodeRow[]>()
  interface TimeAcc {
    serial: number
    cpuSum: number
    memSum: number
    netIn: number
    netOut: number
    n: number
  }
  const byTime = new Map<string, TimeAcc>()
  let minSerial = Number.POSITIVE_INFINITY
  let maxSerial = Number.NEGATIVE_INFINITY
  // Estate-wide accumulators (single pass — no full-array spreads at 8.6k rows).
  let cpuSum = 0
  let memSum = 0
  let cpuPeak = 0
  let memPeak = 0
  let ioWaitPeak = 0
  let loadavgPeak = 0
  let psiMemPeak = 0

  for (const row of rows) {
    const list = byNode.get(row.node)
    if (list) list.push(row)
    else byNode.set(row.node, [row])

    if (row.timeSerial < minSerial) minSerial = row.timeSerial
    if (row.timeSerial > maxSerial) maxSerial = row.timeSerial
    cpuSum += row.cpuRatio
    memSum += row.memRatio
    if (row.cpuRatio > cpuPeak) cpuPeak = row.cpuRatio
    if (row.memRatio > memPeak) memPeak = row.memRatio
    if (row.ioWaitRatio > ioWaitPeak) ioWaitPeak = row.ioWaitRatio
    if (row.loadavg > loadavgPeak) loadavgPeak = row.loadavg
    if (row.psiMemSomeRatio > psiMemPeak) psiMemPeak = row.psiMemSomeRatio

    const key = row.timeSerial.toFixed(5)
    const acc = byTime.get(key)
    if (acc) {
      acc.cpuSum += row.cpuRatio
      acc.memSum += row.memRatio
      acc.netIn += row.netInMb
      acc.netOut += row.netOutMb
      acc.n += 1
    } else {
      byTime.set(key, {
        serial: row.timeSerial,
        cpuSum: row.cpuRatio,
        memSum: row.memRatio,
        netIn: row.netInMb,
        netOut: row.netOutMb,
        n: 1,
      })
    }
  }

  const perNode = [...byNode.entries()]
    .map(([node, list]) => statOf(node, list))
    .sort((a, b) => b.cpuPeak - a.cpuPeak)

  const timeline: RrdEstateTimePoint[] = [...byTime.values()]
    .map((a) => ({
      timeSerial: a.serial,
      cpuAvg: a.cpuSum / a.n,
      memAvg: a.memSum / a.n,
      netInMb: a.netIn,
      netOutMb: a.netOut,
    }))
    .sort((a, b) => a.timeSerial - b.timeSerial)

  return {
    hasData: true,
    perNode,
    estate: {
      cpuPeak,
      cpuAvg: cpuSum / rows.length,
      memPeak,
      memAvg: memSum / rows.length,
      ioWaitPeak,
      loadavgPeak,
      psiMemPeak,
    },
    timeline,
    windowStartSerial: Number.isFinite(minSerial) ? minSerial : null,
    windowEndSerial: Number.isFinite(maxSerial) ? maxSerial : null,
  }
}
