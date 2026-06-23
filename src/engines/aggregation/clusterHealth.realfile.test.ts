import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptProxmox } from '@/engines/parser/adapters/proxmox'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView } from './estateView'

const fixture = join(__dirname, '../parser/__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

describe('cluster health acceptance (real report)', () => {
  maybe('aggregates real HA status; HA resources and backup jobs empty in this fixture', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const bundle = adaptProxmox(wb)

    const snapshot: Snapshot = {
      id: 'proxmox-ch-realfile',
      filename: 'proxmox-report.xlsx',
      fileSize: bytes(0),
      capturedAt: new Date('2026-06-23T00:00:00Z'),
      vCenterLabel: bundle.clusterName,
      rvtoolsVersion: 'proxmox',
      parsedAt: new Date('2026-06-23T00:00:00Z'),
      source: 'proxmox',
      viSdkUuid: null,
      vMetaData: [],
      vinfo: bundle.vinfo,
      vhost: bundle.vhost,
      vmUsage: bundle.vmUsage,
      vdatastore: bundle.vdatastore,
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      proxmoxSnapshots: bundle.proxmoxSnapshots,
      proxmoxStorageContent: bundle.proxmoxStorageContent,
      proxmoxHaResources: bundle.proxmoxHaResources,
      proxmoxHaStatus: bundle.proxmoxHaStatus,
      proxmoxBackupJobs: bundle.proxmoxBackupJobs,
      parseErrors: bundle.warnings,
    }

    const merged = mergeSnapshotsToEstate([snapshot])
    const view = buildEstateView(merged, [snapshot], 'active', new Date('2026-06-23T00:00:00Z'))
    const { clusterHealth } = view

    console.log('[cluster-health] quorum:', clusterHealth.ha.quorumStatus)
    console.log('[cluster-health] fencing:', clusterHealth.ha.fencingStatus)
    console.log('[cluster-health] HA resources:', clusterHealth.ha.managedCount)
    console.log('[cluster-health] backup jobs:', clusterHealth.backups.jobCount)

    // The fixture is a single-node lab: quorum present, no HA-managed guests,
    // no scheduled backup jobs.
    expect(clusterHealth.ha.quorumStatus).toBe('OK')
    expect(clusterHealth.ha.managedCount).toBe(0)
    expect(clusterHealth.backups.jobCount).toBe(0)
  })
})
