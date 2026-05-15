import type { Cores, MiB } from '@/engines/units'

/**
 * Canonical VM row produced by the RVTools adapter. The adapter normalizes
 * column names, casing and locale variants into this shape so the downstream
 * engines never branch on the original source format.
 *
 * vatlas extends vsizer's shape with the OS columns, the identity keys
 * (Phase 4 multi-vCenter merge) and branded MiB storage columns. Memory is
 * RENAMED `vramMb` → `vramMib` to encode the unit in the name (ADR-0010:
 * RVTools "MB" is reinterpreted as MiB, never converted).
 */
export interface VInfoRow {
  vmName: string
  cluster: string
  /** ESXi host this VM runs on. RVTools `vInfo.Host`. Used by
   *  `synthesizeOrphanClusters` (ADR-0014) to attribute clusterless VMs to
   *  their standalone host. Empty when the source doesn't expose it. */
  host: string
  /** vCPU count of the VM (branded — was bare `number` in vsizer). */
  vcpu: Cores
  /** Allocated memory. RVTools "Memory" MB-cells reinterpreted as MiB. */
  vramMib: MiB
  /** CPU Ready % from RVTools quickStats (ADR-0012). null when not reported. */
  cpuReadinessPercent: number | null
  poweredOn: boolean
  // ── NEW for vatlas ──────────────────────────────────────────────────────
  /** `OS according to the configuration file` (the configured guest OS). */
  osConfig: string
  /** `OS according to the VMware Tools` (the running guest OS). */
  osTools: string
  /** RVTools `VM UUID` (BIOS UUID) — Phase 4 multi-vCenter identity key. */
  vmBiosUuid: string
  /** RVTools `VM Instance UUID`. */
  vmInstanceUuid: string
  /** RVTools `VI SDK UUID` — the vCenter instance UUID (Phase 4 merge key). */
  viSdkUuid: string
  /** RVTools `VI SDK Server` — the vCenter FQDN/IP. */
  viSdkServer: string
  /** Provisioned storage. RVTools "Provisioned MB" reinterpreted as MiB. */
  provisionedMib: MiB
  /** In-use storage. RVTools "In Use MB" reinterpreted as MiB. */
  inUseMib: MiB
}
