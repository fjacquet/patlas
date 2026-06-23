import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cores, mhz, mib, sockets } from '@/engines/units'
import i18n from '@/i18n'
import type { EsxAggregate } from '@/types/estate'
import { EsxDetail, type EsxDetailData } from './EsxDetail'

const host = (): EsxAggregate =>
  ({
    hostName: 'esx-1',
    cluster: 'CL_1',
    sockets: sockets(2),
    cores: cores(24),
    speedMhz: mhz(2600),
    physicalGhz: 62.4,
    memoryMib: mib(262_144),
    vmCount: 10,
    vcpuAllocated: cores(40),
    vramAllocatedMib: mib(100_000),
    cpuRatio: 0.3,
    ramRatio: 0.5,
    meanCpuReadinessPercent: null,
    maxCpuReadinessPercent: null,
    vmsAboveReadinessWarning: 0,
    readinessAvailable: false,
    faultDomain: '',
    model: 'PowerEdge',
    vendor: 'Dell',
    esxVersion: '8.0.0',
    poweredOnVms: 8,
  }) as unknown as EsxAggregate

const data = (over: Partial<EsxDetailData> = {}): EsxDetailData => ({
  host: host(),
  vswitches: [
    {
      host: 'esx-1',
      cluster: 'CL_1',
      switch: 'vSwitch0',
      ports: 128,
      freePorts: 96,
      mtu: 1500,
      vmCount: 8,
    },
  ],
  dvswitches: [],
  ...over,
})

describe('EsxDetail (LC-4, augments Hosts)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders the host title, switches, and the factual datastore em-dash + note', () => {
    render(<EsxDetail detail={data()} onBack={() => {}} />)
    expect(screen.getByText(/esx-1/)).not.toBeNull()
    expect(screen.getByText('vSwitch0')).not.toBeNull()
    expect(screen.getByText(/Per-node storage names are not available/)).not.toBeNull() // datastoresNote
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('fires onBack', async () => {
    const onBack = vi.fn()
    render(<EsxDetail detail={data()} onBack={onBack} />)
    await userEvent.click(screen.getByText(/Back/))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
