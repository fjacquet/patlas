/**
 * Public surface of the aggregation engine. `useEstateView` and every
 * future export import `buildEstateView`/`EMPTY_VIEW` from here.
 */
export { aggregateClusters } from './aggregateClusters'
export { CONTENTION_THRESHOLDS, TOP_N_DEFAULT } from './contention'
export { buildEstateView, EMPTY_VIEW } from './estateView'
export { consumedGhz, physicalGhz } from './ghz'
export { aggregateGlobals, emptySummary } from './globals'
export { classifyOsFamily, type OsFamily } from './osFamily'
export { aggregateHostsPerCluster } from './perCluster'
export { perDatastore } from './perDatastore'
export { perEsx } from './perEsx'
export {
  type StorageByX,
  type StorageCapacityGroup,
  type StorageConsumptionGroup,
  storageByX,
} from './storageByX'
export { aggregateVmsPerCluster, readinessStats, topReadinessVmsByCluster } from './vinfoMerge'
export { relinkBlankClusterDatastores, type VsanRelinkResult } from './vsanRelink'
