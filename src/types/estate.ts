import type { Cores, GHz, MHz, MiB, Sockets } from '@/engines/units'

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

  // ── CPU Ready / contention (RVTools-only) ─────────────────────────────
  meanCpuReadinessPercent: number | null
  maxCpuReadinessPercent: number | null
  vmsAboveReadinessWarning: number
  readinessAvailable: boolean

  // ── Stretched-cluster DR (Phase 4 — per-site reservation + confidence) ─
  stretched: boolean
  drReservedGhz: GHz
  /**
   * Factual confidence in the per-site reservation, NEVER collapsing
   * metadata absence to 'high':
   *   - 'high'   — every host carries a fault domain AND ≥2 distinct
   *                domains → reservation from real per-site capacity
   *   - 'medium' — SOME hosts tagged (partial coverage) → assume
   *                symmetric 0.5
   *   - 'low'    — NO host tagged → cannot prove a split; assume
   *                symmetric 0.5 (low-confidence chip shown)
   */
  stretchedConfidence: StretchedConfidence
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

/** Factual confidence enum for the per-site stretched reservation. */
export type StretchedConfidence = 'high' | 'medium' | 'low'

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
 * Phase-4 forward-compat placeholder. The field EXISTS on `EstateView`
 * (typed `TimelinePoint[] | null`) and is `null` in Phase 2 — Phase 4
 * populates it without changing the dashboard component contract.
 */
export interface TimelinePoint {
  capturedAt: Date
  vmCount: number
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
  /** Phase-4 forward-compat — always `null` in Phase 2. */
  trends: TimelinePoint[] | null
}
