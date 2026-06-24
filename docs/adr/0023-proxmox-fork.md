# ADR-0023: patlas Is a Fork of vatlas Remapped to Proxmox

**Status:** Accepted
**Date:** 2026-06-23
**Project:** patlas

## Context

vatlas is a VMware/RVTools analytics tool. A Proxmox VE equivalent was needed
with the same core value: drop a report in the browser → see numbers → export →
leave. The architectural mold (100%-client-side, privacy-invariant, pure
engines, single `useEstateView` bridge, ECharts SVG, HTML + PPTX export) is
sound and reusable. The divergence is confined to the input format, terminology,
and domain-specific views.

Two implementation strategies were considered: a multi-platform vatlas that
ingests both RVTools and Proxmox reports, or a separate fork. The fork was
chosen (Decision D1/D2 in the design spec) because the two input formats,
column schemas, and domain concepts (VMware vs Proxmox) diverge enough that a
shared codebase would require pervasive runtime conditionals and compromise
clarity for both audiences.

## Decision

1. **Fork, not rewrite.** patlas is a fork of vatlas. The app shell, privacy
   guard (`src/privacy/fetchGuard.ts` — throws synchronously on any
   non-same-origin request), the inputs-only Zustand store, `useEstateView`
   (the single `useMemo` bridge from store to UI/exports), `Chart.tsx`
   (ECharts SVG renderer, mandated project-wide), `DataTable.tsx`, the HTML
   and PPTX export builders, and the CI shape (typecheck → lint → test →
   build → deploy to GitHub Pages) are all kept verbatim or near-verbatim.

2. **Keep the canonical data-model shape; remap at the UI/i18n layer.**
   `VInfoRow`, `VHostRow`, `VDatastoreRow`, and `Snapshot` are structurally
   preserved so the pure aggregation engines (`engines/aggregation/`),
   right-sizing (`sizing.ts`, `monsterVm.ts`), OS EOS forecast, and trends
   engines are reused without modification. All user-facing terminology is
   remapped in i18n strings only: Host → Node, VM → Guest (or VM / Container
   by `guestType`), Datastore → Storage, vCenter → Cluster.

3. **Cluster pivot = Proxmox cluster name.** The cluster grouping key is the
   cluster `Name` from the Proxmox Cluster sheet. A standalone node with no
   cluster sheet falls back to a single implicit `"proxmox"` bucket. In a
   multi-report in-session trend load, each report's cluster name forms one
   bucket; guests are keyed by `Vm Id` + cluster (Proxmox VMIDs are
   cluster-unique, not global).

4. **Unified QEMU + LXC guests via `guestType`.** Both VM rows (`VMs` sheet)
   and container rows (`Containers` sheet) map into `VInfoRow`. A `guestType:
   'qemu' | 'lxc'` extension field carries the distinction; views segment by
   guest type where appropriate. Engines operate on the unified row set.

5. **Input format: Proxmox `.zip` bundle or bare `.xlsx`.** The upload zone
   accepts both. On `.zip`, the parser worker sniffs ZIP magic bytes and
   extracts `report.xlsx` (and optionally `network-diagram.svg`) using
   `fflate`. A bare `.xlsx` is parsed directly. `fflate` extraction runs in
   the worker alongside `xlsx`; no bytes leave the browser. This intentionally
   relaxes vatlas's "no .zip bundles" rule — the `.zip` is the Proxmox tool's
   native output.

6. **Stacked-composite-sheet parsing via `extractStackedSection`.**  The
   Proxmox Cluster sheet encodes several independent sub-tables stacked
   vertically (cluster info, Cluster HA, backup jobs, storage definitions). A
   shared `extractStackedSection(sheet, headerKeyword)` helper splits the
   sheet into named sub-table ranges; the adapter calls it per sub-table
   rather than reading the sheet as a single flat table. The same helper
   serves the Cluster HA view.

7. **DR analysis dropped.** There is no Proxmox analog for VMware's
   stretched-cluster DR simulation. The DR engine (`engines/drSim`), DR views,
   and all stretched-cluster / fault-domain / site-loss logic are removed
   cleanly — not stubbed. ADR-0021 and ADR-0022 are not applicable to patlas.

8. **Proxmox-native views (web-only).** Three views absent from vatlas are
   added as pure engines + view components, intentionally excluded from the
   HTML report and PPTX deck:
   - **Snapshot Sprawl** — guest snapshot count, age, total size; excludes
     the Proxmox `current` live-state marker.
   - **Storage Content** — per-storage content-type breakdown (images /
     rootdir / iso / vztmpl / backup …) and per-guest backup recency.
   - **Cluster Health** — HA status (quorum / fencing, HA-managed guests)
     and scheduled backup jobs; parsed from the stacked Cluster / Cluster HA
     composite sheet via `extractStackedSection`.

9. **Proxmox "GB" treated as GiB (binary).** Matching vatlas ADR-0010
   (RVTools "MB" = MiB), Proxmox `GB` column values are treated as GiB and
   converted to MiB via `×1024` with no additional 1.048576 factor. The
   branded units module enforces type-safe MiB/GiB/TiB throughout. This
   assumption is flagged as risk R1 in the design spec — verify against one
   node of known RAM before final release.

## Rationale

A fork preserves full clarity for each product without pervasive runtime
conditionals. Keeping the canonical data-model shape makes the pure engine
layer reusable at zero cost: no engine changes, no re-testing. Remapping only
at the UI/i18n layer is the lowest-coupling way to achieve correct Proxmox
terminology. The `guestType` extension to `VInfoRow` is additive and does not
require any engine change — engines already operate on unified row sets, and
views that need to segment by type do so via a filter on one field. The
stacked-sheet helper is the only novel parsing primitive; it is a pure function
and is engine-gated at ≥75% (ADR-0005).

## Alternatives Considered

- **Multi-platform vatlas (single repo, runtime source detection).** Rejected
  (D1/D2): the two input formats and column schemas diverge enough that a
  shared codebase would require pervasive conditionals; the separation keeps
  each product focused.
- **Separate containers table (not unified with VMs).** Rejected (D5):
  unifying into `VInfoRow` + `guestType` allows all aggregation, sizing, EOS,
  and monster-guest engines to operate on one row set without modification.
- **New data model (break from vatlas shapes).** Rejected (D3): breaking the
  canonical shape would require rewriting every aggregation engine; the
  structural reuse is the primary cost saving of the fork strategy.
- **Keep DR analysis, stub it.** Rejected: stubbed features create UI surface
  that implies capability the product doesn't have. Clean removal is correct.

## Consequences

- `engines/parser/adapters/proxmox.ts` is the single new parsing artifact;
  all other engines are consumed unchanged.
- `extractStackedSection` is a shared utility; any future composite-sheet
  format (if Proxmox adds one) reuses it.
- `VInfoRow` carries the `guestType` extension field; existing code that does
  not read it is unaffected.
- The `fflate` dependency is added (worker-only, privacy-invariant compatible).
- ADR-0010's "GB = GiB, ×1024 only" rule is extended to Proxmox; risk R1
  (GiB vs GB factor) must be verified before v1 release.
- DR-related files (`engines/drSim/`, `components/dr/`, `slides/drSlide.*`,
  all `dr.json` i18n namespaces) are deleted; reintroducing them is not
  permitted without a new ADR.
- ADR-0021 and ADR-0022 are not applicable to patlas (DR analysis was dropped
  in the Proxmox fork).
