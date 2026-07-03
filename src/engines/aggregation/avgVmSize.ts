import type { Cores, MiB } from '@/engines/units'
import { cores as coresOf, mib } from '@/engines/units'
import type { AccountingMode } from '@/types/estate'
import type { GuestRow } from '@/types/guest'

/**
 * Average VM size — mean/median vCPU, vRAM and provisioned storage over the
 * accounting-mode-filtered guest population. Same population definition as
 * `vinfoMerge.groupByCluster` (Critical-6): guests with an empty cluster are
 * dropped, and `configured` keeps powered-off VMs while
 * `active`/`storage-realistic` exclude them.
 */

export interface AvgVmSize {
  vmCount: number
  vcpu: { mean: Cores; median: Cores }
  vramMib: { mean: MiB; median: MiB }
  provisionedMib: { mean: MiB; median: MiB }
}

export const emptyAvgVmSize: AvgVmSize = Object.freeze({
  vmCount: 0,
  vcpu: { mean: coresOf(0), median: coresOf(0) },
  vramMib: { mean: mib(0), median: mib(0) },
  provisionedMib: { mean: mib(0), median: mib(0) },
})

const meanOf = (values: readonly number[]): number =>
  values.reduce((acc, n) => acc + n, 0) / values.length

const medianOf = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number)
}

export const computeAvgVmSize = (guests: readonly GuestRow[], mode: AccountingMode): AvgVmSize => {
  const filtered = guests.filter(
    (g) => g.cluster.length > 0 && (mode === 'configured' || g.poweredOn),
  )
  if (filtered.length === 0) return emptyAvgVmSize

  const vcpuValues = filtered.map((g) => g.vcpu as number)
  const vramValues = filtered.map((g) => g.vramMib as number)
  const provisionedValues = filtered.map((g) => g.provisionedMib as number)

  return {
    vmCount: filtered.length,
    vcpu: { mean: coresOf(meanOf(vcpuValues)), median: coresOf(medianOf(vcpuValues)) },
    vramMib: { mean: mib(meanOf(vramValues)), median: mib(medianOf(vramValues)) },
    provisionedMib: {
      mean: mib(meanOf(provisionedValues)),
      median: mib(medianOf(provisionedValues)),
    },
  }
}
