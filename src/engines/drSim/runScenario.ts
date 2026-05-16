import { aggregateClusters } from '@/engines/aggregation/aggregateClusters'
import { aggregateGlobals } from '@/engines/aggregation/globals'
import type { MergedEstate } from '@/engines/snapshotMerge'
import { cores, mib } from '@/engines/units'
import type { AccountingMode, DrMode, DrScenario, DrSimResult } from '@/types/estate'
import { survivorVerdict } from './allocate'

interface RunOpts {
  mode: AccountingMode
  stretchedClusters: ReadonlySet<string>
  allocRatios: { cpuRatio: number; ramRatio: number }
}

const isEmpty = (s: DrScenario): boolean =>
  s.failedHosts.size === 0 && s.failedClusters.size === 0 && s.failedVCenters.size === 0

/** Dominant mode for the UI echo: vCenter ▷ cluster ▷ host. */
const dominantMode = (s: DrScenario): DrMode =>
  s.failedVCenters.size > 0 ? 'vcenter' : s.failedClusters.size > 0 ? 'cluster' : 'host'

/**
 * DR what-if: re-run the SHIPPED aggregation on the survivor row subset
 * (estateView.ts compose pattern — reuse, never re-derive). NEVER mutates
 * `merged` (fresh arrays). `null` when nothing is marked failed.
 *
 * vCenter-loss filters by ROW `viSdkUuid` on the MERGED estate (depends on
 * Plan 04-01). Host rows carry no `viSdkUuid`, so a failed vCenter's
 * clusters are derived from its vinfo rows and folded into the
 * cluster-level filter — that also removes the matching hosts.
 *
 * The stretched per-site reservation (04-02) and the allocation ratios
 * (04-03) flow through because survivors are aggregated with the SAME
 * `stretchedClusters` + `allocRatios` the live estate uses.
 */
export const runScenario = (
  merged: MergedEstate,
  scenario: DrScenario,
  opts: RunOpts,
): DrSimResult | null => {
  if (isEmpty(scenario)) return null

  // Clusters belonging to a failed vCenter (folded into the cluster filter
  // so host rows — which lack viSdkUuid — are removed consistently).
  const vcLostClusters = new Set<string>()
  if (scenario.failedVCenters.size > 0) {
    for (const v of merged.vinfo) {
      if (scenario.failedVCenters.has(v.viSdkUuid)) vcLostClusters.add(v.cluster)
    }
  }
  const clusterFailed = (c: string): boolean =>
    scenario.failedClusters.has(c) || vcLostClusters.has(c)

  const survivorVinfo = merged.vinfo.filter(
    (v) =>
      !scenario.failedHosts.has(v.host) &&
      !clusterFailed(v.cluster) &&
      !scenario.failedVCenters.has(v.viSdkUuid),
  )
  const survivorVhost = merged.vhost.filter(
    (h) => !scenario.failedHosts.has(h.hostName) && !clusterFailed(h.cluster),
  )

  const aggregate = (vinfo: typeof merged.vinfo, vhost: typeof merged.vhost) =>
    aggregateClusters({
      vinfo,
      vhost,
      mode: opts.mode,
      stretchedClusters: opts.stretchedClusters,
      allocRatios: opts.allocRatios,
    })

  const beforeClusters = aggregate(merged.vinfo, merged.vhost)
  const afterClusters = aggregate(survivorVinfo, survivorVhost)
  const before = aggregateGlobals(beforeClusters)
  const after = aggregateGlobals(afterClusters)

  // Evacuee = before − after allocation (both computed under the SAME
  // accounting mode, so the mode's powered-off/template handling is
  // already consistent — no separate re-derivation).
  const evacueeVcpu = Math.max(
    0,
    (before.vcpuAllocated as number) - (after.vcpuAllocated as number),
  )
  const evacueeVramMib = Math.max(
    0,
    (before.vramAllocatedMib as number) - (after.vramAllocatedMib as number),
  )

  const perSurvivor = afterClusters.map((c) => ({
    cluster: c.cluster,
    verdict: survivorVerdict(c),
  }))

  // Caveats: i18n KEY suffixes only (RESEARCH A5 / PROJECT.md line 39).
  const caveats: string[] = []
  const reservationHigh = afterClusters.some(
    (c) =>
      (c.physicalRamMib as number) > 0 &&
      (c.drReservedRamMib as number) > 0.8 * (c.physicalRamMib as number),
  )
  if (reservationHigh) caveats.push('caveats.reservationHigh')

  const verdicts = perSurvivor.map((p) => p.verdict)
  const confidence: DrSimResult['confidence'] = verdicts.includes('overflows')
    ? 'low'
    : verdicts.includes('tight')
      ? 'medium'
      : 'high'

  return {
    mode: dominantMode(scenario),
    before,
    after,
    evacueeVcpu: cores(evacueeVcpu),
    evacueeVramMib: mib(evacueeVramMib),
    perSurvivor,
    confidence,
    caveats,
  }
}
