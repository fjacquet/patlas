// P9 view-model result shapes. Type-only (erased) imports from the pure
// aggregation engines — no runtime coupling, no cycle (the engines import
// their input types from here; these are produced in the single
// `buildEstateView` pass and surfaced on `EstateView`).
import type { NetworkRollup } from '@/engines/aggregation/network'
import type { EstateSizing } from '@/engines/aggregation/sizing'
import type { StorageByX } from '@/engines/aggregation/storageByX'
import type { ThresholdFlags } from '@/engines/aggregation/thresholdFlags'
import type { VsanRelinkResult } from '@/engines/aggregation/vsanRelink'
import type { Cores, GHz, GiB, MHz, MiB, Sockets } from '@/engines/units'

/**
 * Estate aggregate types — ported from vsizer `types/cluster.ts` +
 * `types/global.ts`, then brand-retrofitted to vatlas' Phase-1 units.
 *
 * The vsizer→vatlas deltas (ADR-0010 / Phase-1 type contract):
 * - GHz fields (`physicalGhz`/`consumedGhz`/`availableGhz`/`drReservedGhz`)
 *   become branded `GHz`; core counts become `Cores`.
 * - `physicalRamMb`/`vramAllocatedMb` are RENAMED + branded to
 *   `physicalRamMib: MiB` / `vramAllocatedMib: MiB` (RVTools "MB" IS MiB —
 *   reinterpreted, never converted).
 * - vsizer's active-memory sum chain is DROPPED entirely: vatlas'
 *   Phase-1 `VInfoRow` does not parse active memory, so the field would
 *   be permanently `null` — dead code, removed at the type level.
 * - New for vatlas: `AccountingMode`, `OsFamily`, `DatastoreAggregate`
 *   (Moderate-11 NAA dedupe), `EsxAggregate` (per-host rollup), and the
 *   `EstateView` assembler contract every dashboard/export consumes.
 */

/** OS-family bucket — 3-way split for the DSH-04 donut (NOT the Phase-5
 *  EOS normalizer). `other` is a real, visible bucket — never dropped. */
export type OsFamily = 'windows' | 'linux' | 'other'

/**
 * The three accounting modes (DSH-06, Critical-6). The mode is a single
 * parameter threaded through `vinfoMerge`/`perEsx` and echoed back on
 * `EstateView` — never precomputed into parallel arrays (Pitfall 2).
 *
 * - `configured`         — all VMs (powered on or off) for vCPU/vRAM sums.
 * - `active`             — powered-on VMs only (default for CPU/RAM).
 * - `storage-realistic`  — powered-on for vCPU/vRAM; all VMs for storage.
 */
export type AccountingMode = 'configured' | 'active' | 'storage-realistic'

/**
 * Host-side rollup for one cluster (ported `ClusterHostStats`). Brands on
 * the GHz / MiB fields; ratios stay bare `number` (0..1 by design).
 */
export interface ClusterHostStats {
  cluster: string
  hostCount: number
  /** Σ host.cores across this cluster's hosts. */
  physicalCores: Cores
  physicalGhz: GHz
  consumedGhz: GHz
  availableGhz: GHz
  /** Σ host.memoryMib across this cluster's hosts. mib(0) when none of
   *  the hosts had a parseable memory column. */
  physicalRamMib: MiB
  /** Σ host.memoryMib × host.ramRatio — capacity-weighted RAM
   *  consumption. mib(0) when `physicalRamMib` is 0. */
  consumedRamMib: MiB
  /** Capacity-weighted CPU utilization: `consumedGhz / physicalGhz`
   *  (ADR-0011). */
  meanCpuRatio: number
  maxCpuRatio: number
  minCpuRatio: number
  /** Capacity-weighted RAM utilization, falling back to
   *  `mean(host.ramRatio)` when `physicalRamMib === 0` (ADR-0011). */
  meanRamRatio: number
  maxRamRatio: number
  minRamRatio: number
}

/**
 * VM-side rollup for one cluster (ported `ClusterVmStats`, active-memory
 * field dropped). Which VMs are summed depends on the `AccountingMode` —
 * `readinessStats` is ALWAYS powered-on-only regardless of mode.
 */
export interface ClusterVmStats {
  cluster: string
  vmCount: number
  vcpuAllocated: Cores
  vramAllocatedMib: MiB
  /** Arithmetic mean of `cpuReadinessPercent` across powered-on VMs that
   *  reported it (percent). `null` when none reported. ADR-0012. */
  meanCpuReadinessPercent: number | null
  /** Largest reported `cpuReadinessPercent`, or `null`. */
  maxCpuReadinessPercent: number | null
  /** Count of powered-on VMs whose readiness exceeds
   *  `CONTENTION_THRESHOLDS.warning` (5 %). `0` (never inferred) when
   *  readiness is unreported. */
  vmsAboveReadinessWarning: number
  /** True iff at least one powered-on VM reported a readiness value. */
  readinessAvailable: boolean
}

/**
 * One row in the per-cluster top-N CPU Ready annex. `cpuReadinessPercent`
 * is non-null here (only reporting VMs make the list).
 */
export interface TopReadinessVm {
  vmName: string
  cluster: string
  vcpu: Cores
  cpuReadinessPercent: number
}

/**
 * Per-cluster aggregate (ported vsizer `ClusterAggregate`). GHz/MiB/Cores
 * branded; active-memory field dropped. Stretched-cluster DR math is ported
 * intact but dormant in Phase 2 (`stretchedClusters` is always empty).
 */
export interface ClusterAggregate {
  cluster: string
  hostCount: number
  /** Number of VMs in this cluster (accounting-mode aware). */
  vmCount: number
  /** Distinct datastores attributed to this cluster via the vDatastore
   *  `Cluster name` column, NAA-deduped WITHIN the cluster (Moderate-11:
   *  a shared LUN counts once per cluster it appears in). `0` when the
   *  vDatastore sheet parsed but none matched this cluster; the em-dash
   *  sentinel is reserved for "vDatastore absent" (`null`). */
  datastoreCount: number | null

  // ── CPU capacity ──────────────────────────────────────────────────────
  physicalCores: Cores
  /** `stretched ? 0.5 × physicalCores : physicalCores`. */
  usablePhysicalCores: Cores
  /** vCPU consolidation: `vcpuAllocated / usablePhysicalCores`, against
   *  PHYSICAL cores never threads (Moderate-4). `0` when divisor is 0. */
  vcpuPerPcpu: number
  physicalGhz: GHz
  consumedGhz: GHz
  /** physicalGhz − consumedGhz − drReservedGhz. */
  availableGhz: GHz

  // ── RAM capacity (host-side) ──────────────────────────────────────────
  physicalRamMib: MiB
  consumedRamMib: MiB
  drReservedRamMib: MiB
  availableRamMib: MiB

  // ── CPU ratios — capacity-weighted, DR-aware (0..3) ───────────────────
  meanCpuRatio: number
  maxCpuRatio: number
  minCpuRatio: number

  // ── RAM ratios — capacity-weighted, DR-aware (0..3) ───────────────────
  meanRamRatio: number
  maxRamRatio: number
  minRamRatio: number

  // ── VM allocations ────────────────────────────────────────────────────
  vcpuAllocated: Cores
  vramAllocatedMib: MiB

  /** Average MHz consumed per allocated vCPU. `0` when vcpuAllocated 0. */
  mhzPerVcpu: number

  // ── Allocation headroom (ALC — driven by the URL-hash ratio sliders) ──
  /** vCPU the cluster can host at the active CPU ratio:
   *  `usablePhysicalCores × cpuRatio` (default 4:1). The slider changes
   *  THIS verdict only — never `vcpuPerPcpu` (ALC-04). */
  capacityVcpu: Cores
  /** vRAM the cluster can host at the active RAM overcommit factor:
   *  `physicalRamMib × ramRatio` (default 1:1). */
  capacityRamMib: MiB

  // ── CPU Ready / contention (RVTools-only) ─────────────────────────────
  meanCpuReadinessPercent: number | null
  maxCpuReadinessPercent: number | null
  vmsAboveReadinessWarning: number
  readinessAvailable: boolean

  // ── Stretched-cluster DR (Phase 4 — per-site reservation + confidence) ─
  stretched: boolean
  drReservedGhz: GHz
  /**
   * FACTUAL site-data discriminator (UAT G1 — the stretched flag is the
   * user's declaration; the engine never judges it, only states where the
   * split came from):
   *   - 'detected' — every host carries a fault domain AND ≥2 distinct
   *                  domains → reservation from REAL per-site capacity
   *                  (Site A/B values populated)
   *   - 'assumed'  — partial OR no fault-domain coverage → symmetric 0.5
   *                  reservation, per-site values null
   * No 'high/medium/low' verdict, no chip — that judgement was removed.
   */
  siteData: 'detected' | 'assumed'
  /**
   * Headline reservation fraction (GHz basis) used for the UI "%" row and
   * the DR subtraction echo. `0` when not stretched. Per-resource fractions
   * are applied internally (see aggregateClusters ADR comment).
   */
  reservedFraction: number
  /** Larger / smaller site physical GHz. `null` ⇒ sites indeterminate
   *  (assumed-symmetric medium/low) → em-dash sentinel (UI-SPEC §STR-02). */
  siteACapacityGhz: GHz | null
  siteBCapacityGhz: GHz | null
  siteACapacityRamMib: MiB | null
  siteBCapacityRamMib: MiB | null
}

/**
 * Estate-wide rollup (ported vsizer `GlobalSummary`, active-memory field
 * dropped). `datastoreCount` + `totalStorageMib` ADDED for DSH-02
 * (sourced from the NAA-deduped `perDatastore` output).
 */
export interface GlobalSummary {
  clusterCount: number
  hostCount: number
  vmCount: number

  // CPU
  physicalCores: Cores
  usablePhysicalCores: Cores
  vcpuPerPcpu: number
  physicalGhz: GHz
  consumedGhz: GHz
  availableGhz: GHz

  // RAM (host-side)
  physicalRamMib: MiB
  consumedRamMib: MiB
  drReservedRamMib: MiB
  availableRamMib: MiB

  meanCpuRatio: number
  meanRamRatio: number

  vcpuAllocated: Cores
  vramAllocatedMib: MiB

  mhzPerVcpu: number

  // Stretched-cluster rollup
  stretchedClusterCount: number
  drReservedGhz: GHz

  /** Estate-wide count of powered-on VMs whose CPU Ready exceeds the
   *  warning threshold. Sum across reporting clusters; `null` when no
   *  cluster reports (never collapse absence to 0 — ADR-0012). */
  vmsAboveReadinessWarning: number | null

  // ── DSH-02 datastore totals (NAA-deduped via perDatastore) ────────────
  /** Count of distinct datastore keys (`naa ?? name`) — no double-count. */
  datastoreCount: number
  /** Σ first-row capacity across distinct datastore keys (Moderate-11). */
  totalStorageMib: MiB
}

/**
 * One NAA-deduped datastore (Moderate-11). Rows sharing a `naa` collapse
 * to ONE aggregate keyed `naa ?? name`; capacity/free are taken from the
 * FIRST row in the group — NEVER summed (a shared LUN is identical in
 * every cluster's view; summing double-counts).
 */
export interface DatastoreAggregate {
  /** `naa ?? name` — the dedupe key. */
  key: string
  /** Display name (first seen for this key). */
  name: string
  /** VMFS / NFS / vSAN / … (first seen for this key). */
  type: string
  capacityMib: MiB
  freeMib: MiB
  /** capacity − free. */
  usedMib: MiB
  /** (capacity − free) / capacity; 0 when capacity is 0. */
  usedRatio: number
  provisionedMib: MiB
  /** provisioned / capacity; 0 when capacity is 0. */
  overProvisionRatio: number
  /** How many raw rows collapsed into this key (>1 ⇒ shared LUN). */
  sharedDuplicateCount: number
}

/**
 * Per-ESX-host rollup (DSH-01 + Phase-3 inventory tree consumer). `cores`
 * is PHYSICAL cores — `VHostRow` structurally has no threads field so the
 * Moderate-4 bug is type-prevented. `vmCount`/`vcpuAllocated` honor the
 * accounting `mode`; CPU Ready reuses the SHARED `readinessStats`.
 */
export interface EsxAggregate {
  hostName: string
  cluster: string
  sockets: Sockets
  cores: Cores
  speedMhz: MHz
  physicalGhz: GHz
  memoryMib: MiB
  vmCount: number
  vcpuAllocated: Cores
  vramAllocatedMib: MiB
  cpuRatio: number
  ramRatio: number
  meanCpuReadinessPercent: number | null
  maxCpuReadinessPercent: number | null
  vmsAboveReadinessWarning: number
  readinessAvailable: boolean
  /** P5 factual host attributes (plain text; '' when absent — NO lifecycle
   *  verdict, ESXi support-state is Phase 7). */
  faultDomain: string
  model: string
  vendor: string
  esxVersion: string
  /** Powered-on VM count on this host (P5 Hosts view). */
  poweredOnVms: number
}

/**
 * Flat per-VM row for the Phase-3 inventory table (INV-05). This is a PURE
 * PROJECTION of `Snapshot.vinfo`, NOT an aggregation — a 1:1 filter/map of
 * the source rows (same operation-class as the `classifyOsFamily` call in
 * the existing `buildEstateView` vinfo loop), never a group/sum. It rides
 * inside that one existing pass so the project keeps exactly one `useMemo`
 * site (`useEstateView`). Mirrors the lean flat-field `EsxAggregate` idiom.
 */
export interface VmDisplayRow {
  vmName: string
  cluster: string
  host: string
  vcpu: Cores
  vramMib: MiB
  /** Running guest OS (`osTools`) when reported, else the configured OS. */
  os: string
  poweredOn: boolean
  provisionedMib: MiB
}

/** Per-OsFamily counts (DSH-04). `other` is always present (even at 0). */
export interface OsBreakdown {
  windows: number
  linux: number
  other: number
}

/**
 * P8 In-Session Trends. The headline metrics tracked across snapshots —
 * a `Pick` of the shipped `GlobalSummary`/`OperationalInsights` fields
 * (calc-from-real-data; every value is the shipped aggregate, never a new
 * derivation). Branded units preserved (no raw `* 1.048576`).
 */
export interface TrendHeadline {
  vmCount: number
  poweredOnVms: number
  hostCount: number
  clusterCount: number
  vcpuAllocated: Cores
  vramAllocatedMib: MiB
  totalStorageMib: MiB
}

/**
 * One timeline point (DD-A A2 — one `capturedAt` calendar day; same-day
 * multi-vCenter files are spatially merged via the shipped merge engine
 * first, so the point's counts reconcile with the dashboard for that day).
 * `metadata` is an array — a merged point legitimately spans multiple
 * vCenters (criterion 6). `ordinal` is non-null only for D-05
 * undeterminable-date points (positioned by stable load order, never a
 * fabricated Date).
 */
export interface TrendPoint {
  date: Date
  ordinal: number | null
  metadata: { vCenterLabel: string; rvtoolsVersion: string }[]
  headline: TrendHeadline
  byCluster: Map<string, TrendHeadline>
}

/**
 * Signed difference between two consecutive points' headlines (DD-B B1 —
 * count-deltas on existing aggregate fields; branded units via the shipped
 * converters). A field is `null` when either side is `null` (presentation
 * of the em-dash sentinel is the UI layer's job, not the engine's).
 */
export interface TrendDelta {
  from: Date
  to: Date
  vmCount: number
  poweredOnVms: number
  hostCount: number
  clusterCount: number
  vcpuAllocated: number
  vramAllocatedGib: GiB
  totalStorageGib: GiB
}

/**
 * The temporal trend projection. Produced inside the single
 * `buildEstateView` pass (composed there, never in a component or a
 * separate memoised hook — the one sanctioned memo is the
 * `useEstateView` boundary). `null` when fewer than 2 snapshots are
 * selected (the Phase-2 degenerate case). `orderInferred` drives the
 * factual D-05 caption when any point is ordinal-positioned.
 */
export interface TrendSeries {
  points: TrendPoint[]
  deltas: TrendDelta[]
  orderInferred: boolean
}

/**
 * P7 OS End-of-Support projection. Defined here (not in the engine) so the
 * types→engines import direction is preserved — `bucketEos.ts` imports these
 * as types (no cycle). The `partition` is a DISJOINT cover whose counts
 * reconcile to the VM entity total (D-06/D-10). `cumulative` is a derived
 * display overlay. ESXi hosts are a SEPARATE kind, never summed with VMs
 * (D-09b). `reference.today` is the injected workbook-load date (D-07);
 * `EsxiHostRow.patchEol` is always the null em-dash sentinel (D-09c).
 */
export type EosBucketKey = 'overdue' | 'w3' | 'w3to6' | 'w6to9' | 'w9to12' | 'beyond12' | 'unknown'

export interface EosRow {
  vmName: string
  cluster: string
  host: string
  /** Raw RVTools OS string, preserved verbatim (D-12). */
  os: string
  slug: string | null
  version: string | null
  eolFrom: string | null
  bucket: EosBucketKey
}

export interface EsxiHostRow {
  hostName: string
  esxVersion: string
  major: string | null
  majorEol: string | null
  patchEol: null
  bucket: EosBucketKey
}

export interface EosProjection {
  reference: { today: string; lastVerified: string }
  partition: Record<EosBucketKey, EosRow[]>
  cumulative: {
    overdue: number
    le3: number
    le6: number
    le9: number
    le12: number
    unknown: number
  }
  rawUnknown: { osString: string; count: number }[]
  esxi: { hosts: EsxiHostRow[]; partition: Record<EosBucketKey, number> }
}

/**
 * The single assembled view every dashboard component and export consumes
 * (via the `useEstateView` hook — the project's only `useMemo` site).
 * Single-snapshot in Phase 2; the shape must NOT preclude multi-snapshot
 * (Phase 4 populates `trends`).
 */
export interface EstateView {
  globals: GlobalSummary
  clusters: ClusterAggregate[]
  hosts: EsxAggregate[]
  datastores: DatastoreAggregate[]
  /** Flat per-VM rows for the inventory table (INV-05). Pure projection
   *  of `Snapshot.vinfo`, produced in the single `buildEstateView` pass. */
  vmRows: VmDisplayRow[]
  /** Per-cluster OS breakdown, keyed by cluster name. */
  vmsByCluster: Map<string, OsBreakdown>
  /** Estate-wide OS breakdown. */
  osBreakdown: OsBreakdown
  accountingMode: AccountingMode
  /**
   * P8 In-Session Trends. Produced inside the single `buildEstateView`
   * pass (composed there, never in a component or a separate memoised
   * hook). `null` when fewer than 2 snapshots are selected. */
  trends: TrendSeries | null
  /** Distinct vCenters in the merged estate (DR vCenter-loss picker). */
  vcenters: { viSdkUuid: string; label: string }[]
  /** DR what-if result. `null` when no component is marked failed
   *  (mirrors the `trends: T | null` idiom). Phase-4 DRS-01..06. */
  drSim: DrSimResult | null
  /** P5 estate-level operational insights (RCI). */
  operationalInsights: OperationalInsights
  /** P5 per-cluster operational insights, keyed by cluster name. */
  clusterInsights: Map<string, OperationalInsights>
  /** P5 per-cluster full detail projection for the drill screen
   *  (aggregate + insights), keyed by cluster name. */
  clusterDetail: Map<string, ClusterDetail>
  /**
   * P6 capacity-planning "what-if" projection (PLN-03/PLN-04). The
   * estate re-aggregated under the user's PLANNED Personal Ratios — a
   * SEPARATE, explicitly-"planned" surface, never overwriting the
   * measured `globals`/`clusters` (D-02/D-03). `null` only in the
   * frozen `EMPTY_VIEW`; otherwise always present (planned ratios
   * default 4:1/1:1, D-05). Produced inside the single
   * `buildEstateView` pass — no second `useMemo` (D-11). */
  plannedView: { globals: GlobalSummary; clusters: ClusterAggregate[] } | null
  /**
   * P6 Custom Failover (D-11): the SAME `runScenario` sim re-run with
   * the PLANNED ratios applied. Never a third DR mode and never
   * conflated with the measured `drSim`. `null` when no scenario is
   * marked failed or the planned ratios are not applied to DR. */
  plannedDrSim: DrSimResult | null
  /**
   * P7 OS End-of-Support forecast. Produced inside the single
   * `buildEstateView` pass — no second `useMemo` (D-00). A frozen empty
   * projection in `EMPTY_VIEW`; otherwise always present. */
  eos: EosProjection
  /**
   * P9 storage-by-X (D-07/D-08) — two-lens (consumption + capacity)
   * rollups by Cluster/ESX/VM/Datastore. Produced inside the single
   * `buildEstateView` pass — no second `useMemo`. Frozen-empty in
   * `EMPTY_VIEW`; otherwise always present. */
  storage: StorageByX
  /**
   * P9 vSAN / blank-`Cluster name` relink result (D-09/D-10) —
   * attributed / shared-across-N / unrelinkable maps keyed by the
   * `naa ?? name` datastore key. Same single-pass origin. */
  vsan: VsanRelinkResult
  /**
   * P9 network topology rollup (D-11) — vSwitch/dvSwitch/portgroup/
   * uplink aggregates; empty when the OPTIONAL network sheets were
   * absent (factual-degrade). Same single-pass origin. */
  network: NetworkRollup
  /**
   * P9 threshold flags (D-01/D-04) — factual per-row booleans + counts
   * driven by the in-memory thresholds slice; no verdict/severity/
   * colour. Same single-pass origin. */
  flags: ThresholdFlags
  /**
   * P-RS right-sizing/stress extract — per-VM oversized/undersized/stressed
   * flags + counts, max across loaded snapshots, powered-on only. Neutral
   * measurement, user-editable thresholds (no verdict/severity). Same
   * single-pass origin; `EMPTY_SIZING` in `EMPTY_VIEW`. */
  sizing: EstateSizing
  /**
   * P9 LC-4 per-datastore drill projection, keyed by the `naa ?? name`
   * datastore key. Produced in the single `buildEstateView` pass — no
   * second `useMemo`. Empty `Map` in `EMPTY_VIEW`. */
  datastoreDetail: Map<string, DatastoreDetailEntry>
  /**
   * P9 LC-4 per-VM drill projection, keyed by VM name. Same single-pass
   * origin; empty `Map` in `EMPTY_VIEW`. */
  vmDetail: Map<string, VmDetailEntry>
}

/**
 * P5 operational insights — every field CALCULATED from parsed RVTools
 * columns (calc-from-real-data; nothing invented). Used at estate scope
 * AND per-cluster (same shape, the "globally and per-cluster" principle).
 */
export interface OperationalInsights {
  /** Realized vCPU:pCPU consolidation (= `vcpuPerPcpu`). */
  overcommitVcpuPerPcpu: number
  /** Core-weighted mean CPU % (0..100+). */
  avgCpuPct: number
  /** Host-mem-weighted mean memory % (0..100+). */
  avgMemPct: number
  poweredOnVms: number
  poweredOffVms: number
  suspendedVms: number
  templateVms: number
  provisionedMib: MiB
  /** Σ in-use (RVTools "In Use" already includes .vswp + snapshots). */
  inUseMib: MiB
  totalPhysicalCores: Cores
  totalHostMemoryMib: MiB
  /** In-guest disk used. `null` when no vPartition data (factual, not 0). */
  guestUsedMib: MiB | null
}

/** P5 per-cluster drill projection (one-screen-fit detail / 1 PPTX slide). */
export interface ClusterDetail {
  aggregate: ClusterAggregate
  insights: OperationalInsights
}

/**
 * P9 LC-4 per-datastore drill projection. Every value calculated upstream
 * in the single `buildEstateView` pass; `hostCount` is `null` (em-dash)
 * when the RVTools `Hosts` count is absent (factual — never fabricated).
 * `dsFlagged`/`luFlagged` are the factual threshold markers (no verdict).
 */
export interface DatastoreDetailEntry {
  key: string
  name: string
  type: string
  capacityMib: MiB
  freeMib: MiB
  usedMib: MiB
  provisionedMib: MiB
  usedRatio: number
  sharedDuplicateCount: number
  /** RVTools `vDatastore.Hosts` is a COUNT (binding memory); `null` when
   *  the column is absent/non-numeric → em-dash, never fabricated. */
  hostCount: number | null
  /** VM names referencing this datastore via `vInfo.Path` (single source —
   *  the relink's `datastoreVms`). Empty when none/​not derivable. */
  vms: string[]
  dsFlagged: boolean
  luFlagged: boolean
}

/** P9 LC-4 per-VM partition row (factual flag marker, no verdict). */
export interface VmPartitionEntry {
  disk: string
  capacityMib: MiB
  consumedMib: MiB
  freeMib: MiB
  flagged: boolean
}

/**
 * P9 LC-4 per-VM drill projection. Calculated upstream in the single
 * `buildEstateView` pass; not-derivable lists are empty (caller renders
 * the em-dash sentinel), never fabricated.
 */
export interface VmDetailEntry {
  vmName: string
  cluster: string
  host: string
  os: string
  vcpu: Cores
  vramMib: MiB
  provisionedMib: MiB
  inUseMib: MiB
  poweredOn: boolean
  partitions: VmPartitionEntry[]
  portgroups: { network: string; switch: string }[]
  datastores: string[]
}

/** Factual per-survivor headroom verdict (no color, no editorial verb). */
export type Verdict = 'absorbs' | 'tight' | 'overflows'

/**
 * The DR loss mode of a scenario (UI selector state echo). Phase-6
 * re-derivation (D-12 / G3): exactly two modes — `server` (a set of
 * failed hosts removed with their VMs) and `site` (a set of failed
 * fault-domains removed). Cluster-loss (DRS-02) and vCenter-loss
 * (DRS-03) are RETIRED — they were UAT-rejected.
 */
export type DrMode = 'server' | 'site'

/**
 * Inputs-only DR what-if selection. Sets are REPLACED never mutated
 * (Zustand `Object.is`); never persisted (no hash, no localStorage).
 * Phase-6 re-derivation (D-07/D-08): `failedHosts` drives Server loss;
 * `failedSites` holds `faultDomain` values driving Site loss.
 */
export interface DrScenario {
  failedHosts: Set<string>
  failedSites: Set<string>
}

/**
 * DR simulation result — the SHIPPED aggregation re-run on the survivor
 * row subset. Wrong DR numbers are the project's #1 risk; the factual
 * `caveats` (i18n KEYS, never free text / numbers / editorial verbs)
 * are the structural disclosure mitigation (DRX-03). Phase-6
 * re-derivation (D-09/D-10): impact is PHYSICAL CPU (GHz + cores) +
 * PHYSICAL RAM removed (never vCPU); the high/med/low `confidence`
 * grade is RETIRED entirely (the tool does not judge the user's
 * scenario — DRX-05) while `caveats`/assumptions survive verbatim.
 */
export interface DrSimResult {
  mode: DrMode
  before: GlobalSummary
  after: GlobalSummary
  /** Physical CPU clock removed (before − after `physicalGhz`). The
   *  single gold accent figure, with `physicalCpuRemovedCores`. */
  physicalCpuRemovedGhz: GHz
  /** Physical CPU cores removed (before − after `physicalCores`). */
  physicalCpuRemovedCores: Cores
  /** Physical RAM removed (before − after `physicalRamMib`). */
  physicalRamRemovedMib: MiB
  perSurvivor: { cluster: string; verdict: Verdict }[]
  /** i18n key suffixes (e.g. `caveats.reservationHigh`) — never free
   *  text, never a pre-formatted number, never an editorial verb. */
  caveats: string[]
}
