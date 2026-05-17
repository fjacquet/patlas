import { create } from 'zustand'
import type { DrScenario } from '@/types/estate'
import type { Snapshot } from '@/types/snapshot'

const EMPTY_SCENARIO = (): DrScenario => ({
  failedHosts: new Set(),
  failedSites: new Set(),
})

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
   * Clusters the user has flagged stretched (Phase 4 STR-01). Drives the
   * per-site reservation + DR. Inputs-only, REPLACED never mutated; no
   * persist, no localStorage (PROJECT.md line 53 / T-04-06).
   */
  stretchedClusters: Set<string>
  /**
   * DR what-if selection (Phase 6 DRX-02..05). Inputs-only, REPLACED
   * never mutated; never persisted (no hash, no localStorage — T-04-13).
   */
  scenario: DrScenario
  /**
   * P6 capacity-planning "Personal Ratios" — the user's PLANNED CPU/RAM
   * overcommit for the explicitly-"planned" what-if lens (PLN-03/D-05).
   * Defaults CPU 4:1 / RAM 1:1 (the carried ALC-02 intent). Inputs-only,
   * REPLACED never mutated (Zustand `Object.is`); no persist, no
   * localStorage, no URL-hash codec (PROJECT.md line 53 / D-06 / T-06-01).
   */
  plannedRatios: { cpu: number; ram: number }
  addSnapshot: (s: Snapshot) => void
  removeSnapshot: (id: string) => void
  setActiveSnapshot: (id: string | null) => void
  setSelectedSnapshotIds: (ids: Set<string>) => void
  setStretchedClusters: (clusters: Set<string>) => void
  setScenario: (scenario: DrScenario) => void
  setPlannedRatios: (r: { cpu: number; ram: number }) => void
  renameVCenter: (id: string, label: string) => void
  setCapturedAt: (id: string, date: Date) => void
  clearAll: () => void
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: new Map(),
  activeSnapshotId: null,
  selectedSnapshotIds: new Set(),
  stretchedClusters: new Set(),
  scenario: EMPTY_SCENARIO(),
  plannedRatios: { cpu: 4, ram: 1 },

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

  setStretchedClusters: (clusters) => set({ stretchedClusters: new Set(clusters) }),

  setScenario: (scenario) =>
    set({
      scenario: {
        failedHosts: new Set(scenario.failedHosts),
        failedSites: new Set(scenario.failedSites),
      },
    }),

  // REPLACE never mutate (Zustand `Object.is`) — a fresh object so
  // subscribers re-render; no persist, no localStorage (D-06).
  setPlannedRatios: (r) => set({ plannedRatios: { ...r } }),

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

  clearAll: () =>
    set({
      snapshots: new Map(),
      activeSnapshotId: null,
      selectedSnapshotIds: new Set(),
      stretchedClusters: new Set(),
      scenario: EMPTY_SCENARIO(),
      plannedRatios: { cpu: 4, ram: 1 },
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
export const selectStretchedClusters = (s: SnapshotState): Set<string> => s.stretchedClusters
export const selectSetStretchedClusters = (s: SnapshotState): ((c: Set<string>) => void) =>
  s.setStretchedClusters
export const selectScenario = (s: SnapshotState): DrScenario => s.scenario
export const selectSetScenario = (s: SnapshotState): ((sc: DrScenario) => void) => s.setScenario
// P6 planned-ratios slice (D-06). Stable refs — never construct here.
export const selectPlannedRatios = (s: SnapshotState): { cpu: number; ram: number } =>
  s.plannedRatios
export const selectSetPlannedRatios = (
  s: SnapshotState,
): ((r: { cpu: number; ram: number }) => void) => s.setPlannedRatios
