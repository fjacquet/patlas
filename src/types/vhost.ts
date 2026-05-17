import type { Cores, MHz, MiB, Sockets } from '@/engines/units'

/**
 * Canonical ESXi host row produced by the RVTools adapter. Ratios are 0..1
 * floats — formatters turn them into locale-aware percent strings at the UI
 * boundary.
 *
 * vatlas rebrands the numeric fields (`cores`/`speedMhz`/`memoryMib` are
 * branded; `memoryMib` RENAMED from vsizer's `memoryMb` per ADR-0010) and
 * adds `sockets` (physical CPU count, RVTools `# CPU`). `hostName` is kept
 * verbatim so the ported `synthesizeOrphanClusters` matches on it unchanged.
 */
export interface VHostRow {
  hostName: string
  cluster: string
  /** Physical CPU socket count. RVTools `vHost.# CPU`. */
  sockets: Sockets
  /** Total physical core count across all sockets. RVTools `vHost.# Cores`. */
  cores: Cores
  /** Nominal CPU speed. RVTools `vHost.Speed` (MHz). */
  speedMhz: MHz
  /** Physical host RAM. RVTools `# Memory`/`Memory` MB reinterpreted as MiB. */
  memoryMib: MiB
  /** Mean CPU utilization in [0, 1] over the source's monitoring window. */
  cpuRatio: number
  /** Mean RAM utilization in [0, 1]. */
  ramRatio: number
  /**
   * RVTools `vSAN Fault Domain Name` — the stretched-cluster site key.
   * Empty string when the column is absent or the host is untagged
   * (Phase 4 STR-02/03; consumed by Plan 04-02). Never `undefined`.
   */
  faultDomain: string
  /** RVTools `vHost.Model` — factual host hardware model. '' when absent.
   *  Plain text only — NO lifecycle verdict (P5; vendor EOS not in RVTools). */
  model: string
  /** RVTools `vHost.Vendor` — factual. '' when absent. */
  vendor: string
  /** RVTools `vHost.ESX Version` — factual ESXi version string. '' when
   *  absent. Support-state classification is Phase 7 (EOS), NOT here. */
  esxVersion: string
}
