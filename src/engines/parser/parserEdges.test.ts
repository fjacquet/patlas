import { describe, expect, it } from 'vitest'
import { readNumber, readString, toRatio } from './adapters/columnMap'
import { parseSnapshot } from './normalizeColumns'
import type { ParsedWorkbook } from './parseXlsx'
import { isOrphanCluster, synthesizeOrphanClusters } from './synthesizeOrphanClusters'

describe('columnMap coercion branches', () => {
  it('readNumber handles booleans, non-finite, and locale strings', () => {
    expect(readNumber(true)).toBe(1)
    expect(readNumber(false)).toBe(0)
    expect(readNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(readNumber('not-a-number')).toBe(0)
    expect(readNumber({})).toBe(0)
    expect(readNumber("1'234,5")).toBe(1234.5)
  })

  it('readString trims and null-collapses', () => {
    expect(readString(null)).toBe('')
    expect(readString('  x  ')).toBe('x')
    expect(readString(42)).toBe('42')
  })

  it('toRatio passes ratios through and divides percentages', () => {
    expect(toRatio(0.42)).toBe(0.42)
    expect(toRatio(42)).toBe(0.42)
  })
})

describe('synthesizeOrphanClusters edge branches', () => {
  it('isOrphanCluster matches only the prefixed names', () => {
    expect(isOrphanCluster('(no cluster) host-1')).toBe(true)
    expect(isOrphanCluster('cluster-prod')).toBe(false)
  })

  it('is a no-op (same refs) when every host already has a cluster', () => {
    const input = {
      vinfo: [],
      vhost: [
        {
          hostName: 'h',
          cluster: 'c',
          sockets: 1 as never,
          cores: 1 as never,
          speedMhz: 1 as never,
          memoryMib: 1 as never,
          cpuRatio: 0,
          ramRatio: 0,
          faultDomain: '',
          model: '',
          vendor: '',
          esxVersion: '',
        },
      ],
    }
    const out = synthesizeOrphanClusters(input)
    expect(out.vinfo).toBe(input.vinfo)
  })

  it('leaves a clusterless host with no name untouched', () => {
    const out = synthesizeOrphanClusters({
      vinfo: [],
      vhost: [
        {
          hostName: '',
          cluster: '',
          sockets: 1 as never,
          cores: 1 as never,
          speedMhz: 1 as never,
          memoryMib: 1 as never,
          cpuRatio: 0,
          ramRatio: 0,
          faultDomain: '',
          model: '',
          vendor: '',
          esxVersion: '',
        },
      ],
    })
    expect(out.vhost[0]?.cluster).toBe('')
  })
})

describe('parseSnapshot — viSdkUuid null path & empty sheet', () => {
  const HDR = [
    'VM',
    'Powerstate',
    'Cluster',
    'Host',
    '# CPUs',
    'Memory',
    'Provisioned MB',
    'In Use MB',
  ]

  it('returns viSdkUuid null when no VM carries one and tolerates an empty sheet', () => {
    const wb: ParsedWorkbook = {
      sheets: new Map([
        [
          'vInfo',
          {
            name: 'vInfo',
            headers: HDR,
            rows: [
              {
                VM: 'vm-1',
                Powerstate: 'poweredOn',
                Cluster: 'c',
                Host: 'h',
                '# CPUs': 2,
                Memory: 1024,
                'Provisioned MB': 2048,
                'In Use MB': 1024,
              },
            ],
          },
        ],
        [
          'vHost',
          {
            name: 'vHost',
            headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', '# Memory'],
            rows: [
              { Host: 'h', Cluster: 'c', '# CPU': 2, '# Cores': 8, Speed: 2400, '# Memory': 32768 },
            ],
          },
        ],
        ['Empty', { name: 'Empty', headers: [], rows: [] }],
      ]),
    }
    const { snapshot } = parseSnapshot(wb)
    expect(snapshot.viSdkUuid).toBeNull()
    expect(snapshot.vinfo).toHaveLength(1)
  })
})
