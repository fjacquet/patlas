import { create } from 'zustand'
import type { Snapshot } from '@/types/snapshot'

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
  addSnapshot: (s: Snapshot) => void
  removeSnapshot: (id: string) => void
  setActiveSnapshot: (id: string | null) => void
  renameVCenter: (id: string, label: string) => void
  setCapturedAt: (id: string, date: Date) => void
  clearAll: () => void
}

export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: new Map(),
  activeSnapshotId: null,

  addSnapshot: (s) =>
    set((state) => {
      const next = new Map(state.snapshots)
      next.set(s.id, s)
      return { snapshots: next, activeSnapshotId: state.activeSnapshotId ?? s.id }
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
      return { snapshots: next, activeSnapshotId }
    }),

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

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

  clearAll: () => set({ snapshots: new Map(), activeSnapshotId: null }),
}))

// Selectors — pure, stable references on unchanged state. Never construct a
// new array/object inside a selector (Zustand's `Object.is` equality would
// then loop). `selectSortedSnapshots`-style derivations live at the callsite
// behind `useMemo` (see SnapshotListSidebar).
export const selectHasSnapshots = (s: SnapshotState): boolean => s.snapshots.size > 0

export const selectActiveSnapshot = (s: SnapshotState): Snapshot | null =>
  s.activeSnapshotId ? (s.snapshots.get(s.activeSnapshotId) ?? null) : null
