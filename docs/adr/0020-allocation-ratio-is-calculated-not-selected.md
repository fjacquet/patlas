<!-- generated-by: gsd-doc-writer -->
# ADR-0020: Allocation Ratio Is Calculated, Not User-Selected

**Status:** Accepted
**Date:** 2026-05-17
**Project:** vatlas
**Phase:** 6 — Allocation & DR (re-derived)

## Context

The original Phase-4 "Allocated Resources" design (old requirements ALC-01..04)
treated the consolidation ratio as a user-supplied what-if input: an in-app
slider, named presets, and a `#alloc=cpu:..,ram:..` URL-hash codec
(`useAllocationHash` / `AllocationSliders`) that persisted the chosen ratio to
the address bar. The realized consolidation of the estate was inferred from
whatever number the user dialed in.

Phase-4 UAT (locked decision G2 / OPEN-1) rejected this. RVTools already
contains every figure needed to compute the realized consolidation directly:
`vCPU allocated ÷ usable physical cores` and `vRAM ÷ physical RAM`. Asking the
user to invent a ratio in order to see their own measured ratio is
self-contradictory — the tool measures, it does not ask the user to guess. A
slider also conflated two distinct concepts (the measured present state vs. a
capacity-planning what-if) into one control.

## Decision

1. The realized consolidation ratio is **always calculated and displayed**,
   never an input. It is `vCPU allocated ÷ usable physical cores` (CPU) and
   `vRAM ÷ physical RAM` (RAM), computed at both estate and per-cluster scope
   from parsed RVTools columns. This "measured" value is satisfied by Phase 5
   Operational Insights (RCI-01); Phase 6 builds no new realized-ratio UI
   (DRY).
2. Capacity planning is a **separate, explicitly-labelled what-if lens**
   (requirements PLN-01..04): a 4th top-level ViewToggle segment ("Capacity
   planning — what-if (planned)") that is structurally distinct from the
   measured value and never overwrites or hides it.
3. The planned lens accepts a Planned CPU ratio and Planned RAM ratio via
   named preset buttons (CPU 1:1 / 4:1 / 8:1 / VDI 10:1; RAM same pattern)
   filling an editable numeric field; defaults are CPU 4:1 / RAM 1:1. No
   slider widget.
4. Planned ratios are held **in memory only** (Zustand inputs slice,
   `plannedRatios`). There is no URL-hash codec and no `localStorage` of
   planned inputs — refresh = data gone (consistent with ADR-0001).
5. The planned what-if recomputes against physical cores (not hyperthreads)
   through the single `useEstateView` memo, with the measured reference shown
   read-only and qualified as "measured" — the two are never conflated.

## Rationale

The product promise is "the tool measures, it never asks the user to invent
numbers". A measured ratio derived from the export is auditable; a slider value
is editorial. Splitting "measured" from "planned" into two visibly distinct
surfaces preserves the legitimate capacity-planning use case (reference #8)
without contaminating the factual estate description that feeds the HTML/PPTX
report. Keeping planned ratios in the in-memory store (not the URL) aligns the
new lens with the privacy invariant — there is no persisted ratio input
anywhere.

## Alternatives Considered

- **Keep the slider/preset/URL-hash as the realized-ratio mechanism.**
  Rejected by UAT G2: it asks the user to supply the very number the tool
  should compute, and persists a dataset-adjacent input to the URL.
- **Single control serving both measured and planned.** Rejected (OPEN-1):
  conflating a factual present-state metric with a speculative what-if is the
  defect UAT flagged; the two must be visibly distinct.
- **No capacity-planning surface at all.** Rejected: the what-if sizing use
  case is in scope (reference #8); it is preserved as the explicitly-"planned"
  lens rather than discarded.

## Consequences

- `useAllocationHash.ts` and `AllocationSliders.tsx` are removed from the
  codebase. There is no `#alloc=` URL-hash codec and no allocation slider
  anywhere.
- Old requirements ALC-01/02/03/04 are retired/re-derived: the realized ratio
  is satisfied by RCI-01 (Phase 5); the what-if becomes PLN-01..04 (Phase 6,
  Complete).
- The planned lens lives in `src/components/planning/` (`PlanningView`,
  `PlannedRatiosControl`); planned inputs live in `src/store/snapshotStore.ts`
  as a `plannedRatios` slice; the projection composes inside
  `buildEstateView` (`src/engines/aggregation/estateView.ts`) under the single
  `useEstateView` memo — no second `useMemo`.
- Any future ratio input must be in-memory only and on the explicitly-"planned"
  lens; reintroducing a URL-hash or `localStorage` ratio codec is forbidden
  (D-06).
- Engines stay pure: ratio math is a function of parsed columns plus the
  in-memory planned inputs; no React/DOM/Zustand/Zod inside `engines/`.
