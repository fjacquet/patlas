import { aggregateClusters } from '@/engines/aggregation/aggregateClusters'
import { aggregateGlobals } from '@/engines/aggregation/globals'
import type { MergedEstate } from '@/engines/snapshotMerge'
import { cores, ghz, mib } from '@/engines/units'
import type { AccountingMode, DrMode, DrScenario, DrSimResult } from '@/types/estate'
import { survivorPhysicalVerdict } from './allocate'

interface RunOpts {
  mode: AccountingMode
  stretchedClusters: ReadonlySet<string>
  allocRatios: { cpuRatio: number; ramRatio: number }
}

const isEmpty = (s: DrScenario): boolean => s.failedHosts.size === 0 && s.failedSites.size === 0

/** Dominant mode for the UI echo: Site loss ▷ Server loss (D-07/D-08). */
const dominantMode = (s: DrScenario): DrMode => (s.failedSites.size > 0 ? 'site' : 'server')

/**
 * DR what-if: re-run the SHIPPED aggregation on the survivor row subset
 * (estateView.ts compose pattern — reuse, never re-derive). NEVER mutates
 * `merged` (fresh arrays). `null` when nothing is marked failed.
 *
 * Phase-6 re-derivation (D-07/D-08/D-09/D-10 — supersedes the
 * UAT-rejected cluster/vCenter loss model):
 *
 * - Server loss (`failedHosts`) removes those host rows + every VM on
 *   them, then re-runs the KEPT aggregate()/aggregateGlobals spine.
 * - Site loss (`failedSites`) holds `faultDomain` values (the site
 *   identity declared via stretched clusters — same `h.faultDomain`
 *   field `aggregateClusters.reservationFor` uses); the engine removes
 *   every host whose `faultDomain ∈ failedSites` and the VMs on those
 *   hosts. Non-stretched workload physically at the lost site is
 *   removed too (factually LOST — the result's before−after physical
 *   delta exposes exactly what the UI's "lost — no DR target" line
 *   needs). The no-fault-domain symmetric-50% behaviour stays inside
 *   `aggregateClusters` (NOT re-derived here).
 *
 * Impact is PHYSICAL CPU (GHz + cores) + PHYSICAL RAM removed —
 * before − after on the GlobalSummary physical fields, branded
 * (ghz()/cores()/mib()); never vCPU (D-09). The high/med/low scenario
 * grade is RETIRED (D-10 — the tool does not judge the user's
 * scenario); the factual `caveats` array is kept verbatim.
 *
 * The stretched per-site reservation (04-02) and the allocation ratios
 * (04-03) flow through because survivors are aggregated with the SAME
 * `stretchedClusters` + `allocRatios` the live estate uses. Custom
 * Failover (D-11) is just this same function called with the PLANNED
 * `allocRatios` — no new primitive here.
 */
export const runScenario = (
  merged: MergedEstate,
  scenario: DrScenario,
  opts: RunOpts,
): DrSimResult | null => {
  if (isEmpty(scenario)) return null

  // Site loss: the failed fault-domains remove their physical hosts.
  // The removed host NAMES are derived from the site-filtered vhost
  // diff so the matching VMs (which carry no faultDomain) drop too.
  const siteLostHosts = new Set<string>()
  if (scenario.failedSites.size > 0) {
    for (const h of merged.vhost) {
      if (scenario.failedSites.has(h.faultDomain)) siteLostHosts.add(h.hostName)
    }
  }
  const hostFailed = (hostName: string): boolean =>
    scenario.failedHosts.has(hostName) || siteLostHosts.has(hostName)

  const survivorVinfo = merged.vinfo.filter((v) => !hostFailed(v.host))
  const survivorVhost = merged.vhost.filter((h) => !hostFailed(h.hostName))

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

  // Impact = before − after PHYSICAL capacity (D-09). Physical CPU
  // (GHz + cores) and physical RAM removed — never vCPU. Both sides
  // computed under the SAME accounting mode, so the mode's
  // powered-off/template handling is already consistent.
  const physicalCpuRemovedGhz = Math.max(
    0,
    (before.physicalGhz as number) - (after.physicalGhz as number),
  )
  const physicalCpuRemovedCores = Math.max(
    0,
    (before.physicalCores as number) - (after.physicalCores as number),
  )
  const physicalRamRemovedMib = Math.max(
    0,
    (before.physicalRamMib as number) - (after.physicalRamMib as number),
  )

  // D-09: survivor verdict computed against PHYSICAL headroom.
  const perSurvivor = afterClusters.map((c) => ({
    cluster: c.cluster,
    verdict: survivorPhysicalVerdict(c),
  }))

  // Caveats: i18n KEY suffixes only (RESEARCH A5 / PROJECT.md line 39).
  const caveats: string[] = []
  const reservationHigh = afterClusters.some(
    (c) =>
      (c.physicalRamMib as number) > 0 &&
      (c.drReservedRamMib as number) > 0.8 * (c.physicalRamMib as number),
  )
  if (reservationHigh) caveats.push('caveats.reservationHigh')

  // WR-04: D-08 Site loss is RAW physical subtraction of every host in the
  // failed fault-domain — including hosts of declared-stretched clusters.
  // The before−after delta books those stretched hosts as removed (no
  // surviving-site failover is modeled). The panel's "lost — no DR target"
  // line only counts NON-stretched hosts, which would otherwise imply the
  // stretched portion is protected; emit an explicit factual caveat so the
  // displayed narrative matches what the engine actually computes.
  if (scenario.failedSites.size > 0) {
    const stretchedSiteHostRemoved = merged.vhost.some(
      (h) => siteLostHosts.has(h.hostName) && opts.stretchedClusters.has(h.cluster),
    )
    if (stretchedSiteHostRemoved) caveats.push('caveats.siteRawSubtraction')
  }

  return {
    mode: dominantMode(scenario),
    before,
    after,
    physicalCpuRemovedGhz: ghz(physicalCpuRemovedGhz),
    physicalCpuRemovedCores: cores(physicalCpuRemovedCores),
    physicalRamRemovedMib: mib(physicalRamRemovedMib),
    perSurvivor,
    caveats,
  }
}
