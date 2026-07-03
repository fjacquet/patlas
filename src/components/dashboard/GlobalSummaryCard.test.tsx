import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AvgVmSize } from '@/engines/aggregation/avgVmSize'
import i18n from '@/i18n'
import type { GlobalSummary } from '@/types/estate'
import { GlobalSummaryCard } from './GlobalSummaryCard'

const globals: GlobalSummary = {
  clusterCount: 2,
  hostCount: 6,
  vmCount: 120,
  physicalCores: 96 as GlobalSummary['physicalCores'],
  usablePhysicalCores: 90 as GlobalSummary['usablePhysicalCores'],
  vcpuPerPcpu: 3,
  physicalGhz: 230 as GlobalSummary['physicalGhz'],
  consumedGhz: 40 as GlobalSummary['consumedGhz'],
  availableGhz: 190 as GlobalSummary['availableGhz'],
  physicalRamMib: 1_048_576 as GlobalSummary['physicalRamMib'],
  consumedRamMib: 262_144 as GlobalSummary['consumedRamMib'],
  availableRamMib: 786_432 as GlobalSummary['availableRamMib'],
  meanCpuRatio: 0.3,
  meanRamRatio: 0.25,
  vcpuAllocated: 300 as GlobalSummary['vcpuAllocated'],
  vramAllocatedMib: 524_288 as GlobalSummary['vramAllocatedMib'],
  mhzPerVcpu: 800,
  vmsAboveReadinessWarning: 3,
  datastoreCount: 4,
  totalStorageMib: 2_097_152 as GlobalSummary['totalStorageMib'],
}

const avgVmSize = {
  vmCount: 120,
  vcpu: { mean: 6.4, median: 4 },
  vramMib: { mean: 12_288, median: 8_192 },
  provisionedMib: { mean: 61_440, median: 40_960 },
} as unknown as AvgVmSize

describe('GlobalSummaryCard — avg VM size tiles (Task 3)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('keeps the summary section aria-label contract', () => {
    render(
      <GlobalSummaryCard
        globals={globals}
        mode="active"
        capturedDate="Jun 1, 2026"
        avgVmSize={avgVmSize}
      />,
    )
    expect(screen.getByLabelText('Estate summary')).not.toBeNull()
  })

  it('renders avg vCPU with a fractional mean and median sub-caption', () => {
    render(
      <GlobalSummaryCard
        globals={globals}
        mode="active"
        capturedDate="Jun 1, 2026"
        avgVmSize={avgVmSize}
      />,
    )
    const label = screen.getByText('Avg vCPU')
    const value = label.nextElementSibling
    expect(value?.textContent).toBe('6.4')
    expect(screen.getByText('median 4.0')).not.toBeNull()
  })

  it('renders avg RAM in GiB with the median sub-caption', () => {
    render(
      <GlobalSummaryCard
        globals={globals}
        mode="active"
        capturedDate="Jun 1, 2026"
        avgVmSize={avgVmSize}
      />,
    )
    const label = screen.getByText('Avg RAM')
    const value = label.nextElementSibling
    expect(value?.textContent).toBe('12.0 GiB')
    expect(screen.getByText('median 8.0 GiB')).not.toBeNull()
  })

  it('renders avg disk in GiB with the median sub-caption', () => {
    render(
      <GlobalSummaryCard
        globals={globals}
        mode="active"
        capturedDate="Jun 1, 2026"
        avgVmSize={avgVmSize}
      />,
    )
    const label = screen.getByText('Avg disk')
    const value = label.nextElementSibling
    expect(value?.textContent).toBe('60.0 GiB')
    expect(screen.getByText('median 40.0 GiB')).not.toBeNull()
  })
})
