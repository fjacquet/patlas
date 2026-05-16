/**
 * Public surface of the snapshot-merge engine. `useEstateView` calls
 * `mergeSnapshotsToEstate` inside the project's single `useMemo` before
 * `buildEstateView`. Mirrors the `engines/aggregation/index.ts` barrel.
 */
export { mergeSnapshotsToEstate, type MergedEstate } from './mergeSnapshotsToEstate'
export { buildVCenterIndex, type VCenterEntry } from './vCenterIndex'
