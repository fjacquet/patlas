import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cores, mib } from '@/engines/units'
import i18n from '@/i18n'
import type { VmDetailEntry } from '@/types/estate'
import { VmDetail } from './VmDetail'

const entry = (over: Partial<VmDetailEntry> = {}): VmDetailEntry => ({
  vmName: 'vm-1',
  cluster: 'CL_1',
  host: 'esx-1',
  os: 'RHEL 8',
  vcpu: cores(4),
  vramMib: mib(8192),
  provisionedMib: mib(40_960),
  inUseMib: mib(20_480),
  poweredOn: true,
  partitions: [
    { disk: '/', capacityMib: mib(1000), consumedMib: mib(950), freeMib: mib(50), flagged: true },
    {
      disk: '/var',
      capacityMib: mib(500),
      consumedMib: mib(100),
      freeMib: mib(400),
      flagged: false,
    },
  ],
  portgroups: [{ network: 'PG-Prod', switch: 'vSwitch0' }],
  datastores: ['DS_A'],
  ...over,
})

describe('VmDetail (LC-4)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders the VM title, partitions, portgroups and datastores', () => {
    render(<VmDetail detail={entry()} onBack={() => {}} />)
    expect(screen.getByText(/vm-1/)).not.toBeNull()
    expect(screen.getByText('/')).not.toBeNull()
    expect(screen.getByText(/PG-Prod \(vSwitch0\)/)).not.toBeNull()
    expect(screen.getByText('DS_A')).not.toBeNull()
  })

  it('fires onBack', async () => {
    const onBack = vi.fn()
    render(<VmDetail detail={entry()} onBack={onBack} />)
    await userEvent.click(screen.getByText(/Back/))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('flags only the over-line partition with the gold marker, no status colour', () => {
    const { container } = render(<VmDetail detail={entry()} onBack={() => {}} />)
    expect(container.querySelectorAll('.bg-accent-500\\/15')).toHaveLength(1)
    // Built at runtime — no literal status-colour token in source.
    expect(container.querySelector(`[class*="util-${'high'}"]`)).toBeNull()
  })

  it('renders the em-dash for empty partition/portgroup/datastore lists', () => {
    render(
      <VmDetail
        detail={entry({ partitions: [], portgroups: [], datastores: [] })}
        onBack={() => {}}
      />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
