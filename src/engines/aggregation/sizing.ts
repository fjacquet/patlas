import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { CONTENTION_THRESHOLDS } from './contention'

/**
 * Pure right-sizing/stress engine — mirrors `thresholdFlags.ts` +
 * `contention.ts`. No React/Zustand/Zod/DOM.
 *
 * Evaluates per-resource (CPU and/or memory, independently), on POWERED-ON
 * VMs only, using the MAX across loaded snapshots. Any `null` input ⇒ that
 * resource's util is `null` and its flags `false` (ADR-0012 — an absent
 * measurement is "not derivable", NEVER coerced to 0). Divide-by-zero is
 * guarded (the `fsOver` precedent), never `Infinity`/`NaN`.
 *
 * Three categories, evaluated against user-editable thresholds:
 *  - Oversized:  utilization at/below the oversize line (allocation ≫ usage)
 *  - Undersized: utilization at/above the undersize line (usage ≈ allocation)
 *  - Stressed:   runtime pressure — ballooning/swapping (memory) or CPU Ready
 */

export interface SizingThresholds {
  cpuOversizePct: number
  memOversizePct: number
  cpuUndersizePct: number
  memUndersizePct: number
  balloonMib: number
  swapMib: number
}

/** RVTools-rightsizing defaults. Single source of truth — the store
 *  re-exports this (the `DEFAULT_THRESHOLDS` pattern). CPU-Ready stress
 *  reuses `CONTENTION_THRESHOLDS.warning`, so it is NOT duplicated here. */
export const DEFAULT_SIZING_THRESHOLDS: SizingThresholds = {
  cpuOversizePct: 10,
  memOversizePct: 20,
  cpuUndersizePct: 90,
  memUndersizePct: 90,
  balloonMib: 0,
  swapMib: 0,
}

export interface SizingFlags {
  cpuOversized: boolean
  memOversized: boolean
  cpuUndersized: boolean
  memUndersized: boolean
  memStressed: boolean
  cpuStressed: boolean
}

export interface VmSizing {
  vmName: string
  cluster: string
  host: string
  vcpu: number
  vramMib: number
  cpuUtilPct: number | null
  memActivePct: number | null
  memConsumedPct: number | null
  balloonedMib: number | null
  swappedMib: number | null
  cpuReadinessPercent: number | null
  sampleBasis: 'single' | 'max-of-N'
  flags: SizingFlags
}

export interface SizingCounts {
  oversized: number
  undersized: number
  stressed: number
  cpuOversized: number
  memOversized: number
  cpuUndersized: number
  memUndersized: number
  memStressed: number
  cpuStressed: number
}

export interface EstateSizing {
  rows: VmSizing[]
  counts: SizingCounts
  thresholds: SizingThresholds
  snapshotCount: number
  /** true when at least one usage metric was derivable across the snapshots. */
  hasUsageData: boolean
}

export interface MaxUsage {
  activeMib: number | null
  consumedMib: number | null
  balloonedMib: number | null
  swappedMib: number | null
  cpuUsageMhz: number | null
}

/** Identity key for joining usage to a VM (instance uuid → bios uuid →
 *  name+cluster). Matches the parser's `usageIdentity`. */
const identity = (r: {
  vmInstanceUuid: string
  vmBiosUuid: string
  vmName: string
  cluster: string
}): string => r.vmInstanceUuid || r.vmBiosUuid || `${r.vmName}::${r.cluster}`

/** Max of two nullable numbers, treating `null` as "no sample". */
const maxN = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b)

/**
 * Per-identity max of each usage metric over POWERED-ON samples across all
 * snapshots. A single snapshot yields that one reading. Snapshots whose raw
 * rows were released (or test fixtures without the field) contribute nothing.
 */
export const maxVmUsageAcrossSnapshots = (snapshots: Snapshot[]): Map<string, MaxUsage> => {
  const out = new Map<string, MaxUsage>()
  for (const snap of snapshots) {
    const poweredOn = new Set<string>()
    for (const v of snap.vinfo ?? []) if (v.poweredOn) poweredOn.add(identity(v))
    for (const u of snap.vmUsage ?? []) {
      const id = identity(u)
      if (!poweredOn.has(id)) continue
      const prev = out.get(id)
      out.set(id, {
        activeMib: maxN(prev?.activeMib ?? null, u.activeMib),
        consumedMib: maxN(prev?.consumedMib ?? null, u.consumedMib),
        balloonedMib: maxN(prev?.balloonedMib ?? null, u.balloonedMib),
        swappedMib: maxN(prev?.swappedMib ?? null, u.swappedMib),
        cpuUsageMhz: maxN(prev?.cpuUsageMhz ?? null, u.cpuUsageMhz),
      })
    }
  }
  return out
}

/** CPU utilization % — `null` when usage or host speed is not derivable, or
 *  capacity is 0 (guarded; never `Infinity`/`NaN`). */
export const cpuUtil = (
  usageMhz: number | null,
  vcpu: number,
  coreMhz: number | undefined,
): number | null => {
  if (usageMhz === null || coreMhz === undefined) return null
  const cap = vcpu * coreMhz
  return cap > 0 ? (usageMhz / cap) * 100 : null
}

/** Memory % of configured — `null` when the metric is absent or configured 0. */
export const memPct = (mibUsed: number | null, vramMib: number): number | null =>
  mibUsed === null || vramMib <= 0 ? null : (mibUsed / vramMib) * 100

export const computeSizing = (
  vinfo: VInfoRow[],
  vhost: VHostRow[],
  maxUsage: Map<string, MaxUsage>,
  thresholds: SizingThresholds,
  snapshotCount: number,
): EstateSizing => {
  const speedByHost = new Map<string, number>()
  for (const h of vhost) if (h.hostName !== '') speedByHost.set(h.hostName, h.speedMhz as number)

  const basis: VmSizing['sampleBasis'] = snapshotCount >= 2 ? 'max-of-N' : 'single'
  const rows: VmSizing[] = []
  let hasUsageData = false
  const counts: SizingCounts = {
    oversized: 0,
    undersized: 0,
    stressed: 0,
    cpuOversized: 0,
    memOversized: 0,
    cpuUndersized: 0,
    memUndersized: 0,
    memStressed: 0,
    cpuStressed: 0,
  }

  for (const v of vinfo) {
    if (!v.poweredOn) continue
    const u = maxUsage.get(identity(v))
    if (u) hasUsageData = true
    const vcpuN = v.vcpu as number
    const vramN = v.vramMib as number
    const cpuUtilPct = cpuUtil(u?.cpuUsageMhz ?? null, vcpuN, speedByHost.get(v.host))
    const memActivePct = memPct(u?.activeMib ?? null, vramN)
    const memConsumedPct = memPct(u?.consumedMib ?? null, vramN)
    const ballooned = u?.balloonedMib ?? null
    const swapped = u?.swappedMib ?? null
    const ready = v.cpuReadinessPercent

    const flags: SizingFlags = {
      cpuOversized: cpuUtilPct !== null && cpuUtilPct <= thresholds.cpuOversizePct,
      memOversized: memActivePct !== null && memActivePct <= thresholds.memOversizePct,
      cpuUndersized: cpuUtilPct !== null && cpuUtilPct >= thresholds.cpuUndersizePct,
      memUndersized: memActivePct !== null && memActivePct >= thresholds.memUndersizePct,
      memStressed:
        (ballooned !== null && ballooned > thresholds.balloonMib) ||
        (swapped !== null && swapped > thresholds.swapMib),
      cpuStressed: ready !== null && ready > CONTENTION_THRESHOLDS.warning,
    }

    if (flags.cpuOversized) counts.cpuOversized += 1
    if (flags.memOversized) counts.memOversized += 1
    if (flags.cpuUndersized) counts.cpuUndersized += 1
    if (flags.memUndersized) counts.memUndersized += 1
    if (flags.memStressed) counts.memStressed += 1
    if (flags.cpuStressed) counts.cpuStressed += 1
    if (flags.cpuOversized || flags.memOversized) counts.oversized += 1
    if (flags.cpuUndersized || flags.memUndersized) counts.undersized += 1
    if (flags.memStressed || flags.cpuStressed) counts.stressed += 1

    rows.push({
      vmName: v.vmName,
      cluster: v.cluster,
      host: v.host,
      vcpu: vcpuN,
      vramMib: vramN,
      cpuUtilPct,
      memActivePct,
      memConsumedPct,
      balloonedMib: ballooned,
      swappedMib: swapped,
      cpuReadinessPercent: ready,
      sampleBasis: basis,
      flags,
    })
  }

  return { rows, counts, thresholds, snapshotCount, hasUsageData }
}
