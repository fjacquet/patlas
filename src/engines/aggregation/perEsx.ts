import { cores as coresOf, mib } from '@/engines/units'
import type { AccountingMode, EsxAggregate } from '@/types/estate'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import { physicalGhz } from './ghz'
import { readinessStats } from './vinfoMerge'

/**
 * Per-ESX-host rollup (DSH-01 + Phase-3 inventory-tree consumer). Hosts
 * grouped by `hostName`; VMs attached via `VInfoRow.host === hostName`.
 *
 * DRY mandate (RESEARCH §perEsx): CPU Ready stats reuse the SAME
 * `readinessStats` helper `vinfoMerge` exports — the reduce-not-spread
 * loop is NOT copy-pasted. `vmCount`/`vcpuAllocated` honor the same
 * accounting `mode` as `vinfoMerge` (powered-off excluded unless
 * `configured`). `cores` is PHYSICAL cores — `VHostRow` structurally has
 * no threads field so the Moderate-4 bug is type-prevented.
 */
export const perEsx = (
  vhost: VHostRow[],
  vinfo: VInfoRow[],
  mode: AccountingMode,
): EsxAggregate[] => {
  const vmsByHost = new Map<string, VInfoRow[]>()
  for (const vm of vinfo) {
    const list = vmsByHost.get(vm.host) ?? []
    list.push(vm)
    vmsByHost.set(vm.host, list)
  }

  return vhost.map((h): EsxAggregate => {
    const allVms = vmsByHost.get(h.hostName) ?? []
    // Mode-aware allocation cohort (mirrors vinfoMerge: configured keeps
    // powered-off VMs; active/storage-realistic exclude them).
    const counted = mode === 'configured' ? allVms : allVms.filter((vm) => vm.poweredOn)
    // readinessStats is always powered-on-only internally (ADR-0012).
    const ready = readinessStats(allVms)
    return {
      hostName: h.hostName,
      cluster: h.cluster,
      sockets: h.sockets,
      cores: h.cores,
      speedMhz: h.speedMhz,
      physicalGhz: physicalGhz(h.speedMhz, h.cores),
      memoryMib: h.memoryMib,
      vmCount: counted.length,
      vcpuAllocated: coresOf(counted.reduce((acc, vm) => acc + (vm.vcpu as number), 0)),
      vramAllocatedMib: mib(counted.reduce((acc, vm) => acc + (vm.vramMib as number), 0)),
      cpuRatio: h.cpuRatio,
      ramRatio: h.ramRatio,
      meanCpuReadinessPercent: ready.mean,
      maxCpuReadinessPercent: ready.max,
      vmsAboveReadinessWarning: ready.countAboveWarning,
      readinessAvailable: ready.available,
      faultDomain: h.faultDomain,
      model: h.model,
      vendor: h.vendor,
      esxVersion: h.esxVersion,
      poweredOnVms: allVms.filter((vm) => vm.poweredOn).length,
    }
  })
}
