---
phase: 03-inventory-navigation
plan: 02
subsystem: inventory
tags: [columndef, datatable, vm-table, esx-table, datastore-table, inv-02, inv-03, inv-04, inv-05, inv-06, naa-dedupe]
requires:
  - DataTable<T> / ColumnPicker generic primitives (03-01)
  - VmDisplayRow interface + EstateView.vmRows pure projection (03-01, in src/types/estate.ts + src/engines/aggregation/estateView.ts)
  - EstateView.hosts (EsxAggregate) / EstateView.datastores (DatastoreAggregate) verbatim Phase-2 output
  - format.ts display formatters / csv.ts raw RFC-4180 serializer (Phase 1 / 03-01)
  - AccountingModeToggle.test.tsx component-test idiom (Phase 2)
provides:
  - "vmColumns: ColumnDef<VmDisplayRow>[] (INV-02) — accessors ⊂ VmDisplayRow, zero OsBreakdown"
  - "esxColumns: ColumnDef<EsxAggregate>[] + esxDefaultVisible (INV-03) — EstateView.hosts verbatim"
  - "datastoreColumns: ColumnDef<DatastoreAggregate>[] + datastoreDefaultVisible (INV-04) — no cluster column, NAA dedupe consumed verbatim"
  - "VmTable/EsxTable/DatastoreTable — thin props-from-view wrappers (no hook, no memo, no @/engines)"
  - CSV-of-filtered×visible-view contract proven end-to-end (INV-05 × INV-06)
affects:
  - 03-03 (InventoryView shell mounts these wrappers as the single useEstateView caller; registers the inventory i18n namespace; first production importer → activates the @tanstack 60 KiB gz gate)
tech-stack:
  added: []
  patterns:
    - ColumnDef modules are pure config (zero React / useMemo / @/engines); identity column enableHiding:false
    - Default-visibility seed = module-scope constant derived from an exported id list (KISS, not meta.defaultHidden)
    - Wrappers receive their EstateView slice as a prop (GlobalDashboard single-caller lift discipline)
    - Datastore table binds EstateView.datastores verbatim — Phase-2 NAA dedupe never re-derived (Moderate-11)
key-files:
  created:
    - src/components/inventory/columns/vmColumns.ts
    - src/components/inventory/columns/esxColumns.ts
    - src/components/inventory/columns/datastoreColumns.ts
    - src/components/inventory/VmTable.tsx
    - src/components/inventory/EsxTable.tsx
    - src/components/inventory/DatastoreTable.tsx
    - src/components/inventory/columns/columns.test.ts
    - src/components/inventory/DataTable.csv.test.tsx
  modified: []
decisions:
  - "INV-02/03/04 ColumnDefs + wrappers fully implement the table behaviour; the shell mount that makes them user-visible is 03-03 plumbing (same staged pattern as 03-01 DataTable)"
  - "@tanstack 60 KiB gz bundle gate remains a graceful no-op: no production entrypoint imports the inventory tables yet (wiring is 03-03), so TanStack is tree-shaken out of the production graph — gate activates in 03-03, NOT widened"
  - "VmDisplayRow projection REUSED from 03-01 (src/types/estate.ts + estateView.ts) — vmColumns binds its 8 fields directly; zero second projection, zero new useMemo, zero @/engines import in any component"
metrics:
  duration: "~30min (continuation: closeout + Task 3 DataTable.csv.test.tsx this session)"
  completed: 2026-05-16
  tasks: 3
  files: 8
---

# Phase 3 Plan 2: Three Object Tables Summary

VM/ESX/datastore tables wired to existing `EstateView` outputs via three pure `ColumnDef` modules and three thin prop-consuming wrappers reusing the 03-01 generic `DataTable`/`ColumnPicker` — `VmDisplayRow` (03-01) reused not duplicated, datastore NAA dedupe consumed verbatim.

## What Was Built

- **Task 1 — ColumnDef modules** (`vmColumns.ts`, `esxColumns.ts`, `datastoreColumns.ts`): pure data arrays, zero React/`useMemo`/`@/engines`. `vmColumns` binds the 8 `VmDisplayRow` fields (no `OsBreakdown`); `esxColumns` consumes `EsxAggregate` verbatim with an `esxDefaultVisible` opt-in id list; `datastoreColumns` consumes `DatastoreAggregate` verbatim with no cluster column and a `datastoreDefaultVisible` id list. Identity columns (`vmName`/`hostName`/`key`) carry `enableHiding:false`. Numeric cells use `format.ts` for display; CSV reads raw via `row.getValue` (two-path discipline).
- **Task 2 — Thin wrappers** (`VmTable.tsx`, `EsxTable.tsx`, `DatastoreTable.tsx`): receive their `EstateView` slice as a prop (GlobalDashboard single-caller lift), compose `DataTable` with the ColumnDef module + a default-visibility seed built as a module-scope constant from the exported id list. No `useEstateView`, no `useMemo`, no `@/engines` import.
- **Task 3 — Tests** (`columns.test.ts`, `DataTable.csv.test.tsx`): ColumnDef invariants (accessor ⊂ VmDisplayRow, identity not hideable, no OsBreakdown/cluster, shared-LUN NAA stays one row with `sharedDuplicateCount>1`); CSV integration test proving filtered rows × visible columns × raw values, embedded newline preserved + RFC-4180 quoted, `vatlas-{kind}-YYYYMMDD.csv` filename.

## VmDisplayRow Reuse (explicit confirmation)

`VmDisplayRow` and `EstateView.vmRows` were produced by **03-01** inside the single `buildEstateView` pass (`src/types/estate.ts` + `src/engines/aggregation/estateView.ts`). This plan **reused** that projection verbatim: `vmColumns` binds its 8 fields directly and `VmTable` receives `rows: VmDisplayRow[]` as a prop. Grep-verified: **zero** second projection, **zero** new `useMemo`, **zero** `@/engines`/`useEstateView` import in any component or column module (the only `@/engines`/`useMemo` substring hits are negations inside doc-comments). ESX binds `EstateView.hosts` verbatim; datastore binds `EstateView.datastores` verbatim with the Phase-2 NAA dedupe never re-derived (test asserts one row, `sharedDuplicateCount>1`).

## Deviations from Plan

None. The plan was executed as written. Per the timed-out continuation: Tasks 1–2 and the `columns.test.ts` half of Task 3 were already committed (`1ce8fd8`, `b37cafb`); the only genuinely unfinished deliverable was Task 3's `DataTable.csv.test.tsx`, which was written this session (RED→GREEN: components already shipped, so it went straight to GREEN after the debounce-aware export-poll fix). Biome safe-autofix applied import ordering to the two untracked test files (cosmetic, no logic change).

## Gate Results

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npx @biomejs/biome check .` | PASS (127 files, 0 errors) |
| `npm run test:run` | PASS (35 files, 225 tests) |
| `npm run build` | PASS |
| `npm run check:supply-chain` | PASS |
| `npm run check:bundle-size` | PASS — main chunk 202.7 KiB gz ≤ 300 KiB |
| single-useMemo grep gate | PASS (0 real `useMemo(` outside allowlist) |
| grep: no OsBreakdown in vmColumns / no cluster in datastoreColumns | PASS |
| grep: no @/engines/useEstateView/useMemo in wrappers+columns | PASS |
| semgrep (CLI fallback `--config=auto --error`, 8 new files) | PASS — 0 findings, 378 rules |

**@tanstack bundle chunk:** No `@tanstack` chunk emitted yet — `check-bundle-size` reports *"OK (no @tanstack chunk found — nothing to gate yet)"*. This is correct and by design: no production entrypoint imports the inventory tables yet (grep-confirmed: zero non-test importers outside `src/components/inventory/`), so TanStack is tree-shaken out of the production graph. The tables being module-level "real importers" does not pull TanStack into the bundle until a production consumer mounts `<DataTable>` — that is the 03-03 `InventoryView`/App wiring. The 60 KiB gz gate activates in 03-03; it was **not** widened or bypassed.

> Semgrep MCP tool was unavailable in this environment; used the CLI fallback `semgrep --config=auto --error` (acceptable per prior plans). 0 findings.

## Threat Model Verification

- **T-03-06 (datastore re-derivation):** mitigated — `datastoreColumns`/`DatastoreTable` consume `EstateView.datastores` verbatim; `columns.test.ts` asserts a shared LUN stays one NAA-keyed row with `sharedDuplicateCount>1` and capacity taken from the first row (never summed).
- **T-03-07 (CSV column projection):** mitigated — `DataTable.csv.test.tsx` asserts the CSV header omits the hidden `cluster` column and the filtered-out `bravo`/C2 row is absent (`getVisibleLeafColumns × getFilteredRowModel` only).
- **T-03-08 (VM-name XSS):** mitigated — ColumnDefs declare accessors only, no HTML sink; cells render via the 03-01 DataTable React-text boundary.
- **T-03-09 (per-table state privacy):** accepted as designed — no new persistence surface added.

No new security surface introduced beyond the plan's threat register.

## Known Stubs

None. The tables are fully implemented; they are not yet mounted by a production shell (03-03), which is documented staged plumbing, not a stub.

## Self-Check: PASSED

- All 8 created files present on disk (verified).
- Commits verified: `1ce8fd8` (ColumnDef modules), `b37cafb` (wrappers), `739c883` (tests).
