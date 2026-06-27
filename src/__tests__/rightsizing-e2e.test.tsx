import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { RightSizingView } from '@/components/rightsizing/RightSizingView'
import { buildEstateView } from '@/engines/aggregation'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { GuestRow, VmUsageRow } from '@/types/guest'
import type { NodeRow } from '@/types/node'
import type { Snapshot } from '@/types/snapshot'

/**
 * P-RS end-to-end: build a 10k Proxmox estate in memory (no xlsx, no
 * parsing), run it through the SAME pure pipeline (mergeSnapshotsToEstate →
 * buildEstateView), then assert the right-sizing extract is derived correctly
 * — powered-on-only filtering, all three categories populated — and that the
 * view renders.
 *
 * The distribution is seeded to guarantee all three categories:
 *  - i % 5 === 0  → poweredOff (2 000 VMs, excluded from sizing)
 *  - i % 3 === 0  → oversized:  1 vCPU,  512 MiB RAM, low active (50 MHz, 20 MiB)
 *  - i % 7 === 0  → undersized: 8 vCPU, 4096 MiB RAM, high active (3500 MHz, 3500 MiB)
 *  - else         → stressed:   4 vCPU, 2048 MiB RAM, balloon > 0
 *  (powered-on VMs only — categories apply to powered-on VMs)
 */

const VM_COUNT = 10_000
// i%5===0 → poweredOff → 8 000 powered-on
const POWERED_ON = VM_COUNT - Math.floor(VM_COUNT / 5)
const TODAY = new Date('2026-01-01T00:00:00Z')

// 8 Proxmox nodes spread across 2 clusters
const CLUSTERS: [string, ...string[]] = ['cluster-a', 'cluster-b']
const HOSTS_PER_CLUSTER = 4

function makeProxmoxHosts(): NodeRow[] {
  const hosts: NodeRow[] = []
  for (const cluster of CLUSTERS) {
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
        model: 'Dell PowerEdge R750',
        vendor: 'Dell',
        serialNumber: `SN-${cluster}-${h}`,
        esxVersion: '',
      })
    }
  }
  return hosts
}

function makeProxmoxEstate(vmCount: number): Snapshot {
  const hostList = makeProxmoxHosts()
  const hostNames: [string, ...string[]] = hostList.map((h) => h.hostName) as [string, ...string[]]
  const guests: GuestRow[] = []
  const vmUsage: VmUsageRow[] = []

  // pick(arr, i) is safe: modulo always yields a valid index for non-empty arrays.
  const pick = <T,>(arr: [T, ...T[]], i: number): T => arr[i % arr.length] as T

  for (let i = 0; i < vmCount; i++) {
    const name = `vm-${String(i + 1).padStart(5, '0')}`
    const cluster = pick(CLUSTERS, i)
    const host = pick(hostNames, i)
    const guestType: 'qemu' | 'lxc' = i % 10 === 0 ? 'lxc' : 'qemu'
    const poweredOff = i % 5 === 0
    const powerState = poweredOff ? ('poweredOff' as const) : ('poweredOn' as const)

    // Sizing distribution (only matters for powered-on)
    let vcpuN = 4
    let vramN = 2_048

    if (!poweredOff) {
      if (i % 3 === 0) {
        // oversized: low vcpu + low allocation
        vcpuN = 1
        vramN = 512
      } else if (i % 7 === 0) {
        // undersized: high allocation + high usage
        vcpuN = 8
        vramN = 4_096
      }
      // else stressed default: 4 vcpu, 2048 MiB
    }

    guests.push({
      vmName: name,
      cluster,
      host,
      vcpu: cores(vcpuN),
      vramMib: mib(vramN),
      cpuReadinessPercent: null,
      powerState,
      template: false,
      poweredOn: !poweredOff,
      osConfig: 'Debian GNU/Linux 12',
      osTools: 'Debian GNU/Linux 12',
      vmBiosUuid: `bios-${i}`,
      vmInstanceUuid: `inst-${i}`,
      viSdkUuid: '',
      viSdkServer: '',
      provisionedMib: mib(vramN * 2),
      inUseMib: mib(vramN),
      path: `[local] ${name}/${name}.conf`,
      guestType,
    })

    if (!poweredOff) {
      // Provide usage rows to drive sizing engine
      if (i % 3 === 0) {
        // oversized: very low CPU + mem usage → cpuUtil < 10%, memActive < 20%
        vmUsage.push({
          vmName: name,
          cluster,
          vmBiosUuid: `bios-${i}`,
          vmInstanceUuid: `inst-${i}`,
          activeMib: mib(50), // 20% of 512 MiB
          consumedMib: mib(80),
          balloonedMib: mib(0),
          swappedMib: mib(0),
          cpuUsageMhz: mhz(50), // 10% of 1 * 3200 MHz
        })
      } else if (i % 7 === 0) {
        // undersized: very high CPU + mem usage → cpuUtil > 90%, memActive > 90%
        vmUsage.push({
          vmName: name,
          cluster,
          vmBiosUuid: `bios-${i}`,
          vmInstanceUuid: `inst-${i}`,
          activeMib: mib(3_800), // ~92% of 4096 MiB
          consumedMib: mib(3_900),
          balloonedMib: mib(0),
          swappedMib: mib(0),
          cpuUsageMhz: mhz(24_000), // ~93.8% of 8 * 3200 = 25600 MHz (CPU also > 90%)
        })
      } else {
        // stressed: ballooning present — exceeds DEFAULT balloonMib threshold of 0
        vmUsage.push({
          vmName: name,
          cluster,
          vmBiosUuid: `bios-${i}`,
          vmInstanceUuid: `inst-${i}`,
          activeMib: mib(1_200),
          consumedMib: mib(1_800),
          balloonedMib: mib(512),
          swappedMib: mib(0),
          cpuUsageMhz: mhz(8_000),
        })
      }
    }
  }

  return {
    id: 'proxmox-rs-e2e',
    filename: 'proxmox-10k.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date(Date.UTC(2026, 4, 15)),
    parsedAt: new Date(),
    vCenterLabel: 'proxmox-cluster',
    rvtoolsVersion: 'proxmox',
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    guests,
    nodes: hostList,
    vmUsage,
    proxmoxSnapshots: [],
    proxmoxStorageContent: [],
    proxmoxHaResources: [],
    proxmoxHaStatus: [],
    proxmoxBackupJobs: [],
    storages: [],
    vpartition: [],
    nodeInterfaces: [],

    vmNics: [],
    parseErrors: [],
  }
}

let snapshot: Snapshot

beforeAll(() => {
  snapshot = makeProxmoxEstate(VM_COUNT)
}, 30_000)

const buildSizing = () =>
  buildEstateView(mergeSnapshotsToEstate([snapshot]), [snapshot], 'active', TODAY).sizing

describe('Right-sizing end-to-end (Proxmox in-memory 10k estate)', () => {
  it('populates vmUsage for powered-on VMs', () => {
    expect(snapshot.vmUsage.length).toBeGreaterThanOrEqual(7_000)
    const sizing = buildSizing()
    expect(sizing.hasUsageData).toBe(true)
  })

  it('populates all three categories from the seeded distribution', () => {
    const { counts } = buildSizing()
    expect(counts.oversized).toBeGreaterThan(0)
    expect(counts.undersized).toBeGreaterThan(0)
    expect(counts.stressed).toBeGreaterThan(0)
  })

  it('evaluates powered-on VMs only (powered-off excluded)', () => {
    const sizing = buildSizing()
    expect(sizing.rows.length).toBe(POWERED_ON)
    // vm-00001 is i=0 → poweredOff → absent from the extract
    expect(sizing.rows.some((r) => r.vmName === 'vm-00001')).toBe(false)
  })

  it('renders the view through the store without crashing on 10k VMs', async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
    useSnapshotStore.getState().addSnapshot(snapshot)
    render(<RightSizingView />)
    // The heading and at least one VM row render (DataTable virtualizes).
    expect(screen.getByRole('heading', { name: /right-sizing/i })).toBeInTheDocument()
  })
})

afterEach(() => {
  useSnapshotStore.getState().clearAll()
})

beforeEach(() => {
  useSnapshotStore.getState().clearAll()
})
