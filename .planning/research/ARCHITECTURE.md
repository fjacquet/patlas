# Architecture Research — vatlas

**Domain:** Client-side VMware estate analytics web app (React 19 + TS + Vite, RVTools `.xlsx` ingestion, multi-snapshot, HTML + PPTX export).
**Researched:** 2026-05-15
**Confidence:** HIGH — derived directly from vsizer's shipped, tested architecture plus the explicit vatlas scope deltas in PROJECT.md.

---

## 1. Guiding Architectural Invariants

These are not negotiable in v1 — they cascade into every decision below.

1. **Pure engines.** All non-trivial logic lives in `engines/` as plain pure functions: `(input data) -> derived data`. No React, no Zustand, no DOM. Vitest-gated at 75 % coverage. Lifted directly from vsizer ADR-0005.
2. **Memory-only state.** Workbook bytes are dropped after parse. No `localStorage` / `IndexedDB` / `OPFS` of dataset rows (vsizer ADR-0001, ADR-0004 — PROJECT.md reaffirms). Refresh = data gone.
3. **Single source format.** RVTools only. The vsizer `detectSource` branch and the entire Live Optics adapter (`engines/parser/adapters/liveoptics.ts`, 11 KB) do not ship in vatlas v1.
4. **Snapshots are immutable.** A `Snapshot` is a parsed workbook + ingestion timestamp + user-named vCenter label. The user mutates *selection* (which snapshots are part of the active Estate, which clusters are stretched, which are failed for DR) — never the snapshot itself.
5. **Aggregation is a derivation.** Cluster aggregates, globals, trends, DR sim, EOS forecast are all *derived views* over the active Estate. The store keeps the inputs; engines produce the views; React renders them. No cached aggregates flowing back into the store except where re-derivation is too expensive (see §7 — memoization).
6. **Both exports consume the same view-models.** HTML report and PPTX deck read identical input shapes (`EstateView`, `ClusterAggregate[]`, `GlobalSummary`, `EosForecast`, `DrSimResult`). Adding a metric only touches one engine surface.

---

## 2. System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Upload / │ │ Global   │ │Inventory │ │  EOS     │ │  DR Sim  │     │
│  │ Snapshot │ │Dashboard │ │  Tree    │ │ Forecast │ │  Panel   │     │
│  │ Manager  │ │          │ │(cluster→ │ │          │ │          │     │
│  │          │ │          │ │ESX→VM)   │ │          │ │          │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       │            │            │            │            │            │
│   ┌───┴────────────┴────────────┴────────────┴────────────┴───┐        │
│   │           Trends View  │  Export Buttons (HTML / PPTX)     │        │
│   └───┬────────────────────────────────────────┬─────────────┘         │
│       │                                        │                       │
├───────┴────────────────────────────────────────┴───────────────────────┤
│                            HOOKS LAYER                                  │
│  useSnapshotUpload  · useEstateView  · useTrends  · useDrSim · useEos  │
│  useExportHtml      · useExportPptx  · useFilters · useStretchedFlags  │
├────────────────────────────────────────────────────────────────────────┤
│                        STORE (Zustand, memory-only)                     │
│  ┌─────────────┐ ┌───────────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ snapshots/  │ │ estateSelect/ │ │ scenarios/ │ │  ui/             │  │
│  │ slice       │ │ slice         │ │ slice (DR) │ │  slice           │  │
│  └─────────────┘ └───────────────┘ └────────────┘ └────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                       ENGINES (pure functions)                          │
│                                                                         │
│   parser/        ──► snapshotMerge/  ──►  aggregation/  ──┬──► drSim/   │
│   (RVTools only)     (N→1 estate)        (cluster+global)│             │
│                                                          ├──► eos/      │
│   trends/  ◄── snapshotTimeline (uses aggregation result) │             │
│                                                          ├──► export/   │
│                                                          │    html/     │
│                                                          └──► export/   │
│                                                               pptx/     │
│   shared: types/, utils/, schemas (Zod)                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `engines/parser/` | RVTools workbook → canonical typed rows. Pure. | SheetJS + column adapter + Zod validation. Forked from vsizer. |
| `engines/snapshotMerge/` | N parsed snapshots → unified Estate rows with cluster-collision resolution per vCenter. | Generalises vsizer `resolveClusterCollisions`. |
| `engines/aggregation/` | Estate rows → cluster aggregates + global summary, DR-aware for stretched clusters. | Direct port of vsizer math. |
| `engines/trends/` | Sequence of per-snapshot aggregates → time-series metrics (cluster count, host count, VM count, vCPU, vRAM, datastore growth). | New. |
| `engines/eos/` | VM `OS`/`Tools` columns + ESX build versions → at-risk count at +3/+6/+9/+12 months. | New, with curated catalogue. |
| `engines/drSim/` | Estate + failed-component set + stretched flags → survivor capacity per surviving cluster. | New, sits on top of aggregation. |
| `engines/export/html/` | View-models → self-contained HTML report file. | New. |
| `engines/export/pptx/` | View-models → PPTX deck. | Direct port of vsizer. |
| `store/snapshotsSlice` | Map of `snapshotId → Snapshot` (immutable). | Zustand. |
| `store/estateSelectSlice` | `Set<snapshotId>` user has activated for the current Estate. | Zustand. |
| `store/scenariosSlice` | Stretched flags, failed clusters/vCenters for DR sim, CPU/RAM overcommit ratios. | Zustand. |
| `store/uiSlice` | Active route/tab, theme, selected cluster for drill-down, table sort state. | Zustand. |
| `hooks/useEstateView` | Memoised aggregation pipeline over the active Estate + scenarios. | `useMemo` + selectors. |
| `components/` | Pure presentational React 19. Reads store + hook outputs. | Tailwind v4. |

---

## 3. Engine Module Catalogue

Each module is a directory of pure functions with sibling `*.test.ts` files. One-line responsibility per file:

### `engines/parser/`

- `parseXlsx.ts` — SheetJS `XLSX.read` → `ParsedWorkbook { sheets: Map<name, ParsedSheet> }`. **Lift from vsizer.**
- `adapters/rvtools.ts` — `ParsedWorkbook → { vinfo, vhost, vpartition, vdisk, vdatastore, vsc_vmk?, vmultipath? }`. **Extend vsizer adapter** to read more sheets (datastores, partitions, OS columns).
- `adapters/columnMap.ts` — Header-alias resolver. **Lift from vsizer.**
- `schemas.ts` — Zod schemas for `VInfoRow`, `VHostRow`, `VDatastoreRow`, `VPartitionRow`. **Extend.**
- `synthesizeOrphanClusters.ts` — Standalone-host VMs → synthetic cluster. **Lift from vsizer.**

Drop entirely from vsizer: `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts` (zip extraction was Live-Optics-specific in vsizer; reassess if vatlas needs zip support — out of scope per PROJECT.md v1).

### `engines/snapshotMerge/`

- `mergeSnapshotsToEstate.ts` — `Snapshot[] → EstateRows`. Tags every row with its source `vCenterLabel`. Resolves cluster collisions across vCenters via `"<cluster> (<vCenterLabel>)"` suffix.
- `vCenterIndex.ts` — Build `Map<vCenterLabel, { clusters, hosts, vmCount }>` for the vCenter-pivot views.

### `engines/aggregation/`

- `ghz.ts` — MHz→GHz primitives. **Lift from vsizer.**
- `perCluster.ts` — Host-side rollup per cluster. **Lift from vsizer.**
- `vinfoMerge.ts` — VM-side rollup per cluster, joined into host stats. **Lift from vsizer.**
- `aggregateClusters.ts` — Combine + apply stretched DR reservation. **Lift from vsizer.**
- `globals.ts` — Estate-wide summary. **Lift from vsizer.**
- `contention.ts` — CPU Ready bucketing. **Lift from vsizer.**
- `perDatastore.ts` — *New.* Datastore capacity/usage rollup keyed by datastore name across all hosts that see it.
- `perEsx.ts` — *New.* Per-host VM list, vCPU/RAM allocation, contention, derived for the inventory tree.

### `engines/trends/`

- `buildTimeline.ts` — `Snapshot[]` (already aggregated) → `TimelinePoint[]` sorted by `capturedAt`. Each point holds `globals`, `clusterAggregates` keyed by cluster, datastore growth.
- `deltaMetrics.ts` — Successive `TimelinePoint` pairs → growth-rate (`+5 VMs / month`, `+2 % vCPU`).
- `seriesForChart.ts` — Pivot timeline by metric for chart consumption: `{ metric: 'vmCount', points: [{t, v}] }`.

### `engines/eos/`

- `osCatalogue.ts` — Static lookup table: regex → `{ family, releaseDate, eosDate, eolDate }`. Curated, hand-maintained, ships with the app. Covers Windows Server 2008→2025, RHEL 6→10, Ubuntu LTS, ESX 5.5→8.0, etc.
- `classifyVm.ts` — `VInfoRow → { osFamily, eosDate | null, eolDate | null, status: 'supported' | 'eos-soon' | 'eos' | 'eol' }`.
- `classifyHost.ts` — ESX build → support state.
- `forecastAtRisk.ts` — Estate + horizon-months → `EosForecast { atRisk3m, atRisk6m, atRisk9m, atRisk12m, byOs: {…} }`.

### `engines/drSim/`

- `runScenario.ts` — `(EstateRows, DrScenario, stretchedFlags) → DrSimResult`. Removes failed clusters/vCenters from the host set, re-runs `aggregateClusters` + `aggregateGlobals` on survivors, computes "overflow vCPU / vRAM" the failed sites would dump on survivors.
- `allocate.ts` — Apply user CPU:pCPU and RAM overcommit ratios to compute headroom and "can survivors absorb the workload?" verdict (number, not editorial — ADR-0003 style).

### `engines/export/html/`

- `renderReport.tsx` — *Server-side-style* React component tree that takes `EstateView + scenarios` and returns an HTML string via `renderToStaticMarkup`. No event handlers, no hydration — pure HTML.
- `inlineAssets.ts` — Inline CSS (a small report-specific stylesheet, **not** the full Tailwind output) + base64-inlined chart SVGs.
- `renderCharts.ts` — Chart-library-agnostic SVG renderer that takes a series spec and emits a static `<svg>` string (charts in the HTML report must be SVG, not canvas, to survive being a single file).
- `assembleHtml.ts` — Wrap HTML + inline CSS + inline SVG + (optional) data-URI font into one `<html>…</html>` string. Returns `string`.

### `engines/export/pptx/`

- `builder.ts` — Top-level deck assembler. **Lift from vsizer**, expand slide set.
- `slides/titleSlide.ts`, `overviewSlide.ts`, `clusterSlide.ts`, `contentionAnnex.ts` — **Lift from vsizer.**
- `slides/eosSlide.ts`, `drSimSlide.ts`, `trendsSlide.ts`, `inventorySlide.ts` — *New.*
- `primitives/colors.ts`, `kpiCard.ts`, `progressBar.ts` — **Lift from vsizer.**
- `primitives/chartSvg.ts` — *New.* Render a minimal SVG bar/line chart for inclusion in PPTX (pptxgenjs supports SVG via `addImage({ data: 'data:image/svg+xml;base64,…' })`).

### `engines/format/`

- All formatters from vsizer `utils/format.ts` (locale-aware numbers, GHz, MB→GB, percent, dates). **Lift unchanged.**

---

## 4. Data Model — TypeScript Types

```typescript
// ────────── Snapshot model ──────────

/** One ingested RVTools workbook. Immutable after parse. */
export interface Snapshot {
  id: string                  // ULID, generated at ingest
  filename: string            // original file name (display only)
  fileSize: number            // bytes (display only)
  capturedAt: Date            // user-edited; default = file's mtime or now()
  vCenterLabel: string        // user-edited; default = derived from filename
  parsedAt: Date              // when this app finished parsing it
  source: 'rvtools'           // future-proof, but only 'rvtools' in v1

  // Canonical rows — already adapter-normalized and Zod-validated.
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vpartition: VPartitionRow[]

  parseErrors: ParseError[]
}

/** Active set chosen by the user. The "current view" is computed over this. */
export interface Estate {
  snapshotIds: ReadonlySet<string>      // which snapshots are in scope
  vCenterLabels: ReadonlySet<string>    // derived: snapshots' labels
}

// ────────── Scenario model ──────────

/** Disaster-recovery what-if. Mutable. */
export interface DrScenario {
  failedVCenters: ReadonlySet<string>   // mark whole vCenter as down
  failedClusters: ReadonlySet<string>   // or just specific clusters
  cpuOvercommitRatio: number             // default 4
  ramOvercommitRatio: number             // default 1.25
}

export interface StretchedFlags {
  clusters: ReadonlySet<string>          // cluster names marked stretched
}

// ────────── View-models (engine outputs) ──────────

/** The single payload that drives the dashboard, HTML report, and PPTX deck. */
export interface EstateView {
  estate: Estate
  scenario: DrScenario
  stretched: StretchedFlags

  // From the latest snapshot in the Estate (sorted by capturedAt):
  globals: GlobalSummary
  clusters: ClusterAggregate[]          // sorted by cluster name
  hosts: EsxAggregate[]                 // sorted by host name
  datastores: DatastoreAggregate[]
  vmsByCluster: Map<string, VInfoRow[]> // for tree drill-down

  // From all snapshots in the Estate (only populated if estate.snapshotIds.size > 1):
  trends: TimelinePoint[] | null

  // Computed from globals + scenario:
  drSim: DrSimResult

  // Computed from VInfoRow.os fields against the catalogue:
  eos: EosForecast
}

export interface TimelinePoint {
  snapshotId: string
  capturedAt: Date
  vCenterLabel: string
  globals: GlobalSummary
  clusters: ClusterAggregate[]
  datastoreTotalGb: number
}

export interface DrSimResult {
  survivors: ClusterAggregate[]
  surviving: GlobalSummary
  lostVcpu: number
  lostRamMb: number
  overflowVcpuPerSurvivor: number       // (lostVcpu × cpuOvercommitRatio) ÷ survivors
  overflowRamMbPerSurvivor: number
  verdict: 'absorbs' | 'tight' | 'overflows'   // factual: number-driven, not editorial
}

export interface EosForecast {
  asOf: Date
  byHorizon: {
    m3: { vmCount: number, hostCount: number, byFamily: Record<OsFamily, number> }
    m6:  { vmCount: number, hostCount: number, byFamily: Record<OsFamily, number> }
    m9:  { vmCount: number, hostCount: number, byFamily: Record<OsFamily, number> }
    m12: { vmCount: number, hostCount: number, byFamily: Record<OsFamily, number> }
  }
  unclassified: number                  // VMs whose OS string didn't match any catalogue entry
}
```

---

## 5. Zustand Store — Slice Diagram

```
useVatlasStore (combined slices)
│
├── snapshots: Map<string, Snapshot>          // immutable, append-only
│   ├── addSnapshot(s: Snapshot): void
│   ├── removeSnapshot(id: string): void
│   ├── renameVCenter(id: string, label: string): void
│   └── setCapturedAt(id: string, date: Date): void
│
├── estate: { snapshotIds: Set<string> }
│   ├── toggleSnapshot(id: string): void
│   ├── selectAll(): void
│   └── clearSelection(): void
│
├── scenario: DrScenario
│   ├── toggleFailedCluster(name: string): void
│   ├── toggleFailedVCenter(label: string): void
│   ├── setCpuOvercommit(r: number): void
│   └── resetScenario(): void
│
├── stretched: StretchedFlags
│   └── toggleStretched(cluster: string): void
│
└── ui: {
      activeTab: 'overview' | 'inventory' | 'eos' | 'dr' | 'trends'
      drillCluster: string | null
      drillHost: string | null
      theme: 'light' | 'dark' | 'system'
      lang: 'fr' | 'en'
    }
```

**Key design points:**

- **No `aggregates` in the store.** The store holds *inputs only* — snapshots, selections, flags. Aggregates are derived in `useEstateView()` with `useMemo` keyed on the inputs that matter (snapshot ids, stretched set identity, scenario identity). This is a deliberate departure from vsizer, which caches `aggregates` in the store — that worked because vsizer has a single immutable dataset; vatlas's DR sim changes too often for cache-in-store to pay off.
- **Sets, not arrays, for selection state.** `Set` identity makes `useMemo` cache invalidation natural: replace the set on every mutation; reference equality is enough.
- **Persistence:** **none**. Refresh = back to empty. The privacy invariant trumps the temptation to use `sessionStorage` for tab refreshes. UI-only prefs (`theme`, `lang`) may use `localStorage` — matches vsizer.

---

## 6. Multi-Snapshot Data Flow

```
Drop N .xlsx files
        │
        ▼
useSnapshotUpload
   ├─ extractWorkbookBytes(file)          (per file)
   ├─ parseXlsx(bytes)                    (per file, in Web Worker — see §7)
   ├─ adaptRvtools(parsedWorkbook)        (per file)
   ├─ Zod validate                        (per file)
   └─ snapshots.addSnapshot(snapshot)     (one mutation per file)
        │
        ▼  (user mutates: toggle snapshots in/out of Estate, mark stretched, configure DR)
        │
useEstateView(snapshots, estate, scenario, stretched)
   │
   ├─ activeSnapshots = [...estate.snapshotIds].map(id => snapshots.get(id)!)
   │                       .sort(by capturedAt asc)
   │
   ├─ if activeSnapshots.length === 0:
   │      return EMPTY_VIEW
   │
   ├─ if activeSnapshots.length === 1:
   │      latest = activeSnapshots[0]
   │      mergedRows = latest.{vinfo, vhost, vdatastore, …}
   │      trends = null
   │
   ├─ if activeSnapshots.length > 1:
   │      latest = activeSnapshots.at(-1)!         // most recent for the dashboard
   │      mergedRows = mergeSnapshotsToEstate([latest])  // dashboard is "now"
   │      trends = buildTimeline(activeSnapshots)        // each snapshot aggregated independently
   │
   ├─ stretchedSet = stretched.clusters
   │
   ├─ clusters = aggregateClusters({ ...mergedRows, stretchedClusters: stretchedSet })
   ├─ globals  = aggregateGlobals(clusters)
   ├─ drSim    = runScenario(mergedRows, scenario, stretchedSet)
   ├─ eos      = forecastAtRisk(mergedRows.vinfo, mergedRows.vhost, new Date())
   │
   └─ return { estate, scenario, stretched, globals, clusters, …, trends, drSim, eos }
```

**Multi-vCenter aggregation.** When `activeSnapshots.length > 1` and the user has explicitly chosen to *merge* (vs trend), the dashboard shows the union of the latest snapshot from each distinct `vCenterLabel`. Each label's `Snapshot` is treated as authoritative for its own vCenter. `mergeSnapshotsToEstate` handles cluster-name collisions across vCenters using the same `" (<vCenterLabel>)"` suffix vsizer already uses for file-level collisions.

**Trends mode.** When user selects multiple snapshots *of the same vCenter*, the timeline view runs `aggregateClusters` independently per snapshot and assembles a `TimelinePoint[]`. The dashboard remains anchored on the most recent snapshot.

These two modes are not mutually exclusive — the UI toggles between "merge across vCenters" (treat the active set as one estate) and "show evolution" (treat the active set as a timeline of one vCenter). Detection is automatic: if all active snapshots share `vCenterLabel`, default mode is *trend*; otherwise *merge*. The user can override.

---

## 7. Performance Strategy

Realistic worst case sized from RVTools exports we've seen: 20 clusters × 60 hosts/cluster × 30 VMs/host = ~36 000 VMs, ~1 200 hosts, ~6 000 datastores, ~150 000 vDisks, in a single workbook ~30 MB. Multiply by 12 monthly snapshots for the trends scenario → ~430 000 VM rows total in memory.

**Mitigations, listed by priority:**

1. **Web Worker for parsing.** `parseXlsx` + adapter + Zod can run in `engines/parser/index.worker.ts` invoked via `new Worker(new URL('./index.worker.ts', import.meta.url), { type: 'module' })`. Vite supports this natively. Frees the main thread during the 1–5 s SheetJS parse of a 30 MB workbook. **High priority for v1.**
2. **Memoise the view pipeline.** `useEstateView` returns a single object whose every field is computed in a `useMemo` keyed by referentially-stable inputs (the Set/Map identities the store handed out). The aggregation pipeline is fast in pure JS (vsizer benchmarks the full pipeline in tens of ms for ~10 000 VMs); the only cost is preventing it from running on every keystroke. **Required.**
3. **Virtualise long tables and trees.** Inventory tree (cluster → ESX → VM) at 36 000 leaves cannot render to DOM. Use **`@tanstack/react-virtual`** — lightweight, headless, framework-agnostic, works in trees by virtualising the *flattened* visible-row array. Same library handles the datastore table and the per-cluster VM table. **Required for v1.**
4. **Lazy-aggregate trends.** `buildTimeline` runs only when the user opens the Trends tab. Behind `useEstateView`'s `useMemo`, gated by a `enabled: tab === 'trends'` flag the hook reads from the UI slice.
5. **Defer non-default snapshots.** When the user loads 12 monthly exports, only parse + aggregate the most recent eagerly. Background-parse the rest (queue posted to the worker) so the dashboard becomes interactive while trends are still warming. Display a small "trends preparing — N/12" indicator.
6. **No PPTX/HTML generation on the main thread.** Both export builders run in a worker (`engines/export/index.worker.ts`). They synthesize 5–50 MB of bytes which would jank the main thread otherwise.
7. **Charting library — picked for performance.** Defer to the dedicated charting research, but the architectural requirement is *static SVG output*. Both the dashboard renderer and the HTML report renderer must produce identical SVG so we have one chart engine, not two. Candidates: `visx` (low-level, SVG-native, headless), `Recharts` (popular but DOM-heavy), `Apache ECharts` via SVG renderer (very fast but heavyweight bundle). Architectural preference is `visx` — fits the "engine returns SVG strings" pattern used by `engines/export/html/`.

**What we explicitly do NOT do:**

- No `IndexedDB`, no `OPFS`, no `SharedArrayBuffer` for cross-tab — would break the privacy invariant for marginal performance gain.
- No streaming SheetJS parse — `XLSX.read` is one-shot; the workaround is the Worker.
- No `react-window` — `@tanstack/react-virtual` is the newer headless successor and integrates with sortable column headers more cleanly.

---

## 8. Build Order (Dependency Graph)

```
Phase 0 — Bootstrap
        │
        ▼
Phase 1 — Parser  (engines/parser/)
        │   depends on: nothing (pure)
        │   delivers:   parseXlsx, adaptRvtools, schemas, single-snapshot import flow
        ▼
Phase 2 — Aggregation  (engines/aggregation/)
        │   depends on: parser
        │   delivers:   aggregateClusters, aggregateGlobals, perEsx, perDatastore
        │   UI:         global dashboard (single snapshot, no DR sim, no trends)
        ▼
Phase 3 — Multi-snapshot model  (engines/snapshotMerge/ + store/snapshotsSlice rework)
        │   depends on: parser, aggregation
        │   delivers:   multi-vCenter merge, snapshot list UI, vCenter label edit
        ▼
Phase 4 — Inventory tree (cluster → ESX → VM) UI
        │   depends on: aggregation, multi-snapshot model
        │   delivers:   virtualised tree, sortable tables, datastore view
        │   no new engine — just consumes aggregates that already exist
        ▼
Phase 5 — Stretched-cluster + DR sim  (engines/drSim/)
        │   depends on: aggregation
        │   delivers:   stretched toggle (already in aggregation port), failed-cluster/vCenter sim
        ▼
Phase 6 — EOS forecast  (engines/eos/)
        │   depends on: parser (needs OS column expansion), aggregation
        │   delivers:   curated catalogue, 3/6/9/12-month forecast, EOS tab
        ▼
Phase 7 — Trends  (engines/trends/)
        │   depends on: multi-snapshot model, aggregation
        │   delivers:   timeline charts (cluster/host/VM/vCPU/vRAM/datastore)
        ▼
Phase 8 — HTML report export  (engines/export/html/)
        │   depends on: every view-model from Phases 2 / 5 / 6 / 7
        │   delivers:   single-file HTML, inlined CSS + SVG charts
        ▼
Phase 9 — PPTX export  (engines/export/pptx/)
        │   depends on: every view-model from Phases 2 / 5 / 6 / 7
        │   delivers:   PPTX deck with title / overview / cluster / EOS / DR / trends slides
        ▼
Phase 10 — Polish, i18n FR, GH Pages deploy
```

**Dependency rationale:**

- **Parser before everything** because every engine takes its rows as input.
- **Aggregation before multi-snapshot** because the single-snapshot path must work first; multi-snapshot is a *wrapper* over single-snapshot aggregation per timepoint.
- **Inventory tree after aggregation** because the tree consumes `perEsx` + `vmsByCluster`, both aggregation outputs.
- **DR sim after aggregation** because DR sim *is* aggregation re-run on a subset of hosts.
- **EOS after parser-expansion** because EOS needs the OS column the v1 parser doesn't currently surface (vsizer's adapter omits it).
- **Trends after multi-snapshot** by definition — a single snapshot has no timeline.
- **Both exports last** because each consumes every view-model; iterating exports against incomplete view-models doubles the work.

Phases 8 and 9 (HTML and PPTX) can ship in parallel after Phase 7 lands. Phase 5 (DR sim) and Phase 6 (EOS) can also ship in parallel after Phase 4.

---

## 9. Reuse Map from vsizer

| vsizer file | vatlas action | Notes |
|-------------|---------------|-------|
| `src/engines/parser/parseXlsx.ts` | **Port unchanged** | SheetJS wrapper; format-agnostic. |
| `src/engines/parser/adapters/columnMap.ts` | **Port unchanged** | Header-alias resolver. |
| `src/engines/parser/adapters/rvtools.ts` | **Port + extend** | Add OS column, datastore/partition extraction. |
| `src/engines/parser/adapters/liveoptics.ts` | **Drop** | Out of scope. |
| `src/engines/parser/detectSource.ts` | **Drop** | Single format. |
| `src/engines/parser/extractWorkbook.ts` | **Drop** | Was Live-Optics zip helper. |
| `src/engines/parser/normalizeColumns.ts` | **Port unchanged** | |
| `src/engines/parser/schemas.ts` | **Port + extend** | Add `VDatastoreRow`, `VPartitionRow` schemas. |
| `src/engines/parser/synthesizeOrphanClusters.ts` | **Port unchanged** | Standalone-host VM handling. |
| `src/engines/parser/resolveClusterCollisions.ts` | **Port + generalise** | Now keyed by `vCenterLabel`, not filename. Same algorithm. |
| `src/engines/aggregation/ghz.ts` | **Port unchanged** | |
| `src/engines/aggregation/perCluster.ts` | **Port unchanged** | |
| `src/engines/aggregation/vinfoMerge.ts` | **Port unchanged** | |
| `src/engines/aggregation/aggregateClusters.ts` | **Port unchanged** | Stretched-cluster DR math intact. |
| `src/engines/aggregation/globals.ts` | **Port unchanged** | |
| `src/engines/aggregation/contention.ts` | **Port unchanged** | |
| `src/engines/export/pptx/builder.ts` | **Port + extend** | New slide types appended. |
| `src/engines/export/pptx/slides/*.ts` | **Port unchanged** | Title / Overview / Cluster / Contention stay; add EOS / DR / Trends / Inventory siblings. |
| `src/engines/export/pptx/primitives/*.ts` | **Port unchanged** | |
| `src/utils/format.ts` | **Port unchanged** | |
| `src/types/{cluster,global,vinfo,vhost,source}.ts` | **Port + extend** | Add `Snapshot`, `Estate`, `DrScenario`, `EosForecast`, `TimelinePoint`, `VDatastoreRow`. |
| `src/store/datasetStore.ts` | **Rewrite** | Multi-snapshot model is a different shape; pattern survives, structure changes. |
| `src/i18n/` | **Port + extend** | Add namespaces: `inventory`, `eos`, `dr`, `trends`, `report`. |
| `src/test/setup.ts` | **Port unchanged** | |
| `biome.json`, `vitest.config.ts`, `tsconfig.*.json` | **Port unchanged** | Same tooling discipline. |
| `.github/workflows/static.yml` | **Port + tweak base URL** | `base: '/vatlas/'`. |
| `src/__fixtures__/` | **Port** | Plus add multi-snapshot fixtures. |

**Net-new engine modules:** `snapshotMerge/`, `trends/`, `eos/`, `drSim/`, `export/html/`, `aggregation/perDatastore.ts`, `aggregation/perEsx.ts`.

---

## 10. HTML Report Architecture

**Goal:** one `.html` file the user double-clicks anywhere with no network, no missing assets, no JavaScript.

```
EstateView + scenario + stretched
        │
        ▼
engines/export/html/renderReport.tsx
   ├─ React component tree (function components, no hooks)
   │     ├─ <Header />            (title, vCenter labels, capture date range)
   │     ├─ <GlobalKpiSection />  (numbers from globals)
   │     ├─ <ClusterCards />      (one card per cluster — table + inline SVG bar)
   │     ├─ <InventoryTable />    (paginated server-side: top 100 VMs by vRAM, or full)
   │     ├─ <EosSection />        (forecast horizons + table by OS family)
   │     ├─ <DrSimSection />      (survivors, overflow numbers)
   │     ├─ <TrendsSection />     (only if trends !== null; line charts as SVG)
   │     └─ <Footer />            (generation timestamp, vatlas version)
   │
   ▼ renderToStaticMarkup() (react-dom/server)
   │
   HTML string
        │
        ▼
inlineAssets(htmlString)
   ├─ Prepend <style> block: a hand-written ~5 KB stylesheet (NOT Tailwind's full output).
   │     Reuses Midnight Executive variables in literal CSS — same palette as PPTX.
   ├─ Charts are already inline <svg>…</svg> from renderCharts.ts.
   ├─ No <img>, no <link>, no <script>.
   └─ Wrap with <!DOCTYPE html><html lang="…"><head>…</head><body>…</body></html>.
        │
        ▼
String → Blob({ type: 'text/html;charset=utf-8' }) → trigger download
```

**Why React renderToStaticMarkup?** The team already writes React; reusing the dashboard component patterns (slightly trimmed) for the report is the shortest path. The renderer runs *in the main thread* — output is just a string, not a worker boundary issue — but for a 36 000-VM estate where the report might be 8 MB of HTML, the rendering itself should move to a worker. Worker can import `react-dom/server` cleanly.

**Why a hand-written stylesheet, not Tailwind?** Bundling Tailwind's full CSS into a single shareable HTML file would inflate it by ~50 KB and pull in classes the report doesn't use. A ~5 KB report-specific stylesheet keyed to the Midnight Executive variables is leaner and stays in sync with the PPTX theme.

**Why SVG charts, not canvas?** Canvas can't be embedded as static markup. SVG strings inline cleanly into the HTML output. Same SVG-emitter is reused by the on-screen dashboard charts and the PPTX deck (pptxgenjs accepts SVG via `addImage`). One chart engine, three outputs.

---

## 11. Data Flow Diagrams

### Snapshot Ingest

```
User drops N files
   │
   ▼
useSnapshotUpload (per file, in worker)
   │  parseXlsx → adaptRvtools → zod validate
   ▼
snapshots.addSnapshot({ id, vinfo, vhost, …, capturedAt, vCenterLabel })
   │
   ▼
estate.toggleSnapshot(id)   ← default: auto-select newly added
```

### Active Dashboard View

```
useVatlasStore (snapshots, estate, scenario, stretched, ui)
   │
   ▼ select inputs
useEstateView({snapshots, estate, scenario, stretched})
   │  useMemo:
   │    1. resolve active snapshots
   │    2. merge → cluster aggregates → globals
   │    3. drSim, eos, (optionally) trends
   ▼
EstateView
   │
   ▼ subscribe (Zustand selectors keep referential stability)
<Dashboard /> · <Inventory /> · <Eos /> · <Dr /> · <Trends />
```

### Export

```
EstateView + scenario + stretched
   │
   ├──► useExportHtml() ──► worker.postMessage('html', view)
   │                         worker: renderReport + inlineAssets
   │                         worker.postMessage(htmlString)
   │                       main: Blob + download
   │
   └──► useExportPptx() ──► worker.postMessage('pptx', view)
                             worker: buildPptx (pptxgenjs)
                             worker.postMessage(arrayBuffer)
                           main: Blob + download
```

---

## 12. Anti-Patterns to Avoid

### Anti-Pattern 1: Caching aggregates in the store

**What people do:** Stash `aggregates: Record<string, ClusterAggregate>` on the store (vsizer does this) and update it via store actions whenever a flag flips.

**Why it's wrong for vatlas:** DR sim makes the aggregate set depend on `scenario.failedClusters`, the EOS view depends on the asOf date, and trends depend on the full snapshot timeline. Cache invalidation across all those axes inside the store is mistakes-waiting-to-happen.

**Do this instead:** Store inputs (snapshots, scenario, stretched), derive aggregates in `useEstateView` with `useMemo`. The compute is fast in pure JS; the bug surface from manual invalidation is the real cost.

### Anti-Pattern 2: Letting React components import engines directly for *transforms*

**What people do:** `const clusters = useMemo(() => aggregateClusters(vinfo, vhost), [...])` scattered across components.

**Why it's wrong:** Two components ask for the same aggregate twice → recompute twice. Also entangles components with engine signatures.

**Do this instead:** A single `useEstateView` hook owns the whole pipeline. Components consume the view-model only. The hook is the *one* engine bridge.

### Anti-Pattern 3: Tailwind in the HTML report

**What people do:** Reuse the dashboard's JSX as-is for the report and let Vite ship the Tailwind output inlined.

**Why it's wrong:** The full Tailwind build is ~30–50 KB even after purge; the report uses ~5 KB worth of styles. A 36 000-VM report HTML will already be 5+ MB — every kilobyte of CSS chrome is wasted.

**Do this instead:** Hand-written stylesheet for the report renderer. Keep the Midnight Executive variables in sync with `index.css`.

### Anti-Pattern 4: Generating PPTX or HTML on the main thread

**What people do:** Call `buildPptx` from a button handler, await it, download.

**Why it's wrong:** A 30-cluster deck takes seconds; the UI freezes; the user thinks the app crashed.

**Do this instead:** Both exports run in a Worker. Main thread shows a progress indicator and remains interactive.

### Anti-Pattern 5: Mutating Snapshots

**What people do:** Compute trends by re-aggregating and storing the per-snapshot aggregate *back on the Snapshot*.

**Why it's wrong:** Snapshots must be reference-stable so `useMemo` dependencies work. A mutation triggers cascading recomputes.

**Do this instead:** Snapshots are frozen on insert. Trends are computed once per `(snapshotIds, stretched)` pair, memoised in the view hook.

### Anti-Pattern 6: Per-snapshot vCenter inference from filename

**What people do:** Try to parse `vCenterLabel` from `filename` regex.

**Why it's wrong:** Filename conventions vary by client; mis-detection silently merges clusters that shouldn't merge.

**Do this instead:** Default to a filename-derived label, but require user confirmation in the snapshot list. The user is the authority on vCenter identity.

---

## 13. Scaling Considerations

| Estate size (single snapshot) | Architecture stays the same? | Notes |
|---|---|---|
| Up to 10 clusters / 100 hosts / 5 k VMs | Yes | No virtualisation strictly needed but ship it anyway — UX is uniform. |
| 10–50 clusters / 1 000 hosts / 30 k VMs | Yes | Virtualised tree + memoised view hook handles this. |
| 50+ clusters / 5 000+ hosts / 100 k+ VMs | Yes, with caveats | Parse moves to a Worker (already), tree virtualisation is mandatory, HTML report becomes slow to render — chunk into sections, generate progressively. |
| Trend with 24 monthly snapshots × 30 k VMs each | Yes | Background-parse all but the latest; lazy-compute trends. |

**Scaling priorities:**

1. **First bottleneck:** SheetJS parse on a 30 MB workbook (~1–5 s). Mitigation: Worker, already in plan.
2. **Second bottleneck:** Aggregation on 100 k VMs. Mitigation: memoisation. JS is fast enough; native loops in `aggregation/` do not need parallelisation.
3. **Third bottleneck:** Rendering the inventory tree of 36 000 leaves. Mitigation: `@tanstack/react-virtual` from day one.
4. **Fourth bottleneck:** HTML report file size (8+ MB for large estates). Mitigation: paginate inventory table inside the report (top 100 + per-cluster top 25) — full inventory is in the dashboard, not the report.

---

## 14. Integration Points

### External Services

**None.** vatlas is 100 % client-side. There is no API surface, no third-party service, no telemetry. The OS EOS catalogue is shipped *with the bundle* as a TypeScript module, not fetched.

### Internal Boundaries

| Boundary | Direction | Contract |
|---|---|---|
| UI ↔ Hooks | bidirectional | Hooks subscribe to store + return derived view-models. UI calls store actions. |
| Hooks ↔ Engines | one-way | Hooks call engine functions; engines never reach back. |
| Engines ↔ Engines | one-way DAG | parser → snapshotMerge → aggregation → {drSim, eos, trends, export}. No cycles. |
| Store ↔ Engines | one-way | Store actions may call engines to validate input (e.g. parser at ingest). Engines never read the store. |
| Main thread ↔ Workers | one-way each | Parsing worker accepts `ArrayBuffer + filename`, returns `Snapshot`. Export worker accepts `EstateView`, returns `ArrayBuffer` or `string`. |

---

## 15. Sources & Confidence

- **vsizer codebase** (`/Users/fjacquet/Projects/vsizer/src/`) read in full: `CLAUDE.md`, `package.json`, `engines/parser/`, `engines/aggregation/`, `engines/export/pptx/`, `store/datasetStore.ts`, `types/`. HIGH confidence — this is the proven baseline the user explicitly asked to reuse.
- **PROJECT.md** for vatlas — defines the scope deltas (drop Live Optics, add EOS / DR sim / multi-snapshot / HTML report / inventory tree). HIGH confidence — explicit author intent.
- **Architectural patterns** (pure engines, memory-only store, Worker offload, virtualised tree) — direct extrapolation from the vsizer pattern + standard React 19 + TanStack practice. HIGH confidence.
- **Performance numbers** (parse time, estate size envelope) — order-of-magnitude estimates from typical RVTools exports + vsizer benchmark data. MEDIUM confidence; will need verification with real fixtures in Phase 1.
- **Chart library preference for `visx`** — based on the SVG-string-as-engine-output requirement (HTML report must inline). MEDIUM confidence; defer to a dedicated charting research pass.

---

*Architecture research for vatlas — VMware estate analytics web app.*
*Researched: 2026-05-15.*
