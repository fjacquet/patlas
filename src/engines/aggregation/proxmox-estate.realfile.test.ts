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

describe('proxmox estate-totals acceptance (real report)', () => {
  maybe('produces non-zero estate globals from the real Proxmox report', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const bundle = adaptProxmox(wb)

    // Assemble a minimal but fully-typed Snapshot that mirrors what the
    // parser worker produces. Network arrays are empty (Proxmox has none);
    // viSdkUuid is null (no vCenter). `id` and `parsedAt` are stamped here
    // as the main-thread store would do.
    // No row-level cluster fallback needed here: adaptProxmox itself now
    // defaults clusterName to 'proxmox' for standalone nodes (D4).
    const snapshot: Snapshot = {
      id: 'proxmox-realfile-test',
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

    const { globals } = view

    // Log the real numbers so the test output is self-documenting.
    console.log('[proxmox-estate] nodes (hostCount):', globals.hostCount)
    console.log('[proxmox-estate] guests (vmCount):', globals.vmCount)
    console.log('[proxmox-estate] total vCPU allocated:', globals.vcpuAllocated)
    console.log('[proxmox-estate] total vRAM MiB:', globals.vramAllocatedMib)
    console.log('[proxmox-estate] clusterCount:', globals.clusterCount)

    // Core non-zero assertions
    expect(globals.hostCount, 'at least one Proxmox node must be parsed').toBeGreaterThan(0)
    expect(globals.vmCount, 'at least one guest (QEMU or LXC) must be parsed').toBeGreaterThan(0)
    expect(
      globals.vcpuAllocated as number,
      'total allocated vCPU must be positive',
    ).toBeGreaterThan(0)
    expect(
      globals.vramAllocatedMib as number,
      'total allocated vRAM (MiB) must be positive',
    ).toBeGreaterThan(0)
  })
})
