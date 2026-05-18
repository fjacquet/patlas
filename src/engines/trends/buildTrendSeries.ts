import { aggregateClusters, aggregateGlobals, perDatastore } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { gib, mib } from '@/engines/units'
import { mibToGib } from '@/engines/units/converters'
import type {
  AccountingMode,
  TrendDelta,
  TrendHeadline,
  TrendPoint,
  TrendSeries,
} from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import { captureDateOrdinal } from './captureDateOrdinal'

/**
 * Pure temporal-trends engine (DD-A A2 / DD-B B1 / DD-C carry / D-05
 * ordinal). No React/DOM/Zustand/Zod, no clock — every value is the
 * shipped aggregate, so a point's counts reconcile with the dashboard for
 * that day by construction. Composed inside the single `buildEstateView`
 * pass; never a component or a separate memoised hook.
 */

const dayKey = (d: Date): string => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`

const poweredOnOf = (vinfo: { template: boolean; powerState: string }[]): number =>
  vinfo.reduce((n, v) => (!v.template && v.powerState === 'poweredOn' ? n + 1 : n), 0)

/**
 * Aggregate one snapshot group through the SHIPPED engines (DRY — the
 * exact calls `buildEstateView` makes, so counts reconcile). Exported so
 * the DD-C release path (08-02 `useSnapshotUpload`) computes the carried
 * `releasedAggregate` with the SAME math instead of duplicating it.
 */
export const aggregateTrendGroup = (
  group: Snapshot[],
  mode: AccountingMode,
  opts: {
    stretchedClusters?: ReadonlySet<string>
    allocRatios?: { cpuRatio: number; ramRatio: number }
  } = {},
): { headline: TrendHeadline; byCluster: Map<string, TrendHeadline> } => {
  const stretchedClusters = opts.stretchedClusters ?? new Set<string>()
  const allocRatios = opts.allocRatios ?? { cpuRatio: 4, ramRatio: 1 }
  const merged = mergeSnapshotsToEstate(group)
  const clusters = aggregateClusters({
    vinfo: merged.vinfo,
    vhost: merged.vhost,
    mode,
    stretchedClusters,
    allocRatios,
  })
  const datastores = perDatastore(merged.vdatastore)
  const totalStorageMib = mib(datastores.reduce((acc, d) => acc + (d.capacityMib as number), 0))
  const globals = aggregateGlobals(clusters, datastores.length, totalStorageMib)

  const headline: TrendHeadline = {
    vmCount: globals.vmCount,
    poweredOnVms: poweredOnOf(merged.vinfo),
    hostCount: globals.hostCount,
    clusterCount: globals.clusterCount,
    vcpuAllocated: globals.vcpuAllocated,
    vramAllocatedMib: globals.vramAllocatedMib,
    totalStorageMib,
  }

  const byCluster = new Map<string, TrendHeadline>()
  for (const c of clusters) {
    const clusterCap = mib(
      merged.vdatastore
        .filter((d) => d.clusterName === c.cluster)
        .reduce((acc, d) => acc + (d.capacityMib as number), 0),
    )
    byCluster.set(c.cluster, {
      vmCount: c.vmCount,
      poweredOnVms: poweredOnOf(merged.vinfo.filter((v) => v.cluster === c.cluster)),
      hostCount: c.hostCount,
      clusterCount: 1,
      vcpuAllocated: c.vcpuAllocated,
      vramAllocatedMib: c.vramAllocatedMib,
      totalStorageMib: clusterCap,
    })
  }
  return { headline, byCluster }
}

const deltaOf = (a: TrendPoint, b: TrendPoint): TrendDelta => ({
  from: a.date,
  to: b.date,
  vmCount: b.headline.vmCount - a.headline.vmCount,
  poweredOnVms: b.headline.poweredOnVms - a.headline.poweredOnVms,
  hostCount: b.headline.hostCount - a.headline.hostCount,
  clusterCount: b.headline.clusterCount - a.headline.clusterCount,
  vcpuAllocated: (b.headline.vcpuAllocated as number) - (a.headline.vcpuAllocated as number),
  vramAllocatedGib: gib(
    (mibToGib(b.headline.vramAllocatedMib) as number) -
      (mibToGib(a.headline.vramAllocatedMib) as number),
  ),
  totalStorageGib: gib(
    (mibToGib(b.headline.totalStorageMib) as number) -
      (mibToGib(a.headline.totalStorageMib) as number),
  ),
})

export const buildTrendSeries = (
  selected: Snapshot[],
  mode: AccountingMode,
  opts: {
    stretchedClusters?: ReadonlySet<string>
    allocRatios?: { cpuRatio: number; ramRatio: number }
  },
): TrendSeries | null => {
  if (selected.length < 2) return null
  const stretchedClusters = opts.stretchedClusters ?? new Set<string>()
  const allocRatios = opts.allocRatios ?? { cpuRatio: 4, ramRatio: 1 }

  const ord = captureDateOrdinal(selected)

  // Determinable-date snapshots group by calendar day (DD-A A2 — same-day
  // multi-vCenter files spatially merge into ONE point). Undeterminable
  // ones are positioned by ordinal (D-05 — never a fabricated real date).
  const dated = new Map<string, Snapshot[]>()
  const inferred: Snapshot[] = []
  for (const s of selected) {
    if (ord.ordinal.get(s.id) === null) {
      const k = dayKey(s.capturedAt)
      const g = dated.get(k) ?? []
      g.push(s)
      dated.set(k, g)
    } else {
      inferred.push(s)
    }
  }

  const pointOf = (group: Snapshot[], ordinal: number | null): TrendPoint => {
    const released = group.find((s) => s.rawReleased === true && s.releasedAggregate != null)
    const agg =
      released?.releasedAggregate != null
        ? {
            headline: released.releasedAggregate.headline,
            byCluster: released.releasedAggregate.byCluster,
          }
        : aggregateTrendGroup(group, mode, { stretchedClusters, allocRatios })
    // `group` is non-empty by construction (dated groups have >=1 member;
    // inferred points are single-snapshot). Earliest capturedAt represents
    // the day; no clock is constructed here (engine purity).
    const date = group
      .map((s) => s.capturedAt)
      .reduce((min, d) => (d.getTime() < min.getTime() ? d : min))
    return {
      date,
      ordinal,
      metadata: group.map((s) => ({
        vCenterLabel: s.vCenterLabel,
        rvtoolsVersion: s.rvtoolsVersion,
      })),
      headline: agg.headline,
      byCluster: agg.byCluster,
    }
  }

  const datedPoints = [...dated.values()]
    .map((g) => pointOf(g, null))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const inferredPoints = inferred
    .map((s) => pointOf([s], ord.ordinal.get(s.id) ?? 0))
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))

  // Dated points first (real temporal axis), ordinal-positioned points
  // after (D-05 — surfaced factually via `orderInferred`).
  const points = [...datedPoints, ...inferredPoints]

  const deltas: TrendDelta[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    if (prev && cur) deltas.push(deltaOf(prev, cur))
  }

  return { points, deltas, orderInferred: ord.orderInferred }
}
