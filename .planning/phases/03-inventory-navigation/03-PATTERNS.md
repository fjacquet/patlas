# Phase 3: Inventory Navigation - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 20 (create/modify)
**Analogs found:** 17 / 20 (3 net-new with no in-repo analog: TanStack DataTable, virtualised tree, CSV serializer — anchored on RESEARCH recipes)

> All analogs are SHIPPED vatlas `src/` — vatlas is its own codebase. vsizer reuse for csv/table is **void** (RESEARCH Pitfall 2: no `*csv*`, zero `@tanstack/*` in vsizer). Anchor on the vatlas idioms below + RESEARCH §Code Examples for the TanStack-specific shape.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useEstateView.ts` (MODIFY) | hook | transform | itself (line 17-20) | exact (extend, don't add memo) |
| `src/engines/aggregation/estateView.ts` (MODIFY) | engine/util | transform (projection) | itself (line 29-68) | exact |
| `src/types/estate.ts` (MODIFY) | type | — | `EsxAggregate` (line 237-254) | exact |
| `src/utils/csv.ts` (NEW) | util | transform | `src/utils/format.ts` (pure-fn idiom) | role-match (logic = RESEARCH §Pattern 3) |
| `src/utils/oneLine.ts` (NEW) | util | transform | `src/utils/format.ts` | role-match |
| `src/components/inventory/DataTable.tsx` (NEW) | component | request-response (UI state) | RESEARCH §Pattern 1 + §virtualised-rows | NO in-repo analog |
| `src/components/inventory/InventoryTree.tsx` (NEW) | component | event-driven (expand) | RESEARCH §Pattern 2 | NO in-repo analog |
| `src/components/inventory/columns/{vm,esx,datastore}Columns.ts` (NEW) | util/config | — | `src/types/estate.ts` field lists | role-match (shape only) |
| `src/components/inventory/{Vm,Esx,Datastore}Table.tsx` (NEW) | component | CRUD-read | `GlobalDashboard.tsx` (props-from-view) | role-match |
| `src/components/inventory/ColumnPicker.tsx` (NEW) | component | event-driven | `ThemeToggle.tsx` (a11y/button idiom) | partial |
| `src/components/inventory/InventoryView.tsx` (NEW) | component | request-response | `GlobalDashboard.tsx` (line 48-87) | exact (shell pattern) |
| `src/components/ViewToggle.tsx` (NEW) | component | event-driven | `AccountingModeToggle.tsx` (line 32-83) | **exact** |
| `src/App.tsx` (MODIFY) | component | — | itself (line 28-37) | exact |
| `src/i18n/index.ts` (MODIFY) | i18n | — | itself (line 24-38) | exact |
| `src/i18n/locales/{en,fr}/inventory.json` (NEW) | i18n | — | `locales/en/dashboard.json` | exact |
| `scripts/generate-inventory-10k.mjs` (NEW) | script | — | `scripts/generate-mib-canary.mjs` | exact |
| `scripts/check-bundle-size.mjs` (MODIFY) | infra | — | itself (line 47-85) | exact |
| `*.test.tsx` / `*.test.ts` (NEW) | test | — | `AccountingModeToggle.test.tsx`, `estateView.test.ts` | exact |

---

## Pattern Assignments

### `src/hooks/useEstateView.ts` (MODIFY — hook, transform) — CRITICAL: NO second useMemo

**Analog:** itself. The hook is structurally UNCHANGED. The VmDisplayRow projection rides inside `buildEstateView`, not here.

**The exact insertion contract** — `useEstateView.ts:17-20` stays byte-identical:

```typescript
export function useEstateView(mode: AccountingMode): EstateView {
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  return useMemo(() => (snapshot ? buildEstateView(snapshot, mode) : EMPTY_VIEW), [snapshot, mode])
}
```

The doc comment at lines 6-16 already states "the project's SINGLE sanctioned `useMemo` site". **Do not add `useInventoryRows`, do not add a second `useMemo`, do not add a `useMemo` in any table/tree component.** TanStack sort/filter/visibility = component `useState` (RESEARCH Anti-Pattern "a second useMemo-aggregation site").

**Deviation:** none to this file. `EstateView` grows a `vmRows` field; the memo just memoizes a slightly larger object (RESEARCH Data Source §, line 344).

---

### `src/engines/aggregation/estateView.ts` (MODIFY — engine, pure projection)

**Analog:** itself. This is where the VmDisplayRow projection inserts.

**Exact insertion point** — inside `buildEstateView`, alongside the existing `for (const vm of snapshot.vinfo)` loop at `estateView.ts:50-56` (reuse the SAME single pass — do not add a second iteration):

```typescript
// existing loop, estateView.ts:48-56
const osBreakdown = emptyBreakdown()
const vmsByCluster = new Map<string, OsBreakdown>()
for (const vm of snapshot.vinfo) {
  const family = classifyOsFamily(vm.osConfig, vm.osTools)
  osBreakdown[family] += 1
  const perCluster = vmsByCluster.get(vm.cluster) ?? emptyBreakdown()
  perCluster[family] += 1
  vmsByCluster.set(vm.cluster, perCluster)
}
```

**Required deviation:** add a `vmRows` accumulator populated in this same loop (1:1 projection — filter/map, NEVER group/sum), and add `vmRows` to the returned object literal at `estateView.ts:58-67` AND to `EMPTY_VIEW` at `estateView.ts:75-84` (mirror `hosts: Object.freeze([]) as never[]`). Projection = lean subset of `VInfoRow` (RESEARCH line 207, 344): `{ vmName, cluster, host, vcpu, vramMib, os: osTools||osConfig, poweredOn, provisionedMib }`. This is the same operation-class as the existing `classifyOsFamily` call already in this loop — a reshape, not an estate-fact computation (RESEARCH A2). KISS placement note (RESEARCH A2): a tiny `projectVmRows(snapshot)` helper file is fine if preferred; behaviourally identical.

---

### `src/types/estate.ts` (MODIFY — type)

**Analog:** `EsxAggregate` interface, `estate.ts:237-254` (lean per-row display interface — closest shape to VmDisplayRow).

**Pattern to copy** (doc-comment + flat branded fields, `estate.ts:231-254`):

```typescript
/**
 * Per-ESX-host rollup (DSH-01 + Phase-3 inventory tree consumer). ...
 */
export interface EsxAggregate {
  hostName: string
  cluster: string
  sockets: Sockets
  cores: Cores
  ...
}
```

**Required deviation:** add `export interface VmDisplayRow` (lean ~8-field subset of `VInfoRow` — see `vinfo.ts:13-44` for field source/branding: `vcpu: Cores`, `vramMib: MiB`, `provisionedMib: MiB` are branded; `vmName/cluster/host/os` are `string`; `poweredOn: boolean`). Add `vmRows: VmDisplayRow[]` to `EstateView` (`estate.ts:279-291`), placed next to `hosts`/`datastores`. Doc-comment must state "pure projection of `Snapshot.vinfo`, not an aggregation" (lineage discipline matches every other interface here). RESEARCH recommends a new `src/types/inventory.ts` is acceptable — but `estate.ts` is the established home for the `EstateView` contract; prefer extending it.

---

### `src/utils/csv.ts` (NEW — util, pure transform) — NO in-repo analog; logic is RESEARCH §Pattern 3

**Analog (idiom only):** `src/utils/format.ts:1-21` — the pure-fn module idiom: top-of-file doc-comment explaining provenance + lineage, named `export const`/`export function`, bare values, em-dash/empty sentinels, zero React/i18n imports, fully unit-testable.

**Exact code to write** (RESEARCH §Pattern 3, lines 213-224 + CSV-injection guard, RESEARCH line 422):

```typescript
function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)            // raw value, NO locale formatting
  if (/^[=+\-@]/.test(s)) s = `'${s}`            // CSV-injection guard (RESEARCH Security)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}
```

**Required deviation from format.ts:** `format.ts` is locale-AWARE display; `csv.ts` is the OPPOSITE — raw values, NO `toLocaleString`, newlines PRESERVED (RESEARCH Anti-Pattern "Formatting numbers in the CSV", Pitfall 4). Keep the format.ts header-comment style stating this contrast explicitly. ≥75% coverage gate (ADR-0005, RESEARCH line 460).

---

### `src/utils/oneLine.ts` (NEW — util, pure transform)

**Analog (idiom):** `src/utils/format.ts` (same pure-module idiom; could fold into a display helper but RESEARCH §structure lists it separate).

**Exact code** (RESEARCH Pitfall 4, line 281):

```typescript
export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()
```

**Required deviation:** applied ONLY at the table cell-render boundary (display); the CSV path passes the ORIGINAL value to `toCsv`. Two deliberate code paths (RESEARCH Pitfall 4). Full original text goes into the cell `title` attribute (UI-SPEC §Three object tables: "full text in title attribute").

---

### `src/components/inventory/DataTable.tsx` (NEW — generic, 3 consumers) — NO in-repo analog

**Analog:** none in repo (no TanStack usage anywhere). Anchor: RESEARCH §Pattern 1 (lines 172-195) + §Virtualised rows (lines 323-331). For React structure/className conventions copy `GlobalDashboard.tsx`/`AccountingModeToggle.tsx` (Tailwind `dark:` twin on every color utility, `.panel` for the panel surface, `focus-visible:ring-2 focus-visible:ring-primary-500`).

**Core pattern to copy** (RESEARCH lines 175-193):

```typescript
const table = useReactTable({
  data, columns,
  state: { sorting, columnFilters, globalFilter, columnVisibility },
  onSortingChange: setSorting,
  onColumnVisibilityChange: setColumnVisibility,
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
const { rows } = table.getRowModel()
const rowVirtualizer = useVirtualizer({
  count: rows.length, getScrollElement: () => scrollRef.current,
  estimateSize: () => 36, overscan: 12,
})
```

**Required deviations / contract:**

- Generic `<T,>` component: props `{ data: T[], columns: ColumnDef<T>[], headerFor: (id) => string }`. Single component, 3 consumers — DRY-justified (RESEARCH line 90).
- Sort/filter/visibility state = local `useState` (NOT `useMemo` — see useEstateView rule).
- Fixed row height 36px (RESEARCH line 195 — no measured/variable rows).
- Global filter debounced 150 ms (RESEARCH Pattern 4, line 228).
- Sticky header + sticky first column on secondary `.panel` surface; active sort header uses accent gold (UI-SPEC §Color reserved list, §Three object tables).
- Cell values rendered as React text children only — never raw-HTML sink (RESEARCH Anti-Pattern, Security line 423). `oneLine()` at the cell boundary; original in `title`.
- Exposes the CSV-of-current-view primitive: `table.getVisibleLeafColumns()` × `table.getFilteredRowModel().rows` → `toCsv` → Blob/anchor/`revokeObjectURL` (RESEARCH §Pattern 3 lines 305-319). Filename `vatlas-{object}-{YYYYMMDD}.csv` (UI-SPEC §CSV export).
- `import { flexRender, useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table'` + `import { useVirtualizer } from '@tanstack/react-virtual'`.

---

### `src/components/inventory/InventoryTree.tsx` (NEW — virtualised tree) — NO in-repo analog

**Analog:** none. Anchor: RESEARCH §Pattern 2 "Flatten-tree-to-rows + lazy children (the 10k recipe)" (lines 197-207). React/Tailwind conventions from `GlobalDashboard.tsx`.

**The flatten-visible recipe (extracted verbatim from RESEARCH lines 202-207):**

1. Pre-index ONCE in the same `useEstateView` projection (NOT a new memo): `clustersOrdered: string[]` (from `EstateView.clusters`), `hostsByCluster: Map<cluster, EsxAggregate[]>` (group `EstateView.hosts` by `.cluster`), `vmsByHost: Map<hostName, VmDisplayRow[]>` (group projected `vmRows` by `.host`).
2. Component state: `expanded: Set<string>` of node ids (`cl:<name>`, `esx:<name>`).
3. `buildVisibleRows(expanded)`: walk clusters → push cluster row; if cluster ∈ expanded push its hosts; if host ∈ expanded push its VMs → returns `FlatNode[]` whose length ≈ only-opened (lazy children — children included ONLY when parent id ∈ expandedSet).
4. `useVirtualizer({ count: flat.length, estimateSize: () => 36, overscan: 12 })` → render window only; indent by `node.depth` via `paddingLeft` (16px/level — UI-SPEC §Spacing).

**Required deviations:**

- Tree hierarchy = synthetic vCenter root (`Snapshot.vCenterLabel`) → Cluster → ESX → VM. NO Datacenter level (RESEARCH A1 / Open Q2; UI-SPEC §Inventory layout). Root label key `inventory.tree.root`.
- DO NOT use TanStack `getExpandedRowModel()` — it materializes the full subtree (RESEARCH Anti-Pattern, line 234; verified TanStack-docs claim line 201).
- `buildVisibleRows` is render-derived presentation state, NOT aggregation — a local `useMemo` keyed on `expanded` is acceptable render-memoization (RESEARCH line 199) OR a plain call; it does NOT violate the one-useMemo rule (that rule is about *aggregation*).
- Chevron rotates 90°, `aria-expanded`; count badge Caption size on secondary surface, never em-dash (count always known, 0 shows `0`) — UI-SPEC §Virtualised tree.
- Selecting a node scopes the active table (root = unscoped); selected row uses accent indicator (UI-SPEC §Inventory layout).
- Never hold a parallel tree-of-objects; flat array derived on demand (RESEARCH Critical-5 memory budget, line 207).

---

### `src/components/inventory/columns/{vm,esx,datastore}Columns.ts` (NEW — ColumnDef config)

**Analog:** field lists from `src/types/estate.ts` — `EsxAggregate` (`estate.ts:237-254`), `DatastoreAggregate` (`estate.ts:211-229`), and `VmDisplayRow` (new). Header text via i18n `inventory.col.<field>`.

**Required deviations:**

- `esxColumns: ColumnDef<EsxAggregate>[]` — consume `EstateView.hosts` verbatim (INV-03, no projection).
- `datastoreColumns: ColumnDef<DatastoreAggregate>[]` — consume `EstateView.datastores` verbatim; NO cluster column; do NOT re-derive (RESEARCH Anti-Pattern line 232, Pitfall NAA dedupe, Open Q3).
- `vmColumns: ColumnDef<VmDisplayRow>[]` — bound to projected `vmRows`; reference ONLY VmDisplayRow fields (RESEARCH Pitfall 1 warning sign — never reference `OsBreakdown` fields).
- Each table: ~8 default-visible columns, rest opt-in; identity columns (vmName / hostName / datastore key) `enableHiding: false` (RESEARCH §Column visibility line 299).
- Number cells format via the inherited `src/utils/format.ts` formatters for DISPLAY only; CSV uses raw values (RESEARCH Pitfall 4). Absent data → em-dash `—` sentinel (UI-SPEC; matches `format.ts` non-finite behavior).

---

### `src/components/inventory/{Vm,Esx,Datastore}Table.tsx` (NEW — wire DataTable to view)

**Analog:** `GlobalDashboard.tsx:48-87` — the "single `useEstateView` caller, children get derived `EstateView` as plain props" pattern.

**Pattern to copy** (`GlobalDashboard.tsx:48-52, 79-82`):

```typescript
const view = useEstateView(mode)
...
<GlobalSummaryCard globals={view.globals} mode={mode} />
<PerClusterColumns clusters={view.clusters} vmsByCluster={view.vmsByCluster} />
```

**Required deviation:** these are thin wrappers — pick `view.vmRows` / `view.hosts` / `view.datastores`, pass with the matching column module into `<DataTable>`. Do NOT call `useEstateView` per-table (the shell calls it once and passes props down — same lift discipline as `GlobalDashboard`; RESEARCH Pattern 4 line 228 "do not lift filter state above InventoryPanel" — but DO lift the `view` source). No `useMemo`.

---

### `src/components/inventory/ColumnPicker.tsx` (NEW — show/hide popover, INV-06)

**Analog:** `ThemeToggle.tsx:75-108` / `AccountingModeToggle.tsx:32-83` for the a11y button-list + Tailwind idiom (checkbox list instead of segmented buttons).

**Pattern to copy** (RESEARCH §Column visibility, lines 293-300):

```typescript
// table.getAllLeafColumns().filter(c => c.getCanHide())
//   → checkbox calling column.toggleVisibility()
```

**Required deviations:** popover anchored to a "Columns" toolbar button (icon + Label); default columns pre-checked; "Reset" restores default set; keyboard-operable, closes on Escape / outside click, applies immediately (UI-SPEC §Column-picker). Visibility state ephemeral in-memory only — NO `localStorage` (RESEARCH Anti-Pattern line 235, Open Q5; privacy invariant). Every color utility carries its `dark:` twin (copy `AccountingModeToggle.tsx:58,69-73`).

---

### `src/components/inventory/InventoryView.tsx` (NEW — shell: tree pane + tabbed tables)

**Analog:** `GlobalDashboard.tsx:48-87` — region root that owns the only lifted `useState`, calls `useEstateView` once, renders states (empty/error), wraps in a scoped `<ErrorBoundary>`.

**Pattern to copy** (`GlobalDashboard.tsx:48-66, 69-87`): the `DashboardError` message-only fallback (reads ONLY `error.message`/`error.name` — never stack/cause, privacy; `GlobalDashboard.tsx:19-30`), the no-snapshot empty `<section className="panel">` block, the `<main className="flex-1 overflow-y-auto p-8"><ErrorBoundary FallbackComponent=...>` wrapper.

**Required deviations:** two-pane layout — left virtualised tree (`.panel`), right tabbed object-table area, gap 32px/xl (UI-SPEC §Inventory layout). Inner sub-tab strip (VM | ESX | Datastore) reuses the `AccountingModeToggle` `aria-pressed` idiom. Owns: tree-selection scope state, active-tab state, the single `view = useEstateView(mode)` call (props down). Uses `useTranslation('inventory')`. States per UI-SPEC §Copywriting (empty/loading/error, em-dash sentinels).

---

### `src/components/ViewToggle.tsx` (NEW — Dashboard↔Inventory) — STRONGEST analog

**Analog:** `AccountingModeToggle.tsx:32-83` — copy this almost verbatim (it is already the controlled 2/3-segment `aria-pressed` reuse of the `ThemeToggle` idiom; RESEARCH Open Q1, UI-SPEC §Dashboard↔Inventory toggle).

**Exact idiom to copy** (`AccountingModeToggle.tsx:52-82`):

```typescript
<fieldset
  role="group"
  aria-label={label}
  onKeyDown={onKeyDown}
  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900"
>
  <legend className="sr-only">{label}</legend>
  {MODES.map((mode) => {
    const active = value === mode
    return (
      <button key={mode} type="button" onClick={() => onChange(mode)}
        className={`... focus-visible:ring-2 focus-visible:ring-primary-500 ${
          active ? 'bg-primary-600 text-white' : 'text-slate-500 ... dark:text-slate-400 ...'}`}
        aria-pressed={active} ...>
```

Also keep the keyboard `move(delta)` + `onKeyDown` Arrow-Left/Right/Up/Down wrap-around handler (`AccountingModeToggle.tsx:36-50`) and the `biome-ignore lint/a11y/noRedundantRoles` comment on `role="group"` (line 54 — a CI grep gate asserts its literal presence).

**Required deviations:** 2 segments (`dashboard` | `inventory`) instead of 3 modes; default segment `dashboard`; i18n keys `inventory.nav.dashboard` / `inventory.nav.inventory` via `useTranslation('inventory')`; controlled `value`/`onChange` (lift state to `App.tsx`). Active segment = accent gold (UI-SPEC §Color reserved list — confirm token vs. `bg-primary-600`; UI-SPEC says "accent gold", AccountingModeToggle uses `bg-primary-600` — follow the UI-SPEC accent for the active *view* segment).

---

### `src/App.tsx` (MODIFY — mount toggle + view switch)

**Analog:** itself, `App.tsx:13-42`.

**Pattern to copy** — the `hasSnapshots ? <sidebar+content> : <UploadZone>` branch (`App.tsx:28-37`) and the header toolbar (`App.tsx:21-27`).

**Required deviation:** add `const [activeView, setActiveView] = useState<'dashboard'|'inventory'>('dashboard')` (component `useState`, mirrors `GlobalDashboard`'s lifted mode — NOT a memo). Place `<ViewToggle value={activeView} onChange={setActiveView} />` in the header `<div className="flex items-center gap-2">` (left of LanguageToggle/ThemeToggle per UI-SPEC §toggle placement "leading edge of the primary toolbar"). Inside the `hasSnapshots` branch, render `<SnapshotListSidebar/>` + (`activeView === 'inventory' ? <InventoryView/> : <GlobalDashboard/>`). Keep the top-level `<ErrorBoundary FallbackComponent={FallbackError}>` net. No router (RESEARCH A5).

---

### `src/i18n/index.ts` (MODIFY) + `locales/{en,fr}/inventory.json` (NEW)

**Analog:** `i18n/index.ts:24-38` (namespace registration) + `locales/en/dashboard.json:1-51` (key-shape mirror).

**Exact registration deviation** (3 edits, copy the `dashboard` lines):

- `index.ts:24` — `export const NAMESPACES = ['common', 'upload', 'dashboard', 'inventory'] as const`
- `index.ts:5-10` — add `import enInventory from './locales/en/inventory.json'` + fr twin
- `index.ts:27-38` — add `inventory: enInventory` to `resources.en`, `inventory: frInventory` to `resources.fr`

**JSON shape** (mirror `dashboard.json` nesting — `nav`, `tab`, `tree`, `filter`, `columns`, `export`, `table`, `col`, `states` per UI-SPEC §i18n lines 154-165). No pre-formatted numbers in strings; no editorial verbs (`recommend|should|healthy|critical` — lint/grep gate, RESEARCH line 27). **Author EN+FR together with strict key parity** — reuse Phase-2's flatten-diff parity check in the verify gate (RESEARCH Pitfall 5, line 288).

---

### `scripts/generate-inventory-10k.mjs` (NEW — synthetic 10k fixture)

**Analog:** `scripts/generate-mib-canary.mjs:1-99` — exact structural template (shebang, header-comment explaining purpose + determinism + git-commit policy, `XLSX.set_fs(fs)`, `dirname(fileURLToPath)` → `src/__fixtures__`, AoA sheets `vInfo`/`vHost`/`vMetaData`, `XLSX.writeFile(..., { bookType:'xlsx', compression:false })` for byte-stable output, `console.warn` final line).

**Required deviations:** generate ~10 000 deterministic `vInfo` rows (loop with a seeded counter — vmName/cluster/host/cpu/memory varied for realistic sort/filter; include one multi-line annotation row to exercise oneLine/CSV Pitfall 4) + proportional vHost rows. Add an `npm run generate-inventory-10k` script to `package.json` mirroring `generate-mib-canary` (line 13). Fixture is NOT bundled in the app — generated for tests/stress only (RESEARCH line 400, Environment table).

---

### `scripts/check-bundle-size.mjs` (MODIFY — TanStack chunk gate)

**Analog:** itself, `check-bundle-size.mjs:36-85` (the marker-scan + gzip-size assertion pattern).

**Pattern to copy** — the `jsChunks.map(read).filter(marker).forEach(gzipSync ≤ MAX)` block (`check-bundle-size.mjs:47-85`). The echarts gate stays untouched (RESEARCH line 460: "the TanStack chunk is separate from the gated echarts chunk").

**Required deviation:** add a sibling marker-scan for `@tanstack` (marker substring `tanstack`) with proposed `MAX_GZIP_BYTES = 61440` (60 KiB — RESEARCH line 460, A6: generous headroom, tighten after first production build). Same "no chunk found → exit 0 nothing-to-gate-yet" graceful behaviour as `check-bundle-size.mjs:56-61`.

---

### Test files (NEW — `*.test.tsx` / `*.test.ts`)

**Analogs:**

- Component tests → `src/components/dashboard/AccountingModeToggle.test.tsx:1-64`: `describe`/`it`/`expect` from vitest, `render`/`screen` from `@testing-library/react`, `userEvent`, `beforeEach(() => i18n.changeLanguage('en'))`, `getByRole('group')`/`getByText`, `aria-pressed` assertions, the non-editorial-copy guard `expect(title).not.toMatch(/recommend|should|good|bad|healthy/i)`.
- Pure-fn tests (csv/oneLine) → `src/engines/aggregation/estateView.test.ts:1-30` idiom: typed fixture builders (`const host = (over: Partial<VHostRow>) => ({...})`), branded-unit constructors (`cores`, `mib`, `mhz`), `buildEstateView`/`EMPTY_VIEW` direct calls. ≥75% coverage (ADR-0005).
- Array narrowing under `noUncheckedIndexedAccess` → `src/test/arrays.ts` `first()` helper.

**Required deviations / required net-new tests (RESEARCH line 462):**

- 10k-stress test: load the synthetic fixture, assert sort < 200 ms on 10k (ROADMAP success #2) and a bounded rendered-row-window count in jsdom for tree expand/collapse (fps not measurable in jsdom — assert window size, RESEARCH line 462).
- CSV-of-filter test: filter → hide a column → assert `toCsv` output = filtered rows × visible columns only, raw values, newline preserved & RFC-4180 quoted (INV-05 × INV-06).
- Tree-virtualisation test: lazy children — assert collapsed parent's children are NOT in the flat array; expand → present.
- i18n parity: reuse Phase-2 flatten-diff EN↔FR check in the verify gate.

---

## Shared Patterns

### Segmented-control aria-pressed idiom (ViewToggle + inner table tabs + ColumnPicker)

**Source:** `src/components/dashboard/AccountingModeToggle.tsx:52-82` (which itself reuses `src/components/ThemeToggle.tsx:80-106`)
**Apply to:** `ViewToggle.tsx`, the VM|ESX|Datastore tab strip in `InventoryView.tsx`.

```typescript
<fieldset role="group" aria-label={label} onKeyDown={onKeyDown}
  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 text-sm dark:border-surface-700 dark:bg-surface-900">
  <legend className="sr-only">{label}</legend>
  {ITEMS.map((it) => (
    <button key={it} type="button" onClick={() => onChange(it)}
      className={`... focus-visible:ring-2 focus-visible:ring-primary-500 ${active ? 'bg-primary-600 text-white' : 'text-slate-500 ... dark:text-slate-400 ...'}`}
      aria-pressed={active}>{label}</button>
  ))}
</fieldset>
```

Keep the `move(delta)`/`onKeyDown` arrow-key wrap handler and the `biome-ignore lint/a11y/noRedundantRoles` comment (CI grep gate asserts literal `role="group"`).

### Pure-fn util module (csv, oneLine)

**Source:** `src/utils/format.ts:1-21` (header doc-comment w/ provenance + lineage; named exports; bare values; em-dash sentinel; zero React/i18n)
**Apply to:** `src/utils/csv.ts`, `src/utils/oneLine.ts`

### Scoped message-only ErrorBoundary (privacy)

**Source:** `src/components/dashboard/GlobalDashboard.tsx:19-30`
**Apply to:** `InventoryView.tsx`
Reads ONLY `error.message`/`error.name` — never `error`, `cause`, `stack` (leaks VM names/hostnames). Top-level `<ErrorBoundary>` in `App.tsx:19` stays the outer net.

### Single useEstateView caller, props down (NO per-component useMemo)

**Source:** `src/components/dashboard/GlobalDashboard.tsx:48-52, 79-82`
**Apply to:** `InventoryView.tsx` (the one caller) → `{Vm,Esx,Datastore}Table.tsx` / `InventoryTree.tsx` (plain props). TanStack sort/filter/visibility = component `useState`. The ONLY `useMemo` is `useEstateView.ts:19` (RESEARCH Anti-Pattern line 233; CLAUDE.md binding).

### Locale-aware display vs. raw data (Pitfall 4 — two deliberate paths)

**Source:** `src/utils/format.ts` (display) vs. RESEARCH §Pattern 3 (CSV raw)
**Apply to:** every numeric/annotation cell. Table cell → `format.ts` formatter + `oneLine()` + original in `title`. CSV → raw `row.getValue(colId)`, NO locale, newline preserved.

### Em-dash sentinel for absent data

**Source:** `src/utils/format.ts` (every formatter returns `'—'` on non-finite)
**Apply to:** all table cells (UI-SPEC §Copywriting: `—`, never `''`, never `"N/A"`). Tree count badges are the exception — count always known, `0` shows `0`.

---

## No Analog Found

| File | Role | Data Flow | Reason | Anchor instead |
|------|------|-----------|--------|----------------|
| `src/components/inventory/DataTable.tsx` | component | UI-state | Zero TanStack usage anywhere in repo (RESEARCH Pitfall 2) | RESEARCH §Pattern 1 + §virtualised-rows (lines 172-195, 323-331) |
| `src/components/inventory/InventoryTree.tsx` | component | event-driven | No tree/virtualisation prior art | RESEARCH §Pattern 2 flatten-visible recipe (lines 197-207) |
| `src/utils/csv.ts` | util | transform | vsizer port void; no csv anywhere | RESEARCH §Pattern 3 (lines 213-224) — but copy `format.ts` *module idiom* |

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/engines/aggregation/`, `src/types/`, `src/components/`, `src/components/dashboard/`, `src/utils/`, `src/i18n/`, `src/test/`, `scripts/`, `package.json`
**Files scanned:** 17 read in full + directory/grep scans of engines, store, package.json
**Key cross-cutting findings:**

- The one-`useMemo` rule (`useEstateView.ts:6-16`) is the single most load-bearing constraint — VmDisplayRow rides inside `buildEstateView`'s EXISTING `snapshot.vinfo` loop (`estateView.ts:50-56`), no new hook/memo.
- `EstateView` carries `hosts`/`datastores` (consume verbatim) but NOT VM rows — `vmsByCluster` is counts-only (`estate.ts:285`); VM table/tree need the new `vmRows` projection (RESEARCH Pitfall 1).
- `AccountingModeToggle.tsx` is a near-perfect ViewToggle/tab template (already the controlled `aria-pressed` reuse of `ThemeToggle.tsx`).
- vsizer csv/table reuse is void — all TanStack + CSV infra is net-new, anchored on RESEARCH §Code Examples not prior art.

**Pattern extraction date:** 2026-05-16
