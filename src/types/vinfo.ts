import type { Cores, MHz, MiB } from '@/engines/units'

/** Exact RVTools vInfo Powerstate (P5). `poweredOn` is derived from this. */
export type VPowerState = 'poweredOn' | 'poweredOff' | 'suspended'

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
  /** Exact RVTools powered-state (P5). */
  powerState: VPowerState
  /** RVTools vInfo `Template` flag (P5). `false` when the column is absent. */
  template: boolean
  /** Derived: `powerState === 'poweredOn'`. Kept so existing consumers
   *  (perEsx, aggregateClusters, exports) are unaffected. */
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
  /** RVTools `vInfo.Path` — the `[datastore] vm/vm.vmx` token. Empty string
   *  when the column is absent. The ONLY valid cluster-identity path for
   *  blank-`Cluster name` (vSAN/host-local) datastores: the vSAN relink
   *  (P9 D-09) parses the `[datastore]` token out of this to attribute a
   *  datastore to the VM's cluster. */
  path: string
  /** Proxmox guest kind: 'qemu' (KVM VM) or 'lxc' (container). The shared
   *  engines ignore it; views segment by it. Always set by the Proxmox
   *  adapter. */
  guestType: 'qemu' | 'lxc'
}

/**
 * Per-VM RUNTIME/perf metrics from the RVTools `vMemory` + `vCPU` sheets.
 * Kept SEPARATE from `VInfoRow` (config/inventory) — config-vs-perf split.
 * Joined to a VM by identity (`vmInstanceUuid` → `vmBiosUuid` →
 * `vmName+cluster`). Every metric is `null` when the cell is absent/blank
 * ("not derivable") — NEVER coerced to 0 (ADR-0012; same rule as
 * `cpuReadinessPercent`). Point-in-time per snapshot.
 */
export interface VmUsageRow {
  vmName: string
  cluster: string
  vmBiosUuid: string
  vmInstanceUuid: string
  /** vMemory `Active` — guest working set (MiB). null when absent. */
  activeMib: MiB | null
  /** vMemory `Consumed` — host RAM backing the VM (MiB). null when absent. */
  consumedMib: MiB | null
  /** vMemory `Ballooned` (MiB). null when absent. */
  balloonedMib: MiB | null
  /** vMemory `Swapped` (MiB). null when absent. */
  swappedMib: MiB | null
  /** vCPU `Overall CPU usage` (MHz). null when absent. */
  cpuUsageMhz: MHz | null
}
