# Average VM size — design

**Date:** 2026-07-03
**Branch:** `feat/avg-vm-size`

## Goal

Surface the **average size of a VM** — vCPU, RAM, and configured disk — on
patlas's overview surfaces, so a reader can see what a typical VM in the
estate looks like at a glance.

Each metric is reported as **mean and median**. Median is included because a
handful of "monster" VMs pull the mean well above the typical VM; the median
is the honest "typical size".

## Scope

- **In:** estate-wide average VM size (mean + median) for vCPU, RAM,
  configured disk, on the **web dashboard** and the **PPTX overview slide**.
- **Out:** the shareable HTML report (deliberately excluded, following the
  rightsizing/monster-VM precedent — those features are web + PPTX only).
- **Out:** per-cluster average size (v1 is estate-wide only).

## Data & population

- **vCPU** ← `GuestRow.vcpu` (`Cores`)
- **RAM** ← `GuestRow.vramMib` (`MiB`)
- **Disk** ← `GuestRow.provisionedMib` (`MiB`) — the configured/allocated
  disk size. This is the correct per-VM storage basis: it is reliably
  populated, whereas per-VM *used* disk (`inUseMib`) is empty in cv4pve
  exports. "Average VM size" is an allocation figure, consistent with vCPU
  and RAM also being allocations.
- **Population** follows the existing **accounting mode**, matching the rest
  of the dashboard:
  - `configured` → all VMs
  - `active` (and any non-`configured` mode) → powered-on VMs only
    (`!poweredOn` skipped)

  This keeps the reported mean consistent with the totals already shown
  (`mean vCPU == globals.vcpuAllocated / globals.vmCount` in the same mode).

## Statistic definitions

For a filtered population of N VMs and a metric's values `xs`:

- **mean** = `Σ xs / N`
- **median** = sort ascending; odd N → middle element; even N → arithmetic
  mean of the two middle elements (may be fractional, e.g. `[4,6] → 5`).
- **Empty population (N = 0)** → all means and medians are `0`
  (frozen `emptyAvgVmSize` constant, mirroring `emptySummary` in
  `globals.ts` and `EMPTY_VIEW`). Divide-by-zero guarded.

Branded units are preserved on every output value (`Cores` for vCPU, `MiB`
for RAM and disk).

## Engine (pure)

New `src/engines/aggregation/avgVmSize.ts`:

```ts
export interface AvgVmSize {
  vmCount: number
  vcpu: { mean: Cores; median: Cores }
  vramMib: { mean: MiB; median: MiB }
  provisionedMib: { mean: MiB; median: MiB }
}

export const emptyAvgVmSize: AvgVmSize   // frozen all-zero constant

export function computeAvgVmSize(
  guests: readonly GuestRow[],
  mode: AccountingMode,
): AvgVmSize
```

Each metric keeps its own branded unit on both `mean` and `median` (no
shared `Stat` type, because the units differ per metric).

- Pure function, no React/DOM/Zustand/Zod. Lives in `engines/`, coverage
  gated ≥75%.
- Filter predicate reuses the established rule: `mode !== 'configured' &&
  !g.poweredOn` → skip.
- Median computed from the raw per-VM values (cannot be derived from
  totals), so the engine consumes the guest rows directly.

## Wiring

- Add top-level field `avgVmSize: AvgVmSize` to the `EstateView` interface
  (`src/types/estate.ts`).
- Compute in `buildEstateView` (`src/engines/aggregation/estateView.ts`):
  `merged.guests` and `mode` are both in scope (~line 157). Add
  `avgVmSize` to the returned object and to `EMPTY_VIEW` (using
  `emptyAvgVmSize`).

Rationale for a top-level field (not folding into `GlobalSummary`):
`aggregateGlobals` receives already-summed cluster aggregates and has no
access to raw guest rows, which the median requires. A separate field keeps
one source of truth.

## Surfaces

### Web — `src/components/dashboard/GlobalSummaryCard.tsx`

- Three `StatTile`s: **avg vCPU**, **avg RAM**, **avg disk**.
- `value` = mean, `sub` = median (e.g. value `6.4`, sub carries the median).
- `avgVmSize` threaded as a new prop from
  `src/components/dashboard/GlobalDashboard.tsx` (which already passes
  multiple `view.*` values as props). Reads `view.avgVmSize`.
- Number formatting via the existing dashboard formatters (RAM/disk shown in
  GiB using the same helpers the neighbouring vCPU/vRAM/storage tiles use).
  vCPU mean may be fractional; median may be fractional on even counts.

### PPTX — `src/engines/export/pptx/slides/overviewSlide.ts`

- Add the three average-size metrics as KPI tiles via `addKpiRow`, value
  formatted `mean / median` (matching the reviewed mock).
- `avgVmSize` added to the `OverviewData` interface and threaded from
  `src/engines/export/pptx/builder.ts`.

## i18n

New keys in **all four** locales (`en`/`fr`/`de`/`it`) — the `keyParity`
gate requires identical key paths:

- label for average vCPU
- label for average RAM
- label for average disk
- a "median" qualifier label (for the tile `sub` / PPTX)

No pre-formatted numbers in strings; no editorial verbs. DE/IT technical
terms follow the existing pending-native-review posture.

## Tests

- **Engine unit test** (`avgVmSize.test.ts`): mean/median math; odd vs even
  N (even → mean of two middles); empty population → `emptyAvgVmSize`;
  accounting-mode filtering (`configured` counts powered-off; `active`
  excludes them); branded units preserved.
- **EstateView**: `avgVmSize` present and non-empty for a populated estate;
  `EMPTY_VIEW.avgVmSize === emptyAvgVmSize`.
- Keep engine coverage ≥75%; run `npm run typecheck` (app + test project)
  after adding the required `EstateView` field so test literals are caught.

## Conventions

- Commit prefix `<type>(NN-NN): …` per phase-plan id.
- Branded units throughout; no raw MiB↔GiB factors.
- i18n keys in all four locales; `keyParity` gate.
- No `localStorage` of dataset rows; no new network calls (privacy invariant).
