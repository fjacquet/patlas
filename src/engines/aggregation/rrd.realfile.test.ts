import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptProxmox } from '@/engines/parser/adapters/proxmox'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView } from './estateView'

/**
 * P8 Pack A acceptance — the RRD analytics over the REAL cv4pve report
 * (skipped when the fixture is absent, like the sibling realfile tests).
 * Confirms node-headroom + storage time-to-full + the single-file trend
 * timeline are derived from the live RRD time-series.
 */
const fixture = join(__dirname, '../parser/__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

describe('RRD analytics acceptance (real report)', () => {
  maybe('derives node headroom, storage growth, and a single-file timeline', () => {
    const bundle = adaptProxmox(parseXlsx(readFileSync(fixture)))
    const snapshot: Snapshot = {
      id: 'rrd-realfile-test',
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
      nodeInterfaces: bundle.nodeInterfaces,
      vmNics: bundle.vmNics,
      rrdNodes: bundle.rrdNodes,
      rrdStorage: bundle.rrdStorage,
      rrdGuests: bundle.rrdGuests,
      parseErrors: bundle.warnings,
    }

    const view = buildEstateView(
      mergeSnapshotsToEstate([snapshot]),
      [snapshot],
      'active',
      new Date('2025-01-01T00:00:00Z'),
    )
    const hr = view.rrdHeadroom
    const sg = view.rrdStorageGrowth

    console.log('[rrd] node samples parsed:', bundle.rrdNodes.length)
    console.log('[rrd] storage samples parsed:', bundle.rrdStorage.length)
    console.log('[rrd] perNode:', hr.perNode.length, 'timeline pts:', hr.timeline.length)
    console.log('[rrd] estate cpuPeak/cpuAvg:', hr.estate.cpuPeak, hr.estate.cpuAvg)
    console.log('[rrd] storages:', sg.rows.length, 'soonestDaysToFull:', sg.soonestDaysToFull)

    expect(hr.hasData, 'RRD-Nodes headroom must be derived').toBe(true)
    expect(hr.perNode.length, 'at least one node series').toBeGreaterThan(0)
    expect(hr.timeline.length, 'estate-wide RRD timeline (single-file trends)').toBeGreaterThan(1)
    expect(hr.estate.cpuPeak).toBeGreaterThan(0)
    expect(hr.windowStartSerial).not.toBeNull()

    expect(sg.hasData, 'RRD-Storage growth must be derived').toBe(true)
    expect(sg.rows.length, 'at least one storage projection').toBeGreaterThan(0)
    // days-to-full may legitimately be null for every storage (flat usage);
    // the projection rows and growth rates must still be present.
    for (const r of sg.rows) expect(Number.isFinite(r.growthGibPerDay)).toBe(true)
  })
})
