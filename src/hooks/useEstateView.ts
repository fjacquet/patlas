import { useMemo } from 'react'
import { buildEstateView, EMPTY_VIEW } from '@/engines/aggregation'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import type { AccountingMode, EstateView } from '@/types/estate'

/**
 * The project's SINGLE sanctioned `useMemo` site (PROJECT.md binding;
 * reaffirmed 01-05-SUMMARY). Reads the referentially-stable active
 * snapshot off the inputs-only store and derives the `EstateView` once
 * per `(snapshot identity, mode)` pair via the pure `buildEstateView`
 * assembler. Returns the frozen `EMPTY_VIEW` when no snapshot is active.
 *
 * This hook ONLY orchestrates + memoizes — it contains no aggregation
 * logic (that lives in the pure engines). Dashboard components consume
 * its output as plain props and must NOT introduce their own `useMemo`.
 */
export function useEstateView(mode: AccountingMode): EstateView {
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  return useMemo(() => (snapshot ? buildEstateView(snapshot, mode) : EMPTY_VIEW), [snapshot, mode])
}
