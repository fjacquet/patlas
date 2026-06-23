import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { Snapshot } from '@/types/snapshot'

// SVG-assertion path — identical documented fallback 02-01's Chart.test.tsx
// chose (RESEARCH Open Question 2): jsdom cannot mount real ReactEChartsCore /
// produce ECharts SVG geometry, so we mock `echarts-for-react/esm/core` with a
// stand-in that emits an inline <svg> IFF the centrally-injected
// `opts.renderer === 'svg'` (VIZ-01), else a <canvas>. This proves the
// dashboard's charts are SVG-wired (Pitfall 3) deterministically.
vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: { opts?: { renderer?: string }; theme?: string }) =>
    props.opts?.renderer === 'svg' ? (
      <svg data-testid="echarts-svg" data-theme={props.theme} />
    ) : (
      <canvas data-testid="echarts-canvas" />
    ),
}))

// Same synchronous-pipeline boundary mock as e2e-smoke: returns a minimal
// Proxmox Snapshot in-process (jsdom cannot drive a module Worker).
// Uses source: 'proxmox' with guestType set on every VInfoRow.
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
      vinfo: [
        {
          vmName: 'vm-1',
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
          vmName: 'vm-2',
          cluster: 'proxmox',
          host: 'pve-node-1',
          vcpu: cores(2),
          vramMib: mib(4096),
          cpuReadinessPercent: null,
          powerState: 'poweredOff' as const,
          template: false,
          poweredOn: false,
          osConfig: 'Ubuntu 22.04',
          osTools: 'Ubuntu 22.04',
          vmBiosUuid: '',
          vmInstanceUuid: '102',
          viSdkUuid: '',
          viSdkServer: '',
          provisionedMib: mib(20480),
          inUseMib: mib(5120),
          path: '',
          guestType: 'qemu',
        },
        {
          vmName: 'ct-1',
          cluster: 'proxmox',
          host: 'pve-node-1',
          vcpu: cores(1),
          vramMib: mib(1024),
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
      vhost: [
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
      vdatastore: [],
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

import App from '@/App'

const dropFile = async (name: string) => {
  const file = new File([new ArrayBuffer(8)], name, { lastModified: Date.UTC(2026, 4, 15) })
  const fileInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
  await act(async () => {
    fireEvent.change(fileInput)
  })
}

describe('Proxmox dashboard smoke: drop → buildEstateView → <GlobalDashboard>', () => {
  beforeEach(async () => {
    useSnapshotStore.getState().clearAll()
    await i18n.changeLanguage('en')
  })
  afterEach(cleanup)

  it('renders the empty-state hero before any snapshot is loaded', () => {
    render(<App />)
    // No snapshot → App shows the hero UploadZone branch (dashboard not mounted).
    expect(screen.queryByText(/No snapshot loaded/)).toBeNull()
    expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0)
  })

  it('drops a Proxmox file and renders the estate dashboard (DSH-01..06, SVG-wired)', async () => {
    render(<App />)
    await dropFile('proxmox-report.xlsx')

    // Section titles present (i18n dashboard namespace, EN). "Clusters" also
    // appears as a summary tile label, so query the section <h2> by role.
    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull()
    })
    expect(screen.queryByRole('heading', { level: 2, name: 'Operating systems' })).not.toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: 'CPU Ready' })).not.toBeNull()

    // Exactly one cluster row for the single-cluster Proxmox snapshot — the
    // cluster table renders one "Cluster detail" drill button per row.
    const clusterDrills = screen.getAllByRole('button', { name: 'Cluster detail' })
    expect(clusterDrills.length).toBe(1)

    // Nodes column header present in the cluster table (DSH-01).
    expect(screen.getAllByText('Nodes').length).toBeGreaterThan(0)

    // CPU Ready estate panel + the gold count label (DSH-05).
    expect(screen.getAllByText(/Guests > 5% CPU Ready/).length).toBeGreaterThan(0)

    // SVG renderer wired (Pitfall 3): every chart host emitted an <svg>, no
    // <canvas> anywhere in the rendered dashboard.
    expect(document.querySelectorAll('[data-testid="echarts-svg"]').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-testid="echarts-canvas"]')).toBeNull()
  })

  it('toggling accounting mode recomputes via useEstateView (Critical-6 / ROADMAP #2)', async () => {
    // The mock has 2 powered-on guests + 1 powered-off guest, so
    // Configured (all 3) ≠ Active (powered-on 2). This tests the real
    // useEstateView path without needing an external fixture file.
    render(<App />)
    await dropFile('proxmox-report.xlsx')

    await waitFor(() =>
      expect(screen.queryByRole('heading', { level: 2, name: 'Clusters' })).not.toBeNull(),
    )

    // Read a summary figure (vCPU tile) in Active (default), then Configured.
    const summary = screen.getByLabelText('Estate summary')
    const vcpuActive = within(summary).getByText('vCPU').nextElementSibling?.textContent ?? ''

    await userEvent.setup().click(screen.getByText('Configured'))
    await waitFor(() => {
      expect(screen.getByText('Configured').getAttribute('aria-pressed')).toBe('true')
    })
    const summary2 = screen.getByLabelText('Estate summary')
    const vcpuConfigured = within(summary2).getByText('vCPU').nextElementSibling?.textContent ?? ''

    // Configured (all VMs incl. powered-off) ≠ Active (powered-on only) — the
    // powered-off-VM trap is surfaced (three distinct totals, ROADMAP #2/#6).
    // Active: vm-1 (4 vCPU) + ct-1 (1 vCPU) = 5 vCPU
    // Configured: vm-1 (4) + vm-2 (2) + ct-1 (1) = 7 vCPU
    expect(vcpuConfigured).not.toBe(vcpuActive)
  })
})
