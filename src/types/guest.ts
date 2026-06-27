import type { Cores, MHz, MiB } from '@/engines/units'

/** Exact Proxmox guest power state. `poweredOn` is derived from this. */
export type VPowerState = 'poweredOn' | 'poweredOff' | 'suspended'

/**
 * Canonical guest row produced by the Proxmox adapter. The adapter normalizes
 * column names, casing and locale variants into this shape so the downstream
 * engines never branch on the original source format.
 *
 * patlas extends vsizer's shape with the OS columns, the identity keys
 * (Phase 4 multi-cluster merge) and branded MiB storage columns. Memory is
 * RENAMED `vramMb` → `vramMib` to encode the unit in the name (ADR-0010:
 * report "MB" cells are reinterpreted as MiB, never converted).
 */
export interface GuestRow {
  vmName: string
  cluster: string
  /** Proxmox node this guest runs on. Used by `synthesizeOrphanClusters`
   *  (ADR-0014) to attribute clusterless guests to their standalone node.
   *  Empty when the source doesn't expose it. */
  host: string
  /** vCPU count of the guest (branded — was bare `number` in vsizer). */
  vcpu: Cores
  /** Allocated memory. Report "Memory" MB-cells reinterpreted as MiB. */
  vramMib: MiB
  /** CPU Ready % from report quickStats (ADR-0012). null when not reported. */
  cpuReadinessPercent: number | null
  /** Exact Proxmox guest power state. */
  powerState: VPowerState
  /** Template flag from the report. `false` when the column is absent. */
  template: boolean
  /** Derived: `powerState === 'poweredOn'`. Kept so existing consumers
   *  (perEsx, aggregateClusters, exports) are unaffected. */
  poweredOn: boolean
  // ── NEW for patlas ──────────────────────────────────────────────────────
  /** `OS according to the configuration file` (the configured guest OS). */
  osConfig: string
  /** `OS according to the guest agent` (the running guest OS). */
  osTools: string
  /** Guest BIOS UUID — Phase 4 multi-cluster identity key. */
  vmBiosUuid: string
  /** Guest instance UUID. */
  vmInstanceUuid: string
  /** Proxmox cluster instance UUID (Phase 4 merge key). */
  viSdkUuid: string
  /** Proxmox cluster FQDN/IP. */
  viSdkServer: string
  /** Provisioned storage. Report "Provisioned MB" reinterpreted as MiB. */
  provisionedMib: MiB
  /** In-use storage. Report "In Use MB" reinterpreted as MiB. */
  inUseMib: MiB
  /** Config path — the `[storage] vm/vm.conf` token. Empty string when the
   *  column is absent. Used to attribute a storage pool to the guest's
   *  cluster (P9 D-09). */
  path: string
  /** Proxmox guest kind: 'qemu' (KVM VM) or 'lxc' (container). The shared
   *  engines ignore it; views segment by it. Always set by the Proxmox
   *  adapter. */
  guestType: 'qemu' | 'lxc'
}

/**
 * Per-guest RUNTIME/perf metrics from the Proxmox report memory and CPU sheets.
 * Kept SEPARATE from `GuestRow` (config/inventory) — config-vs-perf split.
 * Joined to a guest by identity (`vmInstanceUuid` → `vmBiosUuid` →
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
