import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoryTree } from '@/components/inventory/InventoryTree'
import { VmTable } from '@/components/inventory/VmTable'
import { buildEstateView as buildEstateViewMerged } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import type { AccountingMode } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'

/**
 * 10k-VM Proxmox stress proof (ROADMAP Phase-3 success #1/#2/#4). Builds the
 * estate entirely in memory (no xlsx parse, no fixture file), then asserts:
 *  - VM sort by `provisionedMib` desc completes < 200 ms (#2)
 *  - the virtualised tree keeps a BOUNDED rendered window at 10k (#1 proxy)
 *  - CSV export of a filtered VM view works with special characters (#4)
 */

const TEST_TODAY = new Date('2026-01-01T00:00:00Z')
const VM_COUNT = 10_000

const buildEstateView = (snap: Snapshot, mode: AccountingMode) =>
  buildEstateViewMerged(mergeSnapshotsToEstate([snap]), [snap], mode, TEST_TODAY)

// 8 Proxmox nodes spread across 2 clusters
const CLUSTER_NAMES: [string, ...string[]] = ['cluster-alpha', 'cluster-beta']
const HOSTS_PER_CLUSTER = 4

// pick(arr, i) is safe: modulo always yields a valid index for non-empty arrays.
const pick = <T,>(arr: [T, ...T[]], i: number): T => arr[i % arr.length] as T

function makeHosts(): VHostRow[] {
  const hosts: VHostRow[] = []
  for (const cluster of CLUSTER_NAMES) {
    for (let h = 0; h < HOSTS_PER_CLUSTER; h++) {
      hosts.push({
        hostName: `${cluster}-node${h + 1}`,
        cluster,
        sockets: sockets(2),
        cores: cores(32),
        speedMhz: mhz(3_200),
        memoryMib: mib(65_536),
        cpuRatio: 0.4,
        ramRatio: 0.5,
        faultDomain: '',
        model: 'Supermicro SYS-6029P',
        vendor: 'Supermicro',
        serialNumber: `SN-${cluster}-${h}`,
        esxVersion: '',
      })
    }
  }
  return hosts
}

function makeProxmoxEstate(vmCount: number): Snapshot {
  const hostList = makeHosts()
  const hostNames: [string, ...string[]] = hostList.map((h) => h.hostName) as [string, ...string[]]
  const vinfo: VInfoRow[] = []

  for (let i = 0; i < vmCount; i++) {
    const name = `vm-${String(i + 1).padStart(5, '0')}`
    const cluster = pick(CLUSTER_NAMES, i)
    const host = pick(hostNames, i)
    const guestType: 'qemu' | 'lxc' = i % 10 === 0 ? 'lxc' : 'qemu'
    const poweredOff = i % 5 === 0

    // Row i=4242 carries a newline in osConfig to test RFC-4180 CSV quoting.
    const osConfig =
      i === 4242
        ? 'Debian GNU/Linux 12\nmaintenance window: 2026-06'
        : `Debian GNU/Linux ${(i % 5) + 8}`

    vinfo.push({
      vmName: name,
      cluster,
      host,
      vcpu: cores((i % 4) + 1),
      vramMib: mib(512 * ((i % 8) + 1)),
      cpuReadinessPercent: null,
      powerState: poweredOff ? 'poweredOff' : 'poweredOn',
      template: false,
      poweredOn: !poweredOff,
      osConfig,
      osTools: osConfig,
      vmBiosUuid: `bios-${i}`,
      vmInstanceUuid: `inst-${i}`,
      viSdkUuid: '',
      viSdkServer: '',
      provisionedMib: mib(1_024 * ((i % 8) + 1)),
      inUseMib: mib(512 * ((i % 8) + 1)),
      path: `[local] ${name}/${name}.conf`,
      guestType,
    })
  }

  return {
    id: 'proxmox-inventory-stress',
    filename: 'proxmox-10k.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date(Date.UTC(2026, 4, 15)),
    parsedAt: new Date(),
    vCenterLabel: 'proxmox-stress',
    rvtoolsVersion: 'proxmox',
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    vinfo,
    vhost: hostList,
    vmUsage: [],
    proxmoxSnapshots: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    parseErrors: [],
  }
}

let snapshot: Snapshot

beforeAll(() => {
  snapshot = makeProxmoxEstate(VM_COUNT)
}, 30_000)

describe('Inventory 10k stress — Proxmox in-memory estate (Phase-3 #1/#2/#4)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('builds ~10k VMs and projects vmRows in the single estate pass', () => {
    expect(snapshot.vinfo.length).toBeGreaterThanOrEqual(9_000)
    const view = buildEstateView(snapshot, 'active')
    expect(view.vmRows.length).toBe(snapshot.vinfo.length)
  })

  it('sorts the VM rows by provisionedMib desc in < 200 ms at 10k (#2)', () => {
    const view = buildEstateView(snapshot, 'active')
    const rows = view.vmRows.slice()
    const t0 = performance.now()
    rows.sort((a, b) => Number(b.provisionedMib) - Number(a.provisionedMib))
    const elapsed = performance.now() - t0
    // Sorted invariant + the ROADMAP #2 budget (do NOT widen — surface a
    // breach instead, 03-RESEARCH Pitfall 3).
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1]?.provisionedMib)).toBeGreaterThanOrEqual(
        Number(rows[i]?.provisionedMib),
      )
    }
    expect(elapsed).toBeLessThan(200)
  })

  it('keeps the virtualised tree window bounded on expand/collapse at 10k (#1 proxy)', async () => {
    const view = buildEstateView(snapshot, 'active')
    const clustersOrdered = view.clusters.map((c) => c.cluster)
    const hostsByCluster = new Map<string, typeof view.hosts>()
    for (const h of view.hosts) {
      const l = hostsByCluster.get(h.cluster)
      if (l) l.push(h)
      else hostsByCluster.set(h.cluster, [h])
    }
    const vmsByHost = new Map<string, typeof view.vmRows>()
    for (const v of view.vmRows) {
      const l = vmsByHost.get(v.host)
      if (l) l.push(v)
      else vmsByHost.set(v.host, [v])
    }

    render(
      <InventoryTree
        rootLabel="proxmox.stress.local"
        clustersOrdered={clustersOrdered}
        hostsByCluster={hostsByCluster}
        vmsByHost={vmsByHost}
        selectedId={null}
        onSelect={() => {}}
      />,
    )

    const windowCount = () => document.querySelectorAll('[role="treeitem"]').length

    // Root-expanded default: only the root + clusters are flattened — the
    // 10k VM leaves are NOT materialised (lazy children, Critical-5).
    const collapsed = windowCount()
    expect(collapsed).toBeLessThan(200)

    // Expand the first cluster, then its first host — even with thousands of
    // VMs under a host the rendered window stays a bounded virtualised slice.
    const firstCluster = clustersOrdered[0]
    if (firstCluster) {
      await userEvent.click(screen.getByRole('button', { name: firstCluster }))
      const firstHost = hostsByCluster.get(firstCluster)?.[0]?.hostName
      if (firstHost) {
        await userEvent.click(screen.getByRole('button', { name: firstHost }))
      }
    }
    await waitFor(() => {
      // Far below the total leaf count — the virtualiser windows the DOM.
      expect(windowCount()).toBeLessThan(200)
    })
    expect(windowCount()).toBeLessThan(view.vmRows.length)
  })

  it('exports the filtered VM view (raw values, newline preserved) in light AND dark (#4)', async () => {
    const view = buildEstateView(snapshot, 'active')
    let capturedText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      void (obj as Blob).text().then((s) => {
        capturedText = s
      })
      return 'blob:mock'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    for (const theme of ['light', 'dark'] as const) {
      capturedText = ''
      document.documentElement.classList.toggle('dark', theme === 'dark')
      const user = userEvent.setup()
      const { unmount } = render(<VmTable rows={view.vmRows} />)

      // Filter to the deterministic multi-line annotation row the generator
      // embeds (row i===4242: its `osTools` carries a "\n" + the unique token
      // "maintenance window"); narrow + assert RFC-4180 quoting.
      const filter = screen.getByRole('searchbox')
      await user.type(filter, 'maintenance')

      const exportBtn = screen.getByRole('button', { name: /export csv/i })
      await waitFor(
        async () => {
          await user.click(exportBtn)
          expect(capturedText.length).toBeGreaterThan(0)
          expect(capturedText).toContain('\n')
        },
        { timeout: 2000 },
      )
      // RFC-4180: a field containing a newline is double-quoted.
      expect(capturedText).toMatch(/"[^"]*\n[^"]*"/)
      unmount()
    }
  })
})
