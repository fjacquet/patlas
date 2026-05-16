# Phase 2: Aggregation & Global Dashboard - Research

**Researched:** 2026-05-16
**Domain:** Single-snapshot VMware estate aggregation math (ported from vsizer) + ECharts SVG-renderer dashboard infrastructure + the `useEstateView` store→UI bridge
**Confidence:** HIGH (vsizer aggregation code read in full and ported with minimal retrofit; ECharts versions verified against npm registry and official handbook; Phase 1 shipped types read directly from source)

## Summary

Phase 2 has two halves that meet at one seam. The **engine half** ports six vsizer aggregation modules (`ghz`, `perCluster`, `vinfoMerge`, `aggregateClusters`, `globals`, `contention`) and adds two net-new pure modules (`perDatastore` NAA-keyed, `perEsx`). The vsizer math is correct and tested but uses **bare `number`**; vatlas's Phase 1 shipped **branded** `MiB`/`MHz`/`GHz`/`Cores`/`Sockets` types. The retrofit is **mechanical, not invasive** — vsizer's row field names (`memoryMb`→`memoryMib`, plus `sockets` added) already changed in Phase 1's `VHostRow`/`VInfoRow`, so the port is mostly: adjust field names, decide whether engine internals carry brands or unwrap to `number` for arithmetic, and add the three-accounting-mode parameter. The vsizer math itself (capacity-weighted ratios, ADR-0011/0012, stretched-cluster DR factor) ports verbatim.

The **infra half** lands the `<Chart>` wrapper, tree-shaken ECharts imports, and Midnight Executive theme tokens. The single biggest decision — **ECharts 5.6 vs 6.0** — resolves to **`echarts@^6.0.0`** (verified: 6.0.0 is `latest` on npm since 2025-07-30, ~9.5 months stable; `echarts-for-react@^3.0.6` declares `echarts ^6.0.0` in peerDependencies; SVG renderer and `echarts/core`+`echarts.use([...])` tree-shaking are unchanged in v6). STACK.md's 5.6 pin predates the verification and should be overridden — documented below with rationale and the one v6 gotcha (default theme changed; we register our own theme so this is moot, but it must be an explicit `echarts.use()` + `registerTheme` call, not reliance on defaults).

The two halves meet at **`useEstateView`** — the project's single sanctioned `useMemo` site (PROJECT.md constraint). It reads `useSnapshotStore`'s `Map<id,Snapshot>` + `activeSnapshotId`, derives an `EstateView` once per (snapshot identity, accounting mode) pair, and returns the shape consumed by the dashboard now and every export later. Single-snapshot only this phase; the shape must not preclude multi-snapshot (Phase 4).

**Primary recommendation:** Three plans in dependency order — (1) ECharts infra + `<Chart>` + theme + CI bundle gate; (2) aggregation port+retrofit + `perDatastore`/`perEsx` + 3 accounting modes + `useEstateView`; (3) dashboard UI + accounting toggle + integration test on the canary and a real fixture. Plans 1 and 2 are independent (parallelizable); Plan 3 depends on both.

## User Constraints

> No `CONTEXT.md` exists for this phase (`config.json` has `skip_discuss: true`). Constraints below are extracted from PROJECT.md / CLAUDE.md and carry the same authority as locked decisions.

### Locked Decisions (from PROJECT.md / ROADMAP.md / STACK.md)

- **Charting:** Apache ECharts via `echarts-for-react`, **`{ renderer: 'svg' }` mandated project-wide**. Canvas permitted ONLY as a per-chart escape hatch for in-app >10k-point overviews not in the HTML report (no such chart exists in Phase 2 — SVG everywhere here).
- **Tree-shaking mandatory:** `import * as echarts from 'echarts/core'` + per-feature imports + `echarts.use([...])`. `import * as echarts from 'echarts'` is FORBIDDEN.
- **Engines are pure:** no React, no Zustand, no DOM, **no Zod** (Zod is parser-boundary only — confirmed by Phase 1 01-RESEARCH A8 and the shipped Zod-free `engines/units`). Vitest-gated ≥75% coverage on `engines/`.
- **`useEstateView` is the ONE place `useMemo` lives** (PROJECT.md binding constraint; reaffirmed in 01-05-SUMMARY "Note for Phase 2's planner").
- **Store holds inputs only.** No cached aggregates in the store (01-05 deviated from vsizer deliberately; do NOT reintroduce). Derive in `useEstateView`.
- **No domain classes.** KISS/DRY/FP — pure functions composing via small typed functions. If two phases compute the same thing, the second imports from the first.
- **Branded units:** all storage/memory fields are `MiB`, CPU speed `MHz`/`GHz`, counts `Cores`/`Sockets`. No `* 1.048576`. RVTools "MB" IS MiB (ADR-0010).
- **Three accounting modes** surfaced in the engine output: Configured / Active / Storage-realistic. UI default = Active for CPU/RAM, Configured for storage (Critical-6).
- **No persistence of dataset rows** (PAR-05). UI prefs (theme/lang) may use `localStorage` (`vatlas-theme`/`vatlas-lang` only).
- **Midnight Executive palette** consistent across all charts (VIZ-03). Same tokens as the eventual PPTX (vsizer pattern).

### Claude's Discretion

- `<Chart>` wrapper prop API shape (must be KISS-minimal but not preclude treemap/heatmap/calendar/line/sparkline in later phases).
- `EstateView` exact field layout (must not preclude multi-snapshot trends).
- Whether the three accounting modes are precomputed (all three in `EstateView`) vs one-mode-param recompute (recommendation below: **one mode param → recompute via `useEstateView` memo key**; rationale in Pitfall section).
- Plan decomposition (suggested 3 plans below; planner may override).
- Internal engine signatures (brand-carrying vs unwrap-to-number internally).

### Deferred Ideas (OUT OF SCOPE for Phase 2)

- Multi-vCenter merge / snapshot merge (Phase 4 — `engines/snapshotMerge/`).
- Stretched-cluster pill UI + per-site asymmetric reservation (Phase 4). **Note:** the ported `aggregateClusters.ts` already CONTAINS the symmetric 50% stretched math via a `stretchedClusters` param — port it intact but the Phase 2 UI does not expose the toggle; pass an empty set.
- DR simulation, allocation sliders, EOS, trends, exports (Phases 4–7).
- Inventory tree / sortable tables / CSV (Phase 3 — consumes `perEsx`/`perDatastore`/`vmsByCluster` produced here, adds no new engines).
- Treemap / heatmap / calendar-heatmap / line / sparkline chart families (later phases; `<Chart>` API must not preclude them but Phase 2 ships only stacked bar, donut, gauge).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSH-01 | Global dashboard, one column per cluster (ESX / VM-by-OS / datastore counts) | `aggregateClusters` (host+vm rollup) + new OS-family classifier on `VInfoRow.osConfig`/`osTools` + `perDatastore` count per cluster. Per-cluster column layout. |
| DSH-02 | Global summary card (estate totals) | `aggregateGlobals` ports verbatim — already sums clusters/hosts/vms/vcpu/vram/cores; add datastore total + storage total from `perDatastore`. |
| DSH-03 | Per-cluster physical GHz, consumed GHz, mean CPU%, mean RAM%, vCPU allocation | `ghz.ts` (`physicalGhz`/`consumedGhz`) + `perCluster.ts` capacity-weighted ratios + `aggregateClusters` `vcpuAllocated`/`vcpuPerPcpu`. Ports verbatim with brand retrofit. |
| DSH-04 | OS-family breakdown (donut/stacked bar), global + per-cluster | NEW classifier (KISS regex on `osConfig` → Windows/Linux/Other). Donut chart via `<Chart>`+`PieChart`. Per-cluster + global. |
| DSH-05 | CPU Ready% (mean/max/count >5%) | `contention.ts` `CONTENTION_THRESHOLDS` + `vinfoMerge.ts` `readinessStats` port verbatim. Source: `VInfoRow.cpuReadinessPercent` (already parsed Phase 1, `number \| null`). |
| DSH-06 | Three accounting modes with toggle | NEW: accounting-mode param threaded through `vinfoMerge`/`perDatastore`. UI toggle in dashboard. Critical-6 — see Pitfalls. |
| VIZ-01 | Crisp SVG charts at every zoom | `{ renderer: 'svg' }` injected by `<Chart>` via `SVGRenderer` from `echarts/renderers`. DevTools-verifiable inline `<svg>`. |
| VIZ-02 | Chart families (Phase 2 needs stacked bar, donut, gauge) | `<Chart>` wrapper + tree-shaken `BarChart`/`PieChart`/`GaugeChart`. API must not preclude `TreemapChart`/`HeatmapChart`/`LineChart` later. |
| VIZ-03 | Consistent Midnight Executive theming | `echarts.registerTheme('midnight-executive', tokens)` + `<Chart theme>` default; tokens sourced from a shared module also feeding `index.css` (vsizer `pptxPalette` pattern, Moderate-8 forward-compat). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cluster/global/datastore/esx aggregation math | Engine (pure `engines/aggregation/`) | — | PROJECT.md: all non-trivial logic is pure functions, Vitest-gated. No React/Zustand/Zod. |
| Three accounting modes | Engine (param into aggregation) | Hook (mode is a memo key) | Mode changes WHICH VMs/columns sum; that is a math concern, surfaced via a param. UI only picks the param. |
| OS-family classification | Engine (pure classifier on `VInfoRow`) | — | Deterministic string→family; testable in isolation; consumed by both dashboard and (later) EOS. |
| Store→view derivation + memoization | Hook (`useEstateView`) | Store (inputs only) | The ONE sanctioned `useMemo` site. Store stays inputs-only (01-05 contract). |
| ECharts SVG rendering + theme injection | Component (`<Chart>` wrapper) | — | DOM/React concern; wraps `echarts-for-react`; injects renderer+theme+memo. |
| Dashboard layout (per-cluster columns, summary card, toggle) | Component (presentational React) | Hook | Pure presentational; reads `useEstateView` output + a UI-state accounting-mode selector. |
| Accounting-mode UI state | Store (`ui` slice) or local component state | — | A UI selection, not a dataset row — store-able (not a privacy concern). KISS: a small `ui` slice field or `useState` lifted to the dashboard root. |

## Standard Stack

### Core (new for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `echarts` | `^6.0.0` | Charting engine (tree-shaken, SVG renderer) | `[VERIFIED: npm registry]` 6.0.0 is `latest`, published 2025-07-30 (~9.5 months stable as of 2026-05-16). 6.1.0 only at `rc.2` (2026-05-13) — not GA, do NOT use. STACK.md pinned 5.6 but that predates this verification; **override to 6.0** (rationale below). |
| `echarts-for-react` | `^3.0.6` | Thin React binding around ECharts | `[VERIFIED: npm registry]` 3.0.6 is `latest`; `peerDependencies.echarts` is `"^3.0.0 \|\| ^4.0.0 \|\| ^5.0.0 \|\| ^6.0.0"` — explicitly supports echarts 6. STACK.md said `^3.0.2`; current `latest` is `3.0.6`. echarts-for-react 4 does not exist. |

### Supporting (already installed — Phase 1)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zustand` | `^5.0.13` (installed) | `useSnapshotStore` source | `useEstateView` consumes `useSnapshotStore((s)=>...)`. Do not add a store slice for aggregates. |
| `react`/`react-dom` | `^19.2.6` (installed) | UI runtime | `React.memo` custom comparator for `<Chart>` (Moderate-9). |
| `vitest` + `@vitest/coverage-v8` | `^4.1.6` (installed) | Engine unit tests, coverage gate ≥75% | jsdom default; **ECharts render tests** that need real SVG geometry require Vitest Browser Mode (STACK.md note) — but Phase 2 can assert the SVG renderer is wired via a lighter check (see Pitfalls / Validation). |
| `@testing-library/react` | `^16.3.2` (installed) | `useEstateView` hook + dashboard component tests | `renderHook` for the hook. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `echarts@^6.0.0` | `echarts@^5.6.0` (STACK.md original pin) | 5.6 is 17 months old (2024-12-28). 6.0 has been GA 9.5 months, is `echarts-for-react@3.0.6`'s declared peer, same tree-shaking + SVG API. Only v6 risk (default theme change) is moot because we register our own theme. No reason to ship a year-older major. |
| `echarts@^6.1.0-rc.2` | — | RC, not GA (2026-05-13). FORBIDDEN per stack discipline (pin GA only). |
| `echarts-for-react` | Hand-rolled `useEffect`+`echarts.init` wrapper | echarts-for-react handles dispose/resize/option-merge correctly; hand-rolling re-invents disposal bugs. The `<Chart>` wrapper sits ON TOP of echarts-for-react, not instead of it. |

**Installation:**

```bash
npm install echarts@^6.0.0 echarts-for-react@^3.0.6
```

`[VERIFIED: npm view]` as of 2026-05-16: `echarts` latest = `6.0.0` (published 2025-07-30); `echarts-for-react` latest = `3.0.6`, peerDependencies `echarts: "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0"`, `react: "^15.0.0 || >=16.0.0"`. Both compatible with the installed React 19.2.6.

**Version verification commands the planner should re-run at execution time** (versions can move):
```bash
npm view echarts version
npm view echarts-for-react version
npm view echarts-for-react peerDependencies
```

## Architecture Patterns

### System Architecture Diagram

```
                    useSnapshotStore (Zustand, inputs-only — Phase 1, FINAL contract)
                      snapshots: Map<id, Snapshot>   activeSnapshotId: string|null
                                        │
                                        │ select(s => s.snapshots.get(s.activeSnapshotId ?? ''))
                                        │ + accountingMode (ui state)
                                        ▼
                  ┌─────────────────────────────────────────────────┐
                  │  useEstateView(mode)   ← THE ONE useMemo site     │
                  │  memo key: [activeSnapshot identity, mode]        │
                  └─────────────────────────────────────────────────┘
                                        │ calls pure engines (one-way; engines never reach back)
                                        ▼
   ┌──────────────────────── engines/aggregation/ (pure, Zod-free, Vitest ≥75%) ───────────────────────┐
   │                                                                                                    │
   │  ghz.ts ──► perCluster.ts (host rollup) ──┐                                                         │
   │             vinfoMerge.ts (vm rollup,     ├──► aggregateClusters.ts ──► globals.ts                  │
   │                accounting-mode aware) ────┘        (stretched param = ∅ in P2)                      │
   │             contention.ts (CPU Ready thresholds)                                                    │
   │             osFamily.ts  (NEW: VInfoRow → 'windows'|'linux'|'other')                                 │
   │             perDatastore.ts (NEW: NAA-keyed, no double-count — Moderate-11)                          │
   │             perEsx.ts (NEW: per-host rollup for DSH + Phase 3 tree)                                  │
   └────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │ returns EstateView { globals, clusters[], hosts[], datastores[],
                                        │                       vmsByCluster, osBreakdown, accountingMode }
                                        ▼
   ┌──────────────────── components/dashboard/ (presentational React, reads hook) ──────────────────────┐
   │  <GlobalSummaryCard>   <AccountingModeToggle>   <PerClusterColumns>   <OsDonut>   <CpuReadyPanel>   │
   │            └──────────────── all charts go through ──────────────────┘                              │
   │                                  <Chart> wrapper                                                    │
   │     (echarts-for-react + SVGRenderer + 'midnight-executive' theme + React.memo deep-on-data)         │
   └────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── engines/
│   ├── units/                  # Phase 1 — branded MiB/MHz/GHz/Cores/Sockets (consume, don't touch)
│   └── aggregation/            # Phase 2 — port + new
│       ├── ghz.ts              # PORT (tiny brand retrofit)
│       ├── perCluster.ts       # PORT (field-name + brand retrofit)
│       ├── vinfoMerge.ts       # PORT + accounting-mode param
│       ├── aggregateClusters.ts# PORT verbatim (stretched param stays, ∅ in P2)
│       ├── globals.ts          # PORT verbatim + datastore/storage totals
│       ├── contention.ts       # PORT verbatim (constants only)
│       ├── osFamily.ts         # NEW — KISS regex classifier
│       ├── perDatastore.ts     # NEW — NAA-keyed datastore rollup
│       ├── perEsx.ts           # NEW — per-host rollup
│       ├── estateView.ts       # NEW — pure assembler: (snapshot, mode) → EstateView
│       └── index.ts            # barrel
├── types/                      # Phase 1 — Snapshot/VInfoRow/VHostRow/VDatastoreRow (consume)
│   └── estate.ts               # NEW — ClusterAggregate/GlobalSummary/EsxAggregate/DatastoreAggregate/EstateView/OsFamily
├── hooks/
│   └── useEstateView.ts        # NEW — the ONE useMemo bridge
├── theme/
│   └── echartsTheme.ts         # NEW — Midnight Executive tokens (also referenced by index.css)
├── components/
│   ├── Chart.tsx               # NEW — <Chart> wrapper (echarts-for-react + memo + theme + svg)
│   └── dashboard/
│       ├── GlobalDashboard.tsx     # NEW — layout root, owns accounting-mode state
│       ├── GlobalSummaryCard.tsx   # NEW — DSH-02
│       ├── PerClusterColumns.tsx   # NEW — DSH-01/03
│       ├── OsBreakdownDonut.tsx    # NEW — DSH-04
│       ├── CpuReadyPanel.tsx       # NEW — DSH-05
│       └── AccountingModeToggle.tsx# NEW — DSH-06
└── App.tsx                     # MODIFY — swap the Phase-1 "<main> placeholder" for <GlobalDashboard>
```

### Pattern 1: Tree-shaken ECharts registration (module-scope, once)

**What:** Register only the series/components/renderer used, once at module load, before any chart renders.
**When to use:** A single `src/components/Chart.tsx` (or a sibling `echartsRegistry.ts` it imports) does this exactly once.
**Example:**
```typescript
// Source: https://apache.github.io/echarts-handbook/en/basics/import/ [CITED]
import * as echarts from 'echarts/core'
import { BarChart, PieChart, GaugeChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, PieChart, GaugeChart,
  GridComponent, TooltipComponent, LegendComponent, DatasetComponent,
  SVGRenderer,            // SVG ONLY — CanvasRenderer deliberately NOT imported (VIZ-01)
])
echarts.registerTheme('midnight-executive', MIDNIGHT_EXECUTIVE_ECHARTS_THEME)
```
`[VERIFIED: official handbook]` ECharts 6 import paths unchanged from v5: charts from `echarts/charts`, components from `echarts/components`, `SVGRenderer` from `echarts/renderers`, core from `echarts/core`. The handbook explicitly states the tree-shakeable interface ships **no renderer by default** — importing only `SVGRenderer` excludes `CanvasRenderer` from the bundle (this is what hits the ≤300 KB gz budget).

### Pattern 2: `<Chart>` wrapper — KISS-minimal, future-proof

**What:** One component wrapping `echarts-for-react`'s `ReactEChartsCore`, injecting SVG renderer + theme + a `React.memo` comparator (Moderate-9).
**When to use:** EVERY chart in vatlas, all phases. Components never call `echarts.init` or import `echarts-for-react` directly.
**Example (recommended API):**
```typescript
// src/components/Chart.tsx
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'       // the same instance used in the registry import
import type { EChartsCoreOption } from 'echarts/types/dist/shared'

export interface ChartProps {
  option: EChartsCoreOption          // full ECharts option — covers bar/pie/gauge NOW and
                                     //   treemap/heatmap/calendar/line/sparkline LATER without
                                     //   an API change (the option object is the universal surface)
  style?: React.CSSProperties        // height/width; default a sensible min-height
  className?: string
  ariaLabel?: string                 // VIZ accessibility hook (echarts `aria` lives in option)
  notMerge?: boolean                 // pass-through for rare full-replace cases
}

function chartPropsEqual(a: ChartProps, b: ChartProps): boolean {
  // Moderate-9: deep-equal on `option` (the data), shallow on the rest.
  // Cheap structural compare — option is already a memoized value from useEstateView-derived
  //   selectors, so reference equality usually short-circuits this.
  return a.option === b.option
    && a.className === b.className
    && a.ariaLabel === b.ariaLabel
    && a.style === b.style
}

export const Chart = React.memo(function Chart({ option, style, className, ariaLabel, notMerge }: ChartProps) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge={notMerge}
      lazyUpdate
      opts={{ renderer: 'svg' }}            // VIZ-01 — mandated, injected here so no caller can forget
      theme="midnight-executive"            // VIZ-03 — registered once at module load
      style={style ?? { height: 320 }}
      aria-label={ariaLabel}
    />
  )
})
```
**Key design choices (rationale for the planner):**
- The single `option` prop is deliberately the *whole ECharts option object*, not a typed per-chart-family prop set. This is the KISS choice that does **not** preclude treemap/heatmap/calendar/line/sparkline: adding a chart family later means importing `TreemapChart` into the registry and passing a treemap `option` — zero `<Chart>` API change. A bespoke prop API per family would be premature abstraction (PROJECT.md forbids).
- `opts.renderer:'svg'` is injected by the wrapper, not the caller — makes VIZ-01 structurally impossible to violate.
- `React.memo` with `option === option` (reference) comparator works because chart `option` objects are built inside selector functions memoized off `useEstateView`'s output (which is itself memoized). Deep-equal is unnecessary if upstream memoization is correct; the reference check is the cheap correct-by-construction path. (If a later phase produces option objects inline, revisit with a shallow data compare — flagged as Moderate-9 watch item.)
- Import `echarts-for-react/lib/core` (the tree-shaking-friendly entry), NOT the default `echarts-for-react` (which pulls full echarts). `[CITED: echarts-for-react tree-shaking docs, STACK.md]`

### Pattern 3: `useEstateView` — the one bridge, the one `useMemo`

**What:** A hook that reads the store, calls the pure `estateView` assembler, memoizes the result.
**When to use:** Every dashboard component (and every later UI/export) reads its data from here. Nothing else calls `engines/aggregation` from React.
**Example:**
```typescript
// src/hooks/useEstateView.ts
import { useMemo } from 'react'
import { useSnapshotStore, selectActiveSnapshot } from '@/store/snapshotStore'
import { buildEstateView } from '@/engines/aggregation'
import type { AccountingMode, EstateView } from '@/types/estate'

const EMPTY_VIEW: EstateView = /* frozen empty constant */

export function useEstateView(mode: AccountingMode): EstateView {
  const snapshot = useSnapshotStore(selectActiveSnapshot)   // stable ref unless snapshot changes
  return useMemo(
    () => (snapshot ? buildEstateView(snapshot, mode) : EMPTY_VIEW),
    [snapshot, mode],                                        // ONLY memo deps that matter
  )
}
```
**Why this shape (rationale):**
- `selectActiveSnapshot` (Phase 1, shipped) returns a referentially-stable `Snapshot | null` — perfect `useMemo` dep. Snapshot objects are frozen-on-insert (01-05 contract), so identity changes iff the active snapshot changes.
- `mode` is the only other dep. Switching accounting mode recomputes (cheap in pure JS — vsizer benchmarks tens of ms for ~10k VMs; Phase 1 measured a 944 KB workbook parse at ~360 ms and the largest real fixture is 249 VMs). **This is the recommended approach over precomputing all three modes** — see Pitfall "Accounting mode: recompute vs precompute".
- The hook ONLY orchestrates+memoizes. `buildEstateView` is a pure engine function (testable without React).
- **Multi-snapshot forward-compat:** `EstateView` carries a `trends: TimelinePoint[] | null` field (null in Phase 2). Phase 4 changes the hook to read `Map`+selection and populate `trends` — the *shape* is stable, so dashboard components written in Phase 2 don't change. (ARCHITECTURE.md §4 EstateView shape is the contract.)

### Anti-Patterns to Avoid

- **Caching aggregates in the store.** 01-05 deliberately removed this from vsizer's model. Deriving in `useEstateView` is the contract. Reintroducing it multiplies invalidation surface (DR sim/EOS/trends in later phases).
- **`useMemo` in dashboard components.** PROJECT.md: `useEstateView` is the ONLY `useMemo` site. Components receive already-derived data. (Chart `option` builders, if memoized, belong in small selector helpers the hook composes — not scattered `useMemo` in JSX.)
- **`import * as echarts from 'echarts'`.** Pulls ~1 MB. Forbidden. Always `echarts/core` + `echarts.use([...])`.
- **CanvasRenderer import.** Not needed in Phase 2; importing it defeats the SVG-only bundle goal and risks a caller picking canvas.
- **Zod in engines.** Engines are Zod-free (01-RESEARCH A8). Branded types are the engine contract; validation already happened at the parser boundary.
- **Re-deriving brands by re-validating.** Phase 1 rows are already branded `MiB`/`MHz`/etc. Engines consume them directly; arithmetic unwraps to `number` and re-brands the result via the `units` constructors only where the output type demands a brand.
- **Per-chart-family `<Chart>` prop API.** Premature abstraction. The `option` object is the universal surface.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cluster/host/vm aggregation math | A fresh aggregation engine | **Port vsizer `engines/aggregation/`** | The math is shipped, tested (vsizer has `.test.ts` siblings for every file), and encodes hard-won ADRs (0011 capacity-weighted ratios, 0012 CPU Ready arithmetic-mean, 0007 stretched DR factor, the V8 65535-spread-limit fix in `readinessStats`). Re-deriving invites the exact Moderate-4/5 bugs. |
| GHz/percent/ratio/memory formatting | New formatters | **Port vsizer `utils/format.ts`** verbatim | Locale-aware, em-dash sentinels, adaptive precision, the `fmtPercentValue` (already-percent vs 0..1 ratio) distinction — all subtle and tested. ROADMAP says "port unchanged". (Note: vsizer `format.ts` is bare-number; it formats *display* values so no brand retrofit needed — unwrap brand to number at the format call site.) |
| ECharts lifecycle (init/dispose/resize/option merge) | A `useEffect`+`echarts.init` wrapper | **`echarts-for-react`** (`/lib/core` entry) under the `<Chart>` wrapper | Disposal-on-unmount and resize-observer correctness are easy to get subtly wrong (memory leaks on route change). The thin binding is battle-tested. |
| CPU Ready threshold semantics | Inline `> 0.05` checks | **Port `contention.ts` `CONTENTION_THRESHOLDS`** | Single source of truth (5%/10%); shared by aggregator + (future) PPTX color helper. ADR-0003: status thresholds, not verdicts — no "warning/bad" adjectives in output. |
| Datastore dedupe | Sum VMDKs / sum by name | **NAA/UUID-keyed `perDatastore`** | Moderate-11: shared LUNs across clusters double-count if keyed by name. `VDatastoreRow.naa` is the key (already parsed Phase 1). |

**Key insight:** Phase 2 is overwhelmingly a *port*, not a build. vsizer's aggregation directory was read in full for this research — every file ports with at most a field-rename + brand-unwrap. The genuinely new code is small: `osFamily.ts` (regex classifier), `perDatastore.ts`, `perEsx.ts`, `estateView.ts` (assembler), and the four UI/infra files. Treat "port verbatim, retrofit minimally" as the default; building from scratch is the anti-pattern here.

## vsizer Aggregation Port Map (Question 5)

vsizer's `VHostRow`/`VInfoRow` used **bare `number`**. Phase 1's vatlas types (`src/types/vhost.ts`, `vinfo.ts`) are **branded** and slightly renamed. The retrofit per file:

| vsizer file | Port verdict | Retrofit needed | Detail |
|-------------|--------------|------------------|--------|
| `ghz.ts` | **Port, trivial retrofit** | Inputs are now `MHz`/`Cores` brands | `mhzToGhz`, `physicalGhz`, `consumedGhz` do `mhz/1000`, `speedMhz*cores`. Either accept brands and unwrap inside (`(speedMhz as number)`) or accept `number` and let callers unwrap. **Recommendation:** signatures take the brands, unwrap once internally, return `GHz` via the `units` `ghz()` constructor — keeps the brand contract end-to-end. Phase 1 `units` already exports `mhzToGhz`; **DRY: reuse `engines/units` `mhzToGhz` instead of re-declaring vsizer's** (vsizer's `ghz.ts` `mhzToGhz` duplicates what `units` now owns — collapse the duplication). |
| `perCluster.ts` | **Port, mechanical retrofit** | `h.memoryMb` → `h.memoryMib`; `h.cores`/`h.speedMhz` now branded; group key `row.cluster` unchanged | Capacity-weighted ratio logic (ADR-0011), `groupByCluster`, sum/mean helpers all port verbatim. Only the field name `memoryMb`→`memoryMib` and brand unwraps in the arithmetic. `ClusterHostStats` interface moves to `src/types/estate.ts` with `MiB`/`GHz` brands on the memory/ghz fields. |
| `vinfoMerge.ts` | **Port + accounting-mode param** | `v.vramMb`→`v.vramMib`; add `mode` param to drive the powered-on filter | `groupByCluster` currently hard-filters `if (!row.poweredOn) continue`. Critical-6 needs this conditional on mode: **Active** = poweredOn only (current behavior); **Configured** = all VMs; **Storage-realistic** = poweredOn for vCPU/vRAM. `readinessStats`/`topReadinessVmsByCluster` (CPU Ready, ADR-0012) port verbatim — readiness is always powered-on-only regardless of mode (a powered-off VM has no CPU Ready). |
| `aggregateClusters.ts` | **Port verbatim** | None beyond brand types flowing through | Stretched-cluster DR factor (ADR-0007), `vcpuPerPcpu` against `usablePhysicalCores`, `mhzPerVcpu` all port unchanged. **Phase 2 passes `stretchedClusters = new Set()`** (empty) — the math is dormant but present for Phase 4. `ClusterAggregate` type → `src/types/estate.ts`, brand the GHz/MiB fields. |
| `globals.ts` | **Port verbatim + 2 new sums** | None | `aggregateGlobals` already sums every cluster field incl. CPU Ready estate rollup. **Add** `datastoreCount` + `totalStorageMib` (from `perDatastore` output) to `GlobalSummary` for DSH-02. The `emptySummary` constant + null-vs-0 contracts (activeMemMb, vmsAboveReadinessWarning) port unchanged. |
| `contention.ts` | **Port verbatim** | None | `CONTENTION_THRESHOLDS = {warning:5, serious:10}`, `TOP_N_DEFAULT=10`. Pure constants. |
| `utils/format.ts` | **Port verbatim** | None (formats display numbers; unwrap brand at call site) | Locale-aware formatters. ROADMAP "port unchanged". Lives at `src/utils/format.ts` or `src/engines/format/` (ARCHITECTURE.md §3 suggests `engines/format/`; either is fine — KISS, follow whatever Phase 1 established for `utils/`). |

**Retrofit invasiveness verdict:** **LOW.** The branding retrofit is field renames (`memoryMb`→`memoryMib`, `vramMb`→`vramMib` — already done in Phase 1's type files) plus brand-unwrap (`x as number`) in arithmetic expressions and brand-rewrap (`mib(...)`, `ghz(...)`) on outputs. No algorithm changes. The one *logic* change is the accounting-mode param in `vinfoMerge.ts` (genuinely new, Critical-6). Estimate: the six ports are a single focused plan task; the math test suites port alongside (vsizer's `*.test.ts` are the regression net — port + adjust to branded fixtures).

## NEW Engine: `perDatastore.ts` (Question 6, Moderate-11)

**Key:** `VDatastoreRow.naa` (`string | null` — Phase 1 parsed from RVTools `Address`/`naa`/`url`/`uuid` aliases). Dedup on `naa`; when `naa === null` fall back to `name` (and surface a low-confidence note — a nameless-key datastore *can* double-count, but RVTools 3.11+ reliably exposes the address).

**vDatastore columns available** (from Phase 1 `VDatastoreRow`): `name`, `capacityMib: MiB`, `freeMib: MiB`, `provisionedMib: MiB`, `naa: string|null`, `type: string`.

**`DatastoreAggregate` shape (recommended):**
```typescript
interface DatastoreAggregate {
  key: string            // naa ?? name
  name: string           // display name (first seen for this naa)
  type: string           // VMFS/NFS/vSAN
  capacityMib: MiB
  freeMib: MiB
  usedMib: MiB           // capacity - free
  usedRatio: number      // (capacity-free)/capacity, 0 when capacity 0
  provisionedMib: MiB
  overProvisionRatio: number  // provisioned / capacity (thin-provisioning headline)
  sharedDuplicateCount: number // how many raw rows collapsed into this key (>1 = shared LUN)
}
```
Aggregation: group rows by `naa ?? name`; within a group take capacity/free from the **first** row (a shared LUN has identical capacity in every cluster's view — do NOT sum capacity), sum nothing that double-counts. The Moderate-11 sanity check (`provisioned ≤ capacity × 10` warning) is optional in Phase 2 (no diagnostics panel until later) — recommend computing the ratio and leaving a `// TODO(diagnostics, Phase 3+)` rather than building a panel now (YAGNI).

**Per-cluster datastore count (DSH-01):** RVTools `vDatastore` does not reliably carry a cluster column; the honest count is "datastores visible in the estate" globally (DSH-02) plus, per cluster, the count of distinct datastore keys referenced by that cluster's VMs *if* `vPartition`/`vDisk` path parsing is in scope — **it is NOT in Phase 2** (vPartition path→datastore mapping is a Moderate-11 detail deferred). **Recommendation for DSH-01 per-cluster datastore count:** count distinct datastores per cluster only if a trivial column exists; otherwise show the global datastore count in the summary card (DSH-02) and omit a per-cluster datastore number, or mark it "—". Flag as an Open Question for the planner to confirm with the user against a real fixture. `[ASSUMED]` — needs fixture verification.

## NEW Engine: `perEsx.ts` (Question 7)

Per-host rollup from `VHostRow` + the host's VMs (`VInfoRow` filtered by `host` field — Phase 1 `VInfoRow.host` is populated). Drives the per-cluster ESX count (DSH-01) now and the Phase 3 inventory tree (no new engine in Phase 3 — it consumes this).

**`EsxAggregate` shape (recommended):**
```typescript
interface EsxAggregate {
  hostName: string
  cluster: string
  sockets: Sockets
  cores: Cores                 // physical cores (Moderate-4 — NEVER threads)
  speedMhz: MHz
  physicalGhz: GHz             // ghz.physicalGhz(speedMhz, cores)
  memoryMib: MiB
  vmCount: number              // VMs whose VInfoRow.host === hostName (accounting-mode aware)
  vcpuAllocated: Cores
  vramAllocatedMib: MiB
  cpuRatio: number             // 0..1 (from VHostRow)
  ramRatio: number
  meanCpuReadinessPercent: number | null   // reuse readinessStats over this host's VMs
  maxCpuReadinessPercent: number | null
  vmsAboveReadinessWarning: number
}
```
`vmCount`/`vcpuAllocated` honor the accounting mode (same param as `vinfoMerge`). DRY: `perEsx` should call the same `readinessStats` helper `vinfoMerge` uses (export it from a shared spot, don't copy-paste — PROJECT.md DRY).

## Three Accounting Modes (Question 8, Critical-6)

| Mode | Definition | Which VMs/columns | Default for |
|------|------------|-------------------|-------------|
| **Configured** | Everything defined, powered on or off | ALL `VInfoRow` for vCPU/vRAM sums | Storage (DSH-06 default for storage metrics) |
| **Active** | Only what's running today | `poweredOn === true` only for vCPU/vRAM | CPU/RAM dashboards (DSH-06 default for CPU/RAM) |
| **Storage-realistic** | Honest sizing | `poweredOn` for vCPU/vRAM; ALL VMs (incl. powered-off) for provisioned storage | The "honest" combined view |

**RVTools columns driving each:** the discriminator is `VInfoRow.poweredOn` (Phase 1 parsed `Powerstate`→boolean). Storage uses `VInfoRow.provisionedMib`/`inUseMib` (also `perDatastore` `provisionedMib`). CPU/RAM use `VInfoRow.vcpu`/`vramMib`.

**How surfaced in `EstateView` — RECOMMENDATION: one mode param → recompute (NOT precompute all three).**
- Rationale: precomputing all three triples `EstateView` size and the cluster arrays for marginal benefit; the recompute is cheap (vsizer ~tens of ms / 10k VMs; real fixtures here ≤249 VMs). `useEstateView(mode)` already keys its `useMemo` on `mode`, so a toggle flip is one memo miss → one fast recompute. This is the KISS choice and matches the hook design.
- The UI accounting-mode state lives in the dashboard root (a `ui` store field or a lifted `useState`). The toggle (DSH-06) sets it; `useEstateView(mode)` re-derives.
- `EstateView.accountingMode: AccountingMode` is echoed back in the view so charts/labels can show "(Active)" etc.
- Critical-6 test (REQUIRED, ROADMAP success criterion 2 & 6): a synthetic/fixture workbook with ~50% poweredOn / 50% poweredOff, assert the three modes produce three **distinct** totals.

**Powered-off filter is mode-driven in `vinfoMerge.ts`'s `groupByCluster`** — currently `if (!row.poweredOn) continue` is unconditional; make it `if (mode !== 'configured' && !row.poweredOn) continue` for CPU/RAM aggregation, with storage sums taken over the unfiltered set in storage-realistic/configured. CPU Ready (`readinessStats`) is always powered-on-only (a powered-off VM cannot have CPU Ready) regardless of mode — port that filter unchanged.

## Physical-Cores Consolidation (Question 9, Moderate-4)

Phase 1 `VHostRow` already separates the fields correctly:
- `sockets: Sockets` ← RVTools `# CPU` (physical socket count)
- `cores: Cores` ← RVTools `# Cores` (total physical cores across sockets)
- (RVTools `# CPU Threads` / HT logical count is **NOT** in `VHostRow` — Phase 1 correctly omitted it, structurally preventing the Moderate-4 bug.)

vsizer's `aggregateClusters.ts` already computes `vcpuPerPcpu = vcpuAllocated / usablePhysicalCores` where `usablePhysicalCores` derives from `h.physicalCores` (= Σ `cores`). **This is physical-core-based by construction** — port verbatim, no change. UI label must read "vCPU per physical core" (not "vCPU:pCPU" — ambiguous, per Moderate-4 prevention). No threads field exists to accidentally use; the type system enforces correctness here.

## CPU Ready (Question 10, DSH-05, ADR-0012)

`contention.ts` + `vinfoMerge.ts` `readinessStats` port **verbatim**. Source: `VInfoRow.cpuReadinessPercent: number | null` (Phase 1 parsed; null when RVTools didn't report it — RVTools-only inputs frequently lack it).
- Mean: **arithmetic** (ADR-0012 §3 — not vCPU-weighted; weighting dilutes exactly the contended cohort the metric exists to detect).
- Max: via `reduce`, NOT `Math.max(...values)` (vsizer's `readinessStats` already does this — avoids the V8 ~65535 spread-arg limit on hyperscaler clusters). Port the loop verbatim.
- Count > 5%: `CONTENTION_THRESHOLDS.warning`.
- Null/absent contract: `meanCpuReadinessPercent = null`, `readinessAvailable = false` when no VM reported — **never collapse absence to 0 or "all healthy"** (ADR-0012 §2). The dashboard CPU Ready panel (DSH-05) must render "not reported" when `readinessAvailable === false`, not "0%".

## Common Pitfalls

### Pitfall 1: ECharts default theme changed in v6 (relevant because we override)
**What goes wrong:** Relying on ECharts default colors/legend position; v6 changed both (default legend now bottom; color scheme changed).
**Why it happens:** STACK.md examples may assume v5 defaults.
**How to avoid:** We register `midnight-executive` and pass `theme="midnight-executive"` on every `<Chart>` (VIZ-03 requires this anyway). The v6 default-theme change is therefore **moot** — but it MUST be an explicit registered theme, never reliance on defaults. `[CITED: ECharts v6 upgrade guide]`
**Warning signs:** Charts render with wrong palette / legend in unexpected place → theme not registered before first render (registration must be module-scope, before any `<Chart>` mounts).

### Pitfall 2: Accounting mode — recompute vs precompute (Critical-6 design fork)
**What goes wrong:** Precomputing all three modes into `EstateView` (3× the cluster/global/datastore arrays) for a marginal toggle latency win, bloating the memoized object and every export later.
**Why it happens:** "Avoid recompute" instinct.
**How to avoid:** Recompute via `useEstateView(mode)` memo key (recommended above). The compute is provably cheap at vatlas's data scale. Precompute is the premature optimization PROJECT.md's KISS forbids.
**Warning signs:** `EstateView` grows `clustersConfigured`/`clustersActive`/`clustersStorage` parallel arrays — stop, use the param.

### Pitfall 3: SVG renderer not actually wired (VIZ-01 / ROADMAP success #4)
**What goes wrong:** A chart renders via Canvas (default if `CanvasRenderer` ever gets imported, or if `opts.renderer` is dropped), breaking the HTML-export contract silently.
**Why it happens:** Forgetting `opts={{renderer:'svg'}}` on a direct `echarts-for-react` use, or importing `CanvasRenderer`.
**How to avoid:** `<Chart>` injects `opts={{renderer:'svg'}}` centrally and is the ONLY chart entry point; `CanvasRenderer` is never imported. **Verification (ROADMAP success #4):** a test asserting the rendered DOM contains `<svg>` and no `<canvas>` inside a chart. jsdom limitation: jsdom does not produce real ECharts SVG geometry, but it DOES let you assert the renderer choice — alternatively a lightweight check that the registered renderer is SVG, or a Vitest Browser Mode test for the real geometry (STACK.md flags Browser Mode for chart-render tests; Phase 2 can use a minimal Browser-Mode test for this one assertion or assert at the `opts` level). Flag for the planner: decide jsdom-level assertion vs Browser Mode for success criterion #4.
**Warning signs:** DevTools shows `<canvas>` in a chart container.

### Pitfall 4: Bundle-size CI gate value (Question 2)
**What goes wrong:** No gate, or wrong gate value, lets ECharts bloat past the SVG-tree-shaking target unnoticed (ROADMAP success #5: **≤300 KB gzipped** for the ECharts contribution).
**Why it happens:** STACK.md says "150–300 KB gz target"; Phase 1's build warning budget was a generic 700 KB *raw* chunk warning (different metric — raw vs gz, and chunk-warning vs hard-gate).
**How to avoid:** Add a CI step that builds and asserts the ECharts-bearing chunk is **≤300 KB gzipped** (ROADMAP success criterion #5 is the authoritative number — use 300 KB gz as the hard gate). Phase 1 precedent: 01-04 used a build probe inspecting `dist/assets/*.js` sizes (parser worker chunk measured at 138 KB gz). Reuse that probe pattern: build, locate the chunk containing echarts, `gzip -c | wc -c`, fail if > 307200 bytes. Keep the Phase-1 700 KB raw chunk *warning* as-is (it's a Vite warning, orthogonal). `[CITED: ROADMAP success criterion 5, STACK.md, 01-04-SUMMARY worker-chunk probe]`
**Warning signs:** CI green but `import * as echarts from 'echarts'` slipped in (1 MB) — the gate catches it.

### Pitfall 5: Datastore double-count (Moderate-11)
**What goes wrong:** Summing datastore capacity across clusters that share a LUN → impossible totals (total VMDK > total capacity).
**How to avoid:** Key `perDatastore` on `naa ?? name`; take capacity/free from the first row in a key-group, never sum capacity. Surface `sharedDuplicateCount`.
**Warning signs:** Total datastore capacity exceeds the sum of physical arrays the operator knows they have.

### Pitfall 6: CPU Ready absence rendered as 0% (ADR-0012)
**What goes wrong:** RVTools-only inputs often lack CPU Ready; rendering `null` as `0%` tells the operator "no contention" when the truth is "unknown".
**How to avoid:** DSH-05 panel checks `readinessAvailable`; renders "not reported" not "0%". `fmtPercentValue` from ported `format.ts` returns em-dash for non-finite — pair with an explicit availability check.
**Warning signs:** Every cluster shows exactly 0.0% CPU Ready.

### Pitfall 7: vsizer `ghz.ts` duplicates `units.mhzToGhz` (DRY)
**What goes wrong:** Porting vsizer `ghz.ts`'s own `mhzToGhz` creates two `mhzToGhz` (one in `units`, one in `aggregation`) — DRY violation PROJECT.md forbids ("if two phases compute the same thing, the second imports from the first").
**How to avoid:** `aggregation/ghz.ts` imports `mhzToGhz` from `@/engines/units`; keeps only the composite helpers (`physicalGhz`, `consumedGhz`) that are genuinely aggregation-specific.
**Warning signs:** Two `mhzToGhz` definitions in `src/`.

## Code Examples

### OS-family classifier (NEW, KISS — DSH-04)
```typescript
// src/engines/aggregation/osFamily.ts  — pure, no deps
export type OsFamily = 'windows' | 'linux' | 'other'

// Prefer osConfig (vCenter guest-OS dropdown — stable); fall back to osTools.
// KISS regex bank. NOT the full EOS normalizer (that is Phase 5, Moderate-6) —
// Phase 2 only needs the 3-way family split for the donut.
export function classifyOsFamily(osConfig: string, osTools: string): OsFamily {
  const s = (osConfig || osTools).toLowerCase()
  if (/windows|microsoft/.test(s)) return 'windows'
  if (/linux|rhel|red hat|centos|ubuntu|debian|suse|sles|oracle|rocky|alma|photon|coreos/.test(s)) return 'linux'
  return 'other'
}
```
Source: derived from Moderate-6 OS-string variants in PITFALLS.md. `[CITED: PITFALLS.md Moderate-6]` — the *forecast* normalizer is Phase 5; this is the minimal 3-bucket split DSH-04 needs. The `other` bucket must be visible in the donut (never silently drop), consistent with the "unknown OS is a real bucket" principle.

### vsizer capacity-weighted cluster ratio (PORT verbatim — proof it ports clean)
```typescript
// from vsizer perCluster.ts — ports with only memoryMb→memoryMib + brand unwrap
const physical  = sum(hosts.map(h => physicalGhzOf(h.speedMhz, h.cores)))
const consumed  = sum(hosts.map(h => consumedGhzOf(h.speedMhz, h.cores, h.cpuRatio)))
const physicalRamMib = sum(hosts.map(h => h.memoryMib))             // was memoryMb
const meanCpuRatio = physical === 0 ? 0 : consumed / physical        // ADR-0011, verbatim
```
Source: `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/perCluster.ts` `[VERIFIED: codebase read in full]`.

## State of the Art

| Old (STACK.md / ARCHITECTURE.md) | Current (verified 2026-05-16) | When changed | Impact |
|-----------------------------------|-------------------------------|--------------|--------|
| `echarts@^5.6.0` pinned in STACK.md | `echarts@^6.0.0` (GA 2025-07-30, stable 9.5 mo) | v6 GA 2025-07-30 | Use 6.0. Tree-shaking + SVG API unchanged; only default theme changed (moot — we register our own). |
| `echarts-for-react@^3.0.2` (STACK.md) | `echarts-for-react@^3.0.6` (latest); peer `echarts ^6` | 3.0.6 current | Use 3.0.6; explicitly supports echarts 6. |
| ARCHITECTURE.md §7 preferred `visx` | ECharts (tension reconciled in SUMMARY.md) | Research phase | Locked: ECharts. visx not used. |
| vsizer caches `aggregates` in store | vatlas store is inputs-only; derive in `useEstateView` | 01-05 (shipped) | Do NOT add aggregates to store. Contract is final. |

**Deprecated/outdated:** STACK.md's `echarts@^5.6.0` and `echarts-for-react@^3.0.2` pins — superseded by the npm-verified `^6.0.0` / `^3.0.6`. The planner should record an ADR or decision note that Phase 2 overrides the STACK.md ECharts pin with rationale (this research is that rationale).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DSH-01's per-cluster *datastore count* may not be reliably derivable (no cluster column on `vDatastore`; vPartition path-mapping is out of Phase 2 scope) | perDatastore | MEDIUM — if a fixture shows a usable column, per-cluster count is feasible; if not, DSH-01 shows global datastore count only / "—" per cluster. Planner should confirm against a real fixture (`tests/fixtures/RVTools_export_all_2026-04-17_...MOM-vCenter.xlsx`, 102 datastores). |
| A2 | jsdom can assert "renderer is SVG / no `<canvas>`" sufficiently for ROADMAP success #4 without Vitest Browser Mode | Pitfall 3 | LOW-MEDIUM — if jsdom can't, a single minimal Browser-Mode test covers it. Either way the criterion is testable. |
| A3 | The accounting-mode UI state is fine in a `ui` store field / lifted `useState` (it is a UI selection, not a dataset row, so not a privacy concern) | Responsibility Map | LOW — explicitly allowed by PAR-05 (only dataset *rows* are forbidden from storage; this is in-memory UI state anyway). |
| A4 | vsizer `utils/format.ts` ports with zero change (it formats display numbers; brand unwrap at call site) | Port Map | LOW — verified by reading the file; all functions take bare `number`. |

## Open Questions

1. **Per-cluster datastore count (DSH-01).**
   - What we know: `VDatastoreRow` (Phase 1) has no cluster field; global datastore count (DSH-02) is solid via NAA-keyed `perDatastore`.
   - What's unclear: whether DSH-01's "datastore count per cluster column" is derivable in Phase 2 scope (vPartition `[datastore] path` parsing → cluster is a Moderate-11 detail, arguably Phase 3).
   - Recommendation: planner inspects `tests/fixtures/RVTools_export_all_2026-04-17_...MOM-vCenter.xlsx` (102 datastores, 84 hosts) during planning; if no trivial cluster linkage, DSH-01 per-cluster shows ESX + VM-by-OS counts and the datastore count is global-only (summary card) for Phase 2 — note this as a scoped simplification, full per-cluster datastore attribution lands with Phase 3's datastore table.

2. **Success-criterion #4 test mechanism (SVG verification).**
   - What we know: `<Chart>` injects `opts.renderer:'svg'`; jsdom doesn't render real ECharts SVG geometry.
   - What's unclear: cheapest reliable assertion (opts-level / DOM `<svg>` presence / Browser Mode).
   - Recommendation: planner picks one in Plan 1; a Browser-Mode smoke test for one chart is the highest-fidelity, lowest-ambiguity option and STACK.md already anticipates Browser Mode for chart tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `echarts` | VIZ-01/02/03 charts | ✗ (not yet installed) | needs `^6.0.0` | none — must `npm install` (declare in package.json, then `npm install`; Phase 1 deviation #1 in 01-03 shows the classifier permits manifest-then-install) |
| `echarts-for-react` | `<Chart>` wrapper | ✗ (not yet installed) | needs `^3.0.6` | none — same install path |
| vsizer aggregation sources | engine port | ✓ | read in full | — (sibling repo `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/`) |
| Real RVTools fixtures | integration test (ROADMAP success #1/6) | ✓ | 3 real + canary + sample in `tests/fixtures/` & `src/__fixtures__/` | canary (`rvtools-mib-canary.xlsx`, 1 VM/1 host/1 cluster) for unit math; `RVTools_export_all_2026-04-17_...MOM-vCenter.xlsx` (249 VM/84 ESX/102 ds) as the realistic integration fixture |
| Vitest Browser Mode | possible SVG-render test (success #4) | ✗ (jsdom only configured) | Vitest 4 supports it | jsdom opts-level assertion (A2) |

**Missing dependencies with no fallback:** `echarts`, `echarts-for-react` — must be installed (declare exact pins in `package.json` then `npm install`, matching the Phase 1-proven non-bypass path; supply-chain gate only pins `xlsx`, so these install cleanly).

**Missing with fallback:** Vitest Browser Mode — jsdom opts/DOM assertion is the fallback for success #4.

## Validation Architecture

> `config.json` has `workflow.nyquist_validation: false`. Per the section's skip rule, the detailed Nyquist test-map is omitted. The coverage discipline below still applies (it is a hard project gate, not Nyquist).

- **Engine coverage gate:** `engines/aggregation/**` must hit **≥75%** Vitest coverage (Phase 1 precedent: parser hit 93.5%; gate enforced in `vitest.config.ts` coverage include). Port vsizer's `*.test.ts` suites alongside the engine files — they are the regression net for the math (Moderate-4/5 tests, the 62.4 GHz unit test pattern, capacity-weighted-ratio tests).
- **ROADMAP-mandated tests (success criteria 2 & 6):** (a) the hyperthreads-vs-physical-cores test (structurally guaranteed by the type system since `VHostRow` has no threads field — still assert `vcpuPerPcpu` uses `cores`); (b) the `2 sockets × 12 cores × 2600 MHz = 62.4 GHz` unit test (Phase 1 `units` already has the converter version; aggregation adds the `physicalGhz` composition test); (c) three-accounting-modes-distinct-totals test on a 50/50 poweredOn fixture.
- **Integration test (success #1/#6):** drop canary + a real fixture → assert dashboard renders, per-cluster columns present, three modes distinct. Pattern: extend Phase 1's `src/__tests__/e2e-smoke.test.tsx` approach (drives the real pure pipeline) to `parseSnapshot → buildEstateView → render <GlobalDashboard>`.
- **Bundle-size gate:** build probe asserting echarts chunk ≤300 KB gz (Pitfall 4).

## Security Domain

> `config.json` has no `security_enforcement` key. Treating as enabled (absent = enabled). Phase 2 is pure client-side aggregation + rendering — no auth/session/network. The relevant controls are the inherited privacy invariants, not new ASVS surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth — 100% client-side, no backend. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-user/resource access. |
| V5 Input Validation | partial (inherited) | Validation already done at the parser boundary (Zod, Phase 1). Engines consume validated branded rows; **engines stay Zod-free** (do not re-validate). |
| V6 Cryptography | no | No crypto in aggregation/rendering (only `crypto.randomUUID` for snapshot ids — Phase 1, unchanged). |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Telemetry leak via new dep (echarts/echarts-for-react phoning home) | Information disclosure | Phase 1 runtime fetch/XHR/WS/Beacon guard + CSP `connect-src 'self'` already throw on any non-same-origin request; CI telemetry-package denylist. ECharts/echarts-for-react are render-only, no network — but the guard is the structural defense; verify the new deps add no outbound calls (the guard makes any attempt throw, so a leak is detectable not silent). |
| VM names / hostnames leaking via error payloads in chart/render code | Information disclosure (Critical-2) | Same FallbackError contract as Phase 1 (message/name only, never `cause`/row objects). Dashboard render errors must not interpolate `VInfoRow` objects into messages. |
| Wrong numbers (the real "threat" for an operator tool) | (Integrity of the report) | The ported vsizer ADRs (0010/0011/0012/0007) + the Critical-6 three-mode surfacing + the ≥75% engine coverage gate are the mitigations. Wrong numbers are worse than no numbers (SUMMARY.md). |

`[CITED: PITFALLS.md Critical-2, 01-05-SUMMARY threat-model adherence]` — Phase 2 adds no new network surface; the Phase 1 privacy controls cover the new deps. semgrep should scan generated code where the MCP tool is available (CLAUDE.md / project note); Phase 1 SUMMARYs note the semgrep MCP tool was not in the toolset there — planner should attempt a semgrep pass on new engine/UI files at Phase 2 review if available, else rely on the Phase-1 active controls (re-verify `check:supply-chain` green).

## Sources

### Primary (HIGH confidence)
- `/Users/fjacquet/Projects/vsizer/src/engines/aggregation/{ghz,perCluster,vinfoMerge,aggregateClusters,globals,contention,index}.ts` — read in full; the port source `[VERIFIED: codebase]`
- `/Users/fjacquet/Projects/vsizer/src/utils/format.ts` — read in full `[VERIFIED: codebase]`
- `/Users/fjacquet/Projects/rvtui/src/types/{snapshot,vinfo,vhost,index}.ts` — Phase 1 shipped types `[VERIFIED: codebase]`
- `/Users/fjacquet/Projects/rvtui/src/store/snapshotStore.ts` — Phase 1 final store contract `[VERIFIED: codebase]`
- `npm view echarts version / dist-tags / time` and `npm view echarts-for-react version / peerDependencies / dist-tags` `[VERIFIED: npm registry, 2026-05-16]`
- ECharts handbook — Import / tree-shaking page (`apache.github.io/echarts-handbook/en/basics/import/`) `[CITED]`
- ECharts v6 upgrade guide (`echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/`) `[CITED]`
- vatlas planning docs: PROJECT.md, REQUIREMENTS.md, ROADMAP.md (Phase 2 detail), research/{STACK,ARCHITECTURE,PITFALLS,SUMMARY}.md, phases/01-foundation-invariants/01-0{3,4,5}-SUMMARY.md `[VERIFIED: read]`

### Secondary (MEDIUM confidence)
- WebSearch: "Apache ECharts 6.0 breaking changes tree-shaking SVGRenderer" — corroborated v6 tree-shaking unchanged + default-theme change; cross-checked against the official handbook (raised to HIGH for the import-path claim).

### Tertiary (LOW confidence)
- A1 (per-cluster datastore count derivability) — needs fixture verification by the planner; marked ASSUMED.

## Metadata

**Confidence breakdown:**
- Standard stack (ECharts versions): HIGH — npm-registry-verified, peer-dep-confirmed.
- Aggregation port: HIGH — vsizer source read in full; retrofit is mechanical (field rename + brand unwrap); Phase 1 types confirm the field names.
- `<Chart>`/`useEstateView` design: HIGH for the constraints (PROJECT.md/01-05 contracts are explicit); MEDIUM for the exact prop shape (Claude's discretion — recommendation given with rationale).
- New engines (`perDatastore`/`perEsx`/`osFamily`): HIGH for shape; MEDIUM for DSH-01 per-cluster datastore count (A1, needs fixture check).
- Pitfalls: HIGH — sourced from the project's own verified PITFALLS.md + vsizer ADRs + npm verification.

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 for ECharts versions (fast-moving — 6.1.0 RC exists; re-verify `npm view echarts version` at execution). Stable indefinitely for the vsizer port map and Phase 1 contracts (those are committed code).
