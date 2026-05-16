# Phase 3: Inventory Navigation - Research

**Researched:** 2026-05-16
**Domain:** Large-scale virtualised React data UI (TanStack Table + TanStack Virtual) over an existing pure-engine view model; client-side CSV export; no new engines
**Confidence:** HIGH (stack versions npm-verified; codebase contracts read directly; one MEDIUM open decision on raw-row sourcing — resolved with a recommendation)

## Summary

Phase 3 is a pure-UI phase: no new `engines/`, no new `useMemo` site beyond `useEstateView`, consuming the Phase-2 `EstateView`. The work is three sortable/filterable tables (VM / ESX / datastore), one virtualised cluster→ESX→VM tree responsive at 10k+ VMs, per-table column show/hide, and CSV export of the *current filtered+column-projected* view. The standard stack is `@tanstack/react-table@8.21.3` (headless table state: sorting, column filters, column visibility) + `@tanstack/react-virtual@3.13.24` (row windowing) — both npm-verified current and React-19-compatible. vsizer has **no** `utils/csv.ts` and **no** TanStack usage (verified by filesystem scan) — the planner's brief assumed a port that does not exist; CSV and all table infra are net-new for vatlas and must be built (small, ~40 lines for CSV).

The single most consequential finding: **`EstateView` does NOT carry per-VM or per-ESX raw rows usable by the tables/tree.** `EstateView.vmsByCluster` is typed `Map<string, OsBreakdown>` — a per-cluster *count* (`{windows,linux,other}`), not VM rows. `EstateView.hosts` (`EsxAggregate[]`) and `EstateView.datastores` (`DatastoreAggregate[]`) DO carry full per-row data and directly satisfy INV-03 and INV-04. But the VM table (INV-02) and the VM leaves of the tree (INV-01) need per-VM rows that only exist on the raw `Snapshot.vinfo: VInfoRow[]`. This is the central planning decision (see "Data source" below): the recommendation is a **pure projection** of `Snapshot.vinfo` for VM-table/tree display rows — read from the store, not re-aggregated — which honors "no new engines" because projection ≠ aggregation.

**Primary recommendation:** Build a generic headless `DataTable` wrapper over `@tanstack/react-table` (DRY-justified by 3 real consumers — VM/ESX/datastore) with column-visibility + global filter + a CSV-of-current-view primitive; window long lists with `@tanstack/react-virtual`; render the tree as a flattened-visible-rows array virtualised the same way with lazy children. VM-table and tree-leaf display rows are a pure projection of `Snapshot.vinfo` (added as a tiny derived field on the existing `useEstateView` memo, NOT a new hook/useMemo). Test 10k scale with a synthetic fixture generator (real fixtures top out at 249 VMs).

## User Constraints

> No CONTEXT.md exists for this phase (config `skip_discuss: true`, `discuss_mode: "discuss"`). The binding constraints below are extracted from PROJECT.md / CLAUDE.md / ROADMAP and carry the same authority as locked decisions.

### Locked Decisions (from PROJECT.md + CLAUDE.md — binding)

- **KISS / DRY / functional programming are binding.** No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases. `[CITED: CLAUDE.md / PROJECT.md Constraints]`
- **`useEstateView` is the ONE place `useMemo` lives.** Table sort/filter/visibility state is component-local `useState`/`useReducer`, never `useMemo`-derived aggregation. `[CITED: CLAUDE.md; .planning additional context]`
- **Engines are pure functions; the Zustand store holds inputs only.** Phase 3 adds **NO new engine**. `[CITED: ARCHITECTURE.md §8 Phase 4; ROADMAP Phase 3 vsizer-reuse line]`
- **Privacy invariant: no `localStorage` of dataset rows.** Refresh = data gone. UI-only prefs (theme, lang) may use `localStorage` — `vatlas-lang` already does. `[CITED: PROJECT.md Privacy invariant; STACK.md What-NOT-to-Use]`
- **Tech stack is fixed:** React 19 · TS strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) · Vite 8 · Tailwind v4 · Zustand 5 · react-i18next · Biome (single quotes, no semicolons, 2-space, 100-char). `[CITED: CLAUDE.md]`
- **`semgrep scan` generated code where the MCP tool is available** (CLI fallback otherwise; prior phases recorded the MCP tool unavailable — not blocking). `[CITED: <files_to_read> ./CLAUDE.md note; 01-04-SUMMARY Security Scan]`
- **No editorial recommendations anywhere in UI copy** (ADR-0003 lineage; lint/grep gates exist for `recommend|should|healthy|critical`). `[CITED: 02-03-SUMMARY Threat Surface; PITFALLS D12]`

### Claude's Discretion (Phase 3 owns these)

- Generic-vs-bespoke table component shape (recommended: one generic `DataTable`, justified by 3 consumers).
- Where inventory mounts relative to dashboard+sidebar (tab vs route vs panel — recommended below).
- Column-visibility persistence mechanism (recommended: ephemeral in-memory; see Q7).
- Filter UX (global search vs per-column — recommended: global debounced text + a few faceted chips).
- i18n: new `inventory` namespace vs extend `dashboard` (recommended: new namespace).
- Plan decomposition (recommended 3 plans below; planner may override).

### Deferred Ideas (OUT OF SCOPE for Phase 3)

- Multi-vCenter merge / vCenter top tree level (Phase 4 — tree top is single-snapshot vCenter→Datacenter→Cluster→ESX→VM).
- Trends / sparklines (Phase 6).
- EOS status columns/chips (Phase 5).
- DR sim, allocation sliders, stretched pill (Phase 4).
- HTML/PPTX export of inventory (Phase 7 — Phase 3 only does CSV).
- Row hover preview popovers, vSphere iconography polish (FEATURES.md lists these as nice-to-have; not in INV-01..06 — defer unless trivially free).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | Inventory tree (vCenter→Datacenter→Cluster→ESX→VM) responsive at 10 000+ VMs | Flatten-tree-to-rows + `@tanstack/react-virtual` windowing + lazy children expansion (Architecture Patterns §Tree). Datacenter level: parsed `VInfoRow` has no datacenter column — see Open Question 2. |
| INV-02 | Sortable, filterable VM table (RVTools columns) | `@tanstack/react-table` `getSortedRowModel`+`getFilteredRowModel`; rows = pure projection of `Snapshot.vinfo` (Data source §). |
| INV-03 | Sortable, filterable ESX-host table | Direct consumer of `EstateView.hosts: EsxAggregate[]` — already complete in Phase 2 (no projection needed). |
| INV-04 | Sortable, filterable datastore table, NAA/UUID-keyed, no shared-LUN double-count | Direct consumer of `EstateView.datastores: DatastoreAggregate[]` — `perDatastore` already NAA-deduped in Phase 2 (do NOT re-derive). |
| INV-05 | CSV export of the current filtered view | Net-new ~40-line `utils/csv.ts` (vsizer has none); export `table.getFilteredRowModel().rows` × visible columns; raw values, no locale formatting; preserve newlines (Minor-2). |
| INV-06 | Column show/hide per table | `@tanstack/react-table` column visibility API (`columnVisibility` state + `column.getCanHide()`/`toggleVisibility()`). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregated host/datastore rows | Engines (Phase 2, done) | — | `EsxAggregate`/`DatastoreAggregate` already on `EstateView`; tables consume as-is. |
| Per-VM display rows (table + tree leaves) | Store→hook projection | Component | Raw `Snapshot.vinfo` lives in the inputs-only store; a pure projection (no aggregation) belongs on the `useEstateView` memo, consumed by components. |
| Sort / filter / column-visibility state | Component (`useState`/`useReducer`) | TanStack Table core | Per CLAUDE.md: not a `useMemo`-aggregation; it is ephemeral UI state managed by TanStack's headless models. |
| Row windowing | Component (`@tanstack/react-virtual`) | — | Pure DOM-render optimization; no data semantics. |
| Tree expand/collapse + flatten | Component | TanStack Table expanded model | Hierarchy is a presentation concern over already-available rows; no engine. |
| CSV serialization | `utils/` pure fn | Component (trigger) | Pure string transform (like `utils/format.ts`); the click handler wires Blob+download. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | `8.21.3` | Headless table state: sorting, column filtering, global filter, column visibility, expanded model | The de-facto headless React table; framework-agnostic core; no built-in DOM so it composes with virtualization and Tailwind. `[VERIFIED: npm view @tanstack/react-table version → 8.21.3, modified 2026-05-14]` React peer `>=16.8` → React 19 OK `[VERIFIED: npm peerDependencies]` |
| `@tanstack/react-virtual` | `3.13.24` | Row windowing for long tables and the flattened tree | Headless, lightweight, the documented successor to react-window; integrates cleanly with TanStack Table's `rows` array. ARCHITECTURE.md §7 mandates it by name (rejects react-window explicitly). `[VERIFIED: npm view @tanstack/react-virtual version → 3.13.24, modified 2026-05-11; peer react ^19.0.0 listed]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | CSV export, oneLine, column-picker UI | All net-new in-repo code. No CSV/utility library — a ~40-line pure `utils/csv.ts` + a Tailwind `<ColumnPicker>` are KISS-correct and avoid a dependency. `[ASSUMED→recommended]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-table` | Hand-rolled sort/filter + `<table>` | For 1 table maybe; for 3 + a tree, the sort/filter/visibility/expanded state machine is exactly what TanStack solves. Hand-rolling re-creates known-buggy edge cases (multi-sort tiebreak, filter+sort interaction). DRY/KISS favor the library. |
| `@tanstack/react-virtual` | `react-window` / `react-virtuoso` | ARCHITECTURE.md §7 explicitly rejects react-window ("`@tanstack/react-virtual` is the newer headless successor and integrates with sortable column headers more cleanly"). react-virtuoso is heavier and opinionated. Stay with the architecture decision. |
| Generic `DataTable` | 3 bespoke tables | 3 near-identical tables = copy-paste (violates DRY directive). One generic headless wrapper + 3 column-def modules is the DRY-justified abstraction (3 real consumers, not speculative). |
| net-new `utils/csv.ts` | `papaparse` / `json2csv` | Overkill for "rows×columns → RFC-4180 string". Adds a dependency + supply-chain surface for ~40 lines. KISS: write it, unit-test it. |

**Installation:**
```bash
npm install @tanstack/react-table@8.21.3 @tanstack/react-virtual@3.13.24
```

**Version verification (run before locking the plan):**
```bash
npm view @tanstack/react-table version    # expect 8.21.3 (verified 2026-05-16)
npm view @tanstack/react-virtual version  # expect 3.13.24 (verified 2026-05-16)
```
Both verified current as of 2026-05-16. `@tanstack/react-table@8` is the stable major (v9 not released); pin exact or `^8.21.3`.

## Architecture Patterns

### System Architecture Diagram

```
Snapshot (store, inputs-only)
  └─ vinfo: VInfoRow[]  vhost  vdatastore  parseErrors
            │
            ▼  selectActiveSnapshot (Zustand selector, referentially stable)
      useEstateView(mode)  ── the ONE useMemo ──┐
            │ buildEstateView(snapshot, mode)   │  (Phase 2, unchanged)
            ▼                                   ▼
   EstateView {                         + projectInventoryRows(snapshot)  ← NEW pure fn,
     hosts: EsxAggregate[]   ────┐         memoized INSIDE the same useEstateView useMemo
     datastores: DatastoreAg[]──┐│         (no new hook, no new useMemo site)
     vmsByCluster: counts only  ││├─────►  vmRows: VmDisplayRow[]   (pure projection of vinfo)
   }                            │││                  │
                                ▼▼▼                  ▼
                    ┌───────────────────────────────────────────────┐
                    │  Inventory shell  (tab/panel beside dashboard) │
                    │  ┌──────────┬──────────┬──────────┬─────────┐  │
                    │  │ Tree     │ VM table │ ESX table│ DS table│  │
                    │  │ (INV-01) │ (INV-02) │ (INV-03) │ (INV-04)│  │
                    │  └────┬─────┴────┬─────┴────┬─────┴────┬────┘  │
                    │       │          │          │          │       │
                    │   each owns: useReactTable (sort/filter/        │
                    │   columnVisibility = component useState)        │
                    │       │          │          │          │       │
                    │   getFilteredRowModel().rows ──► useVirtualizer │
                    │                              └──► <DataTable/>  │
                    │   "Export CSV" ─► toCsv(filteredRows, visibleCols)│
                    │                   └─► Blob → anchor download     │
                    └───────────────────────────────────────────────┘
```

Data flow to trace: active snapshot → `useEstateView` memo derives both the existing `EstateView` AND the new projected VM rows in the *same* memo → each table/tree component holds its own TanStack table instance with ephemeral sort/filter/visibility state → filtered row model feeds both the virtualizer (DOM) and the CSV exporter (file).

### Recommended Project Structure

```
src/
├── components/
│   └── inventory/
│       ├── InventoryPanel.tsx        # shell: section tabs (Tree | VMs | ESX | Datastores)
│       ├── DataTable.tsx             # generic headless table: virtualised body, sort headers,
│       │                             #   column-visibility, global filter, CSV button
│       ├── ColumnPicker.tsx          # show/hide menu (INV-06), reused by all tables
│       ├── InventoryTree.tsx         # flattened virtualised cluster→ESX→VM tree (INV-01)
│       ├── columns/
│       │   ├── vmColumns.ts          # ColumnDef<VmDisplayRow>[] (INV-02)
│       │   ├── esxColumns.ts         # ColumnDef<EsxAggregate>[] (INV-03)
│       │   └── datastoreColumns.ts   # ColumnDef<DatastoreAggregate>[] (INV-04)
│       └── *.test.tsx
├── utils/
│   ├── csv.ts                        # NEW pure: toCsv(rows, columns) → string (INV-05)
│   └── oneLine.ts                    # NEW pure: oneLine(s) (Minor-2, display only)
├── engines/aggregation/estateView.ts # MODIFIED: also return projected vmRows (pure projection)
├── types/estate.ts                   # MODIFIED: add VmDisplayRow + vmRows on EstateView
├── hooks/useEstateView.ts            # UNCHANGED structurally (still the one useMemo)
└── i18n/locales/{en,fr}/inventory.json  # NEW namespace
```

### Pattern 1: Generic headless DataTable + virtualised body

**What:** One `<DataTable>` parameterised by `ColumnDef<T>[]` + `data: T[]`. Owns `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`. Sort/filter/visibility state is local `useState`. Body rows windowed by `useVirtualizer`.
**When to use:** All three object tables (VM/ESX/datastore).
**Example:**
```typescript
// Source: https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows
//         + https://tanstack.com/virtual/v3 (useVirtualizer)
const table = useReactTable({
  data,
  columns,
  state: { sorting, columnFilters, globalFilter, columnVisibility },
  onSortingChange: setSorting,
  onColumnVisibilityChange: setColumnVisibility,
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
const { rows } = table.getRowModel()              // already sorted+filtered
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 36,                          // fixed row height (KISS)
  overscan: 12,
})
// render only rowVirtualizer.getVirtualItems(); translateY by virtualItem.start
```
Keep row height fixed (one density) — variable-height measurement is a documented perf/complexity tax not justified by INV-01..06.

### Pattern 2: Flatten-tree-to-rows + lazy children (the 10k recipe)

**What:** The tree is rendered as a *single flat array of currently-visible nodes* (a cluster, its hosts if expanded, each host's VMs if expanded), then virtualised exactly like a table. Expand/collapse mutates an expansion `Set<nodeId>` in component state; the flat array is recomputed from `(clusters, hostsByCluster, vmsByHost, expandedSet)` — this recompute is cheap and lives in the component (it is render-derived presentation state, not aggregation, so no `useMemo`-engine rule conflict; a local `useMemo` keyed on the expanded set is acceptable as render memoization, but prefer a plain function call if the visible window is the only cost).
**When to use:** INV-01.
**Why this beats TanStack's built-in `getExpandedRowModel` here:** the built-in expanded model materializes the *entire* expanded subtree into row objects. At 36k leaves with all expanded that is 36k row objects per render. A hand-built flat-visible-array with **lazy children (children of a node are only included when that node's id ∈ expandedSet)** keeps the materialized array bounded by what the user actually opened. `[VERIFIED: TanStack docs — "If you have 50,000 rows, TanStack Table will generate 50,000 row objects and expect you to render them all"; getExpandedRowModel flattens all sub-rows]` `[CITED: https://tanstack.com/table/v8/docs/guide/expanding]`
**Recipe:**
1. Pre-index once (pure, in the same `useEstateView` projection): `clustersOrdered: string[]`, `hostsByCluster: Map<cluster, EsxAggregate[]>` (from `EstateView.hosts`), `vmsByHost: Map<hostName, VmDisplayRow[]>` (from projected vmRows grouped by `VInfoRow.host`).
2. Component state: `expanded: Set<string>` (node ids like `cl:<name>`, `esx:<name>`).
3. `buildVisibleRows(expanded)` walks clusters → push cluster row; if expanded push its hosts; if a host expanded push its VMs. Returns `FlatNode[]` whose length ≈ only-opened.
4. `useVirtualizer({ count: flat.length, ... })` → render window only. Indent by `node.depth` (`paddingLeft`).
**Memory budget (Critical-5):** never hold full raw cell objects per tree node — `VmDisplayRow` carries only the ~8 columns the tree/table show (name, vCPU, vRAM MiB, OS, powerState, provisioned MiB, host, cluster), not the whole `VInfoRow`. Aggregated host rows are already lean. The raw `Snapshot.vinfo` stays in the store (one copy, GC'd on refresh); projection produces a second lean array — acceptable (~10k × 8 small fields), but do NOT also keep a parallel tree-of-objects; the flat array is derived on demand.

### Pattern 3: CSV of the *current* view (INV-05 × INV-06 interaction)

**What:** Export must be exactly `table.getFilteredRowModel().rows` (filter respected) projected onto `table.getVisibleLeafColumns()` (column hide respected), with raw values and preserved newlines.
**Example:**
```typescript
// utils/csv.ts  (NEW — vsizer has no csv.ts; verified by filesystem scan)
// RFC-4180-ish: quote if value contains " , \n or \r ; double internal quotes.
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)            // raw value, NO locale formatting
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}
```
The table component supplies `headers` from visible columns' i18n header text (or column id) and `rows` from `row.getValue(colId)` for each visible column over the filtered model. **CSV uses the raw cell value, never the display-formatted/`oneLine`-d string** (Minor-2: locale numbers and one-lined annotations are display-only; CSV is data for re-import into Excel). Newlines inside an annotation are preserved by the RFC-4180 quoting above. Trigger: `new Blob([csv], {type:'text/csv;charset=utf-8'})` → `URL.createObjectURL` → anchor `download` → `revokeObjectURL`. No server, no fetch — privacy-clean.

### Pattern 4: Single density, global filter + a few facets

Global debounced text filter (`globalFilter` state, 150 ms debounce) over name/OS/host is the KISS default RVTools users expect ("grep for one VM"). Add 2-3 faceted toggles only where cheap and obviously useful (power state for VMs). Per-column filter inputs on every column is over-build for INV-02..04 — not required and adds header complexity. Debounce keeps filtering off the keystroke path (Moderate-9 analogue: do not let the inventory filter re-render the dashboard — it won't, because the dashboard subscribes to its own `useEstateView(mode)` and inventory state is component-local; verify by not lifting filter state above `InventoryPanel`).

### Anti-Patterns to Avoid

- **Re-aggregating in the component / a new hook.** INV-04's NAA dedupe is already done by `perDatastore` (Phase 2). Re-deriving datastores from raw rows in Phase 3 re-introduces Moderate-11 (shared-LUN double-count) and violates "no new engines". Consume `EstateView.datastores` verbatim.
- **A second `useMemo`-aggregation site.** The VM-row projection must ride inside the existing `useEstateView` memo (extend `buildEstateView` to also return `vmRows`), not a new `useInventoryRows` hook with its own `useMemo`. `[CITED: CLAUDE.md "useEstateView is the one place useMemo lives"; 02-02-SUMMARY useMemo-count gate]`
- **`getExpandedRowModel()` for the full tree at 10k+.** Materializes every expanded sub-row; defeats virtualization's memory goal at 36k leaves. Use the lazy flat-visible-array recipe.
- **`localStorage` of column visibility keyed to dataset.** Column ids are not dataset rows, but per the privacy-boundary-crispness recommendation keep visibility ephemeral (Q7) — do not muddy the invariant.
- **Formatting numbers in the CSV.** FR locale uses U+202F (Moderate-2); a locale-formatted CSV re-imports wrong into Excel. CSV = raw values.
- **Variable row heights / measured rows.** Unneeded complexity + perf cost for INV-01..06; fix the row height.
- **Rendering cell text via raw-HTML injection props.** Always render VM names/annotations as React text children (auto-escaped). Never set element inner HTML from row data; `oneLine` is a text transform only — there is no need or excuse for an HTML-injection prop in any inventory cell.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sort + multi-column filter + global filter + column visibility + expanded state | A bespoke reducer per table | `@tanstack/react-table@8.21.3` | Edge cases (sort tiebreak, filter∩sort order, visibility leaf vs group) are exactly the headless models' job; 3+ consumers. |
| Render 10k–36k rows without freezing | Manual scroll math / pagination-only | `@tanstack/react-virtual@3.13.24` | Windowing + overscan + measurement is subtle; ARCHITECTURE.md mandates this lib by name. |
| RFC-4180 escaping | ad-hoc `join(',')` | small in-repo `utils/csv.ts` (test it) | Quoting rules (embedded `"`, `,`, `\n`) are the classic CSV bug; ~40 lines + unit tests is the KISS-correct middle (no dependency). |

**Key insight:** the only thing worth *writing* here is the ~40-line CSV serializer and the ~30-line flat-tree builder; everything else (table state, windowing) is solved infrastructure. The hand-roll trap in this domain is re-deriving aggregates that Phase 2 already produced (datastore dedupe especially).

## Runtime State Inventory

> Not a rename/refactor/migration phase. **N/A.** No stored data, live-service config, OS-registered state, secrets, or build artifacts are renamed or migrated by Phase 3 — it is additive UI over existing in-memory state. Stated explicitly per checklist; nothing to inventory in any of the 5 categories.

## Common Pitfalls

### Pitfall 1: Assuming `EstateView` carries VM/ESX raw rows for the tables

**What goes wrong:** Planning the VM table/tree to read `EstateView.vmsByCluster` and discovering it is `Map<string, OsBreakdown>` — counts, not rows. Tree VM leaves and the VM table have no data source on `EstateView`.
**Why it happens:** Phase-2 summaries say "Phase 3 inventory consumes `perEsx`/`perDatastore`/`vmsByCluster`" — true for ESX (`EstateView.hosts`) and datastores (`EstateView.datastores`), but `vmsByCluster` was deliberately reduced to OS counts for the DSH-04 donut. `[VERIFIED: src/types/estate.ts:285 vmsByCluster: Map<string, OsBreakdown>; 02-02-SUMMARY contract block]`
**How to avoid:** Plan the VM-row projection from `Snapshot.vinfo` up front (Data source §). ESX/datastore tables are fine as-is.
**Warning signs:** A column def for the VM table referencing fields that don't exist on `OsBreakdown`.

### Pitfall 2: `vsizer/src/utils/csv.ts` does not exist

**What goes wrong:** A plan task says "port `vsizer/src/utils/csv.ts` unchanged" and the file isn't there. ROADMAP and the phase brief both assert this port.
**Why it happens:** ROADMAP Phase-3 vsizer-reuse line says "`utils/csv.ts` (port unchanged)"; filesystem scan of `/Users/fjacquet/Projects/vsizer/src` finds **no** csv file and **no** `@tanstack/*` usage anywhere in vsizer. `[VERIFIED: find vsizer/src -name "*csv*" → empty; grep -rl @tanstack vsizer/src → 0; grep @tanstack vsizer/package.json → none]`
**How to avoid:** Treat CSV + all TanStack table infra as net-new. The brief's "TanStack Table column-definition patterns from vsizer" reuse is also void — no prior art exists; build from TanStack docs.
**Warning signs:** Any task whose action is "copy from vsizer" for csv/table.

### Pitfall 3: Sorting/filtering 10k rows on the main thread blocking input

**What goes wrong:** Worry that client-side sort/filter of ~10k VM rows janks the UI; over-engineering toward a Web Worker.
**Why it happens:** 10k feels large. Reality check: Phase-1 measured the *parse* (heavier than sort) of the largest real workbook (249 VMs / 84 hosts / 1152 partitions) at 312 ms; real fixtures top out at 249 VMs. 10k is synthetic-stress territory. A single comparator pass over 10k objects is low-single-digit ms in V8; TanStack's filtered/sorted models are O(n log n) once per state change, not per render.
**How to avoid:** In-memory is fine at 10k — **no Web Worker for sort/filter** (KISS). Debounce the global filter (150 ms) so it runs once per settle, not per keystroke. Re-measure only if a synthetic 10k fixture shows a sort >200 ms (ROADMAP success #2 budget). `[VERIFIED: 01-04-SUMMARY A9 parse timings; .planning fixtures ≤249 VMs]`
**Warning signs:** Sort >200 ms or filter >100 ms on the synthetic 10k fixture (the ROADMAP success gates) — only then consider chunking.

### Pitfall 4: Multi-line annotation cells breaking table layout / CSV (Minor-2)

**What goes wrong:** A VM annotation/description with embedded `\n` renders as a literal newline that breaks the row height, or is stripped from the CSV.
**Why it happens:** RVTools cells can contain newlines; the display path and the data path have opposite needs.
**How to avoid:** `oneLine(s) = s.replace(/\s+/g, ' ').trim()` applied **only at the table display boundary** (the cell renderer). The CSV path uses the original value with RFC-4180 quoting preserving the newline. Two code paths, deliberately. `[CITED: PITFALLS Minor-2; ROADMAP Phase-3 pitfalls-owned]`
**Warning signs:** CSV cells with collapsed whitespace, or table rows with variable height.

### Pitfall 5: i18n EN↔FR key drift (Minor-7)

**What goes wrong:** New `inventory` namespace ships EN keys without FR; FR UI shows raw key names.
**Why it happens:** No missing-key runtime gate (noted in vsizer CLAUDE.md lineage); Phase 2 enforced strict parity manually + a flatten-diff in the verify step.
**How to avoid:** Author `inventory.json` EN+FR together; reuse Phase-2's flatten-diff parity check in the plan's verify gate. `[CITED: PITFALLS Minor-7; 02-03-SUMMARY "strict EN↔FR parity, automated flatten-diff"]`

## Code Examples

### Column visibility (INV-06)
```typescript
// Source: https://tanstack.com/table/v8/docs/api/features/column-visibility
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
// in useReactTable: state:{columnVisibility}, onColumnVisibilityChange:setColumnVisibility
// ColumnPicker maps table.getAllLeafColumns().filter(c => c.getCanHide())
//   → checkbox calling column.toggleVisibility()
// Identity columns (vmName/hostName/datastore key) → enableHiding:false in the ColumnDef
```

### CSV of current filtered + visible view (INV-05 × INV-06)
```typescript
// Source: TanStack row-model API + RFC 4180
function exportCsv(table: Table<T>, headerFor: (id: string) => string) {
  const cols = table.getVisibleLeafColumns()                 // INV-06 respected
  const headers = cols.map((c) => headerFor(c.id))
  const rows = table.getFilteredRowModel().rows.map((r) =>   // INV-05 respected
    cols.map((c) => {
      const v = r.getValue(c.id)                             // RAW value
      return v == null ? '' : String(v)                      // no locale fmt, keep \n
    }),
  )
  const csv = toCsv(headers, rows)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'inventory.csv'; a.click()
  URL.revokeObjectURL(url)
}
```

### Virtualised rows over TanStack's row model
```typescript
// Source: https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows
const { rows } = table.getRowModel()
const v = useVirtualizer({ count: rows.length, getScrollElement: () => ref.current,
  estimateSize: () => 36, overscan: 12 })
// body: position:relative, height: v.getTotalSize();
// each: v.getVirtualItems().map(vi => <Row style={{transform:`translateY(${vi.start}px)`}}
//                                          row={rows[vi.index]} />)
```

## Data Source (the central planning decision)

**Question 5 from the brief, resolved.** `EstateView` outputs and what each Phase-3 surface needs:

| Surface | Needs | On `EstateView` today? | Action |
|---------|-------|------------------------|--------|
| ESX table (INV-03) | per-host rows | **Yes** — `hosts: EsxAggregate[]` (hostName, cluster, sockets, cores, speedMhz, physicalGhz, memoryMib, vmCount, vcpuAllocated, ratios, readiness) | Consume verbatim. Zero new work on the data side. |
| Datastore table (INV-04) | per-datastore NAA-deduped rows | **Yes** — `datastores: DatastoreAggregate[]` (key=naa??name, name, type, capacity/free/used/provisioned MiB, ratios, sharedDuplicateCount) | Consume verbatim. **Do NOT re-derive** (Moderate-11). |
| VM table (INV-02) + tree VM leaves (INV-01) | per-VM rows | **No** — `vmsByCluster` is `Map<string,OsBreakdown>` (counts only) | **Pure projection of `Snapshot.vinfo`** → `VmDisplayRow[]`. |
| Tree cluster/host levels (INV-01) | cluster list + hosts per cluster | Partially — `clusters: ClusterAggregate[]` + `hosts: EsxAggregate[]` (group hosts by `.cluster`) | Group `EstateView.hosts` by `cluster`; clusters from `EstateView.clusters`. |

**Recommendation (option (a) refined):** extend the existing pure `buildEstateView(snapshot, mode)` to also return `vmRows: VmDisplayRow[]` — a 1:1 **projection** (filter/map) of `snapshot.vinfo`, NOT an aggregation (no grouping/summing). `VmDisplayRow` is a lean subset (~8 fields) of `VInfoRow`: `vmName, cluster, host, vcpu, vramMib, osTools||osConfig, poweredOn, provisionedMib`. Add `vmRows` to the `EstateView` type. `useEstateView` is structurally unchanged (still the only `useMemo`; it just memoizes a slightly larger view object). This satisfies ARCHITECTURE "no new engines" because a projection is the same class of operation `osFamily`/display formatters already are — it does not compute estate facts, it reshapes rows for display. `[ASSUMED placement — A2: if the project treats any new `engines/aggregation/` function as an "engine", place `projectVmRows` in `utils/` or inline in the assembler; behaviorally identical, KISS either way.]` Reading raw `Snapshot.vinfo` for *display* (not aggregation) is explicitly the acceptable path per the brief's Q5 ("raw-row read for display is acceptable if it's pure projection").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-window`/`react-virtualized` | `@tanstack/react-virtual@3` | v3 GA line (current 3.13.24) | Headless, hook-based, better TanStack-Table interop; ARCHITECTURE.md mandates it. |
| `react-table@7` HOC API | `@tanstack/react-table@8` headless `useReactTable` | v8 (stable, current 8.21.3; no v9) | Type-safe `ColumnDef<T>`, explicit row models you opt into (tree-shake unused). |
| Build expanded subtree eagerly | Lazy flat-visible-array for huge trees | Community/perf practice | Bounded materialization at 10k+ leaves (Critical-5 memory). |

**Deprecated/outdated:** `react-table@7` patterns (HOC, plugin hooks) — do not follow v7 tutorials; v8 API is different. vsizer "table patterns" reuse is void (no such code exists).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RVTools `vInfo` as parsed (`VInfoRow`) has **no Datacenter column**, so the tree's "Datacenter" level cannot be populated from current data | Open Q2 | INV-01 spec says vCenter→**Datacenter**→Cluster→ESX→VM; if Datacenter must appear, a Phase-1 parser extension is needed (crosses phase boundary). Recommendation: collapse to (synthetic vCenter root)→Cluster→ESX→VM; flag to planner. Verified `VInfoRow`/`VHostRow` fields — no datacenter; not independently confirmed RVTools never exposes a datacenter column the adapter could later pick up. |
| A2 | A pure projection of `Snapshot.vinfo` to lean `VmDisplayRow[]` counts as "no new engine" (projection ≠ aggregation) | Data source | If the project considers any new `engines/aggregation/` derivation an "engine", place the projection in `utils/` or inline in the assembler. Placement nuance, not a blocker. |
| A3 | In-memory sort/filter at 10k VMs stays within ROADMAP budgets (sort <200 ms, filter <100 ms) without a Worker | Pitfall 3 | If a synthetic 10k fixture breaches the budget, plan a chunked/deferred sort. Based on Phase-1 parse timings + V8 sort characteristics, low risk. |
| A4 | Column visibility as ephemeral in-memory state is acceptable (no persistence requirement in INV-06) | Open Q7 | If users expect visibility to survive a reload, revisit (URL-hash, like ALC-03 sliders, is the privacy-clean option — not localStorage). |
| A5 | Inventory mounts as an in-app **tab/section toggle** beside the existing dashboard (no router in the app today) | Open Q1/UI | App.tsx has no router; adding react-router for one toggle is over-build. A `ui.activeTab`-style switch (ARCHITECTURE.md §5 anticipates `activeTab:'overview'|'inventory'|...`) is KISS. A router is a larger decision for the planner. |
| A6 | Combined `@tanstack/*` chunk is small (~20 KB gz) and well clear of any sane budget | Plan decomposition | If the first production build shows otherwise, tighten the proposed sibling bundle gate. Estimate from typical builds, not measured this session. |

## Open Questions

1. **Where does inventory mount, and what is the navigation affordance?**
   - Known: `App.tsx` renders `<SnapshotListSidebar/> + <GlobalDashboard/>` side-by-side; no router; ARCHITECTURE.md §5 anticipates `ui.activeTab`.
   - Recommendation: a lightweight top-level segmented control (reuse the `AccountingModeToggle`/`ThemeToggle` `aria-pressed role=group` idiom — DRY) switching the main pane between Dashboard and Inventory. No router. Inventory has inner sub-tabs (Tree | VMs | ESX | Datastores). UI-SPEC input.

2. **Datacenter tree level (INV-01 says vCenter→Datacenter→Cluster→ESX→VM).**
   - Known: parsed `VInfoRow`/`VHostRow` carry `cluster` and `host` but **no datacenter, no vCenter** field; `viSdkUuid`/`viSdkServer` exist on `VInfoRow` but Phase-4 owns multi-vCenter.
   - Recommendation: Phase 3 single-snapshot tree = **(synthetic vCenter root, label = `Snapshot.vCenterLabel`) → Cluster → ESX → VM**. Omit Datacenter (no parsed source); document as a known limitation; do NOT extend the Phase-1 parser in Phase 3 (phase-boundary + KISS). Planner to confirm this satisfies INV-01's intent (success criterion is *responsiveness at 10k+*, which this meets).

3. **Per-cluster datastore cluster column (Phase-2 A1 carry-forward) — Question 6 from the brief.**
   - Known: `VDatastoreRow` has no `cluster` field; `perDatastore` is NAA-deduped & global; dashboard renders an em-dash per-cluster; 02-03-SUMMARY defers this to "Phase 3".
   - Recommendation: **Keep the datastore table cluster-agnostic in Phase 3.** INV-04 wants a sortable/filterable NAA-keyed datastore table with no shared-LUN double-count — `EstateView.datastores` already delivers exactly that. Surfacing a cluster column requires a Phase-1 parser/`VDatastoreRow` change, and a shared LUN spans clusters by definition — a single cluster column would be lossy/misleading and risks the NAA-dedupe invariant. **Tradeoff:** the dashboard em-dash persists past Phase 3 (acceptable — it is contract-correct). Recommend logging "per-cluster datastore attribution" as a deferred item, NOT Phase-3 scope. Forcing a parser change into a pure-UI phase violates the phase boundary.

4. **i18n: new `inventory` namespace or extend `dashboard`? — Question 8.**
   - Known: `NAMESPACES = ['common','upload','dashboard']`; ARCHITECTURE.md §9 + brief name `inventory` as planned; namespaces are per-UI-concern by design.
   - Recommendation: **new `inventory` namespace** (EN+FR), registered in `NAMESPACES` + both resource maps, strict parity (reuse Phase-2's flatten-diff verify). Extending `dashboard` would bloat an unrelated translator file.

5. **Column-visibility persistence — Question 7.**
   - Known: privacy invariant forbids `localStorage` of dataset rows; column ids are UI prefs, not dataset rows; ALC-03 establishes URL-hash as the sanctioned non-localStorage persistence pattern for sliders.
   - Recommendation: **ephemeral in-memory** (component `useState`, gone on reload). It keeps the privacy boundary crisp (no per-table localStorage keys to reason about) and INV-06 has no persistence clause. If persistence is later wanted, URL-hash (the ALC-03 pattern) — never `localStorage`. UI-SPEC input.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@tanstack/react-table` | INV-02/03/04/06 | ✗ (not yet installed) | target 8.21.3 | none — must `npm install` |
| `@tanstack/react-virtual` | INV-01/02/03/04 | ✗ (not yet installed) | target 3.13.24 | none — must `npm install` |
| npm registry reachable at install time | install step | ✓ (verified via `npm view`) | — | — |
| `semgrep` (MCP or CLI) for generated-code scan | CLAUDE.md gate | unknown (prior phases: MCP unavailable) | — | CLI `npx semgrep` / note-and-defer as 01-04 did |
| Synthetic 10k-VM fixture | ROADMAP success #1/#2 stress | ✗ (must be written; real fixtures ≤249 VMs) | — | extrapolation only (weaker — generate the fixture) |

**Missing dependencies with no fallback:** the two TanStack packages — a plain `npm install` (registry verified reachable).
**Missing dependencies with fallback:** semgrep (degrade to CLI or note-and-defer, precedent 01-04); the 10k fixture (must be generated — write a `scripts/generate-inventory-stress-fixture.mjs` or an in-test synthetic builder; do NOT ship it in the app bundle, mirror `scripts/generate-mib-canary.mjs`).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`. Section intentionally omitted per instructions.

## Security Domain

> `security_enforcement` is not set in config (`features: {}`); CLAUDE.md asks for `semgrep scan` of generated code. Phase 3 introduces **no** network, auth, file-upload, or schema surface (render-only React over in-memory data; CSV export is a client-side Blob — no fetch). The Phase-1 fetch/XHR/WS/Beacon runtime guard + CSP `connect-src 'self'` already cover the new TanStack deps.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | None — no auth surface. |
| V3 Session Management | no | None. |
| V4 Access Control | no | None — single-user client app. |
| V5 Input Validation | low | Data already Zod-validated at the Phase-1 parser boundary; Phase 3 only displays it. No new input. |
| V6 Cryptography | no | None. |

**Known threat patterns for this stack:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSV-injection (formula `=`/`+`/`-`/`@` prefix opened in Excel) | Tampering | Low risk (RVTools data, not user-authored) but cheap: prefix-guard a leading `=+-@` with `'` in `csvCell`. Recommend the ~1-line guard — VM names/annotations are upstream-influenceable; no downside. |
| VM names/annotations rendered into the DOM | Tampering / XSS | React escapes text children by default — render all cell values as React text. Never feed row data into an element's raw-HTML sink. `oneLine` is a pure text transform. |
| Table-state "persistence convenience" writing row-derived data to `localStorage` | Info disclosure (privacy invariant) | Keep sort/filter/visibility ephemeral (Open Q5); no persistence of any row-derived state. |
| Supply chain (new deps) | Tampering | Pin `@tanstack/*`; keep `check:supply-chain` green; no `papaparse`-class CSV dependency added (in-repo serializer). |

## Sources

### Primary (HIGH confidence)
- `npm view @tanstack/react-table version` → `8.21.3` (modified 2026-05-14); peer `react >=16.8` — verified this session
- `npm view @tanstack/react-virtual version` → `3.13.24` (modified 2026-05-11); peer `react ^19.0.0` — verified this session
- Codebase read directly: `src/types/estate.ts`, `src/types/{snapshot,vinfo,vhost}.ts`, `src/hooks/useEstateView.ts`, `src/App.tsx`, `src/i18n/index.ts`, `src/store/snapshotStore.ts`, `scripts/check-bundle-size.mjs`, `02-02/02-03/01-04-SUMMARY.md`, ROADMAP/PITFALLS/ARCHITECTURE/FEATURES/STACK
- Filesystem scans: `vsizer/src` has no `*csv*` and zero `@tanstack/*` (port assumption disproved)
- [TanStack Table v8 — Expanding guide](https://tanstack.com/table/v8/docs/guide/expanding)
- [TanStack Table v8 — Virtualized Rows example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows)
- [TanStack Table v8 — Column Visibility API](https://tanstack.com/table/v8/docs/api/features/column-visibility)

### Secondary (MEDIUM confidence)
- [TanStack Table v8 — Virtualization guide](https://tanstack.com/table/v8/docs/guide/virtualization) (TanStack ships no virtualization itself; compose with react-virtual)
- [Building a High-Performance Virtualized Table with TanStack — Medium/Ashwin Rishi](https://medium.com/@ashwinrishipj/building-a-high-performance-virtualized-table-with-tanstack-react-table-ced0bffb79b5) (proven to ~50k rows; FEATURES.md cited)

### Tertiary (LOW confidence)
- None relied upon for prescriptive claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions npm-verified this session, React-19 peers confirmed, architecture mandates the libs by name
- Architecture/patterns: HIGH — derived from direct reads of the actual `EstateView`/`Snapshot` contracts + TanStack official docs; the flat-tree recipe is the documented large-tree pattern
- Pitfalls: HIGH — Pitfall 1 & 2 verified by reading types and scanning vsizer; the performance pitfall is grounded in Phase-1's measured timings
- Open questions: MEDIUM — Datacenter level and inventory mount point are genuine product/UX decisions for the planner/UI-SPEC, not research gaps

**Research date:** 2026-05-16
**Valid until:** ~2026-06-15 (TanStack v8/v3 are stable, slow-moving; re-verify versions if planning slips a month)

## Recommended Plan Decomposition (planner may override)

Respect dependency order infra → tables → tree-shell (worktrees unavailable this session → sequential; decomposition already honors that):

- **Plan 03-01 — Shared table infrastructure.** `npm install` both TanStack deps; net-new `utils/csv.ts` + `utils/oneLine.ts` (pure, unit-tested, ≥75% coverage gate per ADR-0005); generic `<DataTable>` (headless table state, virtualised body, sort headers, global debounced filter, `<ColumnPicker>` for INV-06, CSV-of-filtered-visible-view primitive for INV-05). Add `VmDisplayRow` type + extend `buildEstateView`/`EstateView` with the pure `vmRows` projection (still one `useMemo`). **Bundle gate:** the TanStack chunk is separate from the gated echarts chunk; recommend a sibling assertion (extend `check-bundle-size.mjs` or a tiny new gate) — propose **≤60 KB gz** for the combined `@tanstack/*` (generous headroom; tighten after first production build). `[ASSUMED size — A6: confirm against first build, mirror the echarts-gate pattern in check-bundle-size.mjs]`
- **Plan 03-02 — The three object tables.** `vmColumns`/`esxColumns`/`datastoreColumns` ColumnDefs; wire VM table to projected `vmRows`, ESX table to `EstateView.hosts`, datastore table to `EstateView.datastores` (verbatim — no re-derivation, NAA dedupe preserved). `oneLine` at display for any annotation column; CSV exports raw values. Per-table column-visibility defaults (~8 visible, rest opt-in); identity columns `enableHiding:false`.
- **Plan 03-03 — Virtualised tree + shell + i18n + integration + 10k stress.** Flat-visible-array tree with lazy children + react-virtual; inventory shell with sub-tabs; segmented Dashboard↔Inventory switch in `App.tsx` (reuse the toggle idiom); new `inventory` i18n namespace EN+FR (flatten-diff parity); synthetic 10k-VM fixture (scripts, not bundled) + perf assertions for ROADMAP success #1 (expand/collapse stays responsive — assert via bounded rendered-row-window count in jsdom, since fps is not measurable there) and #2 (sort <200 ms on 10k).
