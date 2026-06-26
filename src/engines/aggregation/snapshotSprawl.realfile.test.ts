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

describe('snapshotSprawl acceptance (real Proxmox report)', () => {
  maybe(
    'parses Snapshots sheet and produces a zeroed sprawl (all rows are current markers)',
    () => {
      const wb = parseXlsx(readFileSync(fixture))
      const bundle = adaptProxmox(wb)

      // Log raw row count so the test output is self-documenting.
      console.log('raw Snapshots rows:', bundle.proxmoxSnapshots.length)

      // The fixture must have parsed at least some Snapshots rows.
      expect(bundle.proxmoxSnapshots.length, 'Snapshots sheet must have rows').toBeGreaterThan(0)

      const snapshot: Snapshot = {
        id: 'proxmox-sprawl-realfile-test',
        filename: 'proxmox-report.xlsx',
        fileSize: bytes(0),
        capturedAt: new Date('2025-01-01T00:00:00Z'),
        vCenterLabel: bundle.clusterName,
        rvtoolsVersion: 'proxmox',
        parsedAt: new Date(),
        source: 'proxmox',
        viSdkUuid: null,
        vMetaData: [],
        guests: bundle.guests,
        nodes: bundle.nodes,
        vmUsage: bundle.vmUsage,
        proxmoxSnapshots: bundle.proxmoxSnapshots,
        proxmoxStorageContent: bundle.proxmoxStorageContent,
        proxmoxHaResources: bundle.proxmoxHaResources,
        proxmoxHaStatus: bundle.proxmoxHaStatus,
        proxmoxBackupJobs: bundle.proxmoxBackupJobs,
        storages: bundle.storages,
        vpartition: [],
        vnetwork: [],
        vswitch: [],
        dvswitch: [],
        dvport: [],
        parseErrors: bundle.warnings,
      }

      const merged = mergeSnapshotsToEstate([snapshot])
      const view = buildEstateView(merged, [snapshot], 'active', new Date('2025-01-01T00:00:00Z'))

      const { snapshotSprawl } = view

      // Log the computed counts so the output is self-documenting.
      console.log('real checkpoints (count):', snapshotSprawl.count)

      // The real report holds only `current` markers — no real checkpoints.
      expect(snapshotSprawl.count, 'no real checkpoints expected').toBe(0)
      expect(
        snapshotSprawl.oldestAgeDays,
        'oldestAgeDays must be null when no checkpoints',
      ).toBeNull()
      expect(snapshotSprawl.rows, 'rows must be empty').toEqual([])
    },
  )
})
