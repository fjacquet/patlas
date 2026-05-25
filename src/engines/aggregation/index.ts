/**
 * Public surface of the aggregation engine. `useEstateView` and every
 * future export import `buildEstateView`/`EMPTY_VIEW` from here.
 */
export { aggregateClusters } from './aggregateClusters'
export { CONTENTION_THRESHOLDS, TOP_N_DEFAULT } from './contention'
export { buildDatastoreDetail, buildVmDetail } from './detailIndex'
export { buildEstateView, EMPTY_VIEW } from './estateView'
export { consumedGhz, physicalGhz } from './ghz'
export { aggregateGlobals, emptySummary } from './globals'
export {
  computeMonsters,
  DEFAULT_MONSTER_THRESHOLDS,
  type MonsterEstate,
  type MonsterThresholds,
  type MonsterVm,
} from './monsterVm'
export {
  type DvSwitchAgg,
  type NetworkRollup,
  networkRollup,
  type PortgroupAgg,
  type VSwitchAgg,
} from './network'
export { classifyOsFamily, type OsFamily } from './osFamily'
export { aggregateHostsPerCluster } from './perCluster'
export { perDatastore } from './perDatastore'
export { perEsx } from './perEsx'
export {
  computeSizing,
  DEFAULT_SIZING_THRESHOLDS,
  type EstateSizing,
  maxVmUsageAcrossSnapshots,
  type SizingCounts,
  type SizingThresholds,
  type VmSizing,
} from './sizing'
export {
  type StorageByX,
  type StorageCapacityGroup,
  type StorageConsumptionGroup,
  storageByX,
} from './storageByX'
export {
  computeThresholdFlags,
  type ThresholdFlags,
  type ThresholdInput,
} from './thresholdFlags'
export { aggregateVmsPerCluster, readinessStats, topReadinessVmsByCluster } from './vinfoMerge'
export { relinkBlankClusterDatastores, type VsanRelinkResult } from './vsanRelink'
