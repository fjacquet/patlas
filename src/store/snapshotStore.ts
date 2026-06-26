import { create } from 'zustand'
import { DEFAULT_MONSTER_THRESHOLDS, type MonsterThresholds } from '@/engines/aggregation/monsterVm'
import { DEFAULT_SIZING_THRESHOLDS, type SizingThresholds } from '@/engines/aggregation/sizing'
import { DEFAULT_THRESHOLDS, type ThresholdInput } from '@/engines/aggregation/thresholdFlags'
import type { ReleasedTrendAggregate, Snapshot } from '@/types/snapshot'

/** Store-public alias of the pure-engine threshold shape (single source of
 *  truth lives in `engines/aggregation/thresholdFlags`). Re-exported so
 *  existing store consumers keep importing it from here. */
export type ThresholdConfig = ThresholdInput
export type { MonsterThresholds, SizingThresholds }
export { DEFAULT_MONSTER_THRESHOLDS, DEFAULT_SIZING_THRESHOLDS, DEFAULT_THRESHOLDS }

/**
 * Multi-snapshot, inputs-only Zustand store.
 *
 * DELIBERATE DEVIATION from vsizer's `datasetStore` (ARCHITECTURE.md §5): this
 * store holds INPUTS ONLY — a `Map<snapshotId, Snapshot>` (append-only from the
 * UI's perspective) plus the active selection. It caches NO aggregates; every
 * derived value (totals, ratios, treemaps) is computed downstream in Phase 2's
 * `useEstateView` with `useMemo`. vatlas mutates along more axes than vsizer
 * (multi-snapshot, rename, recapture), so cached aggregates would multiply
 * invalidation surface — the KISS choice is to derive, not store.
 *
 * PAR-05: this module performs no browser-storage writes of any kind (no web
 * storage, no client database, no origin-private filesystem) and uses no
 * Zustand persistence middleware. Refresh == data gone, by construction
 * (module-scope `new Map()` re-runs on every load).
 *
 * Zustand uses `Object.is` for change detection, so the `Map` reference is
 * REPLACED (`new Map(state.snapshots)`) on every content-affecting mutation —
 * never mutated in place — or subscribers would not re-render.
 */
interface SnapshotState {
  snapshots: Map<string, Snapshot>
  activeSnapshotId: string | null
  /**
   * The estate selection consumed by the multi-FILE merge (Phase 4 MVC-01).
   * Default = ALL snapshot ids: multi-file merge is the PRIMARY path; a
   * single snapshot is the degenerate case that still works. Inputs-only,
   * REPLACED never mutated (Zustand `Object.is`); no persist, no localStorage
   * (PROJECT.md line 53).
   */
  selectedSnapshotIds: Set<string>
  /**
   * P6 capacity-planning "Personal Ratios" — the user's PLANNED CPU/RAM
   * overcommit for the explicitly-"planned" what-if lens (PLN-03/D-05).
   * Defaults CPU 4:1 / RAM 1:1 (the carried ALC-02 intent). Inputs-only,
   * REPLACED never mutated (Zustand `Object.is`); no persist, no
   * localStorage, no URL-hash codec (PROJECT.md line 53 / D-06 / T-06-01).
   */
  plannedRatios: { cpu: number; ram: number }
  /**
   * P9 threshold-alerting config (D-01/D-02). In-memory inputs-only,
   * REPLACED never mutated (Zustand `Object.is`); NO new localStorage key,
   * no URL-hash — `clearAll` restores defaults so refresh == defaults
   * restored (PAR-05 / D-02).
   */
  thresholds: ThresholdConfig
  /**
   * P-RS right-sizing thresholds (user-editable ratios). In-memory inputs-only,
   * REPLACED never mutated; NO new localStorage key, no URL-hash — `clearAll`
   * restores defaults so refresh == defaults restored (PAR-05).
   */
  sizingThresholds: SizingThresholds
  /** P-RS monster-VM thresholds (vCPU/vRAM lines). In-memory inputs-only,
   *  REPLACED never mutated; no persist — `clearAll` restores defaults. */
  monsterThresholds: MonsterThresholds
  addSnapshot: (s: Snapshot) => void
  removeSnapshot: (id: string) => void
  setActiveSnapshot: (id: string | null) => void
  setSelectedSnapshotIds: (ids: Set<string>) => void
  setPlannedRatios: (r: { cpu: number; ram: number }) => void
  setThresholds: (t: ThresholdConfig) => void
  setSizingThresholds: (t: SizingThresholds) => void
  setMonsterThresholds: (t: MonsterThresholds) => void
  renameVCenter: (id: string, label: string) => void
  setCapturedAt: (id: string, date: Date) => void
  /**
   * DD-C (Critical-5): drop a snapshot's raw row arrays for GC when > 4
   * snapshots are loaded, carrying its already-computed `releasedAggregate`
   * so its trend point survives. Inputs-only, REPLACE-never-mutate;
   * in-memory only, no spill to any browser storage (the surviving
   * aggregate is the only remaining input fact for that point — A3
   * resolved reading). Never called for the active/latest snapshot.
   */
  releaseRawRows: (id: string, releasedAggregate: ReleasedTrendAggregate) => void
  clearAll: () => void
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: new Map(),
  activeSnapshotId: null,
  selectedSnapshotIds: new Set(),
  plannedRatios: { cpu: 4, ram: 1 },
  thresholds: { ...DEFAULT_THRESHOLDS },
  sizingThresholds: { ...DEFAULT_SIZING_THRESHOLDS },
  monsterThresholds: { ...DEFAULT_MONSTER_THRESHOLDS },

  addSnapshot: (s) =>
    set((state) => {
      const next = new Map(state.snapshots)
      next.set(s.id, s)
      // Default selection follows the loaded set: a newly dropped file joins
      // the merged estate automatically (multi-FILE merge is the primary
      // path). Set is REPLACED, never mutated.
      const selectedSnapshotIds = new Set(state.selectedSnapshotIds)
      selectedSnapshotIds.add(s.id)
      return {
        snapshots: next,
        activeSnapshotId: state.activeSnapshotId ?? s.id,
        selectedSnapshotIds,
      }
    }),

  removeSnapshot: (id) =>
    set((state) => {
      if (!state.snapshots.has(id)) return {}
      const next = new Map(state.snapshots)
      next.delete(id)
      const activeSnapshotId =
        state.activeSnapshotId === id
          ? next.size > 0
            ? (next.keys().next().value as string)
            : null
          : state.activeSnapshotId
      const selectedSnapshotIds = new Set(state.selectedSnapshotIds)
      selectedSnapshotIds.delete(id)
      return { snapshots: next, activeSnapshotId, selectedSnapshotIds }
    }),

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

  setSelectedSnapshotIds: (ids) => set({ selectedSnapshotIds: new Set(ids) }),

  // REPLACE never mutate (Zustand `Object.is`) — a fresh object so
  // subscribers re-render; no persist, no localStorage (D-06).
  setPlannedRatios: (r) => set({ plannedRatios: { ...r } }),

  // REPLACE never mutate (Zustand `Object.is`) — fresh object so
  // subscribers re-render; no persist, no localStorage (D-02).
  setThresholds: (t) => set({ thresholds: { ...t } }),

  // REPLACE never mutate (Zustand `Object.is`) — fresh object so subscribers
  // re-render; no persist, no localStorage (P-RS).
  setSizingThresholds: (t) => set({ sizingThresholds: { ...t } }),

  // REPLACE never mutate (Zustand `Object.is`) — fresh object; no persist.
  setMonsterThresholds: (t) => set({ monsterThresholds: { ...t } }),

  renameVCenter: (id, label) =>
    set((state) => {
      const snap = state.snapshots.get(id)
      if (!snap) return {}
      const next = new Map(state.snapshots)
      next.set(id, { ...snap, vCenterLabel: label })
      return { snapshots: next }
    }),

  setCapturedAt: (id, date) =>
    set((state) => {
      const snap = state.snapshots.get(id)
      if (!snap) return {}
      const next = new Map(state.snapshots)
      next.set(id, { ...snap, capturedAt: date })
      return { snapshots: next }
    }),

  releaseRawRows: (id, releasedAggregate) =>
    set((state) => {
      const snap = state.snapshots.get(id)
      if (!snap) return {}
      const next = new Map(state.snapshots)
      next.set(id, {
        ...snap,
        guests: [],
        nodes: [],
        vmUsage: [],
        storages: [],
        vpartition: [],
        vnetwork: [],
        vswitch: [],
        dvswitch: [],
        dvport: [],
        rawReleased: true,
        releasedAggregate,
      })
      return { snapshots: next }
    }),

  clearAll: () =>
    set({
      snapshots: new Map(),
      activeSnapshotId: null,
      selectedSnapshotIds: new Set(),
      plannedRatios: { cpu: 4, ram: 1 },
      thresholds: { ...DEFAULT_THRESHOLDS },
      sizingThresholds: { ...DEFAULT_SIZING_THRESHOLDS },
      monsterThresholds: { ...DEFAULT_MONSTER_THRESHOLDS },
    }),
}))

// Selectors — pure, stable references on unchanged state. Never construct a
// new array/object inside a selector (Zustand's `Object.is` equality would
// then loop). `selectSortedSnapshots`-style derivations live at the callsite
// behind `useMemo` (see SnapshotListSidebar).
export const selectHasSnapshots = (s: SnapshotState): boolean => s.snapshots.size > 0

export const selectActiveSnapshot = (s: SnapshotState): Snapshot | null =>
  s.activeSnapshotId ? (s.snapshots.get(s.activeSnapshotId) ?? null) : null

// The merge consumes the SELECTED snapshots. Selectors must return stable
// references (Zustand `Object.is`) so these expose the two underlying
// referentially-stable inputs (`snapshots` Map + `selectedSnapshotIds` Set,
// both REPLACED never mutated by the store). The actual `Snapshot[]`
// derivation happens INSIDE `useEstateView`'s single `useMemo` — never in a
// selector (a fresh array there would loop the equality check) and never in
// a second `useMemo` (grep-gated single-memo invariant).
export const selectSnapshots = (s: SnapshotState): Map<string, Snapshot> => s.snapshots
export const selectSelectedSnapshotIds = (s: SnapshotState): Set<string> => s.selectedSnapshotIds
// P6 planned-ratios slice (D-06). Stable refs — never construct here.
export const selectPlannedRatios = (s: SnapshotState): { cpu: number; ram: number } =>
  s.plannedRatios
export const selectSetPlannedRatios = (
  s: SnapshotState,
): ((r: { cpu: number; ram: number }) => void) => s.setPlannedRatios
// P9 threshold slice (D-02). Stable refs — never construct here.
export const selectThresholds = (s: SnapshotState): ThresholdConfig => s.thresholds
export const selectSetThresholds = (s: SnapshotState): ((t: ThresholdConfig) => void) =>
  s.setThresholds
// P-RS sizing-threshold slice. Stable refs — never construct here.
export const selectSizingThresholds = (s: SnapshotState): SizingThresholds => s.sizingThresholds
export const selectSetSizingThresholds = (s: SnapshotState): ((t: SizingThresholds) => void) =>
  s.setSizingThresholds
// P-RS monster-threshold slice. Stable refs — never construct here.
export const selectMonsterThresholds = (s: SnapshotState): MonsterThresholds => s.monsterThresholds
export const selectSetMonsterThresholds = (s: SnapshotState): ((t: MonsterThresholds) => void) =>
  s.setMonsterThresholds
