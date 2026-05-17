import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_VIEW } from '@/engines/aggregation'
import { cores, ghz, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import type {
  DrScenario,
  DrSimResult,
  EstateView,
  EsxAggregate,
  GlobalSummary,
} from '@/types/estate'
import { DrSimPanel } from './DrSimPanel'

const host = (over: Partial<EsxAggregate>): EsxAggregate => ({
  hostName: 'esx-1',
  cluster: 'C1',
  sockets: sockets(2),
  cores: cores(12),
  speedMhz: mhz(2600),
  physicalGhz: ghz(31.2),
  memoryMib: mib(262_144),
  vmCount: 8,
  vcpuAllocated: cores(0),
  vramAllocatedMib: mib(0),
  cpuRatio: 4,
  ramRatio: 1,
  meanCpuReadinessPercent: null,
  maxCpuReadinessPercent: null,
  vmsAboveReadinessWarning: 0,
  readinessAvailable: false,
  faultDomain: '',
  model: '',
  vendor: '',
  esxVersion: '',
  poweredOnVms: 8,
  ...over,
})

const summary = (over: Partial<GlobalSummary> = {}): GlobalSummary => ({
  ...EMPTY_VIEW.globals,
  clusterCount: 2,
  hostCount: 4,
  vmCount: 40,
  ...over,
})

const result = (over: Partial<DrSimResult> = {}): DrSimResult => ({
  mode: 'server',
  before: summary(),
  after: summary({ hostCount: 3 }),
  physicalCpuRemovedGhz: ghz(31.2),
  physicalCpuRemovedCores: cores(12),
  physicalRamRemovedMib: mib(262_144),
  perSurvivor: [{ cluster: 'C1', verdict: 'absorbs' }],
  caveats: [],
  ...over,
})

const view = (over: Partial<EstateView> = {}): EstateView => ({
  ...EMPTY_VIEW,
  hosts: [
    host({ hostName: 'esx-1', cluster: 'C1', faultDomain: 'Site A' }),
    host({ hostName: 'esx-2', cluster: 'C1', faultDomain: 'Site B' }),
    host({ hostName: 'esx-3', cluster: 'C2', faultDomain: 'Site A' }),
  ],
  ...over,
})

const EMPTY_SCN: DrScenario = { failedHosts: new Set(), failedSites: new Set() }

describe('DrSimPanel (DRX — two-mode physical-impact presenter)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders exactly two mode segments (server/site), no third', () => {
    render(
      <DrSimPanel
        view={view()}
        drMode="server"
        onDrMode={() => {}}
        scenario={EMPTY_SCN}
        onScenario={() => {}}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    const modeGroup = screen.getByRole('group', { name: 'Loss scenario' })
    const buttons = modeGroup.querySelectorAll('button')
    expect(buttons).toHaveLength(2)
    expect(screen.getByText('Server loss')).not.toBeNull()
    expect(screen.getByText('Site loss')).not.toBeNull()
    expect(screen.queryByText(/cluster loss/i)).toBeNull()
    expect(screen.queryByText(/vcenter loss/i)).toBeNull()
  })

  it('shows physical impact labels (not vCPU) and no confidence', () => {
    render(
      <DrSimPanel
        view={view({ drSim: result() })}
        drMode="server"
        onDrMode={() => {}}
        scenario={{ failedHosts: new Set(['esx-1']), failedSites: new Set() }}
        onScenario={() => {}}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.getByText('Physical CPU removed')).not.toBeNull()
    expect(screen.getByText('Physical RAM removed')).not.toBeNull()
    expect(screen.queryByText(/vCPU/i)).toBeNull()
    expect(screen.queryByText(/confidence/i)).toBeNull()
    expect(screen.queryByText(/^(high|medium|low)$/i)).toBeNull()
  })

  it('reversible failed chip appears on host check and disappears on uncheck', async () => {
    const onScenario = vi.fn<(s: DrScenario) => void>()
    const { rerender } = render(
      <DrSimPanel
        view={view()}
        drMode="server"
        onDrMode={() => {}}
        scenario={EMPTY_SCN}
        onScenario={onScenario}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.queryByText('simulated failed')).toBeNull()
    await userEvent.click(screen.getByLabelText('esx-1'))
    expect(onScenario).toHaveBeenCalled()
    rerender(
      <DrSimPanel
        view={view()}
        drMode="server"
        onDrMode={() => {}}
        scenario={{ failedHosts: new Set(['esx-1']), failedSites: new Set() }}
        onScenario={onScenario}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.getAllByText('simulated failed').length).toBeGreaterThan(0)
  })

  it('Apply-planned checkbox switches the presented result drSim → plannedDrSim', () => {
    const measured = result({ physicalCpuRemovedGhz: ghz(10) })
    const planned = result({ physicalCpuRemovedGhz: ghz(99) })
    const v = view({ drSim: measured, plannedDrSim: planned })
    const { rerender } = render(
      <DrSimPanel
        view={v}
        drMode="server"
        onDrMode={() => {}}
        scenario={{ failedHosts: new Set(['esx-1']), failedSites: new Set() }}
        onScenario={() => {}}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.getByText(/10\s*GHz/)).not.toBeNull()
    rerender(
      <DrSimPanel
        view={v}
        drMode="server"
        onDrMode={() => {}}
        scenario={{ failedHosts: new Set(['esx-1']), failedSites: new Set() }}
        onScenario={() => {}}
        declaredStretched={new Set()}
        applyPlannedToDr={true}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.getByText(/99\s*GHz/)).not.toBeNull()
  })

  it('Site segment shows the no-stretched note when no clusters are declared stretched', () => {
    render(
      <DrSimPanel
        view={view()}
        drMode="site"
        onDrMode={() => {}}
        scenario={EMPTY_SCN}
        onScenario={() => {}}
        declaredStretched={new Set()}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(
      screen.getByText(
        'Site loss needs at least one cluster you have declared stretched. None are declared in this snapshot.',
      ),
    ).not.toBeNull()
  })

  it('Site picker over declared-stretched fault domains + the factual lost line', async () => {
    const onScenario = vi.fn<(s: DrScenario) => void>()
    const { rerender } = render(
      <DrSimPanel
        view={view()}
        drMode="site"
        onDrMode={() => {}}
        scenario={EMPTY_SCN}
        onScenario={onScenario}
        declaredStretched={new Set(['C1'])}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    // C1 hosts span Site A + Site B; the picker offers both.
    expect(screen.getByLabelText('Site A')).not.toBeNull()
    expect(screen.getByLabelText('Site B')).not.toBeNull()
    await userEvent.click(screen.getByLabelText('Site A'))
    expect(onScenario).toHaveBeenCalled()
    // With Site A picked, C2 (non-stretched) host esx-3 is physically at
    // Site A with no DR target → the explicit factual lost line.
    rerender(
      <DrSimPanel
        view={view({ drSim: result() })}
        drMode="site"
        onDrMode={() => {}}
        scenario={{ failedHosts: new Set(), failedSites: new Set(['Site A']) }}
        onScenario={onScenario}
        declaredStretched={new Set(['C1'])}
        applyPlannedToDr={false}
        onApplyPlannedToDr={() => {}}
      />,
    )
    expect(screen.getByText(/no stretched DR target — lost:/)).not.toBeNull()
  })
})
