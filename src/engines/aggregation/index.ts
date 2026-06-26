/**
 * Public surface of the aggregation engine. `useEstateView` and every
 * future export import `buildEstateView`/`EMPTY_VIEW` from here.
 */
export { aggregateClusters } from './aggregateClusters'
export { type ClusterHealth, computeClusterHealth } from './clusterHealth'
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
  type NetworkRollup,
  type NodeNetworkStats,
  networkRollup,
} from './network'
export { classifyOsFamily, type OsFamily } from './osFamily'
export { aggregateHostsPerCluster } from './perCluster'
export { perDatastore } from './perDatastore'
export { perEsx } from './perEsx'
export { computeRrdNodeStats, EMPTY_RRD_HEADROOM } from './rrdNodeStats'
export { computeRrdStorageGrowth } from './rrdStorageGrowth'
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
  computeSnapshotSprawl,
  excelSerialToUnixMs,
  type SnapshotSprawl,
  type SnapshotSprawlRow,
} from './snapshotSprawl'
export {
  type StorageByX,
  type StorageCapacityGroup,
  type StorageConsumptionGroup,
  storageByX,
} from './storageByX'
export {
  type BackupFileRow,
  computeStorageContentHealth,
  type StorageContentHealth,
  type StorageContentTypeGroup,
  type StorageGroup,
} from './storageContentHealth'
export {
  computeThresholdFlags,
  type ThresholdFlags,
  type ThresholdInput,
} from './thresholdFlags'
export { aggregateVmsPerCluster, readinessStats, topReadinessVmsByCluster } from './vinfoMerge'
export { relinkBlankClusterDatastores, type VsanRelinkResult } from './vsanRelink'
