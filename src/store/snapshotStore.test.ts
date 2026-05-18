import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Snapshot } from '@/types/snapshot'
import {
  DEFAULT_THRESHOLDS,
  selectActiveSnapshot,
  selectHasSnapshots,
  selectSetThresholds,
  selectThresholds,
  useSnapshotStore,
} from './snapshotStore'

// Minimal Snapshot factory — the store does not inspect row contents, only
// identity + the two fields the mutators touch (vCenterLabel, capturedAt).
const makeSnapshot = (id: string, overrides: Partial<Snapshot> = {}): Snapshot =>
  ({
    id,
    filename: `${id}.xlsx`,
    fileSize: 0,
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    vCenterLabel: `vc-${id}`,
    rvtoolsVersion: '4.4.0',
    parsedAt: new Date('2026-05-15T00:00:00Z'),
    source: 'rvtools',
    viSdkUuid: null,
    vinfo: [],
    vhost: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    parseErrors: [],
    ...overrides,
  }) as unknown as Snapshot

describe('snapshotStore', () => {
  beforeEach(() => {
    useSnapshotStore.getState().clearAll()
  })

  it('starts empty', () => {
    const s = useSnapshotStore.getState()
    expect(s.snapshots.size).toBe(0)
    expect(s.activeSnapshotId).toBeNull()
  })

  it('addSnapshot sets activeId on first add and replaces the Map identity', () => {
    const before = useSnapshotStore.getState().snapshots
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const after = useSnapshotStore.getState()
    expect(after.snapshots).not.toBe(before)
    expect(after.snapshots.size).toBe(1)
    expect(after.activeSnapshotId).toBe('a')
  })

  it('addSnapshot preserves activeId on subsequent adds', () => {
    const store = useSnapshotStore.getState()
    store.addSnapshot(makeSnapshot('a'))
    store.addSnapshot(makeSnapshot('b'))
    const s = useSnapshotStore.getState()
    expect(s.snapshots.size).toBe(2)
    expect(s.activeSnapshotId).toBe('a')
  })

  it('removeSnapshot is a no-op on a missing id (Map identity unchanged)', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const before = useSnapshotStore.getState().snapshots
    useSnapshotStore.getState().removeSnapshot('nope')
    const after = useSnapshotStore.getState().snapshots
    expect(after).toBe(before)
    expect(after.size).toBe(1)
  })

  it('removeSnapshot rotates activeId to the first remaining key when removing the active one', () => {
    const store = useSnapshotStore.getState()
    store.addSnapshot(makeSnapshot('a'))
    store.addSnapshot(makeSnapshot('b'))
    expect(useSnapshotStore.getState().activeSnapshotId).toBe('a')
    useSnapshotStore.getState().removeSnapshot('a')
    const s = useSnapshotStore.getState()
    expect(s.snapshots.has('a')).toBe(false)
    expect(s.activeSnapshotId).toBe('b')
  })

  it('removeSnapshot sets activeId to null when removing the last snapshot', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('only'))
    useSnapshotStore.getState().removeSnapshot('only')
    const s = useSnapshotStore.getState()
    expect(s.snapshots.size).toBe(0)
    expect(s.activeSnapshotId).toBeNull()
  })

  it('removeSnapshot keeps activeId when removing a non-active snapshot', () => {
    const store = useSnapshotStore.getState()
    store.addSnapshot(makeSnapshot('a'))
    store.addSnapshot(makeSnapshot('b'))
    useSnapshotStore.getState().removeSnapshot('b')
    expect(useSnapshotStore.getState().activeSnapshotId).toBe('a')
  })

  it('setActiveSnapshot sets the id with no membership validation', () => {
    useSnapshotStore.getState().setActiveSnapshot('ghost')
    expect(useSnapshotStore.getState().activeSnapshotId).toBe('ghost')
    useSnapshotStore.getState().setActiveSnapshot(null)
    expect(useSnapshotStore.getState().activeSnapshotId).toBeNull()
  })

  it('renameVCenter produces a new Snapshot object and a new Map identity', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const beforeMap = useSnapshotStore.getState().snapshots
    const beforeSnap = beforeMap.get('a')
    useSnapshotStore.getState().renameVCenter('a', 'renamed')
    const afterMap = useSnapshotStore.getState().snapshots
    const afterSnap = afterMap.get('a')
    expect(afterMap).not.toBe(beforeMap)
    expect(afterSnap).not.toBe(beforeSnap)
    expect(afterSnap?.vCenterLabel).toBe('renamed')
  })

  it('renameVCenter is a no-op when the id is absent', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const before = useSnapshotStore.getState().snapshots
    useSnapshotStore.getState().renameVCenter('nope', 'x')
    expect(useSnapshotStore.getState().snapshots).toBe(before)
  })

  it('setCapturedAt produces a new Snapshot object and a new Map identity', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const beforeMap = useSnapshotStore.getState().snapshots
    const beforeSnap = beforeMap.get('a')
    const newDate = new Date('2027-12-25T00:00:00Z')
    useSnapshotStore.getState().setCapturedAt('a', newDate)
    const afterMap = useSnapshotStore.getState().snapshots
    const afterSnap = afterMap.get('a')
    expect(afterMap).not.toBe(beforeMap)
    expect(afterSnap).not.toBe(beforeSnap)
    expect(afterSnap?.capturedAt).toBe(newDate)
  })

  it('setCapturedAt is a no-op when the id is absent', () => {
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    const before = useSnapshotStore.getState().snapshots
    useSnapshotStore.getState().setCapturedAt('nope', new Date())
    expect(useSnapshotStore.getState().snapshots).toBe(before)
  })

  it('clearAll resets both fields', () => {
    const store = useSnapshotStore.getState()
    store.addSnapshot(makeSnapshot('a'))
    store.addSnapshot(makeSnapshot('b'))
    useSnapshotStore.getState().clearAll()
    const s = useSnapshotStore.getState()
    expect(s.snapshots.size).toBe(0)
    expect(s.activeSnapshotId).toBeNull()
  })

  it('selectHasSnapshots reflects map size', () => {
    expect(selectHasSnapshots(useSnapshotStore.getState())).toBe(false)
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    expect(selectHasSnapshots(useSnapshotStore.getState())).toBe(true)
  })

  it('selectActiveSnapshot returns the active snapshot or null', () => {
    expect(selectActiveSnapshot(useSnapshotStore.getState())).toBeNull()
    useSnapshotStore.getState().addSnapshot(makeSnapshot('a'))
    expect(selectActiveSnapshot(useSnapshotStore.getState())?.id).toBe('a')
    useSnapshotStore.getState().setActiveSnapshot('ghost')
    expect(selectActiveSnapshot(useSnapshotStore.getState())).toBeNull()
  })

  it('P9 thresholds: defaults to the RVTools-Analyser-class values (D-03)', () => {
    expect(selectThresholds(useSnapshotStore.getState())).toEqual(DEFAULT_THRESHOLDS)
    expect(DEFAULT_THRESHOLDS).toEqual({ fsUsedPct: 90, dsUsedPct: 85, luUsedPct: 85 })
  })

  it('P9 thresholds: setThresholds REPLACES with a fresh object (Object.is fires)', () => {
    const before = selectThresholds(useSnapshotStore.getState())
    selectSetThresholds(useSnapshotStore.getState())({
      fsUsedPct: 80,
      dsUsedPct: 75,
      luUsedPct: 70,
    })
    const after = selectThresholds(useSnapshotStore.getState())
    expect(after).toEqual({ fsUsedPct: 80, dsUsedPct: 75, luUsedPct: 70 })
    expect(after).not.toBe(before)
  })

  it('P9 thresholds: clearAll restores the defaults (refresh == defaults)', () => {
    selectSetThresholds(useSnapshotStore.getState())({
      fsUsedPct: 50,
      dsUsedPct: 50,
      luUsedPct: 50,
    })
    useSnapshotStore.getState().clearAll()
    expect(selectThresholds(useSnapshotStore.getState())).toEqual(DEFAULT_THRESHOLDS)
  })

  it('PAR-05: store module does not import persistence middleware', () => {
    // import.meta.url is not a `file:` URL under Vite/Vitest — resolve from cwd.
    const moduleSource = readFileSync(resolve(process.cwd(), 'src/store/snapshotStore.ts'), 'utf-8')
    expect(moduleSource).not.toMatch(/zustand\/middleware\/persist/)
    expect(moduleSource).not.toMatch(/localStorage\.setItem/)
    expect(moduleSource).not.toMatch(/sessionStorage/)
    expect(moduleSource).not.toMatch(/indexedDB|IndexedDB/)
    expect(moduleSource).not.toMatch(/OPFS|navigator\.storage/)
  })
})
