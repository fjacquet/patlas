import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptProxmox } from '@/engines/parser/adapters/proxmox'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import { buildTopology, type TopologyNode } from './topologyTree'

/**
 * P-NT acceptance — buildTopology over the REAL cv4pve-report nodeInterfaces.
 * Skipped when the fixture is absent (CI has no workbook).
 *
 * Assertions are invariant-based, not magic-number hardcoded:
 *   1. At least one distinct topology group (hasData + groups.length ≥ 1).
 *   2. Every group has at least one root, and every root is a 'bond' or 'nic'
 *      kind (uplink-rooted hierarchy invariant) with a 'bridge' child.
 *   3. Every leaf node that carries vmNodeSpread has .total equal to its
 *      containing group's node count (the group = "identical-config nodes",
 *      so every node in the group is counted in the denominator).
 */
const fixture = join(__dirname, '../parser/__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

/** Recursively collect all leaf TopologyNodes (no children). */
function collectLeaves(n: TopologyNode): TopologyNode[] {
  if (!n.children || n.children.length === 0) return [n]
  return n.children.flatMap((c) => collectLeaves(c))
}

describe('topology tree acceptance (real report)', () => {
  maybe('buildTopology produces a valid uplink-rooted tree from the real network sheet', () => {
    const bundle = adaptProxmox(parseXlsx(readFileSync(fixture)))
    const snapshot: Snapshot = {
      id: 'topology-realfile-test',
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
      parseErrors: bundle.warnings,
    }

    const merged = mergeSnapshotsToEstate([snapshot])
    const view = buildTopology(merged)

    // Log the real numbers so test output is self-documenting.
    console.log('[topology] nodeInterfaces parsed:', bundle.nodeInterfaces.length)
    console.log('[topology] vmNics parsed:', bundle.vmNics.length)
    console.log('[topology] groups:', view.groups.length)
    for (const [i, g] of view.groups.entries()) {
      console.log(
        `[topology]   group[${i}] nodes=[${g.nodes.join(', ')}] roots=${g.roots.length} unconfigured=${g.unconfiguredNicCount}`,
      )
    }

    // 1. hasData + at least one group (network sheet is present in this fixture).
    expect(view.hasData, 'real network sheet must produce at least one topology group').toBe(true)
    expect(
      view.groups.length,
      'at least one distinct interface configuration',
    ).toBeGreaterThanOrEqual(1)

    // 2. Every group has a valid uplink-rooted hierarchy:
    //    roots are 'bond' or 'nic' kind, each root has a 'bridge' child.
    for (const [gi, g] of view.groups.entries()) {
      expect(g.roots.length, `group[${gi}] must have at least one root`).toBeGreaterThan(0)
      for (const root of g.roots) {
        expect(
          ['bond', 'nic'].includes(root.kind),
          `group[${gi}] root "${root.name}" must be bond or nic (uplink)`,
        ).toBe(true)
        expect(
          root.children?.some((c) => c.kind === 'bridge'),
          `group[${gi}] root "${root.name}" must have a bridge child`,
        ).toBe(true)
      }
    }

    // 3. Every vmNodeSpread leaf has .total === the group's node count.
    //    This verifies the denominator is set from the deduplicated node list,
    //    not a hardcoded constant or an off-by-one.
    for (const [gi, g] of view.groups.entries()) {
      const groupNodeCount = g.nodes.length
      for (const root of g.roots) {
        const leaves = collectLeaves(root)
        for (const leaf of leaves) {
          if (leaf.vmNodeSpread !== undefined) {
            expect(
              leaf.vmNodeSpread.total,
              `group[${gi}] leaf "${leaf.name}" vmNodeSpread.total must equal group node count`,
            ).toBe(groupNodeCount)
          }
        }
      }
    }
  })
})
