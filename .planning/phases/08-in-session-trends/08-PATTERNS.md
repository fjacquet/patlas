# Phase 8: In-Session Trends - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 16 (5 new, 11 modified)
**Analogs found:** 16 / 16 (every new/modified file has a shipped analog — P8 is composition of shipped engines)

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `src/engines/trends/buildTrendSeries.ts` | NEW | engine (pure) | transform / batch | `src/engines/eos/bucketEos.ts` + `src/engines/aggregation/estateView.ts` | exact (pure projection, P5/P6/P7 precedent) |
| `src/engines/trends/captureDateOrdinal.ts` | NEW | engine (pure) | transform | `src/engines/parser/captureDate.ts` (`inferCaptureDate`, deterministic, no clock) | exact |
| `src/engines/trends/buildTrendSeries.test.ts` | NEW | test | — | `src/engines/aggregation/estateView.test.ts` | exact |
| `src/engines/trends/captureDateOrdinal.test.ts` | NEW | test | — | `src/engines/aggregation/estateView.test.ts` / `src/engines/eos/*.test.ts` | exact |
| `src/engines/trends/index.ts` | NEW | barrel | — | `src/engines/aggregation/index.ts` | exact |
| `src/types/estate.ts` | MOD | model (types) | — | self — `TimelinePoint` placeholder (lines 330-338) + `EosProjection` (372-385) | exact (replace stub) |
| `src/engines/aggregation/estateView.ts` | MOD | engine (pure) | transform | self — P7 EOS composition (lines 258-268, 279) | exact (in-file precedent) |
| `src/hooks/useEstateView.ts` | MOD | hook | request-response | self — line 55 `buildEstateView(...)` call site | exact |
| `src/store/snapshotStore.ts` | MOD | store | event-driven (mutation) | self — `setCapturedAt` (139-146) / `removeSnapshot` (96-110) | exact (REPLACE-never-mutate idiom) |
| `src/hooks/useSnapshotUpload.ts` | MOD | hook | streaming (worker drain) | self — current blocking parse loop (27-47) | role-match (behavior change) |
| `src/components/Chart.tsx` | MOD | component | — | self — `echarts.use([...])` registry (29-41) | exact (one-line addition) |
| `src/components/ViewToggle.tsx` | MOD | component | — | self — `AppView`/`VIEWS` (3-5) | exact (append segment) |
| `src/App.tsx` | MOD | shell | — | self — view branch (39-49) | exact (append branch) |
| `src/components/SnapshotCard.tsx` | MOD | component | event-driven (edit) | self — read-only capturedAt (61) + remove button (88-95) | exact (inline edit) |
| `src/components/SnapshotListSidebar.tsx` | MOD | component | — | self — sorted list `useMemo` (25-28) + `useSnapshotUpload` use (23) | exact |
| `src/components/trends/*` (TrendsView, TrendChart, TrendSparkline, DeltaPanel, trendsChartOptions) | NEW | component | request-response | `src/components/eos/EosView.tsx` (whole-file shell + `<Chart>` + ErrorBoundary) | exact (verbatim shell) |
| `src/i18n/locales/{en,fr}/trends.json` | NEW | config (i18n) | — | `src/i18n/locales/{en,fr}/eos.json` (the `eos:` namespace consumed by EosView) | exact |

## Pattern Assignments

### `src/engines/trends/buildTrendSeries.ts` (pure engine, transform/batch) — NEW

**Analog:** `src/engines/aggregation/estateView.ts` (P5/P6/P7 single-pass composition) + reuse of `aggregateClusters`/`aggregateGlobals`/`mergeSnapshotsToEstate`.

**Engine purity + import pattern** — copy the engines/ no-React/no-Zustand/no-Zod header style and `@/engines/...` imports from `estateView.ts` lines 1-22:

```typescript
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { aggregateClusters } from './aggregateClusters'
import { aggregateGlobals } from './globals'
import type { AccountingMode } from '@/types/estate'
```

Note `estateView.ts` imports `aggregateClusters` from `./aggregateClusters` and `aggregateGlobals, emptySummary` from `./globals` (lines 16-17) — `buildTrendSeries.ts` lives in a sibling dir so it imports via the aggregation barrel `@/engines/aggregation` (see `index.ts` analog below) to avoid reaching into private files.

**Core pattern — the P7 EOS sub-projection composed in the single pass** (`estateView.ts` lines 258-289 — copy this exact shape; `buildEosProjection` iterates merged rows internally, returns a typed projection, attached to the return object):

```typescript
// estateView.ts:263-288 — the verbatim template for a new pure sub-projection
const eos = buildEosProjection({
  vinfo: merged.vinfo,
  vhost: merged.vhost,
  catalogue: loadEosCatalogue(),
  today,
})
return {
  globals, clusters, hosts, datastores, vmRows, vmsByCluster, osBreakdown,
  accountingMode: mode,
  trends: null,   // ← P8 replaces this literal with `trends`
  vcenters: merged.vcenters.map(...),
  drSim, operationalInsights, clusterInsights, clusterDetail,
  plannedView, plannedDrSim, eos,
}
```

**DD-A A2 group-by-date + per-group merge** — reuse the exact aggregation calls `buildEstateView` makes for the active estate (`estateView.ts` lines 94-107: `aggregateClusters({ vinfo, vhost, mode, stretchedClusters, datastoreCountByCluster, allocRatios })` then `aggregateGlobals(clusters, datastoreCount, totalStorageMib)`). For each `capturedAt`-day group: `mergeSnapshotsToEstate(group)` → those two calls → emit a `TrendPoint`. This guarantees timeline-point counts reconcile with the dashboard by construction (same engine, same inputs).

**Frozen-empty / null-when-degenerate idiom** — `estateView.ts` returns `trends: null` (line 279) and the frozen `EMPTY_VIEW` (lines 338-356, `Object.freeze`). `buildTrendSeries` returns `null` when `selected.length < 2` (RESEARCH Pattern 1); the caller pattern is `selected.length >= 2 ? buildTrendSeries(...) : null`.

**Branded units in delta math** — never `* 1.048576`; use `src/engines/units/converters.ts`: `mibToGib` (line 19), `gibToTib` (20), `mibToTib` (21). `estateView.ts` uses the `mib(...)`/`cores(...)` branded constructors from `@/engines/units` (line 5) — mirror that.

---

### `src/engines/trends/captureDateOrdinal.ts` (pure engine, transform) — NEW

**Analog:** `src/engines/parser/captureDate.ts` — a pure, deterministic, no-clock/no-crypto/no-I/O helper.

**Purity contract** — copy the header doc-style from `captureDate.ts` lines 4-8 ("Pure ... No I/O, no clock, no `crypto`"). Deterministic, total function of inputs only.

**Stable-order algorithm** (RESEARCH Pattern 5 / Code Examples) — sort selected snapshots by `parsedAt` ascending, tiebreak by `id`:

```typescript
const stableOrder = [...selected].sort(
  (a, b) => a.parsedAt.getTime() - b.parsedAt.getTime() || (a.id < b.id ? -1 : 1),
)
```

`Snapshot.parsedAt` is stamped by the store at `addSnapshot` (`useSnapshotUpload.ts` line 37 `parsedAt: new Date()`); `id` is the `crypto.randomUUID()` from line 36 — both already stable inputs.

**ISO-date probe reuse caveat** — `captureDate.ts` line 11 `ISO_DATE_RE` is the filename-date regex. RESEARCH Pattern 4 requires the pre-parse ordering to reuse this exact regex, NOT duplicate it. Extract `ISO_DATE_RE` (or a `filenameIsoDate(filename): Date | null` helper) as a shared export from `captureDate.ts` and import it in both the worker and the warm-up ordering — DRY is binding (CLAUDE.md).

---

### `src/engines/trends/buildTrendSeries.test.ts` / `captureDateOrdinal.test.ts` — NEW

**Analog:** `src/engines/aggregation/estateView.test.ts` (Vitest, builder factory + per-field assertions, ≥75% gate per CLAUDE.md `engines/`).

**Test scaffold pattern** — copy verbatim from `estateView.test.ts`:

- `import { describe, expect, it } from 'vitest'` (line 1)
- Fixed reference clock for determinism: `const TEST_TODAY = new Date('2026-01-01T00:00:00Z')` (line 15) — P8 needs ≥2 dated snapshots; build a `snapshots(): Snapshot[]` factory mirroring the `snapshot()` factory (lines 57-109) but varying `capturedAt`/`parsedAt`.
- Route single-`Snapshot` test inputs through the production merge: `buildEstateViewMerged(mergeSnapshotsToEstate([snap]), mode, TEST_TODAY)` (lines 16-17) — `buildTrendSeries` tests pass a multi-snapshot array.
- The `host(over)` / `vm(over)` / `snapshot()` partial-override factory idiom (lines 19-109) is the exact fixture builder pattern to copy.

**Mandatory DD-C correctness case** (RESEARCH Pitfall 4): a dedicated `it(...)` — "release oldest; its trend point survives with identical numbers; dashboard count unchanged". Assert the released point's `headline` equals the pre-release value.

---

### `src/engines/trends/index.ts` (barrel) — NEW

**Analog:** `src/engines/aggregation/index.ts` (verbatim shape).

```typescript
/**
 * Public surface of the trends engine. `buildEstateView` imports
 * `buildTrendSeries` from here.
 */
export { buildTrendSeries } from './buildTrendSeries'
export { captureDateOrdinal } from './captureDateOrdinal'
```

Mirrors the one-line-per-export, doc-header style of the aggregation barrel (lines 1-15).

---

### `src/types/estate.ts` (model) — MOD

**Analog:** self — the `TimelinePoint` placeholder (lines 330-338) is the deprecated stub to REPLACE; `EosProjection`/`EosRow`/`EsxiHostRow` (lines 349-385) are the exact shape-of-typed-projection template for `TrendSeries`/`TrendPoint`/`TrendDelta`.

**Replace the stub** — lines 335-338 `interface TimelinePoint { capturedAt: Date; vmCount: number }` → `TrendSeries`/`TrendPoint`/`TrendDelta` (RESEARCH Code Examples shape). Update `EstateView.trends` (line 407) from `TimelinePoint[] | null` to `TrendSeries | null`.

**Doc-comment idiom** — copy the P7 EOS field comment style (lines 435-439): `"Produced inside the single buildEstateView pass"`. **GOTCHA (RESEARCH Pitfall 3 / CLAUDE.md):** the grep-gate/security hook matches doc-comments — do NOT write the literal React-memo-hook token in any new trends comment; phrase as the shipped EOS comment does ("the single buildEstateView pass", "the only memo is the useEstateView hook"). Existing comments at lines 427/437 already model the safe phrasing.

**Types→engines import direction** — preserve it: `bucketEos.ts` imports `EosProjection` as a type from `estate.ts` (comment lines 341-342). `buildTrendSeries.ts` likewise imports `TrendSeries` etc. as types from `@/types/estate` (no cycle).

---

### `src/engines/aggregation/estateView.ts` (engine) — MOD

**Analog:** self — the P5 (lines 136-216), P6 (224-256), P7 (258-268) "composes in THIS single pass (no second memo, no new file)" precedent — three prior phases used this exact extension point.

**Extension point** — RESEARCH Pattern 1 recommends widening the signature to `buildEstateView(merged, selected, mode, today, opts)` so the pre-merge `selected: Snapshot[]` reaches `buildTrendSeries`. Current signature is lines 55-77 `(merged: MergedEstate, mode, today, opts)`. Add the call immediately before the `return` (after the P7 `eos` block, line 268), exactly mirroring the EOS composition:

```typescript
// after line 268, before the return at 270:
const trends =
  selected.length >= 2
    ? buildTrendSeries(selected, mode, { stretchedClusters, allocRatios })
    : null
```

Then change `trends: null,` (line 279) → `trends,` and add `trends: null` to the frozen `EMPTY_VIEW` only if signature change requires it (line 347 already has `trends: null` — keep).

---

### `src/hooks/useEstateView.ts` (hook) — MOD

**Analog:** self — the single sanctioned `useMemo` (line 48), the `buildEstateView(mergeSnapshotsToEstate(selected), mode, today, {...})` call (lines 55-59), and the dependency array (line 60).

**Threading `selected`** — `selected` is already computed inside the memo (line 49 `const selected = [...snapshots.values()].filter(...)`). If `buildEstateView`'s signature widens (recommended), pass `selected` as the 2nd arg: `buildEstateView(mergeSnapshotsToEstate(selected), selected, mode, today, {...})`. NO new memo, NO new selector — the hook stays a thin orchestrator (lines 33-34 doc: "ONLY orchestrates + memoizes"). Dep array (line 60) unchanged — `snapshots`/`selectedIds` already drive recompute when warm-up `addSnapshot`s land.

**Clock-injection site** — `const today = new Date()` (line 54) is the single sanctioned clock site; `buildTrendSeries` must remain pure (no `new Date()` inside) — any "now" it needs is the injected `today` (mirrors `estateView.ts` line 62 contract).

---

### `src/store/snapshotStore.ts` (store) — MOD: add `releaseRawRows` (DD-C)

**Analog:** self — `setCapturedAt` (lines 139-146) is the exact REPLACE-never-mutate template; `removeSnapshot` (96-110) is the secondary analog.

**`setCapturedAt` idiom to copy verbatim** (lines 139-146):

```typescript
setCapturedAt: (id, date) =>
  set((state) => {
    const snap = state.snapshots.get(id)
    if (!snap) return {}
    const next = new Map(state.snapshots)
    next.set(id, { ...snap, capturedAt: date })
    return { snapshots: next }
  }),
```

`releaseRawRows(id)` follows this exactly — guard `if (!snap) return {}`, fresh `new Map(state.snapshots)`, `next.set(id, { ...snap, vinfo: [], vhost: [], vdatastore: [], vpartition: [], rawReleased: true, releasedAggregate: <frozen> })`, return `{ snapshots: next }`. Map is REPLACED never mutated (store header lines 26-28). Add the action to the `SnapshotState` interface (after line 68 `setCapturedAt`) and a selector if a component reads it.

**D-03 reuse (no new mutation for the edit)** — `setCapturedAt` is already shipped and consumed via the store; `SnapshotCard` calls it. Do NOT add a date mutation; reuse line 139.

**Note (open decision A3 / RESEARCH Open Question 2):** carrying `releasedAggregate` as frozen input metadata on `Snapshot` is a design judgment on the "inputs-only / no cached aggregates" invariant (store header lines 13-21). Flagged MEDIUM — planner/discuss must confirm before locking the release task.

---

### `src/hooks/useSnapshotUpload.ts` (hook) — MOD: latest-first non-blocking drain (D-01/D-02)

**Analog:** self — the current blocking sequential loop (lines 27-47); the `parseInWorker` + `addSnapshot` call (lines 33-38) and per-file `try/catch` toast (39-42) are reused; only the *blocking* nature changes.

**Reused verbatim** — the per-file body (lines 33-42): `const { snapshot } = await parseInWorker(file)`; `useSnapshotStore.getState().addSnapshot({ id: crypto.randomUUID(), parsedAt: new Date(), ...snapshot })`; the privacy-safe `err.message`-only toast (lines 40-41, doc lines 21-22 — never pass the error object).

**Behavior change (NEW — RESEARCH Pattern 4 / Pitfall 6):**

- Order `files` latest-`capturedAt`-first via the filename-ISO probe (shared `ISO_DATE_RE` from `captureDate.ts`, see `captureDateOrdinal.ts`) before the loop; files without a filename date fall back to drop order.
- Parse + `addSnapshot` the FIRST (latest) file, then continue draining the rest in a background promise chain WITHOUT the caller awaiting (the dashboard renders off the first `addSnapshot` → 5 s criterion).
- Singleton-Worker constraint preserved (doc lines 13-19): still exactly one `parseInWorker` in flight (sequential drain) — the change is non-blocking to the React render, not parallel parsing.
- Expose `{ done, total }` from the hook (extend `UseSnapshotUploadResult` interface, lines 7-10) for the D-02 warm-up indicator. DD-C: when loaded count > 4, call `releaseRawRows(oldestNonActiveId)` after each `addSnapshot`.

---

### `src/components/Chart.tsx` (component) — MOD: register `LineChart`

**Analog:** self — the `echarts.use([...])` tree-shaken registry (lines 29-41) and the per-chart `import { ... } from 'echarts/charts'` line (line 1).

**One-line addition** (RESEARCH Pitfall 2 / A1):

- Line 1: add `LineChart` → `import { BarChart, GaugeChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'`
- Inside `echarts.use([...])` (lines 29-41): add `LineChart,` (mirror the `HeatmapChart, // P7 EOS` comment style with a `// P8 trend line + sparkline (SVG — VIZ-01)` note).
- Re-run `npm run check:bundle-size` (≤300 KB gz gate, doc lines 24-27). The single `option` prop API (lines 48-65) is unchanged — sparkline is just a different `option`, no new prop (doc lines 50-56 explicitly anticipate "line/sparkline LATER with zero `<Chart>` API change").

---

### `src/components/ViewToggle.tsx` + `src/App.tsx` (shell) — MOD: add `'trends'` segment

**Analog:** self — `AppView` union (ViewToggle line 3), `VIEWS` const (line 5), and the `App.tsx` view-branch ternary (lines 39-49).

**ViewToggle** — append `'trends'`:

- Line 3: `export type AppView = 'dashboard' | 'inventory' | 'hosts' | 'planning' | 'eos' | 'trends'`
- Line 5: `const VIEWS = ['dashboard', 'inventory', 'hosts', 'planning', 'eos', 'trends'] as const`
The `<fieldset role="group">` + `<legend className="sr-only">` + `map(button aria-pressed)` idiom (lines 47-75), the gold-active-segment class (line 65 `bg-accent-500 text-surface-900` + `dark:` twin), the Arrow-Left/Right wraparound (lines 31-45), and `focus-visible:ring-2 ring-primary-500` (line 63) are all inherited verbatim — no new code. New label key `inventory:nav.trends` in EN+FR (t(`nav.${view}`) line 70). UI-SPEC: append `trends` last.

**App.tsx** — add a branch in the ternary chain (lines 45-49), mirroring the EOS branch exactly:

```tsx
) : activeView === 'trends' ? (
  <TrendsView />
) : (
  <GlobalDashboard />
)}
```

Add `import { TrendsView } from './components/trends/TrendsView'` near line 5 (mirror `import { EosView } from './components/eos/EosView'`).

---

### `src/components/trends/{TrendsView,TrendChart,TrendSparkline,DeltaPanel}.tsx` + `trendsChartOptions.ts` — NEW

**Analog:** `src/components/eos/EosView.tsx` (whole file — the verbatim shell, `<Chart>` use, ErrorBoundary, factual presentation).

**Shell pattern (TrendsView)** — copy `EosView.tsx` lines 157-159 + 280-282:

```tsx
<main className="flex-1 overflow-y-auto p-8">
  <ErrorBoundary FallbackComponent={TrendsError}>
    <div className="flex flex-col gap-6">
      <section className="panel"> ... </section>
```

Empty state when `view.trends === null`: just the `<h2>` heading (EosView lines 55-65, the `if (!snapshot)` early return → `<main className="flex-1 p-8"><section className="panel"><h2 ...>`). UI-SPEC: empty body = factual "Load 2 or more snapshots" line.

**Region-scoped ErrorBoundary** — copy `EosError` verbatim (EosView lines 25-36): `role="alert"`, reads ONLY `error.message` (never `.cause`/`.stack` — leaks VM/host names), `border-util-high/40` panel, `t('states.error', { message })` from the `dashboard` namespace.

**Chart use** — `<Chart option={chartOption} ariaLabel={t('heading')} />` (EosView line 214). The pure option builder lives in `trendsChartOptions.ts` built off `view.trends` (mirrors EosView `chartOption` lines 127-155). **TRD-02 mandate:** `xAxis: { type: 'time' }` + `series.data` as `[Date, value]` pairs (NOT `type: 'category'` — that is the forbidden default; EosView's `type: 'category'` at line 131 is correct for *buckets* but is the anti-pattern for the temporal axis). D-05 fallback: `type: 'category'` over stable-ordered labels ONLY when `view.trends.orderInferred === true`.

**Sparkline** (TRD-03, RESEARCH Pattern 3) — same `<Chart>`, minimal option: `grid:{top:2,bottom:2,left:2,right:2}`, `xAxis/yAxis show:false`, `series:[{type:'line',showSymbol:false,lineStyle:{width:1.5}}]`, `<Chart option={sparkOption} style={{ height: 36 }} />`. Slot lives in `src/components/dashboard/ClusterColumn.tsx` (rendered only when `view.trends` has ≥2 points for that cluster).

**Factual typography idiom** — copy EosView numeric tiles: `font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100` (line 196); section headings `text-xl font-semibold text-slate-700 dark:text-slate-200` (line 162); captions `text-sm text-slate-500 dark:text-slate-400` (lines 165-171). DeltaPanel rows mirror the `reconcile`/`split` factual caption tone (lines 203-210). No editorial verb, no verdict color (D-00 / UI-SPEC Color contract).

**Formatting** — numbers via `@/utils/format` (`fmtInt`, `fmtMemMb`, `fmtDate`) exactly as EosView imports them (line 11 `import { fmtDate, fmtInt } from '@/utils/format'`); locale via `const loc = i18n.language` (line 49). NO pre-formatted numbers in i18n strings (interpolate, EosView lines 166/197/204).

---

### `src/i18n/locales/{en,fr}/trends.json` (config) — NEW

**Analog:** `src/i18n/locales/{en,fr}/eos.json` (the `eos:` namespace `EosView` consumes via `useTranslation('eos')`, EosView line 48).

**Pattern** — new `trends` namespace, parallel keys in BOTH `en/` and `fr/` (CLAUDE.md i18n gate is hard). Keys: `heading`, `warmup` (`Trends preparing — {{done}}/{{total}}`), `orderInferred`, `released`, `delta.<metric>`, empty-state body. New `inventory:nav.trends` key added to BOTH `inventory.json` files (the `nav.${view}` lookup, ViewToggle line 70). No pre-formatted numbers — only `{{interpolation}}` placeholders (mirror `eos.json` `asOf`/`reconcile`/`split` keys consumed at EosView lines 166/204/206).

## Shared Patterns

### Single-pass pure composition (the central architectural invariant — D-00)

**Source:** `src/engines/aggregation/estateView.ts` lines 136 (P5), 224 (P6), 258 (P7)
**Apply to:** `buildTrendSeries.ts`, `estateView.ts`, `useEstateView.ts`
The only sanctioned memo is `useEstateView`'s `useMemo` (useEstateView.ts line 48). Every new analytics vertical (RCI/planned/EOS) was added as a pure sub-call inside `buildEstateView`, attached to the return object — never a second memo, never a store cache. P8 follows this identically (new pure sub-module for testability, mirroring `engines/eos/`).
**GOTCHA:** the grep-gate/security hook matches doc-comments (CLAUDE.md). Never write the literal React-memo-hook token in any new trends comment — phrase like the shipped EOS comments ("the single buildEstateView pass", estate.ts:437).

### REPLACE-never-mutate store mutation (inputs-only invariant)

**Source:** `src/store/snapshotStore.ts` lines 139-146 (`setCapturedAt`), 96-110 (`removeSnapshot`)
**Apply to:** new `releaseRawRows(id)`
Guard `if (!snap) return {}`; `const next = new Map(state.snapshots)`; `next.set(id, { ...snap, <changed fields> })`; `return { snapshots: next }`. Zustand `Object.is` requires a fresh Map reference (store header lines 26-28). No persist, no localStorage of rows (PAR-05, lines 22-25).

### Factual presentation, branded units, em-dash sentinel

**Source:** `src/components/eos/EosView.tsx` (no verdict color/icon/verb) + `src/engines/units/converters.ts` (`mibToGib` line 19, `gibToTib` line 20)
**Apply to:** `DeltaPanel.tsx`, `trendsChartOptions.ts`, `buildTrendSeries.ts`, the warm-up indicator, the inferred-order caption
Signed `+`/`−` is factual (not editorial); `—` em-dash when a field is `null` on either side of a delta pair. Never `* 1.048576` — always the `converters.ts` branded helpers. No `util-low/mid/high` status-ramp tokens on any trend/delta/sparkline element (UI-SPEC Color contract).

### Pure deterministic engine (no clock / no I/O / no crypto)

**Source:** `src/engines/parser/captureDate.ts` lines 4-8 header + `inferCaptureDate` (78-113)
**Apply to:** `captureDateOrdinal.ts`, `buildTrendSeries.ts`
Total function of inputs only. Any "now" is the injected `today` threaded from `useEstateView` line 54 (the single sanctioned clock site, contract at `estateView.ts` line 62). DRY: reuse `ISO_DATE_RE` (captureDate.ts:11) — extract as a shared export, do not duplicate.

### Vitest engine test scaffold (≥75% gate on `engines/`)

**Source:** `src/engines/aggregation/estateView.test.ts` lines 1-17 (imports, fixed `TEST_TODAY`, merge-routing helper) + 19-109 (`host`/`vm`/`snapshot` partial-override factories)
**Apply to:** `buildTrendSeries.test.ts`, `captureDateOrdinal.test.ts`
Copy the factory + fixed-clock + per-field-assertion idiom. Include the mandatory DD-C release-correctness case (RESEARCH Pitfall 4).

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| — | — | None. Every Phase-8 file maps to a shipped vatlas analog (P8 is composition of shipped engines + extension of shipped components — confirmed by ROADMAP "nothing direct; reuses `<Chart>` from Phase 2 and the aggregation pipeline from Phase 2"). |

## Metadata

**Analog search scope:** `src/engines/{aggregation,parser,eos,units,snapshotMerge}/`, `src/hooks/`, `src/store/`, `src/components/` (+ `eos/`, `trends/` target), `src/types/`, `src/utils/`, `src/i18n/locales/`
**Files scanned:** 13 source files read in full (estateView.ts, useEstateView.ts, Chart.tsx, snapshotStore.ts, useSnapshotUpload.ts, captureDate.ts, ViewToggle.tsx, SnapshotCard.tsx, SnapshotListSidebar.tsx, EosView.tsx, estateView.test.ts, aggregation/index.ts) + targeted reads (estate.ts 325-440, App.tsx 28-52, format/converters export grep)
**Pattern extraction date:** 2026-05-17
