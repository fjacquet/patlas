---
phase: 03-inventory-navigation
plan: 03
subsystem: inventory
tags: [inventory-tree, react-virtual, flatten-visible, lazy-children, inventory-shell, view-toggle, i18n-inventory, 10k-stress, tanstack-bundle-gate, inv-01, inv-02, inv-03, inv-04, inv-05, inv-06]
requires:
  - VmDisplayRow + EstateView.vmRows pure projection (03-01)
  - EstateView.hosts (EsxAggregate) / EstateView.datastores (DatastoreAggregate) verbatim Phase-2 output
  - DataTable<T> / ColumnPicker generic primitives + Vm/Esx/DatastoreTable thin wrappers (03-01/03-02)
  - ViewToggle controlled segmented control (03-01)
  - inventory i18n namespace EN+FR + 10k fixture generator (03-03 Task 1, prior commit 3708d81)
  - AccountingModeToggle aria-pressed segmented idiom + component-test idiom (Phase 2)
provides:
  - "InventoryTree (INV-01) — flatten-visible + @tanstack/react-virtual + lazy children; no getExpandedRowModel; bounded DOM window at 10k"
  - "InventoryView — single useEstateView caller; tree pane + tabbed VM/ESX/Datastore tables; tree-selection scopes the active table"
  - "App.tsx ViewToggle wiring — Dashboard↔Inventory switch; Phase-1 sidebar + Phase-2 dashboard untouched"
  - "LIVE @tanstack ≤60 KiB gz bundle gate (measured 17.0 KiB gz) — vendor-tanstack chunk + filename-based marker"
  - "10k-VM stress proof: sort <200ms (#2), bounded virtualised tree window (#1 proxy), filtered-CSV newline-preserved light+dark (#4)"
affects:
  - "Phase 4+ (multi-vCenter / analytics) consume the inventory shell as the established browsable surface; no new engines added"
tech-stack:
  added: []
  patterns:
    - "Flatten-VISIBLE-rows recipe: children materialised ONLY when parent id ∈ expanded Set; flat array derived on demand, no parallel tree-of-objects (Critical-5 / T-03-10)"
    - "Tree/shell state is component useState only — expansion/selection/tab/mode never browser-persisted (T-03-11)"
    - "Single useEstateView caller (InventoryView) → InventoryTree/tables receive plain props (GlobalDashboard lift discipline; project's only useMemo stays useEstateView)"
    - "Plain index helpers (indexHostsByCluster/indexVmsByHost/orderClusters) are render-derived shaping, NOT aggregation — no new useMemo"
    - "vendor-tanstack manualChunks + filename-based bundle marker so the LIVE gate can MEASURE the chunk (minification strips the literal pkg string)"
    - "jsdom virtualiser test infra: offsetHeight/offsetWidth/getBoundingClientRect/ResizeObserver stubbed to a deterministic non-zero viewport in src/test/setup.ts"
key-files:
  created:
    - src/components/inventory/InventoryTree.tsx
    - src/components/inventory/InventoryView.tsx
    - src/components/inventory/InventoryTree.test.tsx
    - src/__tests__/inventory-stress.test.tsx
  modified:
    - src/App.tsx
    - src/__tests__/e2e-smoke.test.tsx
    - src/components/inventory/DataTable.csv.test.tsx
    - src/test/setup.ts
    - vite.config.ts
    - scripts/check-bundle-size.mjs
decisions:
  - "Tree hierarchy = synthetic vCenter root → Cluster → ESX → VM (NO Datacenter level — 03-RESEARCH A1 / UI-SPEC §Inventory layout); ROADMAP Phase-3 detail text still names a Datacenter level but the approved design (UI-SPEC + PLAN) drops it — implemented per the approved design"
  - "buildVisibleRows is a plain call (no useMemo) — render-derived presentation shaping, not aggregation; window cost is bounded (03-RESEARCH line 199)"
  - "[Rule 3] vendor-tanstack manualChunks split + filename-based bundle marker added so the LIVE @tanstack gate the plan mandates can actually MEASURE (minification strips '@tanstack' from the merged index chunk → content-scan was a permanent no-op); gate NOT widened — measured 17.0 KiB gz ≪ 60 KiB"
  - "[Rule 3] jsdom layout stubs (offsetHeight/getBoundingClientRect/ResizeObserver) added to src/test/setup.ts — @tanstack/virtual-core measures via element.offsetHeight which jsdom hard-codes to 0, collapsing every virtualised window to zero rendered rows"
  - "[Rule 1] DataTable.csv.test.tsx toolbar queries updated key→EN copy — Task 1 (committed 3708d81) registered the inventory i18n namespace, so t('export.csv') now resolves to 'Export CSV' not the raw key the 03-01-era test matched"
metrics:
  duration: "~50min (continuation: Tasks 2-3 + closeout this session; Task 1 prior commit 3708d81)"
  completed: 2026-05-16
  tasks: 3
  files: 10
---

# Phase 3 Plan 3: Inventory Tree + Shell Summary

The user-visible Phase-3 surface: a virtualised flatten-visible/lazy-children tree (vCenter → Cluster → ESX → VM), the inventory shell (tree pane + tabbed VM/ESX/Datastore tables, single `useEstateView` caller), the `App.tsx` Dashboard↔Inventory `ViewToggle` switch, and the 10k stress/e2e proofs — with the `@tanstack` bundle gate now LIVE in the production graph at a measured 17.0 KiB gz.

## What Was Built

- **Task 1 — inventory i18n + 10k fixture generator** (prior commit `3708d81`, this session consumed it): EN+FR `inventory.json` (strict key parity, zero editorial verbs), namespace registered in `i18n/index.ts`, `scripts/generate-inventory-10k.mjs` + `npm run generate-inventory-10k`. Reused verbatim — not recreated.
- **Task 2 — tree + shell + App wiring** (commit `2063267`):
  - `InventoryTree.tsx`: the 03-RESEARCH §Pattern 2 flatten-VISIBLE recipe. `buildVisibleRows(expanded)` walks pre-indexed maps and pushes a child row **only** when its parent id ∈ the `expanded` Set — collapsed parents never materialise children (Critical-5 / T-03-10). `@tanstack/react-virtual` windows the DOM; root opens by default; chevron rotates with `aria-expanded`; per-node count badge (`0` shows `0`, never em-dash); selection emits a `TreeSelection` scope. `getExpandedRowModel` is **not** used (grep-verified). No parallel tree-of-objects.
  - `InventoryView.tsx`: mirrors `GlobalDashboard` — the **single** `useEstateView(mode)` caller for the region, region-scoped `ErrorBoundary` reading only `error.message`/`error.name` (T-03-12), no-snapshot empty `.panel` state. Two-pane layout (`.panel` tree pane + tabbed table area, 32px/xl gap). Inner VM|ESX|Datastore tab strip reuses the `AccountingModeToggle` `<fieldset role="group"> + aria-pressed` idiom (DRY, literal `role="group"` + biome-ignore kept). Tree selection scopes VM/ESX tables to the node subtree (root/null = unscoped); Datastore is cluster-agnostic and never narrowed. Plain index helpers, no `useMemo`.
  - `App.tsx`: `activeView` `useState` (component state, not a memo), `<ViewToggle>` at the header toolbar leading edge (left of LanguageToggle/ThemeToggle), `activeView === 'inventory' ? <InventoryView/> : <GlobalDashboard/>` inside the `hasSnapshots` branch beside `<SnapshotListSidebar/>`. Top-level ErrorBoundary/Toaster + hero branch byte-equivalent.
- **Task 3 — tree/stress/e2e proofs + LIVE bundle gate** (commit `d8c4597`): `InventoryTree.test.tsx` (lazy children appear/disappear on expand/collapse, chevron `aria-expanded`, count badge `0`, selection scope incl. root=unscoped); `inventory-stress.test.tsx` (10k fixture via the real parse pipeline: sort by `provisionedMib` desc < 200 ms, bounded virtualised tree window ≪ total leaves, filtered-CSV with embedded newline RFC-4180-quoted under both light and dark); `e2e-smoke.test.tsx` extended (ViewToggle Dashboard↔Inventory with sidebar intact throughout).

## Deviations from Plan

Per the timed-out continuation: Task 1 was already committed (`3708d81`) and reused verbatim — the genuinely unfinished work was Tasks 2–3 and closeout, completed this session. Since the table primitives and ViewToggle already shipped (03-01/02), the TDD Task 3 went RED→GREEN with components in place (straight to GREEN after the infra fixes below).

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LIVE @tanstack bundle gate could not measure the chunk**
- **Found during:** Task 3 (running the LIVE bundle gate)
- **Issue:** The plan mandates the @tanstack ≤60 KiB gz gate go LIVE here, but `vite.config.ts` had no `manualChunks` rule for `@tanstack`, so TanStack folded into the merged `index-*.js`. `check-bundle-size.mjs` detected the chunk by scanning chunk **bytes** for the literal `@tanstack` — minification strips package names, so the gate was a permanent no-op ("no @tanstack chunk found"), not an actual measurement.
- **Fix:** Added a `vendor-tanstack` `manualChunks` rule (`node_modules/@tanstack` → its own chunk) and switched the bundle-size marker to **filename**-based detection (`vendor-tanstack-*.js`). The gate now measures the real chunk. **Gate NOT widened** — measured **17,414 bytes gz (17.0 KiB) ≪ 60 KiB**.
- **Files modified:** `vite.config.ts`, `scripts/check-bundle-size.mjs`
- **Commit:** `d8c4597`

**2. [Rule 3 - Blocking] @tanstack/react-virtual yields zero rows under jsdom**
- **Found during:** Task 3 (InventoryTree test RED)
- **Issue:** `@tanstack/virtual-core` measures the scroll element via `element.offsetHeight`, which jsdom hard-codes to a 0-returning getter. Every virtualised window (the tree, and now DataTable) collapsed to zero rendered rows in tests — the tree/stress/e2e assertions are untestable without a measured viewport.
- **Fix:** Added deterministic jsdom layout stubs to `src/test/setup.ts` (`offsetHeight`/`offsetWidth` getters, a `getBoundingClientRect` fallback, and a `ResizeObserver` shim) yielding a fixed non-zero viewport. Production is unaffected (real ResizeObserver supersedes). Also added `initialRect` to the tree's `useVirtualizer` for a deterministic first paint.
- **Files modified:** `src/test/setup.ts`, `src/components/inventory/InventoryTree.tsx`
- **Commit:** `d8c4597`

**3. [Rule 1 - Bug] Stale 03-01-era i18n-key queries in DataTable.csv.test.tsx**
- **Found during:** Task 3 (full `npm run test:run` regression)
- **Issue:** Task 1 (committed `3708d81`) registered the `inventory` i18n namespace. `DataTable.csv.test.tsx` (written at 03-02 when the namespace was unregistered) queried toolbar controls by the raw keys `/columns\.button/i` and `/export\.csv/i`; with the namespace live these now resolve to `Columns` / `Export CSV`, so the two tests failed.
- **Fix:** Updated the two stale query regexes to the resolved EN copy (`/columns/i`, `/export csv/i`). Pure test-fixture correction; no production logic touched.
- **Files modified:** `src/components/inventory/DataTable.csv.test.tsx`
- **Commit:** `d8c4597`

### Design note (not a deviation)

The ROADMAP Phase-3 prose still names a `vCenter → Datacenter → Cluster → ESX → VM` hierarchy, but the **approved** design (03-UI-SPEC §Inventory layout + 03-03-PLAN + 03-RESEARCH A1) explicitly drops the Datacenter level. Implemented per the approved design (synthetic vCenter root → Cluster → ESX → VM). No Datacenter level — by decision, not omission.

## Gate Results

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npx @biomejs/biome check .` | PASS (134 files, 0 errors) |
| `npm run test:run` | PASS (37 files, 236 tests) |
| Task-3 named files (`InventoryTree` / `inventory-stress` / `e2e-smoke`) | PASS (3 files, 14 tests) |
| `npm run build` | PASS |
| `npm run check:supply-chain` | PASS |
| `node scripts/check-bundle-size.mjs` | PASS — **LIVE @tanstack chunk = 17,414 bytes gz (17.0 KiB) ≤ 60 KiB**; echarts/index chunk 207.7 KiB gz ≤ 300 KiB |
| grep: no `getExpandedRowModel` in `src/components/inventory/` | PASS |
| grep: no `localStorage` in `InventoryTree.tsx`/`InventoryView.tsx` | PASS |
| grep: no `@/engines/aggregation` in non-test component src | PASS |
| grep: exactly one `useEstateView(` caller in `src/components/inventory/` | PASS (1 — InventoryView) |
| grep: zero new `useMemo` in non-test src (only useEstateView + doc-comment mentions) | PASS |
| semgrep (CLI fallback `--config=auto --error`, 3 new files) | PASS — 0 findings, 378 rules |

> Semgrep MCP tool unavailable in this environment; used the documented CLI fallback `semgrep --config=auto --error` (acceptable per prior plans). 0 findings on the 3 new files.

## 10k Stress Result

The synthetic 10k-VM fixture (`src/__fixtures__/rvtools-inventory-10k.xlsx`, gitignored, ~6 MB, regenerated on demand) was driven through the real `parseXlsx → parseSnapshot → buildEstateView` pipeline:
- **Sort (#2):** VM rows sorted by `provisionedMib` descending completes **< 200 ms** at 10k (asserted; sorted-invariant verified). Budget not widened.
- **Bounded tree window (#1 proxy):** the virtualised tree DOM window stays **< 200 nodes** on root-expand and after expanding a cluster + a host with thousands of VMs — far below the total leaf count (fps is not measurable in jsdom; window-size proxy per 03-RESEARCH line 462).
- **Filtered CSV (#4):** filtering to the generator's deterministic embedded-newline row and exporting yields RFC-4180 double-quoted multi-line cells, verified under **both** `light` and `dark` theme classes.

## Threat Model Verification

- **T-03-10 (DoS/memory, Critical-5):** mitigated — flatten-visible + lazy children + react-virtual; `getExpandedRowModel` grep-forbidden; stress test asserts a bounded rendered window at 10k.
- **T-03-11 (state privacy):** mitigated — expansion/selection/tab/mode all component `useState`; grep gate confirms zero `localStorage` in tree + shell.
- **T-03-12 (error info disclosure):** mitigated — `InventoryView`'s region `ErrorBoundary` reads only `error.message`/`error.name` (never stack/cause); Phase-1 top-level boundary is the outer net.
- **T-03-13 (tree/cell XSS):** mitigated — all node/count/cell labels render as React text children (auto-escaped); no raw-HTML sink.
- **T-03-14 (LIVE @tanstack chunk):** mitigated — bundle gate now LIVE in the production graph at 17.0 KiB gz ≤ 60 KiB; `check:supply-chain` green; deps pinned in 03-01.
- **T-03-15 (i18n string leakage):** mitigated in Task 1 (EN↔FR strict parity, no editorial verbs / pre-formatted numbers).

No new security surface beyond the plan's threat register.

## Known Stubs

None. The inventory surface is fully wired and user-reachable via the App `ViewToggle`.

## Self-Check: PASSED

- All 4 created files present on disk: `InventoryTree.tsx`, `InventoryView.tsx`, `InventoryTree.test.tsx`, `inventory-stress.test.tsx` (verified).
- Commits verified in `git log`: `3708d81` (Task 1, i18n + fixture), `2063267` (Task 2, tree + shell + App), `d8c4597` (Task 3, tests + LIVE gate).
