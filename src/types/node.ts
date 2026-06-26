import type { Cores, MHz, MiB, Sockets } from '@/engines/units'

/**
 * Canonical Proxmox node row produced by the Proxmox adapter. Ratios are 0..1
 * floats — formatters turn them into locale-aware percent strings at the UI
 * boundary.
 *
 * patlas rebrands the numeric fields (`cores`/`speedMhz`/`memoryMib` are
 * branded; `memoryMib` RENAMED from vsizer's `memoryMb` per ADR-0010) and
 * adds `sockets` (physical CPU count from the Nodes sheet). `hostName` is kept
 * verbatim so the ported `synthesizeOrphanClusters` matches on it unchanged.
 */
export interface NodeRow {
  hostName: string
  cluster: string
  /** Physical CPU socket count from the Proxmox Nodes sheet. */
  sockets: Sockets
  /** Total physical core count across all sockets from the Proxmox Nodes sheet. */
  cores: Cores
  /** Nominal CPU speed from the Proxmox Nodes sheet (MHz). */
  speedMhz: MHz
  /** Physical node RAM. Report "Memory" MB-cells reinterpreted as MiB. */
  memoryMib: MiB
  /** Mean CPU utilization in [0, 1] over the source's monitoring window. */
  cpuRatio: number
  /** Mean RAM utilization in [0, 1]. */
  ramRatio: number
  /**
   * Proxmox Fault Domain Name — the stretched-cluster site key.
   * Empty string when the column is absent or the node is untagged
   * (Phase 4 STR-02/03; consumed by Plan 04-02). Never `undefined`.
   */
  faultDomain: string
  /** Factual node hardware model from the Proxmox report. '' when absent.
   *  Plain text only — NO lifecycle verdict. */
  model: string
  /** Node hardware vendor from the Proxmox report. '' when absent. */
  vendor: string
  /** Node chassis serial number — the identifier a technician reads to
   *  physically locate the box. '' when absent. Plain text, no verdict. */
  serialNumber: string
  /** Proxmox node version string (PVE version or kernel). '' when absent.
   *  Support-state classification is Phase 7 (EOS), NOT here. */
  esxVersion: string
}
