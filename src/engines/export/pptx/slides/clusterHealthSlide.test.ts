import PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import type { ClusterHealth } from '@/engines/aggregation/clusterHealth'
import { addClusterHealthSlide } from './clusterHealthSlide'

const strings = {} as Record<string, string> // fallbacks exercised

const health: ClusterHealth = {
  ha: {
    resources: [
      {
        sid: 'vm:100',
        type: 'vm',
        state: 'started',
        group: '',
        failback: 'no',
        maxRestart: 1,
        maxRelocate: 1,
        comment: '',
      },
    ],
    managedCount: 1,
    quorumStatus: 'OK',
    fencingStatus: 'OK',
    services: [
      {
        id: 'quorum',
        type: 'quorum',
        status: 'OK',
        node: 'pve1',
        sid: '',
        state: 'active',
        crmState: '',
        requestState: '',
        quorate: 'X',
      },
    ],
  },
  backups: {
    jobs: [
      {
        id: 'backup-job-1',
        enabled: true,
        all: true,
        vmId: '',
        mode: 'snapshot',
        storage: 'DATA',
        startTime: '02:00',
        schedule: 'daily',
        dayOfWeek: '',
        compress: 'zstd',
        type: 'vzdump',
        node: 'pve1',
      },
    ],
    jobCount: 1,
    enabledCount: 1,
    guestsCovered: 1,
  },
}

describe('addClusterHealthSlide', () => {
  it('adds exactly one slide to the deck', () => {
    const pptx = new PptxGenJS()
    addClusterHealthSlide(pptx, health, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide when quorumStatus and fencingStatus are null', () => {
    const pptx = new PptxGenJS()
    const noStatus: ClusterHealth = {
      ...health,
      ha: { ...health.ha, quorumStatus: null, fencingStatus: null },
    }
    addClusterHealthSlide(pptx, noStatus, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide for a French locale', () => {
    const pptx = new PptxGenJS()
    addClusterHealthSlide(pptx, health, strings, 'fr')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })

  it('adds exactly one slide for empty HA services and backup jobs', () => {
    const pptx = new PptxGenJS()
    const empty: ClusterHealth = {
      ha: {
        resources: [],
        managedCount: 0,
        quorumStatus: null,
        fencingStatus: null,
        services: [],
      },
      backups: {
        jobs: [],
        jobCount: 0,
        enabledCount: 0,
        guestsCovered: 0,
      },
    }
    addClusterHealthSlide(pptx, empty, strings, 'en')
    expect((pptx as unknown as { slides: unknown[] }).slides.length).toBe(1)
  })
})
