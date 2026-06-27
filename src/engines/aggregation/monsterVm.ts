import type { GuestRow } from '@/types/guest'

/**
 * Pure "monster VM" extract — the unusually large VMs in the estate, by
 * CONFIGURED allocation (independent of utilization; the right-sizing engine
 * covers utilization). A VM is a monster when it meets EITHER line:
 * `vcpu ≥ minVcpu` OR `vramMib ≥ minVramGib·1024`. User-editable thresholds,
 * neutral measurement — no verdict (ADR-0012). Templates are excluded (not
 * running workloads); powered-off VMs are kept (their allocation is real).
 * No React/Zustand/Zod/DOM.
 */

export interface MonsterThresholds {
  minVcpu: number
  /** vRAM line in GiB (UI-friendly); compared as `minVramGib * 1024` MiB. */
  minVramGib: number
}

/** Defaults: 16 vCPU (NUMA-wide territory) / 128 GiB. Editable. */
export const DEFAULT_MONSTER_THRESHOLDS: MonsterThresholds = {
  minVcpu: 16,
  minVramGib: 128,
}

const MIB_PER_GIB = 1024

export interface MonsterVm {
  vmName: string
  cluster: string
  host: string
  vcpu: number
  vramMib: number
  poweredOn: boolean
  /** Meets the vCPU line. */
  byVcpu: boolean
  /** Meets the vRAM line. */
  byVram: boolean
}

export interface MonsterEstate {
  /** Flagged VMs only, sorted desc by vCPU then vRAM. */
  rows: MonsterVm[]
  count: number
  thresholds: MonsterThresholds
}

export const computeMonsters = (
  vinfo: GuestRow[],
  thresholds: MonsterThresholds,
): MonsterEstate => {
  const minMib = thresholds.minVramGib * MIB_PER_GIB
  const rows: MonsterVm[] = []
  for (const v of vinfo) {
    if (v.template) continue
    const vcpu = v.vcpu as number
    const vramMib = v.vramMib as number
    const byVcpu = vcpu >= thresholds.minVcpu
    const byVram = vramMib >= minMib
    if (byVcpu || byVram) {
      rows.push({
        vmName: v.vmName,
        cluster: v.cluster,
        host: v.host,
        vcpu,
        vramMib,
        poweredOn: v.poweredOn,
        byVcpu,
        byVram,
      })
    }
  }
  rows.sort((a, b) => b.vcpu - a.vcpu || b.vramMib - a.vramMib)
  return { rows, count: rows.length, thresholds }
}
