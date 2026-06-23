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

describe('storage content health acceptance (real report)', () => {
  maybe('aggregates real Storage Content; backups empty in this fixture', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const bundle = adaptProxmox(wb)

    const snapshot: Snapshot = {
      id: 'proxmox-sc-realfile',
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
      parseErrors: bundle.warnings,
    }

    const merged = mergeSnapshotsToEstate([snapshot])
    const view = buildEstateView(merged, [snapshot], 'active', new Date('2026-06-23T00:00:00Z'))
    const { storageContent } = view

    console.log('[storage-content] files:', storageContent.fileCount)
    console.log(
      '[storage-content] content types:',
      storageContent.byContent.map((g) => g.content).join(', '),
    )
    console.log('[storage-content] backups:', storageContent.backups.count)

    // Rich storage content in the fixture (22 rows across DATA/local/local-lvm).
    expect(storageContent.fileCount).toBeGreaterThan(0)
    expect(storageContent.totalSizeMib).toBeGreaterThan(0)
    expect(storageContent.byContent.some((g) => g.content === 'images')).toBe(true)
    expect(storageContent.byStorage.some((g) => g.storage === 'DATA')).toBe(true)
    // No 'backup' content rows in this fixture → backups honestly empty.
    expect(storageContent.backups.count).toBe(0)
    expect(storageContent.backups.oldestAgeDays).toBeNull()
  })
})
