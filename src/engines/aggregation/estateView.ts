import { buildEosProjection } from '@/engines/eos/bucketEos'
import { loadEosCatalogue } from '@/engines/eos/catalogue'
import type { MergedEstate } from '@/engines/snapshotMerge'
import { buildTrendSeries } from '@/engines/trends'
import { cores, mib } from '@/engines/units'
import type {
  AccountingMode,
  ClusterDetail,
  EosProjection,
  EstateView,
  OperationalInsights,
  OsBreakdown,
  VmDisplayRow,
} from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import { aggregateClusters } from './aggregateClusters'
import { computeClusterHealth } from './clusterHealth'
import { buildDatastoreDetail, buildVmDetail } from './detailIndex'
import { aggregateGlobals, emptySummary } from './globals'
import { aggregateGuestData, type GuestData } from './guestData'
import { computeMonsters, DEFAULT_MONSTER_THRESHOLDS, type MonsterThresholds } from './monsterVm'
import { networkRollup } from './network'
import { classifyOsFamily } from './osFamily'
import { datastoreCountByCluster, perDatastore } from './perDatastore'
import { perEsx } from './perEsx'
import {
  computeSizing,
  DEFAULT_SIZING_THRESHOLDS,
  maxVmUsageAcrossSnapshots,
  type SizingThresholds,
} from './sizing'
import { computeSnapshotSprawl } from './snapshotSprawl'
import { storageByX } from './storageByX'
import { computeStorageContentHealth } from './storageContentHealth'
import { computeThresholdFlags, DEFAULT_THRESHOLDS, type ThresholdInput } from './thresholdFlags'
import { relinkBlankClusterDatastores } from './vsanRelink'

/**
 * Pure estate-view assembler — the single composition every dashboard
 * component and export consumes (via the `useEstateView` hook). No React,
 * no Zustand, no Zod.
 *
 * The NAA-deduped `perDatastore` count + first-row capacity sum feed
 * `globals.datastoreCount`/`totalStorageMib` (no double-count, Moderate-11).
 * `trends` is the P8 per-snapshot temporal series (`null` for < 2
 * snapshots), composed here in this single pass from the pre-merge
 * `selected` — never a second memo site (D-00).
 *
 * Datastore→cluster attribution: real RVTools exports DO carry a
 * `Cluster name` column on vDatastore (the earlier "A1: no cluster field"
 * premise was false — UAT-confirmed). `datastoreCountByCluster` feeds the
 * per-cluster count, NAA-deduped WITHIN each cluster (Moderate-11: a
 * shared LUN counts once per cluster it appears in). When the vDatastore
 * sheet is absent the map is `undefined` ⇒ `ClusterAggregate.datastoreCount`
 * is `null` and the column renders the em-dash sentinel; a cluster with
 * the sheet present but no matching datastore renders a real `0`.
 */

const emptyBreakdown = (): OsBreakdown => ({ windows: 0, linux: 0, other: 0 })

/**
 * Phase 4 contract change: `buildEstateView` now consumes the MERGED row
 * bundle (`MergedEstate` from `engines/snapshotMerge`) instead of one raw
 * `Snapshot`. The merge already flattened + deduped + collision-suffixed the
 * selected snapshots' rows, so every aggregation below operates on the
 * single logical estate (multi-FILE merge is the primary path). The row
 * shapes (`vinfo`/`vhost`/`vdatastore`) are unchanged — only the source is.
 */
export function buildEstateView(
  merged: MergedEstate,
  /** The pre-merge selected snapshots (P8 — the temporal trend series is
   *  per-snapshot, so it needs the snapshots BEFORE the spatial merge).
   *  Threaded through the single pass so the whole composition stays in
   *  one pure function and the hook stays a thin orchestrator. */
  selected: Snapshot[],
  mode: AccountingMode,
  /** Reference clock for the EOS forecast (D-07). Injected by the caller —
   *  the only sanctioned site is the `useEstateView` hook boundary, which
   *  passes the workbook-load wall clock. Required so this engine stays a
   *  pure, deterministic function of its inputs (no in-engine clock). */
  today: Date,
  opts?: {
    allocRatios?: { cpuRatio: number; ramRatio: number }
    /** P6 PLANNED Personal Ratios — the explicitly-"planned" what-if
     *  lens (D-05). Drives `plannedView`. NEVER overwrites the measured path. */
    plannedRatios?: { cpuRatio: number; ramRatio: number }
    /** P9 threshold-alerting lines (D-02). Absent ⇒ RVTools-Analyser
     *  defaults. Threaded from the in-memory thresholds slice via the
     *  single `useEstateView` memo. */
    thresholds?: ThresholdInput
    /** P-RS right-sizing thresholds (user-editable ratios). Absent ⇒
     *  RVTools-rightsizing defaults. Threaded from the in-memory slice via
     *  the single `useEstateView` memo. */
    sizingThresholds?: SizingThresholds
    /** P-RS monster-VM thresholds (vCPU/vRAM lines). Absent ⇒ defaults. */
    monsterThresholds?: MonsterThresholds
  },
): EstateView {
  const allocRatios = opts?.allocRatios ?? { cpuRatio: 4, ramRatio: 1 }
  // No vDatastore rows ⇒ sheet absent/empty ⇒ per-cluster count is
  // genuinely unknown (undefined → em-dash). Rows present ⇒ attribute
  // them; an unmatched cluster legitimately gets 0, never em-dash.
  // vHost.hostName → vHost.cluster (single pass) so blank-clusterName
  // vSAN/host-local datastores attribute to their hosts' cluster(s)
  // instead of being dropped (Pitfall 6 / Plan 04-02).
  const hostClusterMap = new Map<string, string>()
  for (const hrow of merged.vhost) {
    if (hrow.hostName !== '' && hrow.cluster !== '') hostClusterMap.set(hrow.hostName, hrow.cluster)
  }
  const dsByCluster =
    merged.vdatastore.length === 0
      ? undefined
      : datastoreCountByCluster(merged.vdatastore, hostClusterMap)
  const clusters = aggregateClusters({
    vinfo: merged.vinfo,
    vhost: merged.vhost,
    mode,
    datastoreCountByCluster: dsByCluster,
    allocRatios,
  })

  const datastores = perDatastore(merged.vdatastore)
  const datastoreCount = datastores.length
  const totalStorageMib = mib(datastores.reduce((acc, d) => acc + (d.capacityMib as number), 0))

  const globals = aggregateGlobals(clusters, datastoreCount, totalStorageMib)
  const hosts = perEsx(merged.vhost, merged.vinfo, mode)

  // ── P9 (D-07..D-11) — four pure projections composed in THIS single
  // pass (no second memo). vsan feeds storage's per-cluster attribution;
  // flags reads the deduped `datastores` + the in-memory thresholds line.
  const vsan = relinkBlankClusterDatastores(merged.vinfo, merged.vdatastore)
  const storage = storageByX(merged, mode, vsan)
  const network = networkRollup(merged)
  const thresholds = opts?.thresholds ?? DEFAULT_THRESHOLDS
  const flags = computeThresholdFlags(merged.vpartition, datastores, thresholds)
  const datastoreDetail = buildDatastoreDetail(datastores, merged.vdatastore, vsan, thresholds)
  const vmDetail = buildVmDetail(merged, thresholds)

  // OS breakdown — global + per-cluster. `other` is always present even
  // at 0 (a real, visible donut bucket). The accounting mode does not
  // change OS classification; it counts every VM the snapshot carries.
  const osBreakdown = emptyBreakdown()
  const vmsByCluster = new Map<string, OsBreakdown>()
  const vmRows: VmDisplayRow[] = []
  for (const vm of merged.vinfo) {
    const family = classifyOsFamily(vm.osConfig, vm.osTools)
    osBreakdown[family] += 1
    const perCluster = vmsByCluster.get(vm.cluster) ?? emptyBreakdown()
    perCluster[family] += 1
    vmsByCluster.set(vm.cluster, perCluster)
    // 1:1 projection (NEVER group/sum) — same operation-class as the
    // classifyOsFamily call above; rides this single existing pass.
    vmRows.push({
      vmName: vm.vmName,
      cluster: vm.cluster,
      host: vm.host,
      vcpu: vm.vcpu,
      vramMib: vm.vramMib,
      os: vm.osTools || vm.osConfig,
      poweredOn: vm.poweredOn,
      provisionedMib: vm.provisionedMib,
      guestType: vm.guestType,
    })
  }

  // ── P5 operational insights (RCI) — estate + per-cluster, all
  // calculated from parsed columns; runs in THIS single pass (no memo).
  const gd = aggregateGuestData(merged.vpartition, merged.vinfo)
  interface Acc {
    on: number
    off: number
    susp: number
    tmpl: number
    prov: number
    inuse: number
  }
  const zero = (): Acc => ({ on: 0, off: 0, susp: 0, tmpl: 0, prov: 0, inuse: 0 })
  const estAcc = zero()
  const accBy = new Map<string, Acc>()
  for (const v of merged.vinfo) {
    const a = accBy.get(v.cluster) ?? zero()
    const bump = (t: Acc) => {
      if (v.template) t.tmpl += 1
      else if (v.powerState === 'poweredOn') t.on += 1
      else if (v.powerState === 'suspended') t.susp += 1
      else t.off += 1
      t.prov += v.provisionedMib as number
      t.inuse += v.inUseMib as number
    }
    bump(a)
    bump(estAcc)
    accBy.set(v.cluster, a)
  }
  const insightsOf = (
    s: {
      meanCpuRatio: number
      meanRamRatio: number
      physicalCores: number
      physicalRamMib: number
      vcpuPerPcpu: number
    },
    a: Acc,
    guest: GuestData | null,
  ): OperationalInsights => ({
    overcommitVcpuPerPcpu: s.vcpuPerPcpu,
    avgCpuPct: s.meanCpuRatio * 100,
    avgMemPct: s.meanRamRatio * 100,
    poweredOnVms: a.on,
    poweredOffVms: a.off,
    suspendedVms: a.susp,
    templateVms: a.tmpl,
    provisionedMib: mib(a.prov),
    inUseMib: mib(a.inuse),
    totalPhysicalCores: cores(s.physicalCores),
    totalHostMemoryMib: mib(s.physicalRamMib),
    guestUsedMib: guest ? guest.consumedMib : null,
    // Headline used storage: in-guest used when reported, else committed
    // (`a.inuse`) so it never goes blank (LiveOptics-comparable; D-quick).
    usedStorageMib: mib(guest ? (guest.consumedMib as number) : a.inuse),
  })
  const operationalInsights = insightsOf(
    {
      meanCpuRatio: globals.meanCpuRatio,
      meanRamRatio: globals.meanRamRatio,
      physicalCores: globals.physicalCores as number,
      physicalRamMib: globals.physicalRamMib as number,
      vcpuPerPcpu: globals.vcpuPerPcpu,
    },
    estAcc,
    gd.estate,
  )
  const clusterInsights = new Map<string, OperationalInsights>()
  const clusterDetail = new Map<string, ClusterDetail>()
  for (const c of clusters) {
    const guest = gd.estate === null ? null : (gd.byCluster.get(c.cluster) ?? null)
    const ins = insightsOf(
      {
        meanCpuRatio: c.meanCpuRatio,
        meanRamRatio: c.meanRamRatio,
        physicalCores: c.physicalCores as number,
        physicalRamMib: c.physicalRamMib as number,
        vcpuPerPcpu: c.vcpuPerPcpu,
      },
      accBy.get(c.cluster) ?? zero(),
      guest,
    )
    clusterInsights.set(c.cluster, ins)
    clusterDetail.set(c.cluster, { aggregate: c, insights: ins })
  }

  // ── P6 PLANNED what-if (PLN-03/PLN-04/D-02/D-11) — composes in THIS
  // single pass (no second memo, no new file). A SEPARATE re-aggregation
  // under the user's PLANNED Personal Ratios; the measured `globals`/
  // `clusters` above are untouched (never conflated — D-02/D-11).
  const plannedRatios = opts?.plannedRatios ?? null
  const plannedView =
    plannedRatios === null
      ? null
      : (() => {
          const plannedClusters = aggregateClusters({
            vinfo: merged.vinfo,
            vhost: merged.vhost,
            mode,
            datastoreCountByCluster: dsByCluster,
            allocRatios: plannedRatios,
          })
          return {
            globals: aggregateGlobals(plannedClusters, datastoreCount, totalStorageMib),
            clusters: plannedClusters,
          }
        })()

  // P7 EOS forecast — composed in this single pass (no second memo site,
  // D-00; the only memo is the `useEstateView` hook). `buildEosProjection`
  // iterates the merged rows internally — the same operation-class as the
  // `classifyOsFamily` vinfo pass above. `today` is the injected reference
  // clock (D-07) — never constructed here, so this engine stays pure.
  const eos = buildEosProjection({
    vinfo: merged.vinfo,
    vhost: merged.vhost,
    catalogue: loadEosCatalogue(),
    today,
  })

  // P8 In-Session Trends — composed in THIS single pass (no second memo
  // site, D-00; the only memo is the `useEstateView` hook). Per-snapshot
  // temporal series from the PRE-merge `selected` (DD-A A2); `null` for
  // < 2 snapshots (the Phase-2 degenerate case, handled inside
  // `buildTrendSeries`). Pure — no clock, reuses the shipped aggregates.
  const trends = buildTrendSeries(selected, mode, { allocRatios })

  // P-RS right-sizing/stress — composed in THIS single pass (no second memo).
  // Per-VM MAX usage across the pre-merge `selected` snapshots (powered-on
  // only); the merged `vinfo`/`vhost` give the canonical VM list + host CPU
  // speed for the utilization denominator. Pure — reuses the shipped rows.
  const sizingThresholds = opts?.sizingThresholds ?? DEFAULT_SIZING_THRESHOLDS
  const sizing = computeSizing(
    merged.vinfo,
    merged.vhost,
    maxVmUsageAcrossSnapshots(selected),
    sizingThresholds,
    selected.length,
  )

  // P-RS monster-VM extract — same single pass; configured allocation only,
  // so no multi-snapshot max is needed (vCPU/vRAM are stable per VM).
  const monsters = computeMonsters(
    merged.vinfo,
    opts?.monsterThresholds ?? DEFAULT_MONSTER_THRESHOLDS,
  )

  // Plan 3A snapshot sprawl — same single pass. `today` is the injected
  // reference clock (no in-engine clock); the engine excludes the Proxmox
  // 'current' live-state marker.
  const snapshotSprawl = computeSnapshotSprawl(merged.proxmoxSnapshots, today)

  // Plan 3B storage-content health — same single pass; `today` reused for
  // backup-file recency.
  const storageContent = computeStorageContentHealth(merged.proxmoxStorageContent, today)

  // Plan 3C cluster HA & backup jobs — same single pass.
  const clusterHealth = computeClusterHealth(
    merged.proxmoxHaResources,
    merged.proxmoxHaStatus,
    merged.proxmoxBackupJobs,
  )

  return {
    globals,
    clusters,
    hosts,
    datastores,
    vmRows,
    vmsByCluster,
    osBreakdown,
    accountingMode: mode,
    trends,
    operationalInsights,
    clusterInsights,
    clusterDetail,
    plannedView,
    eos,
    storage,
    vsan,
    network,
    flags,
    sizing,
    monsters,
    snapshotSprawl,
    storageContent,
    clusterHealth,
    datastoreDetail,
    vmDetail,
  }
}

const EMPTY_INSIGHTS: OperationalInsights = Object.freeze({
  overcommitVcpuPerPcpu: 0,
  avgCpuPct: 0,
  avgMemPct: 0,
  poweredOnVms: 0,
  poweredOffVms: 0,
  suspendedVms: 0,
  templateVms: 0,
  provisionedMib: mib(0),
  inUseMib: mib(0),
  totalPhysicalCores: cores(0),
  totalHostMemoryMib: mib(0),
  guestUsedMib: null,
  usedStorageMib: mib(0),
})

const EMPTY_EOS: EosProjection = Object.freeze({
  reference: Object.freeze({ today: '', lastVerified: '' }),
  partition: Object.freeze({
    overdue: Object.freeze([]) as never[],
    w3: Object.freeze([]) as never[],
    w3to6: Object.freeze([]) as never[],
    w6to9: Object.freeze([]) as never[],
    w9to12: Object.freeze([]) as never[],
    beyond12: Object.freeze([]) as never[],
    unknown: Object.freeze([]) as never[],
  }),
  cumulative: Object.freeze({ overdue: 0, le3: 0, le6: 0, le9: 0, le12: 0, unknown: 0 }),
  rawUnknown: Object.freeze([]) as never[],
  esxi: Object.freeze({
    hosts: Object.freeze([]) as never[],
    partition: Object.freeze({
      overdue: 0,
      w3: 0,
      w3to6: 0,
      w6to9: 0,
      w9to12: 0,
      beyond12: 0,
      unknown: 0,
    }),
  }),
})

const EMPTY_STORAGE = Object.freeze({
  byCluster: Object.freeze([]) as never[],
  byEsx: Object.freeze([]) as never[],
  byVm: Object.freeze([]) as never[],
  byDatastore: Object.freeze([]) as never[],
  capacityByDatastore: Object.freeze([]) as never[],
  capacityByCluster: Object.freeze([]) as never[],
  estate: Object.freeze({
    provisionedMib: mib(0),
    inUseMib: mib(0),
    capacityMib: mib(0),
    usedMib: mib(0),
    freeMib: mib(0),
  }),
})

const EMPTY_VSAN = Object.freeze({
  attributed: new Map<string, string>(),
  shared: new Map<string, number>(),
  unrelinkable: new Set<string>(),
  datastoreVms: new Map<string, string[]>(),
})

const EMPTY_NETWORK = Object.freeze({
  vswitches: Object.freeze([]) as never[],
  dvswitches: Object.freeze([]) as never[],
  portgroups: Object.freeze([]) as never[],
  vmPortgroupCount: 0,
})

const EMPTY_FLAGS = Object.freeze({
  fsFlagged: Object.freeze([]) as never[],
  dsFlagged: Object.freeze([]) as never[],
  luFlagged: Object.freeze([]) as never[],
  counts: Object.freeze({ fs: 0, ds: 0, lu: 0 }),
})

const EMPTY_SIZING = Object.freeze({
  rows: Object.freeze([]) as never[],
  counts: Object.freeze({
    oversized: 0,
    undersized: 0,
    stressed: 0,
    cpuOversized: 0,
    memOversized: 0,
    cpuUndersized: 0,
    memUndersized: 0,
    memStressed: 0,
    cpuStressed: 0,
  }),
  thresholds: DEFAULT_SIZING_THRESHOLDS,
  snapshotCount: 0,
  hasUsageData: false,
})

const EMPTY_MONSTERS = Object.freeze({
  rows: Object.freeze([]) as never[],
  count: 0,
  thresholds: DEFAULT_MONSTER_THRESHOLDS,
})

const EMPTY_SPRAWL = Object.freeze({
  rows: Object.freeze([]) as never[],
  count: 0,
  guestsWithSnapshots: 0,
  totalSizeMib: 0,
  oldestAgeDays: null,
})

const EMPTY_STORAGE_CONTENT = Object.freeze({
  byContent: Object.freeze([]) as never[],
  byStorage: Object.freeze([]) as never[],
  backups: Object.freeze({
    rows: Object.freeze([]) as never[],
    count: 0,
    guestsCovered: 0,
    totalSizeMib: 0,
    newestAgeDays: null,
    oldestAgeDays: null,
  }),
  totalSizeMib: 0,
  fileCount: 0,
})

const EMPTY_CLUSTER_HEALTH = Object.freeze({
  ha: Object.freeze({
    resources: Object.freeze([]) as never[],
    managedCount: 0,
    quorumStatus: null,
    fencingStatus: null,
    services: Object.freeze([]) as never[],
  }),
  backups: Object.freeze({
    jobs: Object.freeze([]) as never[],
    jobCount: 0,
    enabledCount: 0,
    guestsCovered: 0,
  }),
})

/**
 * The valid empty-but-typed view `useEstateView` returns when no snapshot
 * is active. Frozen (modeled on `globals.ts:emptySummary`) so consumers
 * can rely on referential stability.
 */
export const EMPTY_VIEW: EstateView = Object.freeze({
  globals: emptySummary,
  clusters: Object.freeze([]) as never[],
  hosts: Object.freeze([]) as never[],
  datastores: Object.freeze([]) as never[],
  vmRows: Object.freeze([]) as never[],
  vmsByCluster: new Map(),
  osBreakdown: Object.freeze({ windows: 0, linux: 0, other: 0 }),
  accountingMode: 'active',
  trends: null,
  operationalInsights: EMPTY_INSIGHTS,
  clusterInsights: new Map(),
  clusterDetail: new Map(),
  plannedView: null,
  eos: EMPTY_EOS,
  storage: EMPTY_STORAGE,
  vsan: EMPTY_VSAN,
  network: EMPTY_NETWORK,
  flags: EMPTY_FLAGS,
  sizing: EMPTY_SIZING,
  monsters: EMPTY_MONSTERS,
  snapshotSprawl: EMPTY_SPRAWL,
  storageContent: EMPTY_STORAGE_CONTENT,
  clusterHealth: EMPTY_CLUSTER_HEALTH,
  datastoreDetail: new Map(),
  vmDetail: new Map(),
})
