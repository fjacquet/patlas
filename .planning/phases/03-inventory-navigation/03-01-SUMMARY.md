---
phase: 03-inventory-navigation
plan: 01
subsystem: inventory
tags: [tanstack-table, tanstack-virtual, csv, datatable, column-picker, view-toggle, inv-05, inv-06]
requires:
  - EstateView / buildEstateView single-memo projection pass (Phase 2)
  - AccountingModeToggle / ThemeToggle aria-pressed fieldset idiom (Phase 1/2)
  - format.ts pure-util module idiom (Phase 1)
  - scripts/check-bundle-size.mjs echarts gate (Phase 2)
provides:
  - "@tanstack/react-table@8.21.3 + @tanstack/react-virtual@3.13.24 pinned"
  - toCsv / csvCell — pure RFC-4180 serializer with CSV-injection guard
  - oneLine — pure display-only whitespace collapse
  - VmDisplayRow interface + EstateView.vmRows pure projection
  - "DataTable<T> — generic virtualised sortable/filterable/hideable table + CSV-of-current-view"
  - ColumnPicker — INV-06 show/hide popover
  - ViewToggle — Dashboard↔Inventory segmented control
affects:
  - 03-02 (3 object tables consume DataTable + ColumnPicker; set enableHiding/ColumnDef)
  - 03-03 (tree, App wiring, inventory i18n namespace, ViewToggle mount)
tech-stack:
  added:
    - "@tanstack/react-table@8.21.3 (exact)"
    - "@tanstack/react-virtual@3.13.24 (exact)"
  patterns:
    - Headless TanStack table with component-useState sort/filter/visibility (no useMemo)
    - useVirtualizer fixed-36px window, overscan 12 (single density, KISS)
    - CSV of getFilteredRowModel × getVisibleLeafColumns, raw values, newlines preserved
    - oneLine at cell display boundary, original in title (Minor-2 two-path)
key-files:
  created:
    - src/utils/csv.ts
    - src/utils/csv.test.ts
    - src/utils/oneLine.ts
    - src/utils/oneLine.test.ts
    - src/components/inventory/DataTable.tsx
    - src/components/inventory/ColumnPicker.tsx
    - src/components/ViewToggle.tsx
  modified:
    - package.json
    - package-lock.json
    - scripts/check-bundle-size.mjs
    - src/types/estate.ts
    - src/engines/aggregation/estateView.ts
decisions:
  - "tanstack bundle gate threshold = 60 KiB gz (MAX_TANSTACK_GZIP_BYTES=61440); graceful no-op until 03-03 wires the chunk into the production graph"
  - "ColumnPicker popover is a <fieldset>+<legend sr-only> (not <div role=group>) — biome useSemanticElements; matches project ThemeToggle/AccountingModeToggle idiom"
metrics:
  duration: "~38min (continuation: Task 3 only this session)"
  completed: 2026-05-16
  tasks: 3
  files: 12
---

# Phase 3 Plan 01: Table Infrastructure (INV-05/06 Primitives) Summary

Shared, app-agnostic Phase-3 table infrastructure: pinned + bundle-gated TanStack table/virtual deps, two net-new tested pure utils (RFC-4180 CSV serializer with injection guard, display-only `oneLine`), a `VmDisplayRow` projection riding the existing single `buildEstateView` pass, and three reusable unwired components (generic virtualised `DataTable`, `ColumnPicker`, `ViewToggle`).

## What Was Built

**Task 1 — Deps + bundle gate + projection (commit `7fe0bdc`):**

- `@tanstack/react-table@8.21.3` + `@tanstack/react-virtual@3.13.24` installed `--save-exact`, verified via `npm ls`.
- `scripts/check-bundle-size.mjs`: added a **sibling** `@tanstack`-marker gate at `MAX_TANSTACK_GZIP_BYTES = 61440` (60 KiB gz) with the same gzip-and-assert + graceful "no chunk → OK" path as echarts. The existing echarts gate (`MAX_GZIP_BYTES=307200`, `ECHARTS_MARKER='echarts'`) is byte-identical/untouched.
- `src/types/estate.ts`: `export interface VmDisplayRow` (estate.ts:264) mirroring the `EsxAggregate` lean-flat-field idiom, doc-commented "pure projection of `Snapshot.vinfo`, NOT an aggregation"; `vmRows: VmDisplayRow[]` added to `EstateView` adjacent to `hosts`/`datastores` (306).
- `src/engines/aggregation/estateView.ts`: a `vmRows` accumulator declared next to `vmsByCluster`, pushed **inside the existing `for (const vm of snapshot.vinfo)` loop** (no second iteration / hook / memo site); returned in the object literal and frozen in `EMPTY_VIEW` as `Object.freeze([]) as never[]`.

**Task 2 — Pure utils, TDD (commits `03d6ac1` RED, `f0ac63c` GREEN):**

- `src/utils/oneLine.ts`: `export const oneLine = (s) => s.replace(/\s+/g, ' ').trim()`, doc-commented as the DISPLAY-ONLY boundary (Minor-2) — the CSV path never passes through it.
- `src/utils/csv.ts`: `csvCell` (raw `String(v)`, `null/undefined`→`''`, leading `=+-@` single-quote injection guard, RFC-4180 quote/double-quote) + `toCsv(headers, rows)` (comma fields, CRLF rows). Doc-comment states the deliberate contrast with `format.ts` (raw values, no `toLocaleString`, newlines preserved).
- 18 tests across `csv.test.ts` + `oneLine.test.ts`, **100% coverage** on both util files (every behavior bullet covered, RED-then-GREEN observed).

**Task 3 — Components, unwired (commit `ca165dc`):**

- `src/components/inventory/DataTable.tsx`: generic `DataTable<T>`; `useReactTable` with component-`useState` sorting/columnFilters/globalFilter/columnVisibility; `useVirtualizer` fixed 36px rows, overscan 12; 150 ms debounced global filter; sticky header + sticky first column on `.panel`; active-sort header in `accent-500`; cells rendered as React text children with `oneLine()` display + original in `title`; "Export CSV" toolbar button → `toCsv(getFilteredRowModel × getVisibleLeafColumns)` raw values → Blob → `URL.createObjectURL` → anchor `download="vatlas-{objectKind}-{YYYYMMDD}.csv"` → `revokeObjectURL`.
- `src/components/inventory/ColumnPicker.tsx`: INV-06 "Columns" toolbar button opening a `<fieldset>` popover over `getAllLeafColumns().filter(c => c.getCanHide())` checkboxes calling `column.toggleVisibility()`; Escape / outside-pointerdown close; "Reset" → `onReset` callback restoring `DataTable`'s `defaultColumnVisibility`.
- `src/components/ViewToggle.tsx`: 2-segment `['dashboard','inventory']` controlled control, `AccountingModeToggle` idiom verbatim — `<fieldset role="group">` + literal `biome-ignore lint/a11y/noRedundantRoles` + `<legend sr-only>` + arrow-key wrap `move(delta)` + `aria-pressed` map; active segment uses UI-SPEC accent gold (`bg-accent-500 text-surface-900`). Controlled; consumer/state lifted in 03-03.

## Verification Results

| Gate | Result |
|------|--------|
| `npm ls @tanstack/react-table @tanstack/react-virtual` | 8.21.3 / 3.13.24 exact |
| `npm run typecheck` | PASS (tsc + tsconfig.test.json) |
| biome (`npx @biomejs/biome check`, per CLAUDE.md gotcha — `npm run lint` is RTK-intercepted) | PASS, 3 files no fixes |
| `npm run test:run` | 33 files / 214 tests PASS |
| csv/oneLine coverage | 100% statement+branch (≥75% required) |
| `node scripts/check-bundle-size.mjs` | exit 0 — echarts 202.7 KiB ≤ 300 KiB intact; tanstack gate graceful no-op (no `@tanstack` chunk pre-03-03) |
| single-useMemo grep gate | 0 call sites outside `useEstateView` + Phase-1 `SnapshotListSidebar` |
| `localStorage` in inventory/ + ViewToggle | none (incl. doc-comments — tokens removed to keep bare-grep gate literally green) |
| `useMemo` in the 3 component files | none |
| `role="group"` + `noRedundantRoles` in ViewToggle | both literal-present |
| `npm run check:supply-chain` | OK |
| `npm run build` | built in 538ms |
| semgrep (`--config=auto --error`, 378 rules, 3 new component files) | 0 findings / 0 blocking |

## Chosen tanstack bundle-gate threshold + measured size

- **Threshold:** `MAX_TANSTACK_GZIP_BYTES = 61440` (60 KiB gz) — per 03-RESEARCH A6 (line 460): generous headroom, tighten after the first production build that actually pulls the chunk.
- **Measured now:** no `@tanstack` chunk exists in the production graph yet (DataTable/ColumnPicker/ViewToggle have no consumers until 03-03), so the gate is a deliberate graceful no-op. Unpacked install footprint for reference: `@tanstack/react-table` ≈ 776K, `@tanstack/react-virtual` ≈ 40K (tree-shaken/gzipped production size will be a small fraction; first real measurement lands in 03-03).
- The pre-existing echarts gate (300 KiB) is unchanged; current echarts-bearing chunk = 202.7 KiB gz.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lint] ColumnPicker popover: `<div role="group">` → `<fieldset><legend sr-only>`**

- **Found during:** Task 3 (biome gate)
- **Issue:** biome `lint/a11y/useSemanticElements` rejects `<div role="group">` and mandates `<fieldset>`. The plan's ColumnPicker text did not pin the popover element.
- **Fix:** Converted the popover container to `<fieldset>` + `<legend className="sr-only">`, which is also the project's established checkbox/button-group idiom (ThemeToggle / AccountingModeToggle). `aria-controls`/`id` wiring on the trigger button retained. No behavior change.
- **Files modified:** src/components/inventory/ColumnPicker.tsx
- **Commit:** ca165dc

**2. [Rule 3 - Gate compliance] Removed literal `useMemo`/`localStorage` tokens from doc-comments**

- **Found during:** Task 3 (verify grep gates)
- **Issue:** The plan's verify uses bare `! grep -rn 'useMemo' ...` / `! grep -rn 'localStorage' ...`. DataTable/ColumnPicker doc-comments explained these are deliberately NOT used, but the literal tokens tripped the bare grep (false positive — comment prose, no code usage).
- **Fix:** Reworded the doc-comments ("never a render-memo hook", "never browser-persisted") preserving full intent while keeping the automated gate literally green. No code change.
- **Files modified:** src/components/inventory/DataTable.tsx, src/components/inventory/ColumnPicker.tsx
- **Commit:** ca165dc

## Continuation Note

This was a continuation session. Tasks 1 & 2 were already executed and committed in a prior session (`7fe0bdc`, `03d6ac1`, `f0ac63c`); `src/components/ViewToggle.tsx` already existed correctly (untracked) but `DataTable.tsx`/`ColumnPicker.tsx` were missing. This session re-verified Tasks 1 & 2 green, built the two missing components, and committed all three Task-3 files together as `ca165dc`.

## TDD Gate Compliance

Task 2 (`tdd="true"`): RED commit `03d6ac1` (failing tests, modules not yet written) precedes GREEN commit `f0ac63c` (implementation, 100% coverage). No refactor commit needed. Gate sequence satisfied.

## Known Stubs

None. All three components are complete and functional; "unwired" is by design (App/InventoryView wiring and the `inventory` i18n namespace are 03-03 scope, explicitly stated in the plan). Missing-namespace i18n keys resolve to their fallback strings and are exercised end-to-end in 03-03.

## Threat Flags

None. No new network/auth/file-access surface. T-03-01..05 mitigations are all implemented as planned: cell text is React-escaped (no raw-HTML sink), `csvCell` injection guard is unit-tested, sort/filter/visibility are ephemeral component state (zero localStorage), CSV is a client-side Blob (no fetch), deps pinned exact with supply-chain green.

## Self-Check: PASSED

All 8 created files present on disk; all 4 task commits (7fe0bdc, 03d6ac1, f0ac63c, ca165dc) present in git history.
