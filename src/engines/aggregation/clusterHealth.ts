import type {
  ProxmoxBackupJobRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
} from '@/types/snapshot'

/**
 * Pure cluster-health extract — Proxmox HA service status (quorum/fencing),
 * HA-managed resources, and scheduled backup jobs. Neutral measurement only —
 * no verdict (ADR-0012). No React/Zustand/Zod/DOM.
 */

export interface ClusterHealth {
  ha: {
    resources: ProxmoxHaResourceRow[]
    managedCount: number
    /** Status text of the `quorum` service row; `null` when absent. */
    quorumStatus: string | null
    /** Status text of the `fencing` service row; `null` when absent. */
    fencingStatus: string | null
    services: ProxmoxHaStatusRow[]
  }
  backups: {
    jobs: ProxmoxBackupJobRow[]
    jobCount: number
    enabledCount: number
    /** Distinct VMIDs referenced across all jobs' `vmId` lists. */
    guestsCovered: number
  }
}

const statusOfType = (rows: ProxmoxHaStatusRow[], type: string): string | null => {
  const row = rows.find((r) => r.type.trim().toLowerCase() === type)
  return row ? row.status : null
}

export const computeClusterHealth = (
  haResources: ProxmoxHaResourceRow[],
  haStatus: ProxmoxHaStatusRow[],
  backupJobs: ProxmoxBackupJobRow[],
): ClusterHealth => {
  const guests = new Set<string>()
  for (const j of backupJobs) {
    for (const id of j.vmId.split(',')) {
      const v = id.trim()
      if (v !== '') guests.add(v)
    }
  }
  return {
    ha: {
      resources: haResources,
      managedCount: haResources.length,
      quorumStatus: statusOfType(haStatus, 'quorum'),
      fencingStatus: statusOfType(haStatus, 'fencing'),
      services: haStatus,
    },
    backups: {
      jobs: backupJobs,
      jobCount: backupJobs.length,
      enabledCount: backupJobs.filter((j) => j.enabled).length,
      guestsCovered: guests.size,
    },
  }
}
