import type { Snapshot } from '@/types'

/**
 * One logical vCenter in the merged estate. Built from ROW `viSdkUuid`
 * (NOT snapshot id) so a single RVTools 4.x workbook embedding N vCenters
 * and N separately-dropped single-vCenter files take the identical path
 * (RESEARCH Pitfall 1).
 */
export interface VCenterEntry {
  viSdkUuid: string
  /** RVTools `VI SDK Server` for this vCenter (best available). */
  server: string
  /** Display label: vMetaData Server ?? row viSdkServer ?? snapshot label. */
  label: string
  clusters: Set<string>
  vmCount: number
}

/**
 * Build `Map<viSdkUuid, VCenterEntry>` from the selected snapshots' vinfo
 * rows, grouping by ROW `viSdkUuid`. The vCenter count is the number of
 * distinct `viSdkUuid` — NEVER the file/snapshot count (Pitfall 1).
 *
 * Label resolution, in order:
 *   1. a `vMetaData` entry `server` matching this vCenter's row
 *      `viSdkServer` (the columnar 4.x per-vCenter Server, Task 1)
 *   2. the `vMetaData` entry at the same positional index as this vCenter's
 *      first-seen order within the snapshot (single-workbook fallback)
 *   3. the row `viSdkServer`
 *   4. the snapshot `vCenterLabel`
 *
 * Pure: no React/Zustand/Zod; input is never mutated.
 */
export const buildVCenterIndex = (selected: Snapshot[]): Map<string, VCenterEntry> => {
  const index = new Map<string, VCenterEntry>()

  for (const snap of selected) {
    // First-seen order of distinct viSdkUuid within this snapshot, used to
    // positionally align the per-vCenter vMetaData entries when no server
    // string match is available (the allvCenters single-workbook shape).
    const order: string[] = []
    const seen = new Set<string>()
    for (const row of snap.guests) {
      if (!seen.has(row.viSdkUuid)) {
        seen.add(row.viSdkUuid)
        order.push(row.viSdkUuid)
      }
    }

    for (const row of snap.guests) {
      const uuid = row.viSdkUuid
      let entry = index.get(uuid)
      if (!entry) {
        const metaByServer = snap.vMetaData.find(
          (m) => m.server !== '' && m.server === row.viSdkServer,
        )
        const positional = snap.vMetaData[order.indexOf(uuid)]
        const label =
          metaByServer?.server ||
          positional?.server ||
          (row.viSdkServer.trim() !== '' ? row.viSdkServer : '') ||
          snap.vCenterLabel
        entry = {
          viSdkUuid: uuid,
          server: row.viSdkServer,
          label,
          clusters: new Set<string>(),
          vmCount: 0,
        }
        index.set(uuid, entry)
      }
      entry.clusters.add(row.cluster)
      entry.vmCount += 1
    }
  }

  return index
}
