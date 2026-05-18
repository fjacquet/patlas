# Phase 8: In-Session Trends - Research

**Researched:** 2026-05-17
**Domain:** Multi-snapshot temporal aggregation + ECharts time-axis charting + non-blocking Web Worker warm-up, all within vatlas' single-`useMemo` / inputs-only-store / privacy invariants
**Confidence:** HIGH (codebase-verified; ECharts time-axis CITED from official docs)

## Summary

Phase 8 produces a temporal series by running the **existing Phase-2 pure aggregation pipeline once per snapshot** and collecting the per-snapshot results into a `TrendSeries` shape carried on `EstateView.trends` (the field already exists, currently `null`). The central tension (DD-A) resolves cleanly: the single `useMemo` in `useEstateView.ts` keeps doing exactly what it does — merge the *active selection* into one estate via `mergeSnapshotsToEstate` then `buildEstateView` — and the temporal series is computed **inside that same memo, inside the same pure `buildEstateView` call**, by iterating each selected snapshot through `aggregateGlobals`/`aggregateClusters` a second axis of the same data. No second `useMemo`, no second memo site, no change to the Phase-4 merge path. [VERIFIED: src/hooks/useEstateView.ts, src/engines/aggregation/estateView.ts]

The temporal X-axis (TRD-02) is a solved problem in ECharts: `xAxis: { type: 'time' }` plus `series.data` as `[Date, value]` pairs renders **true non-uniform spacing keyed on the real date value, not the array index** — exactly the success-criterion-2 requirement. [CITED: echarts-doc/en/option/partial/2d-data.md] One gap: `LineChart` is **not yet registered** in `Chart.tsx`'s `echarts.use([...])` (only Bar/Pie/Gauge/Heatmap are) — the planner must add `import { LineChart } from 'echarts/charts'` and register it; the bundle-size gate (≤300 KB gz) must be re-checked after. [VERIFIED: src/components/Chart.tsx]

The non-blocking warm-up (D-01/D-02) requires changing `useSnapshotUpload` from a blocking sequential `for await` to a **latest-`capturedAt`-first ordered, fire-and-forget background drain** that `addSnapshot`s each result as it lands, so the active estate (the latest snapshot) renders immediately and trend points fill progressively through the normal store→memo reactive path. The singleton Worker constraint is preserved (still one parse at a time). Memory release (DD-C) is a new inputs-only store mutation that REPLACES a snapshot's row arrays with `[]` while keeping its already-collected aggregate in the trends series.

**Primary recommendation:** Add a pure `src/engines/trends/` module (`buildTrendSeries`) called *inside* `buildEstateView`; carry `TrendSeries | null` on `EstateView.trends`; timeline point = one `capturedAt` date (same-date multi-vCenter files merged spatially first — DD-A option 2); delta panel = count-deltas on existing aggregate fields between consecutive points (DD-B option 1); release raw rows oldest-first when loaded count > 4, never the active/latest (DD-C).

## User Constraints (from CONTEXT.md)

### Locked Decisions (do NOT re-investigate alternatives)

- **D-00:** All P4/P7 invariants hold — calc-from-real-data only; single `useMemo` (`useEstateView`→`buildEstateView`), trends composes inside the existing pure aggregation, NO new `useMemo`, no second memo site (grep-gated); store inputs-only (`Map<id,Snapshot>` + selection Sets, REPLACED never mutated, no cached aggregates); privacy/in-memory only (no `localStorage`/`sessionStorage`/IndexedDB of dataset rows — refresh = data gone); factual labels, no editorial verbs; EN/FR i18n parity (keys in both `en/` and `fr/`, no pre-formatted numbers in strings); branded units (GiB/MiB/GHz/MHz, never raw `* 1.048576`); em-dash sentinel for "not determinable".
- **D-01:** Active estate = the latest-`capturedAt` snapshot, parsed first. Dashboard renders that single estate, interactive immediately (5 s criterion applies to it); older snapshots warm in background.
- **D-02:** Warm-up is non-blocking and progressive. Small factual "trends preparing — N/M" indicator scoped to the trends/sparkline area only (NOT a global blocking overlay). Points/sparklines fill progressively. Factual text, no editorial verb, EN/FR parity.
- **D-03:** User-editable capture date IN SCOPE. `SnapshotListSidebar` gets inline-editable `capturedAt` per snapshot, reusing the **existing `setCapturedAt` store action** (shipped Phase 6 — no new store mutation). Editing recomputes the series through the single memo. Explicit user input is highest-priority capture-date source.
- **D-04:** Capture-date inference order = shipped `inferCaptureDate` chain (explicit → filename ISO → `vMetaData` timestamp → mtime) **plus** a deterministic ordinal fallback. The ROADMAP "vSource sheet" wording maps to the already-shipped `vMetaData` resolution — do NOT add a new sheet probe; only add a `vSource` probe if a real fixture proves `vMetaData` insufficient.
- **D-05:** Date-tie / missing-date = ordinal fallback + factual note. Keep real dates where known. Same-resolved-date or no-inferable-date → assign deterministic ordinal position (stable load order) so points don't collapse + surface a factual caption that ordering is inferred. Nothing dropped, nothing fabricated as a real date. Duplicate-date loads NOT rejected.

### Claude's Discretion (research provides options + recommendation; see DD-A/B/C sections below)

- **DD-A:** Timeline-point identity (per-file vs per-`capturedAt`-date) & multi-vCenter merge composition with the temporal axis. Hard constraints: each point carries snapshot metadata (vCenter label + RVTools version); axis uses real `capturedAt` with non-uniform spacing; must not break single-memo or Phase-4 merge; counts must reconcile.
- **DD-B:** Delta-panel semantics — count-deltas vs identity-resolved churn (Phase-4 keys), which metrics, consecutive-pairs vs also-baseline. Hard constraints: factual phrasing, no editorial verbs; branded units; deltas from real parsed columns only; consistent with "between consecutive snapshots".
- **DD-C:** Memory-release policy (N > 4) — which stay hydrated (active/latest must per D-01), release trigger/order, threshold fixed-vs-surfaced. Hard constraints: only aggregated series retained for released snapshots; active estate never released while active; released → loses drill/re-merge (surface factually if UI changes); still in-memory only.

### Deferred Ideas (OUT OF SCOPE — do not act on)

- EOS-over-time / at-risk-count trend (P7-deferred; only if a TRD demands it — TRD set does not).
- Cross-session / persisted trends history (TRD-05 forbids it; never revisit without project-level privacy change).
- HTML/PPTX export of trends view → Phase 10 (P8 makes the view export-ready via the shared projection shape; does not generate the artifact).
- Live Optics / multi-format trend input — out of v1 scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRD-01 | Load 2–12 monthly snapshots together; headline metrics evolve over time | `buildTrendSeries` inside `buildEstateView` runs the shipped Phase-2 aggregation once per selected snapshot; series carried on `EstateView.trends`. Store already supports N snapshots (`Map<id,Snapshot>` + `selectedSnapshotIds`, default = all). [VERIFIED: snapshotStore.ts, estateView.ts] |
| TRD-02 | Temporal X-axis (actual capture dates, not categorical labels) | ECharts `xAxis:{type:'time'}` + `[Date,value]` pairs = non-uniform real-date positioning. [CITED: echarts-doc 2d-data.md / whats-new-in-echarts-v5.md] Register `LineChart` in `Chart.tsx`. |
| TRD-03 | Per-cluster sparklines on dashboard when 2+ snapshots loaded | Per-cluster series is a slice of the same `TrendSeries` (cluster→points map). Sparkline = same `<Chart>` line option with axes/grid/labels stripped. [VERIFIED: Chart.tsx single `option` prop; ECharts `showSymbol:false`, minimal grid] |
| TRD-04 | Delta panel: what changed between consecutive snapshots | Consecutive-pair count-deltas computed in `buildTrendSeries` from existing aggregate fields (vmCount, poweredOn, vcpuAllocated, vramAllocatedMib, etc.). Factual, branded, no editorial verb. (DD-B) |
| TRD-05 | Refresh ⇒ trends gone (no cross-session persistence) | Satisfied by construction: store is module-scope `new Map()`, no persist middleware, no storage writes; trends are derived, never stored. Verification = the existing PAR-05 refresh test pattern, extended to multi-snapshot. [VERIFIED: snapshotStore.ts header comment] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-snapshot temporal aggregation | Pure engine (`engines/trends/`) | `engines/aggregation` (reused) | Engines are pure, Vitest-gated ≥75%; trends is a new vertical analytics capability on the same spine. No React/DOM/Zustand. |
| Composition into `EstateView.trends` | Pure engine (`buildEstateView`) | — | Single composition point; the one memo's pure callee. No second memo. |
| Memo orchestration | `useEstateView` hook | — | The single sanctioned `useMemo`; only orchestrates + memoizes. |
| Snapshot inputs + capture-date edits + memory release | Zustand store (`snapshotStore`) | — | Inputs-only; `setCapturedAt` reused (D-03); release = new inputs-only mutation REPLACING the Map. |
| Background warm-up ordering & drain | Upload hook (`useSnapshotUpload`) | parser singleton Worker | New non-blocking behavior; Worker stays singleton (one parse at a time). |
| Trend line chart + sparklines | `<Chart>` component (reused) | `chartOptions`-style pure builders | No new chart component/renderer (CONTEXT explicit). Pure option builders off the memoized view. |
| Capture-date edit UI + warm-up indicator + inferred-order caption | `SnapshotListSidebar` / `SnapshotCard` | — | Host for D-03 inline edit, D-02 indicator, D-05 caption. |
| Trends view shell + dashboard sparkline slots | New `TrendsView` + dashboard cluster cards | `ViewToggle` (extend `AppView`) | New top-level segment mirrors EOS precedent (P7). |

## Standard Stack

**No new dependencies.** Every capability uses libraries already pinned in `package.json` and patterns already shipped.

### Core (already installed — versions verified in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| echarts | `^6.0.0` | Trend line chart + sparklines via `xAxis:{type:'time'}` | Already the project chart engine; v6 time-axis API unchanged from v5. [VERIFIED: package.json] [CITED: echarts-doc] |
| echarts-for-react | `^3.0.6` | React binding via `<Chart>` | Already the single chart import site. [VERIFIED: Chart.tsx] |
| react | `^19.2.6` | UI runtime | Shipped. [VERIFIED: package.json] |
| zustand | `^5.0.13` | Inputs-only store (snapshots Map + selection + new release mutation) | Shipped; `setCapturedAt` already exists. [VERIFIED: snapshotStore.ts] |
| react-i18next / i18next | `^16.6.6` / `^26.1.0` | New `trends` namespace EN+FR | Shipped i18n chain; mirror `eos.json` precedent. |

### Supporting (existing internal modules — reuse, do not re-create)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/engines/aggregation/{globals,aggregateClusters}.ts` | Per-snapshot headline + per-cluster aggregates | Called once per snapshot inside `buildTrendSeries`. |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` | Spatial merge of same-date multi-vCenter files | DD-A option 2: merge same-`capturedAt` files into one estate, THEN aggregate that estate as one timeline point. |
| `src/engines/parser/captureDate.ts` `inferCaptureDate` | Capture-date chain (explicit→filename→vMetaData→mtime) | Already wired in the parser worker. P8 adds only the ordinal tiebreaker (D-05) + UI explicit override (D-03 via `setCapturedAt`). |
| `src/engines/units/converters.ts` | Branded MiB→GiB etc. (`mibToGib`, no `*1.048576`) | Delta numbers in branded units. [VERIFIED] |
| `src/utils/format.ts` | Locale date/number formatting (`fmtDate`, `fmtMemMb`, `fmtInt`) | Axis labels + delta numbers; no pre-formatted numbers in i18n strings. [VERIFIED] |
| `src/components/Chart.tsx` | Single SVG ECharts primitive (`option` prop) | Trend chart + sparkline both feed it; add `LineChart` to its registry. |
| `src/store/snapshotStore.ts` `setCapturedAt` | Inline capture-date edit | D-03 reuse verbatim — no new mutation for the edit. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff / Why rejected |
|------------|-----------|-------------------------|
| `xAxis:{type:'time'}` | `xAxis:{type:'category'}` with date strings | Category axis spaces points **evenly by index** — directly violates success criterion 2 / TRD-02. Rejected. [CITED: echarts-doc — category vs time axis] |
| Compute trends inside `buildEstateView` | Second `useMemo` / store-cached series | Both forbidden by D-00 (grep-gated single memo; inputs-only store). Not an option. |
| New chart component for sparkline | — | CONTEXT explicit: sparkline = minimal line variant on the same `<Chart>`. |
| Identity-resolved churn for delta panel (DD-B) | Count-deltas only | Both viable; recommendation = count-deltas (see DD-B) — simpler, KISS, all fields already exist; churn is a v2 idea (DIF-01). |

**Installation:** none.

**Version verification:** `echarts ^6.0.0`, `echarts-for-react ^3.0.6`, `react ^19.2.6`, `zustand ^5.0.13` — all already in `package.json` (verified by reading the file, not the registry, since nothing new is added). The ECharts time-axis API is documented for v5 and explicitly unchanged in v6 per the project's own CLAUDE.md charting note.

## Architecture Patterns

### System Architecture Diagram

```
 User drops N files (UploadZone)
        │
        ▼
 useSnapshotUpload  ── NEW: order files latest-capturedAt-first ──┐
        │  (singleton Worker: parse ONE at a time)                │
        ▼                                                          │
 parseInWorker (parser.worker.ts) ── inferCaptureDate ────────────┘
        │  (snapshot ready)
        ▼
 store.addSnapshot(snapshot)   ◄── fired per-result as each parse lands
        │   (Map<id,Snapshot> REPLACED; selectedSnapshotIds += id)
        │   (DD-C: when loaded count > 4, releaseRawRows(oldest non-active id))
        ▼
 useSnapshotStore (inputs-only)
        │  snapshots Map + selectedSnapshotIds + stretched + scenario + planned
        ▼
 useEstateView  ── THE SINGLE useMemo ───────────────────────────────────┐
        │  selected = snapshots ∩ selectedSnapshotIds                     │
        │  merged   = mergeSnapshotsToEstate(selected)   ← Phase-4 path    │
        │             (active-selection ESTATE — unchanged)               │
        │  view     = buildEstateView(merged, mode, today, opts)          │
        │                       │                                          │
        │                       ├── globals/clusters/eos/... (unchanged)   │
        │                       └── trends = buildTrendSeries(selected,    │
        │                                       mode, opts)  ◄── NEW       │
        │                            per snapshot/point:                   │
        │                              groupByCapturedDate(selected)       │
        │                              → mergeSnapshotsToEstate(sameDate)  │
        │                              → aggregateGlobals + aggregateClusters
        │                              → TrendPoint{date, ordinal?,        │
        │                                  metadata[], headline, byCluster}│
        │                              → consecutive-pair deltas (DD-B)    │
        └──────────────────────────────────────────────────────────────── ┘
        │  EstateView { ...existing, trends: TrendSeries | null }
        ▼
 ┌─────────────┬──────────────────────┬───────────────────────────┐
 │ TrendsView  │ Dashboard cluster    │ SnapshotListSidebar       │
 │ (new seg)   │ cards: sparkline slot│  inline capturedAt edit   │
 │ <Chart>     │ <Chart> minimal line │  warm-up "N/M" indicator  │
 │ time-axis   │ (when ≥2 points)     │  inferred-order caption   │
 │ + delta pnl │                      │                           │
 └─────────────┴──────────────────────┴───────────────────────────┘
```

### Recommended Project Structure

```
src/
├── engines/
│   └── trends/                 # NEW pure module, Vitest-gated ≥75% (mirrors engines/eos/)
│       ├── buildTrendSeries.ts # per-snapshot aggregation → TrendSeries + deltas
│       ├── captureDateOrdinal.ts # D-05 deterministic ordinal fallback (pure)
│       ├── buildTrendSeries.test.ts
│       ├── captureDateOrdinal.test.ts
│       └── index.ts            # barrel (mirrors aggregation/index.ts)
├── types/estate.ts             # EXTEND: replace placeholder TimelinePoint with TrendSeries/TrendPoint/TrendDelta
├── engines/aggregation/estateView.ts # MODIFY: call buildTrendSeries; trends = ... not null
├── store/snapshotStore.ts      # ADD: releaseRawRows(id) inputs-only mutation (DD-C)
├── hooks/useSnapshotUpload.ts  # MODIFY: latest-first ordering + non-blocking drain (D-01/D-02)
├── components/
│   ├── Chart.tsx               # MODIFY: register LineChart in echarts.use([...])
│   ├── ViewToggle.tsx          # MODIFY: add 'trends' to AppView + VIEWS
│   ├── SnapshotCard.tsx        # MODIFY: inline-editable capturedAt (D-03) + inferred caption (D-05)
│   ├── SnapshotListSidebar.tsx # MODIFY: warm-up "N/M" indicator slot (D-02)
│   ├── trends/                 # NEW
│   │   ├── TrendsView.tsx
│   │   ├── TrendChart.tsx      # builds time-axis line option → <Chart>
│   │   ├── TrendSparkline.tsx  # minimal line option → <Chart> (TRD-03)
│   │   ├── DeltaPanel.tsx      # consecutive-pair deltas (TRD-04)
│   │   └── trendsChartOptions.ts # pure ECharts option builders (off memoized view)
│   └── dashboard/ClusterColumn.tsx # MODIFY: sparkline slot when trends has ≥2 points
└── i18n/locales/{en,fr}/trends.json # NEW namespace (EN+FR parity)
```

### Pattern 1: Per-snapshot aggregation inside the single memo (resolves DD-A central tension)

**What:** `buildEstateView` already iterates the *merged active estate*. The new `buildTrendSeries` is called from inside `buildEstateView`, receiving the **same `selected: Snapshot[]`** the hook already computed. It groups snapshots by resolved capture date, merges same-date groups via the existing `mergeSnapshotsToEstate`, and runs `aggregateGlobals`/`aggregateClusters` per group. The result is attached as `EstateView.trends`. The Phase-4 active-estate path is **completely untouched** — trends is an *additional* output of the same pure pass, not a replacement.

**Why this is not a second memo:** `buildEstateView` is a pure function, not a `useMemo`. Adding work to it is exactly how P5 (operational insights), P6 (planned view), and P7 (EOS) were all added — each "composes in THIS single pass (no second memo, no new file)" per the in-file comments. P8 follows the identical established pattern; the only deviation is a new pure sub-module (`engines/trends/`) for testability, mirroring `engines/eos/`. [VERIFIED: estateView.ts lines 136, 224, 258 — three prior phases used this exact pattern]

**When to use:** Always — this is the only sanctioned shape.

```typescript
// Source: pattern established in src/engines/aggregation/estateView.ts (P5/P6/P7 precedent)
// Inside buildEstateView, before the return:
const trends =
  selected.length >= 2            // single snapshot ⇒ no trend (null, like Phase 2)
    ? buildTrendSeries(selected, mode, { stretchedClusters, allocRatios })
    : null
return { ...existing, trends }
```

Note: `buildEstateView` currently receives `MergedEstate`, not `Snapshot[]`. The planner must pass the pre-merge `selected: Snapshot[]` through to `buildTrendSeries` — either by widening `buildEstateView`'s signature to also accept `selected`, or by computing `buildTrendSeries` in the hook's memo body alongside `buildEstateView` (still ONE memo, ONE return). Recommended: widen `buildEstateView(merged, selected, mode, today, opts)` so the entire composition stays in one pure function and the hook stays a thin orchestrator. [VERIFIED: useEstateView.ts line 55 passes `today`; estateView.ts signature is `(merged, mode, today, opts)`]

### Pattern 2: ECharts true temporal axis (TRD-02 / criterion 2)

**What:** `xAxis.type: 'time'` positions each point by its **date value**, producing visibly non-uniform spacing for irregular capture dates (2026-01-31, 2026-02-15, 2026-03-30). `series.data` is an array of `[Date|timestamp, number]` pairs.

```typescript
// Source: https://github.com/apache/echarts-doc/blob/master/en/option/partial/2d-data.md  [CITED]
// + en/tutorial/whats-new-in-echarts-v5.md (time axis selects meaningful ticks, not even split)
const option: EChartsOption = {
  xAxis: { type: 'time' },                 // NOT 'category' — category = even index spacing
  yAxis: { type: 'value' },
  series: [{
    type: 'line',
    showSymbol: true,
    data: points.map((p) => [p.date, p.headline.vmCount]),  // [Date, value] pairs
  }],
  tooltip: { trigger: 'axis' },            // per-point metadata (vCenter label + RVTools version)
}
```

Label formatting for FR/EN parity: pass a `xAxis.axisLabel.formatter` that defers to `fmtDate`/locale — never bake a formatted string into i18n. [VERIFIED: utils/format.ts fmtDate exists]

### Pattern 3: Sparkline = minimal line option on the same `<Chart>` (TRD-03)

**What:** No new component type. A sparkline is the same `type:'line'` option with axes hidden, grid collapsed to full-bleed, symbols off, tooltip off, small fixed height.

```typescript
// Source: ECharts grid/axis show:false idiom (echarts-doc option/component/axis-common.md) [CITED]
const sparkOption: EChartsOption = {
  grid: { top: 2, bottom: 2, left: 2, right: 2 },
  xAxis: { type: 'time', show: false },
  yAxis: { type: 'value', show: false, scale: true },
  series: [{ type: 'line', showSymbol: false, lineStyle: { width: 1.5 },
             data: clusterPoints.map((p) => [p.date, p.value]) }],
}
// fed to the existing <Chart option={sparkOption} style={{ height: 36 }} />
```

### Pattern 4: Non-blocking latest-first warm-up (D-01/D-02)

**What:** Replace the blocking `for (file of files) { await parse }` with: (1) infer each file's capture date cheaply or accept parse order, (2) parse the latest-`capturedAt` file FIRST and `addSnapshot` it (active estate live in ~5 s), (3) continue draining the remaining files latest→oldest in the background without blocking the UI thread, `addSnapshot`-ing each as it lands. The store→memo reactive path fills trend points progressively for free (each `addSnapshot` REPLACES the Map → memo recomputes → `trends` grows).

**Singleton-Worker constraint preserved:** still exactly one `parseInWorker` in flight at a time (sequential drain) — the change is *non-blocking to the React render*, not parallel parsing. STRIDE T-05-07 (one Worker) holds. [VERIFIED: useSnapshotUpload.ts comment + parser singleton]

**Capture-date ordering caveat:** `inferCaptureDate` needs the parsed workbook to read `vMetaData`/filename. For files whose date is in the filename (the common monthly-export case, `RVTools_export_..._2026-03-31.xlsx`), order can be derived from the filename BEFORE parsing via the same `ISO_DATE_RE`. For files without a filename date, fall back to drop order (the user can re-order via D-03 inline edit, which recomputes through the memo). The planner should extract the filename-ISO probe as a tiny pure helper reused by both the worker and the pre-parse ordering, to avoid duplicating `ISO_DATE_RE`. [VERIFIED: captureDate.ts ISO_DATE_RE]

**Indicator:** `SnapshotListSidebar` shows a factual "trends preparing — N/M" line scoped to its own area while `loadedCount < requestedCount`. State source: `useSnapshotUpload` exposes an in-flight count (e.g. `{ done, total }`); no global overlay (would fail criterion 1). Factual, no editorial verb, EN+FR keys.

### Pattern 5: D-05 deterministic ordinal fallback (pure, in `engines/trends/captureDateOrdinal.ts`)

**Algorithm (deterministic, no clock, no randomness):**

1. Resolve every selected snapshot's `capturedAt` (already a `Date` on `Snapshot`; explicit edits already applied via store).
2. Establish a **stable load order** = ascending `parsedAt` (already on `Snapshot`, stamped by the store at `addSnapshot`), tiebroken by `snapshot.id` (UUID, stable). This is the canonical "ordinal sequence".
3. Group snapshots by resolved calendar date (`capturedAt` truncated to day).
4. For groups where ≥2 snapshots share a date AND DD-A treats them as distinct points (i.e. NOT a same-date multi-vCenter spatial merge — see DD-A), OR for snapshots whose date could not be inferred (resolver returned the mtime fallback AND mtime is absent/epoch), assign an **ordinal index** = position in the stable load order. The X position for such points is the ordinal, not a fabricated date.
5. Emit a per-series boolean `orderInferred` (true if ANY point used the ordinal path) so the UI can render the factual caption ("ordering inferred — not from real capture dates"). Never drop a point; never synthesize a fake `Date`.

**Edge case the planner must decide (flag):** an axis cannot mix `type:'time'` (Date) and ordinal integers cleanly. Recommendation: when `orderInferred` is true for the whole series, render the chart with `xAxis.type:'category'` using the stable-ordered labels + the factual caption; when all points have real distinct dates, use `type:'time'`. A mixed case (some real dates, some ordinal) should fall back to category for the whole series with the caption — simplest, honest, and avoids fabricating positions. This is a presentation decision, not a data one (the data always keeps real dates where known).

### Anti-Patterns to Avoid

- **`xAxis.type:'category'` as the default trend axis** — evenly spaces by index, fails TRD-02 / criterion 2. Only acceptable as the D-05 inferred-order fallback (with caption).
- **A second `useMemo` or a memoized trends selector** — grep-gated invariant; the security/grep gate also matches doc-comments, so do not even name `useMemo` in a trends comment with the literal token (CLAUDE.md gotcha).
- **Caching the trend series in the store** — inputs-only invariant; trends are derived.
- **Blocking the batch on every parse** — fails criterion 1 (5 s interactive). Drain in background.
- **Fabricating a `Date` for missing/tied capture dates** — D-05 forbids; use the ordinal + factual caption.
- **`* 1.048576` anywhere in delta math** — branded units; use `mibToGib` (`fmtMemMb` already base-2). [VERIFIED: converters.ts]
- **Editorial verbs in delta/indicator copy** ("grew/improved/degraded/should") — factual only ("+12 VMs", "−480 GiB"). PROJECT.md denylist.
- **A new `<Chart>` variant for sparklines** — CONTEXT explicit: one component, one `option` prop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-snapshot headline aggregation | A new trends-specific aggregator | `aggregateGlobals` + `aggregateClusters` (Phase 2) | Identical math to the dashboard; a parallel impl would drift and double-maintain. DRY is binding. |
| Same-date multi-vCenter combination | A new merge for trend points | `mergeSnapshotsToEstate` (Phase 4) | Already does collision-suffix + vMotion dedupe; reusing it makes timeline points reconcile with the dashboard count by construction. |
| Non-uniform temporal axis | Manual pixel-positioning of dates | ECharts `xAxis.type:'time'` | First-class; selects meaningful ticks; SVG output trivial for P10. [CITED: echarts-doc] |
| Capture-date inference | A new date parser | shipped `inferCaptureDate` | The chain (explicit→filename→vMetaData→mtime) is shipped + tested; P8 adds only the ordinal tiebreaker. |
| Capture-date edit persistence to memo | A new store action | shipped `setCapturedAt` | D-03 explicitly reuses it; it already REPLACES the Map → memo recomputes. [VERIFIED: snapshotStore.ts line 139] |
| Locale date/number formatting | `toLocaleString` scattered in components | `utils/format.ts` (`fmtDate`/`fmtInt`/`fmtMemMb`) | Centralized FR/EN; no pre-formatted numbers in i18n. |
| Sparkline rendering | A canvas micro-chart lib | minimal `<Chart>` line option | SVG renderer mandated; one component; P10 inlining stays trivial. |

**Key insight:** P8 is almost entirely *composition of shipped, tested engines along a second (temporal) axis*. The only genuinely new pure code is (a) the per-snapshot loop + delta computation and (b) the ordinal-fallback helper. Everything else is reuse — which is exactly what the ROADMAP says ("nothing direct; reuses `<Chart>` from Phase 2 and the aggregation pipeline from Phase 2").

## DD-A — Timeline-point identity & multi-vCenter composition (Claude's discretion)

**Options:**

| Option | Timeline point = | Same-date multi-vCenter files | Pros | Cons |
|--------|------------------|-------------------------------|------|------|
| **A1: per-file** | one snapshot file | become 2 separate points on the same date (collide → ordinal via D-05) | trivial; no merge in trends | counts DON'T reconcile with the dashboard (which merges them); same-date collision is the *common* multi-vCenter case → constant ordinal captions; conceptually wrong (two files of the same estate at the same time are one estate state) |
| **A2 (RECOMMENDED): per-`capturedAt`-date, same-date files spatially merged first** | one resolved capture date; same-date files merged via `mergeSnapshotsToEstate` then aggregated as one point | merged spatially (Phase-4 path) into one logical-estate point | counts reconcile with the dashboard by construction; matches the "monthly snapshot of the whole estate" mental model; reuses the shipped merge; D-05 ordinal only fires for genuine ties/missing-dates, not for normal multi-vCenter months | slightly more engine code (group-by-date + per-group merge) |

**Recommendation: A2.** It is the only option where the timeline-point VM count equals the dashboard VM count for that month (counts-must-reconcile hard constraint), and it reuses `mergeSnapshotsToEstate` so Phase-4 semantics compose with the temporal axis instead of fighting it. Each point carries `metadata: { vCenterLabel, rvtoolsVersion }[]` — an array, because a merged point legitimately spans multiple vCenters (criterion 6 says "each snapshot's vCenter label and RVTools version in the snapshot list"; the per-point tooltip lists all contributing vCenters/versions). The active estate (D-01, latest date) is just the most-recent point's underlying merge — same data, no duplication.

**Data flow (exact):** inside `buildTrendSeries(selected, mode, opts)`:

1. resolve date per snapshot (already on `Snapshot.capturedAt`);
2. `groupByDay(selected)` → `Map<dayKey, Snapshot[]>`;
3. for each group: `mergeSnapshotsToEstate(group)` → `aggregateClusters` + `aggregateGlobals` (same calls `buildEstateView` makes for the active estate);
4. emit `TrendPoint{ date, ordinal?, metadata[], headline: Pick<GlobalSummary,...>, byCluster: Map<cluster, clusterHeadline> }`;
5. sort points by date (ordinal-keyed points per D-05);
6. compute consecutive-pair deltas (DD-B).

## DD-B — Delta-panel semantics (Claude's discretion)

**Options:**

| Option | Content | Pros | Cons |
|--------|---------|------|------|
| **B1 (RECOMMENDED): consecutive-pair count-deltas on existing aggregate fields** | per consecutive pair: Δ vmCount, Δ poweredOnVms, Δ hostCount, Δ clusterCount, Δ vcpuAllocated, Δ vramAllocatedMib (→ GiB), Δ totalStorageMib (→ GiB/TiB) | all fields ALREADY exist on `GlobalSummary`/`OperationalInsights`; pure subtraction; factual; KISS; matches ROADMAP example verbatim ("+12 VMs, −3 powered-on, +480 GiB allocated") | doesn't say *which* VMs changed |
| B2: identity-resolved churn via Phase-4 keys | per pair: VMs added/removed/moved-cluster using `(vmBiosUuid)` keys | richer | needs raw vinfo of BOTH snapshots in the pair → conflicts with DD-C memory release (released snapshots have no rows); heavier; this is the v2 `DIF-01` snapshot-diff feature, out of P8's TRD set |

**Recommendation: B1.** Every required number is already computed by the shipped aggregation (`GlobalSummary.vmCount`, `OperationalInsights.poweredOnVms`, `vcpuAllocated`, `vramAllocatedMib`, `physicalRamMib`, `totalStorageMib`, etc. — [VERIFIED: types/estate.ts, globals.ts]). Deltas are pure subtraction between consecutive `TrendPoint.headline`s; **consecutive pairs only** (ROADMAP says "between *consecutive* snapshots"; no baseline lens). B2 is rejected primarily because it structurally conflicts with DD-C (a released snapshot has no rows to diff) and because it IS the explicitly-deferred v2 `DIF-01` side-by-side diff. Delta presentation: signed branded numbers via `utils/format.ts` (`+`/`−` sign is factual, not editorial); i18n keys hold only the label, never the formatted number; em-dash when a field is `null` on either side (e.g. readiness absent). No color, no traffic-light, no verb.

**Headline metric set for the chart + deltas (recommend):** vmCount, poweredOnVms, hostCount, clusterCount, vcpuAllocated, vramAllocatedMib (GiB), consumedGhz, totalStorageMib (GiB/TiB). All present on shipped aggregates; the UI-SPEC/planner picks which render as lines vs delta rows.

## DD-C — Memory-release policy when N > 4 (Claude's discretion)

**Recommendation:**

- **Threshold:** fixed at 4 (ROADMAP Critical-5 / CONTEXT both say "N > 4"). Surfacing it as a user control is a deferred polish, not a TRD — keep it fixed and constant; document the number in a factual caption if/when release changes available UI.
- **What stays hydrated:** the active/latest snapshot (D-01) MUST always keep its raw rows; the 3 most-recent-by-`capturedAt` (so the dashboard active estate + recent re-merge stay possible). When loaded count > 4, release **oldest-by-`capturedAt` first**, never the active, never the newest 4.
- **Release mechanism (inputs-only, REPLACES the Map — no cached aggregate):** a new store action `releaseRawRows(id)` that does `next.set(id, { ...snap, vinfo: [], vhost: [], vdatastore: [], vpartition: [], rawReleased: true })`. The snapshot's metadata (`capturedAt`, `vCenterLabel`, `rvtoolsVersion`, `id`) survives — that's all the trends series needs once that point's aggregate is computed. This is consistent with the inputs-only invariant (it mutates *inputs* — emptying row arrays — not a cached aggregate). [VERIFIED: snapshotStore.ts mutation idiom — `next.set(id, {...snap, capturedAt})` in `setCapturedAt` is the exact template to copy]
- **Critical ordering constraint the planner must honor:** the trend point's aggregate for a soon-to-be-released snapshot MUST be computed and held in the derived `TrendSeries` (via the memo) BEFORE its rows are emptied — otherwise the point's numbers vanish on release. Because `trends` is recomputed every memo pass from whatever rows currently exist, the safe design is: **release only fires for snapshots whose raw rows are no longer needed for any point's first computation**. Since A2 (DD-A) computes every point's aggregate every pass from the still-present rows, releasing an old snapshot's rows means that point can no longer be recomputed. Resolution: when `rawReleased` snapshots exist, `buildTrendSeries` must accept a **carried-forward map of already-computed points** so released points are not recomputed from absent rows. The cleanest inputs-only place to keep the already-computed aggregate of a released point is **on the released `Snapshot` itself** as a small frozen `releasedAggregate` field (it is now *input* metadata, not a cached derivation of live rows — the rows are gone). The planner should treat this as the one subtle correctness point and cover it with a dedicated Vitest case ("release oldest; its trend point survives with identical numbers; dashboard count unchanged").
- **Released-snapshot UI consequence (surface factually):** a released snapshot can no longer be the active estate / drilled / re-merged into the dashboard. If the user clicks a released snapshot, show a neutral factual line (e.g. "raw data released to save memory — trend point retained"), no editorial verb. Selection of a released snapshot for the active merge should be prevented or factually explained. EN+FR keys.
- **Still in-memory only:** no spill to storage (privacy invariant); release just drops arrays for GC.

## Runtime State Inventory

Not applicable — P8 is greenfield feature work (new engine module + new view + additive store mutation), not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed identifier. **None — verified: no string-replacement/rebrand/rename in scope; the only store change is an additive `releaseRawRows` action and reuse of the shipped `setCapturedAt`.**

## Common Pitfalls

### Pitfall 1: Category axis silently passes review then fails criterion 2

**What goes wrong:** A dev wires `xAxis:{type:'category', data: dateStrings}`; it "looks like" a date axis but spaces points evenly by index. 2026-01-31 and 2026-03-30 appear equidistant.
**Why:** category axis is index-positioned by design. [CITED: echarts-doc]
**How to avoid:** mandate `xAxis:{type:'time'}` + `[Date,value]` data pairs; add a Vitest/assertion on the built option that `xAxis.type === 'time'` for the real-date case.
**Warning signs:** uniform tick spacing for known-irregular fixture dates.

### Pitfall 2: `LineChart` not registered → blank chart at runtime

**What goes wrong:** `Chart.tsx` `echarts.use([...])` lacks `LineChart`; a line option renders nothing (no error in some builds).
**Why:** tree-shaken ECharts only renders registered series. [VERIFIED: Chart.tsx registers Bar/Pie/Gauge/Heatmap only; CITED: echarts-doc tree-shaking — explicit chart import required]
**How to avoid:** add `import { LineChart } from 'echarts/charts'` + include in `echarts.use([...])`; re-run `npm run check:bundle-size` (≤300 KB gz gate). LineChart is small; budget should hold but must be verified.
**Warning signs:** empty `<svg>`, no console error.

### Pitfall 3: Second-memo grep gate trips on a doc-comment

**What goes wrong:** a comment in `buildTrendSeries` or `TrendsView` explains "no second useMemo here" containing the literal token; the grep gate / security hook fails the build.
**Why:** CLAUDE.md gotcha — `grep -c "<token>" == 0` plan gates and the security hook match doc-comments too.
**How to avoid:** phrase absence comments WITHOUT the literal token (e.g. "the single sanctioned memo hook is the only one — see useEstateView"); never write the React-memo-hook token in a trends comment.
**Warning signs:** CI gate failure naming a comment line.

### Pitfall 4: Released-snapshot trend point loses its numbers (DD-C correctness)

**What goes wrong:** rows emptied for an old snapshot; next memo pass recomputes `buildTrendSeries` from current rows → that point's aggregate is now 0/absent.
**Why:** trends are recomputed every pass from live rows; releasing rows removes the source.
**How to avoid:** carry the released point's already-computed aggregate as frozen input metadata on the released `Snapshot` (`releasedAggregate`); `buildTrendSeries` uses it instead of re-aggregating absent rows. Dedicated Vitest case.
**Warning signs:** trend line drops to 0 for the oldest months after the 5th snapshot loads.

### Pitfall 5: Capture-date edit doesn't reorder the timeline

**What goes wrong:** user edits a date in the sidebar; the chart doesn't move.
**Why:** the edit must flow through `setCapturedAt` (REPLACES the Map) so the single memo recomputes; if a component holds a local copy it won't.
**How to avoid:** D-03 wiring uses `setCapturedAt` exactly (no local date state that bypasses the store); `buildTrendSeries` keys points off `Snapshot.capturedAt` so a store change re-sorts. [VERIFIED: setCapturedAt REPLACES Map → memo dep `snapshots` changes → recompute]
**Warning signs:** stale point position after edit.

### Pitfall 6: Background drain blocks the first paint

**What goes wrong:** keeping the blocking `for await` and just reordering still serializes 12 parses before the dashboard shows.
**Why:** awaiting the whole batch blocks the `isUploading`/render path.
**How to avoid:** `addSnapshot` the latest file, then continue draining WITHOUT the caller awaiting the rest (background promise chain); the dashboard renders off the first `addSnapshot`. [VERIFIED: useSnapshotUpload.ts is currently fully-awaited blocking — this is the change]
**Warning signs:** 12-file drop freezes ~N seconds before anything renders.

## Code Examples

### Per-snapshot temporal aggregation (new pure engine)

```typescript
// Source: composition pattern from src/engines/aggregation/estateView.ts (P5/P6/P7 precedent)
//         + reuse of shipped aggregateGlobals/aggregateClusters/mergeSnapshotsToEstate
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { aggregateClusters } from './aggregateClusters' // via aggregation barrel
import { aggregateGlobals } from './globals'

export interface TrendPoint {
  date: Date
  ordinal: number | null            // D-05: set when the date was inferred-by-order
  metadata: { vCenterLabel: string; rvtoolsVersion: string }[] // criterion 6 (array — A2)
  headline: TrendHeadline           // Pick of GlobalSummary fields
  byCluster: Map<string, TrendHeadline>
}
export interface TrendDelta { from: Date; to: Date; vmCount: number; /* ...branded */ }
export interface TrendSeries {
  points: TrendPoint[]
  deltas: TrendDelta[]              // consecutive pairs only (DD-B / ROADMAP)
  orderInferred: boolean            // drives the D-05 factual caption
}
```

### Inferred-order ordinal (D-05, pure, deterministic)

```typescript
// stable load order = ascending parsedAt, tiebreak by id (both already on Snapshot)
const stableOrder = [...selected].sort(
  (a, b) => a.parsedAt.getTime() - b.parsedAt.getTime() || (a.id < b.id ? -1 : 1),
)
// ordinal assigned only to tied/undeterminable points; real dates kept otherwise
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ECharts category axis with date-string labels | `xAxis.type:'time'` selecting meaningful ticks, non-even split | ECharts 5 (carried into v6 unchanged) | TRD-02 is a config flag, not custom code. [CITED: echarts-doc whats-new-in-echarts-v5] |
| Blocking sequential upload (shipped) | Latest-first non-blocking background drain | This phase (D-01/D-02) | New behavior, singleton Worker preserved. |

**Deprecated/outdated:** `TimelinePoint` placeholder type in `types/estate.ts` (`{capturedAt, vmCount}`) is a Phase-4 forward-compat stub — P8 replaces it with the richer `TrendSeries`/`TrendPoint`/`TrendDelta`. [VERIFIED: types/estate.ts lines 330-338, EstateView.trends typed `TimelinePoint[] | null`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | LineChart addition keeps the ECharts chunk ≤300 KB gz | Pitfall 2 / Stack | LOW — LineChart is a small module; if the gate trips, planner adds a remediation task. Must be verified by `npm run check:bundle-size` during execution, not assumed. |
| A2 | `vMetaData` timestamp is sufficient for capture-date inference; no `vSource` probe needed | D-04 | LOW — CONTEXT D-04 explicitly says confirm during planning and only add `vSource` if a real fixture proves `vMetaData` insufficient. No fixture in this repo proves otherwise. Flag for fixture validation. |
| A3 | Carrying a released point's aggregate as frozen metadata on the `Snapshot` does not violate the inputs-only invariant | DD-C | MEDIUM — this is a design judgment (the rows are gone, so the surviving aggregate is now input metadata, not a cached derivation of live state). The planner/discuss-phase should confirm this reading of "inputs-only" before locking; an alternative is to cap N at 4 and reject the 5th+ raw retention differently. Surface as an open decision. |
| A4 | The 5 s interactive criterion is met by rendering off the first (latest) `addSnapshot` | Pattern 4 / criterion 1 | LOW — parse time of one ~30 MB workbook is the shipped Phase-1 budget; P8 adds no parse cost to the first file. Verified-by-design, not benchmarked here. |

**Note:** A3 is the one item that genuinely needs user/planner confirmation (it interprets a project invariant). A1/A2/A4 are execution-time verifications, not design unknowns.

## Open Questions

1. **Mixed real-date + ordinal axis rendering (D-05 presentation).**
   - What we know: ECharts `type:'time'` needs Dates; ordinals are integers; mixing is ill-defined.
   - What's unclear: whether the user prefers (a) whole-series category fallback with caption when ANY point is inferred, vs (b) only the tied points get ordinal nudges on an otherwise time axis.
   - Recommendation: (a) — whole-series category + factual caption when `orderInferred` (simplest, honest, no fabricated positions). Planner/UI-SPEC to lock the exact behavior; data layer is unaffected (always keeps real dates where known).

2. **Inputs-only reading for DD-C released-aggregate carry (A3).**
   - What we know: rows must be released (Critical-5); the point's numbers must survive (DD-C).
   - What's unclear: whether storing the surviving aggregate on the `Snapshot` is acceptable under "inputs-only / no cached aggregates" or needs an explicit CONTEXT amendment.
   - Recommendation: treat as input metadata once rows are gone (documented rationale above); confirm in discuss/plan before implementing the release task.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| echarts | trend chart + sparklines | ✓ | ^6.0.0 (package.json) | — |
| echarts-for-react | `<Chart>` binding | ✓ | ^3.0.6 | — |
| react / zustand / react-i18next | view + store + i18n | ✓ | ^19.2.6 / ^5.0.13 / ^16.6.6 | — |
| Vitest + @testing-library/react | engine + component tests (≥75% on `engines/trends/`) | ✓ | ^4.1.2 / ^16.3.2 | — |
| `npm run check:bundle-size` | LineChart-registration size gate | ✓ | shipped script | — (must pass after LineChart add) |
| Network / external service | nothing | ✗ (forbidden by P1 guard, throws) | — | N/A — privacy invariant; trends use only parsed columns |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. P8 introduces zero new dependencies and zero external data sources.

## Sources

### Primary (HIGH confidence)

- Codebase (VERIFIED by direct read): `src/hooks/useEstateView.ts`, `src/engines/aggregation/estateView.ts` + `globals.ts` + barrel `index.ts`, `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` + `index.ts`, `src/store/snapshotStore.ts`, `src/hooks/useSnapshotUpload.ts`, `src/engines/parser/captureDate.ts`, `src/components/Chart.tsx` + `SnapshotCard.tsx` + `SnapshotListSidebar.tsx` + `ViewToggle.tsx` + `App.tsx`, `src/types/estate.ts` + `snapshot.ts`, `src/engines/units/converters.ts`, `src/utils/format.ts`, `package.json`, `.planning/config.json`.
- ECharts official docs via Context7 `/apache/echarts-doc` (CITED):
  - `en/option/component/axis-common.md` — axis `type: 'value'|'category'|'time'|'log'`.
  - `en/option/partial/2d-data.md` — time-axis value formats: timestamp, ISO string, `Date` instance for `[x,y]` pairs.
  - `en/tutorial/whats-new-in-echarts-v5.md` — time axis "no longer split absolutely evenly … selects meaningful points"; carried into v6.
  - `en/tutorial/tree-shaking.md` / `upgrade-guide-v5.md` — `echarts.use([...])` named-import registration required per chart type.
- Planning docs (VERIFIED): `08-CONTEXT.md`, `REQUIREMENTS.md` §In-Session Trends, `ROADMAP.md` ###Phase 8 + Phase 2/4, `04-CONTEXT.md`, project `CLAUDE.md`.

### Secondary (MEDIUM confidence)

- ECharts v6 time-axis API parity with v5: asserted by the project's own `CLAUDE.md` charting note ("v6 tree-shaking + `SVGRenderer` import paths unchanged from v5") cross-referenced with the v5 time-axis doc. No v6-specific breaking change found.

### Tertiary (LOW confidence)

- None relied upon. (No WebSearch needed — every claim is codebase- or official-docs-grounded.)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new deps; every module verified by direct read.
- Architecture (single-memo composition, DD-A/B/C): HIGH — the P5/P6/P7 in-file precedent for "compose in the single pass, new pure module, no second memo" is verified verbatim in `estateView.ts`; DD recommendations follow directly from shipped types/engines.
- ECharts temporal axis (TRD-02): HIGH — CITED from official ECharts docs; the one execution risk (LineChart registration + bundle gate) is flagged as A1.
- Pitfalls: HIGH — derived from verified code state (LineChart not registered; grep-gate gotcha from CLAUDE.md; blocking upload loop) not speculation.

**Validation Architecture:** OMITTED — `.planning/config.json` `workflow.nyquist_validation` is explicitly `false`.

**Security Domain:** OMITTED — no `security_enforcement` key in config; P8 adds no auth/network/crypto/input-parsing surface (no new external input — RVTools parsing is shipped Phase 1; the privacy guard already throws on any network). The only relevant invariant (no persistence of dataset rows) is covered by TRD-05 and verified structurally in `snapshotStore.ts`.

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — stable: no new deps, internal-codebase-grounded; ECharts time-axis API is multi-version-stable)
