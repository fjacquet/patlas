import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'

// jsdom cannot drive a real module Worker, so we mock the `parseInWorker`
// boundary to return a minimal in-memory Proxmox Snapshot synchronously
// in-process. This mirrors the same boundary the originals used (they mocked
// parseSnapshot from the now-deleted RVTools normalizeColumns; we mock the
// same exported boundary — `@/engines/parser` → `parseInWorker`).
// STRIDE T-05-05: test-only mock; the real worker runs the privacy guard at
// its top.
vi.mock('@/engines/parser', () => ({
  parseInWorker: async (file: File) => {
    const buf = await file.arrayBuffer()
    const snapshot: Omit<Snapshot, 'id' | 'parsedAt'> = {
      filename: file.name,
      fileSize: bytes(buf.byteLength),
      capturedAt: new Date('2026-05-15T00:00:00Z'),
      vCenterLabel: 'proxmox',
      rvtoolsVersion: '',
      viSdkUuid: null,
      vMetaData: [],
      source: 'proxmox' as const,
      guests: [
        {
          vmName: 'test-vm-1',
          cluster: 'proxmox',
          host: 'pve-node-1',
          vcpu: cores(4),
          vramMib: mib(8192),
          cpuReadinessPercent: null,
          powerState: 'poweredOn' as const,
          template: false,
          poweredOn: true,
          osConfig: 'Debian 12',
          osTools: 'Debian 12',
          vmBiosUuid: '',
          vmInstanceUuid: '101',
          viSdkUuid: '',
          viSdkServer: '',
          provisionedMib: mib(32768),
          inUseMib: mib(10240),
          path: '',
          guestType: 'qemu',
        },
        {
          vmName: 'test-ct-1',
          cluster: 'proxmox',
          host: 'pve-node-1',
          vcpu: cores(2),
          vramMib: mib(2048),
          cpuReadinessPercent: null,
          powerState: 'poweredOn' as const,
          template: false,
          poweredOn: true,
          osConfig: 'Alpine Linux',
          osTools: 'Alpine Linux',
          vmBiosUuid: '',
          vmInstanceUuid: '201',
          viSdkUuid: '',
          viSdkServer: '',
          provisionedMib: mib(8192),
          inUseMib: mib(2048),
          path: '',
          guestType: 'lxc',
        },
      ],
      nodes: [
        {
          hostName: 'pve-node-1',
          cluster: 'proxmox',
          sockets: sockets(1),
          cores: cores(8),
          speedMhz: mhz(3200),
          memoryMib: mib(65536),
          cpuRatio: 0,
          ramRatio: 0.3,
          faultDomain: '',
          model: 'AMD EPYC',
          vendor: '',
          serialNumber: '',
          esxVersion: 'pve-8.2',
        },
      ],
      vmUsage: [],
      proxmoxSnapshots: [],
      proxmoxStorageContent: [],
      proxmoxHaResources: [],
      proxmoxHaStatus: [],
      proxmoxBackupJobs: [],
      storages: [],
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      parseErrors: [],
    }
    return { snapshot, warnings: [] }
  },
}))

// App imports `parseInWorker` transitively via useSnapshotUpload — import
// AFTER the mock is registered.
import App from '@/App'

describe('Proxmox end-to-end smoke: drop → parse → render', () => {
  beforeEach(async () => {
    useSnapshotStore.getState().clearAll()
    await i18n.changeLanguage('en')
  })

  it('renders the hero UploadZone when no snapshots are loaded', () => {
    render(<App />)
    expect(screen.queryByText(/pAtlas/)).not.toBeNull()
    expect(screen.queryAllByRole('button').length).toBeGreaterThan(0)
  })

  it('drops a Proxmox file and renders a SnapshotCard with the expected metadata', async () => {
    const file = new File([new ArrayBuffer(8)], 'proxmox-report.xlsx', {
      lastModified: Date.UTC(2026, 4, 15),
    })

    render(<App />)

    const inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
    const fileInput = inputs[0] as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file] })

    await act(async () => {
      fireEvent.change(fileInput)
    })

    await waitFor(() => {
      expect(screen.queryByText(/proxmox-report\.xlsx/)).not.toBeNull()
    })

    // The mock returns capturedAt 2026-05-15; assert the year appears
    // (locale format of toLocaleDateString varies).
    const dated = screen.getAllByText(/2026/)
    expect(dated.length).toBeGreaterThan(0)

    // Cluster label from the mock Proxmox snapshot (may appear in sidebar + table).
    expect(screen.queryAllByText(/proxmox/i).length).toBeGreaterThan(0)

    // Row counts: 2 guests (1 VM + 1 LXC), 1 node.
    expect(screen.getByText(/2 Guests/i)).not.toBeNull()
  })

  it('PAR-05: clearing the store mimics a refresh — no persisted dataset rows remain', () => {
    const { addSnapshot } = useSnapshotStore.getState()
    addSnapshot({
      id: 'test-id',
      filename: 'proxmox-test.xlsx',
      fileSize: bytes(0),
      capturedAt: new Date(),
      vCenterLabel: 'proxmox',
      rvtoolsVersion: '',
      parsedAt: new Date(),
      source: 'proxmox',
      viSdkUuid: null,
      vMetaData: [],
      guests: [],
      nodes: [],
      vmUsage: [],
      proxmoxSnapshots: [],
      proxmoxStorageContent: [],
      proxmoxHaResources: [],
      proxmoxHaStatus: [],
      proxmoxBackupJobs: [],
      storages: [],
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      parseErrors: [],
    })
    expect(useSnapshotStore.getState().snapshots.size).toBe(1)

    // A page reload re-initializes the module-scope `new Map()`; clearAll is
    // the test-time equivalent. Nothing in this plan persists dataset rows.
    useSnapshotStore.getState().clearAll()
    expect(useSnapshotStore.getState().snapshots.size).toBe(0)

    // PAR-05: Only patlas-lang / patlas-theme UI prefs are allowed in localStorage.
    const stray = Object.keys(localStorage).filter(
      (k) => !k.startsWith('patlas-lang') && !k.startsWith('patlas-theme'),
    )
    expect(stray).toEqual([])
  })

  it('Phase-3: ViewToggle switches Dashboard↔Inventory with the sidebar intact throughout', async () => {
    const file = new File([new ArrayBuffer(8)], 'proxmox-report.xlsx', {
      lastModified: Date.UTC(2026, 4, 15),
    })

    render(<App />)

    const fileInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { value: [file] })
    await act(async () => {
      fireEvent.change(fileInput)
    })

    // Snapshot loaded → sidebar SnapshotCard + dashboard render (default view).
    await waitFor(() => {
      expect(screen.queryByText(/proxmox-report\.xlsx/)).not.toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Inventory' }).getAttribute('aria-pressed')).toBe(
      'false',
    )

    // Toggle → Inventory: the tree + object-table tab strip render.
    const { userEvent } = await import('@testing-library/user-event')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Inventory' }))
    await waitFor(() => {
      expect(screen.queryByRole('tree', { name: /inventory tree/i })).not.toBeNull()
    })
    expect(screen.getByRole('group', { name: /object type/i })).not.toBeNull()
    // Sidebar still mounted across the switch.
    expect(screen.queryByText(/proxmox-report\.xlsx/)).not.toBeNull()

    // Toggle back → Dashboard: the estate section heading returns.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dashboard' }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull()
    })
    expect(screen.queryByText(/proxmox-report\.xlsx/)).not.toBeNull()
  })
})
