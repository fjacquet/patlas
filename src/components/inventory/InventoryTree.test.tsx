import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cores, ghz, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import type { EsxAggregate, VmDisplayRow } from '@/types/estate'
import { InventoryTree, type TreeSelection } from './InventoryTree'

const host = (
  over: Partial<EsxAggregate> & Pick<EsxAggregate, 'hostName' | 'cluster'>,
): EsxAggregate => ({
  sockets: sockets(2),
  cores: cores(16),
  speedMhz: mhz(2400),
  physicalGhz: ghz(38.4),
  memoryMib: mib(262144),
  vmCount: 0,
  vcpuAllocated: cores(0),
  vramAllocatedMib: mib(0),
  cpuRatio: 0,
  ramRatio: 0,
  meanCpuReadinessPercent: null,
  maxCpuReadinessPercent: null,
  vmsAboveReadinessWarning: 0,
  readinessAvailable: false,
  faultDomain: '',
  model: '',
  vendor: '',
  esxVersion: '',
  poweredOnVms: 0,
  ...over,
})

const vm = (
  over: Partial<VmDisplayRow> & Pick<VmDisplayRow, 'vmName' | 'cluster' | 'host'>,
): VmDisplayRow => ({
  vcpu: cores(2),
  vramMib: mib(4096),
  os: 'Ubuntu Linux',
  poweredOn: true,
  provisionedMib: mib(40960),
  ...over,
})

const CLUSTERS = ['ClusterA', 'ClusterB']
const hostsByCluster = new Map<string, EsxAggregate[]>([
  ['ClusterA', [host({ hostName: 'esx-a1', cluster: 'ClusterA' })]],
  ['ClusterB', [host({ hostName: 'esx-b1', cluster: 'ClusterB' })]],
])
const vmsByHost = new Map<string, VmDisplayRow[]>([
  [
    'esx-a1',
    [
      vm({ vmName: 'vm-a-1', cluster: 'ClusterA', host: 'esx-a1' }),
      vm({ vmName: 'vm-a-2', cluster: 'ClusterA', host: 'esx-a1' }),
    ],
  ],
  // esx-b1 intentionally has zero VMs (empty-node count-badge test).
])

function Harness() {
  return (
    <InventoryTree
      rootLabel="vcenter.test.local"
      clustersOrdered={CLUSTERS}
      hostsByCluster={hostsByCluster}
      vmsByHost={vmsByHost}
      selectedId={null}
      onSelect={() => {}}
    />
  )
}

describe('InventoryTree (INV-01 — flatten-visible + lazy children)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the synthetic vCenter root with an expanded-by-default clusters level', () => {
    render(<Harness />)
    expect(screen.getByText('vcenter.test.local')).not.toBeNull()
    // Root opens by default → clusters visible, but their hosts are NOT.
    expect(screen.getByText('ClusterA')).not.toBeNull()
    expect(screen.getByText('ClusterB')).not.toBeNull()
    expect(screen.queryByText('esx-a1')).toBeNull()
  })

  it('lazy children: a collapsed cluster does NOT materialise its hosts; expand → appear; collapse → gone', async () => {
    render(<Harness />)
    expect(screen.queryByText('esx-a1')).toBeNull()

    // Expand ClusterA via its chevron (aria-label = node label).
    const chevA = screen.getByRole('button', { name: 'ClusterA' })
    await userEvent.click(chevA)
    expect(screen.getByText('esx-a1')).not.toBeNull()
    // ClusterA's host is present; ClusterA VMs still absent (host collapsed).
    expect(screen.queryByText('vm-a-1')).toBeNull()

    // Collapse again — hosts gone from the flat array.
    await userEvent.click(screen.getByRole('button', { name: 'ClusterA' }))
    expect(screen.queryByText('esx-a1')).toBeNull()
  })

  it("a collapsed host's VMs are absent until the host is expanded", async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'ClusterA' }))
    expect(screen.queryByText('vm-a-1')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'esx-a1' }))
    expect(screen.getByText('vm-a-1')).not.toBeNull()
    expect(screen.getByText('vm-a-2')).not.toBeNull()
  })

  it('chevron toggles aria-expanded', async () => {
    render(<Harness />)
    const chevA = screen.getByRole('button', { name: 'ClusterA' })
    expect(chevA.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(chevA)
    expect(screen.getByRole('button', { name: 'ClusterA' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('count badge renders 0 (never an em-dash) for an empty node', async () => {
    render(<Harness />)
    // Expand ClusterB → its host esx-b1 has zero VMs → badge shows "0".
    await userEvent.click(screen.getByRole('button', { name: 'ClusterB' }))
    expect(screen.getByText('esx-b1')).not.toBeNull()
    // The empty host is not expandable (no chevron button for it) and its
    // count badge is the literal "0", never "—".
    expect(screen.getByText('0')).not.toBeNull()
    expect(screen.queryByText('—')).toBeNull()
  })

  it('selecting a node reports a scope; root selection = unscoped', async () => {
    const onSelect = vi.fn<(id: string, sel: TreeSelection) => void>()
    render(
      <InventoryTree
        rootLabel="vcenter.test.local"
        clustersOrdered={CLUSTERS}
        hostsByCluster={hostsByCluster}
        vmsByHost={vmsByHost}
        selectedId={null}
        onSelect={onSelect}
      />,
    )
    await userEvent.click(screen.getByText('vcenter.test.local'))
    expect(onSelect).toHaveBeenLastCalledWith('root', { kind: 'root' })

    await userEvent.click(screen.getByText('ClusterA'))
    expect(onSelect).toHaveBeenLastCalledWith('cl:ClusterA', {
      kind: 'cluster',
      cluster: 'ClusterA',
    })
  })
})
