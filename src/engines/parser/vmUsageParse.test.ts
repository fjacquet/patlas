import { describe, expect, it } from 'vitest'
import { parseSnapshot } from './normalizeColumns'
import type { ParsedSheet, ParsedWorkbook } from './parseXlsx'

/** Build a ParsedSheet (rows keyed by header) — mirrors rvtools.test.ts. */
const mkSheet = (name: string, headers: string[], rows: unknown[][]): ParsedSheet => ({
  name,
  headers,
  rows: rows.map((r) => {
    const o: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      o[h] = r[i] ?? null
    })
    return o
  }),
})
const workbook = (...sheets: ParsedSheet[]): ParsedWorkbook => ({
  sheets: new Map(sheets.map((s) => [s.name, s])),
})

describe('parseSnapshot vmUsage', () => {
  it('emits a vmUsage row joining vMemory + vCPU by identity', () => {
    const wb = workbook(
      mkSheet(
        'vInfo',
        ['VM', 'Powerstate', 'Cluster', 'Host', '# CPUs', 'Memory', 'VM Instance UUID'],
        [['web01', 'poweredOn', 'C1', 'h1', 4, 8192, 'i1']],
      ),
      mkSheet(
        'vHost',
        ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'],
        [['h1', 'C1', 2, 16, 2200, 262144]],
      ),
      mkSheet(
        'vMemory',
        ['VM', 'Cluster', 'VM Instance UUID', 'Active', 'Consumed', 'Ballooned', 'Swapped'],
        [['web01', 'C1', 'i1', 1024, 2048, 0, 0]],
      ),
      mkSheet(
        'vCPU',
        ['VM', 'Cluster', 'VM Instance UUID', 'Overall Cpu Usage'],
        [['web01', 'C1', 'i1', 300]],
      ),
    )
    const { snapshot } = parseSnapshot(wb)
    expect(snapshot.vmUsage).toHaveLength(1)
    expect(snapshot.vmUsage[0]?.activeMib).toBe(1024)
    expect(snapshot.vmUsage[0]?.cpuUsageMhz).toBe(300)
  })

  it('emits an empty vmUsage when both sheets are absent', () => {
    const wb = workbook(
      mkSheet(
        'vInfo',
        ['VM', 'Powerstate', 'Cluster', 'Host', '# CPUs', 'Memory'],
        [['web01', 'poweredOn', 'C1', 'h1', 4, 8192]],
      ),
      mkSheet(
        'vHost',
        ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'],
        [['h1', 'C1', 2, 16, 2200, 262144]],
      ),
    )
    const { snapshot } = parseSnapshot(wb)
    expect(snapshot.vmUsage).toEqual([])
  })
})
