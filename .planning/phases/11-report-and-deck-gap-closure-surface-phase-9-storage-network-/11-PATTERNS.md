# Phase 11: Report & Deck Gap Closure - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 11 (3 new slide modules, 1 new chart builder, 4 modified engine/i18n files, 1 modified component, 1 doc edit, 1 new test)
**Analogs found:** 11 / 11 (every Phase 11 file is additive routing of shipped view-models — strong analog for each)

> Phase 11 is purely additive: existing EstateView fields (`storage`/`network`/`flags`/`vsan`/`datastoreDetail`/`vmDetail`/`plannedView`) are routed into existing export engines + one PlanningView panel. **No new analytics, no new EstateView field, no new ECharts registration** (TreemapChart is already registered in both `Chart.tsx` and the SSR `renderCharts.ts` — verified).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/engines/export/pptx/slides/storageSlide.ts` (new) | pptx-slide | transform | `src/engines/export/pptx/slides/eosSlide.ts` | exact |
| `src/engines/export/pptx/slides/networkSlide.ts` (new) | pptx-slide | transform | `src/engines/export/pptx/slides/inventorySlide.ts` (KPI-only, no chart) | exact |
| `src/engines/export/pptx/slides/plannedSlide.ts` (new) | pptx-slide | transform | `src/engines/export/pptx/slides/eosSlide.ts` / `drSimSlide.ts` | exact |
| `src/engines/export/pptx/builder.ts` (modify) | composition-root | request-response | self (existing slide call-sites) | exact |
| `src/engines/export/chartBundle.ts` (modify) | engine (option builder) | transform | `eosBar`/`drBar`/`overviewCharts` in same file | exact |
| `src/engines/export/html/renderReport.tsx` (modify) | engine (React-SSR tree) | transform | existing `Section` / `Metric` / `data-chart-slot` in same file | exact |
| `src/engines/export/export.worker.ts` (modify, minimal) | worker | streaming | self (existing `optBundle.shared` raster loop) | exact |
| `src/components/planning/PlanningView.tsx` (modify) | component | request-response | `src/components/dr/DrSimPanel.tsx` (thin `view`-prop presenter) | exact |
| `src/i18n/locales/{en,fr}/report.json` (modify) | config (i18n) | — | existing `eos`/`dr` nested blocks | exact |
| `src/i18n/locales/{en,fr}/pptx.json` (modify) | config (i18n) | — | existing `eos`/`dr` nested blocks | exact |
| `src/engines/export/pptx/builder.test.ts` or new `chartBundle.test.ts` (new/extend) | test | — | `src/engines/export/buildExportView.test.ts` | exact |
| `.planning/REQUIREMENTS.md` (modify) | doc (bookkeeping) | — | n/a (mechanical edit) | n/a |

## Pattern Assignments

### `src/engines/export/pptx/slides/storageSlide.ts` (new — pptx-slide, transform)

**Analog:** `src/engines/export/pptx/slides/eosSlide.ts` (KPI row + chart panel) — copy its exact module shape.

The slide composes ONLY the `_layout.ts` primitives — never raw `s.addText`/`s.addShape` (CLAUDE.md: "forbids per-slide copy-paste"; D-04: tighter executive subset). Signature & skeleton to replicate verbatim (from `eosSlide.ts:9-37`):

```typescript
import type PptxGenJS from 'pptxgenjs'
import type { EstateView } from '@/types/estate'   // pull view.storage + view.flags here
import type { ExportStrings } from '../../types'
import { type ExportLocale, pptxNumber } from '../format'
import { addChartPanel, addHeader, addKpiRow, CONTENT_W, M } from './_layout'

export function addStorageSlide(
  pptx: PptxGenJS,
  view: EstateView,
  chartPng: Uint8Array | undefined,   // the new 'storageTreemap' shared PNG
  strings: ExportStrings,
  locale: ExportLocale,
): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['storage.title'] ?? 'Storage')
  const y2 = addKpiRow(s, [ /* estate provisioned/inUse/capacity from view.storage.estate (branded MiB → GiB via Math.round(... / 1024), see drSimSlide.ts:34) */ ], y)
  addChartPanel(s, chartPng, { x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 }, strings['storage.byCluster'] ?? 'Storage by cluster')
}
```

**D-06 flag KPI:** add a factual `{ label: strings['storage.flagged'] ?? 'Flagged datastores', value: pptxNumber(view.flags.counts.ds + view.flags.counts.lu, locale) }` card. **Gold marker only** — `addHeader` already paints the gold factual rule (`_layout.ts:34-41`); do NOT add traffic-light colour or any verb (no "should/poor/over-threshold-warning"). Source field shapes: `ThresholdFlags.counts { fs; ds; lu }` (`src/engines/aggregation/thresholdFlags.ts:43-51`), `StorageByX.estate { provisionedMib; inUseMib; capacityMib; usedMib; freeMib }` (`src/engines/aggregation/storageByX.ts:46-64`).

**Branded-units gotcha (CLAUDE.md / ADR-0010):** RVTools MiB → GiB is `Math.round(Number(x) / 1024)`, exactly as `drSimSlide.ts:34` and `chartBundle.ts:128`. Never `* 1.048576`, never a raw `1000` divide.

---

### `src/engines/export/pptx/slides/networkSlide.ts` (new — pptx-slide, transform)

**Analog:** `src/engines/export/pptx/slides/inventorySlide.ts` (KPI-only, but it still calls `addChartPanel`). **D-08 says NO chart for network** — so this slide is `addHeader` + `addKpiRow` ONLY (omit `addChartPanel` entirely; do not pass a PNG). Closest no-chart prior art is the null-branch of `drSimSlide.ts:21-24` (`addNote` when nothing to show). Skeleton:

```typescript
import { addHeader, addKpiRow } from './_layout'   // NO addChartPanel — D-08
export function addNetworkSlide(pptx, view, strings, locale): void {
  const s = pptx.addSlide()
  const y = addHeader(s, strings['network.title'] ?? 'Network')
  addKpiRow(s, [
    { label: strings['network.vswitches'] ?? 'vSwitches', value: pptxNumber(view.network.vswitches.length, locale) },
    { label: strings['network.dvswitches'] ?? 'dvSwitches', value: pptxNumber(view.network.dvswitches.length, locale) },
    { label: strings['network.portgroups'] ?? 'Portgroups', value: pptxNumber(view.network.portgroups.length, locale) },
    { label: strings['network.vnetwork'] ?? 'VM adjacencies', value: pptxNumber(view.network.vmPortgroupCount, locale) },
  ], y)
}
```

Field shape `NetworkRollup { vswitches[]; dvswitches[]; portgroups[]; vmPortgroupCount }` (`src/engines/aggregation/network.ts:53-59`). Network sheets are OPTIONAL — when absent these arrays are empty (factual-degrade); `pptxNumber(0)` renders `0`, which is correct (never fabricate, never em-dash a real zero).

---

### `src/engines/export/pptx/slides/plannedSlide.ts` (new — pptx-slide, transform; F-1 / D-02)

**Analog:** `eosSlide.ts` shape + the `drSimSlide.ts:21-24` null-guard pattern. `view.plannedView` is `{ globals: GlobalSummary; clusters: ClusterAggregate[] } | null` (`src/types/estate.ts:494`) — only null in `EMPTY_VIEW`, but copy the `drSim === null` guard idiom anyway for safety:

```typescript
const y = addHeader(s, strings['planned.title'] ?? 'Planned vs measured estate')
if (view.plannedView === null) { addNote(s, strings['planned.none'] ?? '—', y); return }
// D-03 expected shape: estate-level measured-vs-planned KPI row.
// measured = view.globals.* ; planned = view.plannedView.globals.*
addKpiRow(s, [
  { label: strings['planned.vcpuMeasured'] ?? 'vCPU:pCPU measured', value: pptxNumber(Number(view.globals.vcpuPerPcpu), locale) },
  { label: strings['planned.vcpuPlanned']  ?? 'vCPU:pCPU planned',  value: pptxNumber(Number(view.plannedView.globals.vcpuPerPcpu), locale) },
], y)
```

`GlobalSummary` is the same shape on `view.globals` and `view.plannedView.globals` — read the existing usage in `renderReport.tsx:84-101` / `builder.ts:56-60` for which fields are safe (`vmCount`, `hostCount`, `clusterCount`, `vcpuPerPcpu`). D-03: faithful-minimal, executive-tight (inherits Phase 10 D-02). Per-cluster delta is the "expected shape" but the planner picks the precise layout — keep it within one screen-fit slide.

---

### `src/engines/export/pptx/builder.ts` (modify — composition-root)

**Analog:** itself. The fixed PPT-03 order is a flat sequence of `addXSlide(pptx, …)` calls (`builder.ts:53-99`). D-05 placement = Claude's discretion; the suggested narrative spot is **after the per-cluster loop, before `addContentionAnnex`** (mirrors "after per-cluster" in D-05). Add exactly mirroring the `addEosSlide`/`addDrSimSlide` call-site shape (`builder.ts:93-94`):

```typescript
// after the `for (const cluster of view.clusters) { addClusterSlide(...) }` loop:
addStorageSlide(pptx, view, png('storageTreemap'), strings, locale)
addNetworkSlide(pptx, view, strings, locale)              // no png — D-08
// plannedSlide placement: with the other re-aggregation slides; D-03 minimal — e.g. after drSim:
addPlannedSlide(pptx, view, strings, locale)
```

`png(k)` is the existing `shared?.get(k)` helper (`builder.ts:51`). Add the three `import { addStorageSlide } from './slides/storageSlide'` lines alongside `builder.ts:20-27` (Biome auto-organizes imports — alphabetical).

---

### `src/engines/export/chartBundle.ts` (modify — engine option builder; D-07 storage treemap)

**Analog:** the `eosBar(view, L)` / `drBar(view, L)` private option-builders in the SAME file (`chartBundle.ts:88-137`) + the inline `ChartLabels`/`LABELS(locale)` map (`chartBundle.ts:22-61`). The treemap data shape is already proven on screen in `StorageView.tsx:87-99` — copy that `series:[{ type:'treemap', breadcrumb:{show:false}, data: groups.map(g => ({ name:g.key, value:g.provisionedMib as number })) }]` shape into a pure builder:

```typescript
/** D-07 storage treemap — provisioned consumption by cluster (same series
 *  shape StorageView renders; pure, returns EChartsOption only). */
function storageTreemap(view: EstateView, _L: ChartLabels): EChartsOption {
  return {
    tooltip: {},
    series: [{
      type: 'treemap',
      breadcrumb: { show: false },
      data: view.storage.byCluster.map((g) => ({ name: g.key, value: g.provisionedMib as number })),
    }],
  }
}
```

**ChartLabels extension (PR #4 pattern):** if the treemap needs any locale string (e.g. a title), add a `storageTitle` field to BOTH branches of the `LABELS` map at `chartBundle.ts:32-61` — the inline EN/FR map is deliberate (keeps chartBundle pure, no i18n-namespace churn; D-07 active-locale-only). Treemap node names are user cluster names (data, not locale) — no label needed there.

**Thread into `buildChartBundle`** (`chartBundle.ts:170-188`) exactly like `eosBar`:

```typescript
const shared: Record<string, EChartsOption> = {
  ...overviewCharts(view, L),
  eosBar: eosBar(view, L),
  storageTreemap: storageTreemap(view, L),   // ← add this line
}
```

The `shared` record key (`storageTreemap`) is the SAME string the worker rasterizes and `builder.ts` looks up via `png('storageTreemap')` — single source of truth, no re-derivation. **No `echarts.use([...])` edit needed** — `TreemapChart` is already registered in the SSR path (`src/engines/export/html/renderCharts.ts:26-47`, verified) and in `Chart.tsx:42`.

---

### `src/engines/export/export.worker.ts` (modify — minimal/possibly zero)

**Analog:** itself. The shared-PNG raster loop already iterates EVERY entry of `optBundle.shared` generically (`export.worker.ts:79-82`): `for (const [k, opt] of Object.entries(optBundle.shared)) sharedPng.set(k, await raster(opt))`. Adding `storageTreemap` to `shared` in `chartBundle.ts` means **the worker rasterizes it with zero worker edits** via the locked `chartToSvg → chartSvgToPng` resvg path (`export.worker.ts:76-77`). The HTML path loops `exportChartSlots(view)` per-cluster only (`export.worker.ts:67-70`) — see the renderReport note below for how the treemap slot gets fed on the HTML side.

---

### `src/engines/export/html/renderReport.tsx` (modify — React-SSR tree; F-2 HTML depth)

**Analog:** the existing `Section` + `Metric` components and `data-chart-slot` mechanism in the SAME file (`renderReport.tsx:50-70`, `123-148`, `237-242`). Add Storage + Network `<Section>`s and a plannedView subsection in the FIXED HTM-04 `data-section` order. Section + chart-slot idiom to replicate (`renderReport.tsx:123-148`):

```tsx
<Section id="storage" title={strings['storage.title'] ?? 'Storage'}>
  <Metric label={strings['storage.provisioned'] ?? 'Provisioned'} value={fmtInt(Number(view.storage.estate.provisionedMib), loc)} />
  {/* factual flagged count — Metric flag prop paints the gold .flagged style (D-06) */}
  <Metric label={strings['storage.flagged'] ?? 'Flagged datastores'} value={fmtInt(view.flags.counts.ds + view.flags.counts.lu, loc)} flag={view.flags.counts.ds + view.flags.counts.lu > 0} />
  {/* Chart slot — assembleHtml splices the trusted ECharts SSR SVG here. */}
  <div data-chart-slot="storage-treemap" className="chart-slot" />
</Section>
```

**Chart-slot wiring (HTML path):** `renderReport.tsx`'s `exportChartSlots(view)` (`:237-242`) currently emits per-cluster ids only. For the single estate-level treemap, the cleanest mirror is to add a fixed slot id `"storage-treemap"` and have the worker's HTML branch (`export.worker.ts:67-71`) set `charts.set('storage-treemap', chartToSvg(optBundle.shared.storageTreemap, ...))` alongside the per-cluster loop. `assembleHtml`'s `SLOT_RE` splice matches ANY `data-chart-slot` id — no assembleHtml change needed (verify against `src/engines/export/html/assembleHtml.ts`).

**Budget (Phase 10 D-02 carry-forward):** HTML carries the *exhaustive* P9 detail (per-cluster/per-datastore tables, threshold-flagged rows, vSAN shared-LUN "shared across N clusters", datastore/VM detail). Size against <5 MB typical / <15 MB hard ceiling using the SAME top-N-inline + remainder-folded lever already in this file (`TOP_N_CLUSTERS = 16`, `renderReport.tsx:29-33` + the annex `<table>` at `:193-216`). The annex `<table>` (`:193-211`) is the table pattern to mirror for per-datastore rows.

**Security gotcha (in-file doc-comment, lines 9-16):** every user-derived value goes through a plain JSX text node (`renderToStaticMarkup` HTML-escapes). The React raw-markup escape-hatch prop is grep-gated as forbidden in this file. New cluster/datastore/VM names from `view.storage`/`view.datastoreDetail`/`view.vmDetail` must be plain `{text}` children — never the dangerous-HTML prop.

---

### `src/components/planning/PlanningView.tsx` (modify — component, F-1 / D-02 / D-03)

**Analog:** `src/components/dr/DrSimPanel.tsx` — the canonical thin `view`-prop presenter (CONTEXT D-03: "mirror this idiom exactly"). Key invariants from `DrSimPanel.tsx:6-19` + `:58-62` and `PlanningView.tsx:50-62`:

- The single `useEstateView(mode)` call already exists in `PlanningView` (`:53`); the new planned panel is a **pure prop-consumer** — pass `view` down, **no second `useMemo`, no `@/engines` import in components** (CLAUDE.md hard invariant).
- Component-level recompute is forbidden — every number is read straight off `view.plannedView` / `view.globals` (exactly as `DrSimPanel` reads `view.drSim`/`view.plannedDrSim`, `DrSimPanel.tsx:60-61`).
- Reuse the `Stat` row idiom (`DrSimPanel.tsx:49-56`): `label + font-mono tabular-nums value`, light/dark twins. Add a new sub-section in `PlanningView`'s `<div className="flex flex-col gap-6">` (`PlanningView.tsx:82`), structurally separated like the existing `mt-12` break (`:86`).
- Wrap in the existing `ErrorBoundary FallbackComponent={PlanningError}` already present (`PlanningView.tsx:81`).

Either add an inline planned-vs-measured block in `PlanningView` or create a sibling `PlannedEstatePanel.tsx` next to `PlannedRatiosControl.tsx` — the `DrSimPanel` prop-interface shape (`DrSimPanelProps { view: EstateView; ... }`, `DrSimPanel.tsx:6-19`) is the template if extracted.

---

### `src/i18n/locales/{en,fr}/report.json` + `pptx.json` (modify — config)

**Analog:** the existing nested `eos` / `dr` blocks in `report.json` and `pptx.json` (verified structure). New keys mirror that nesting: add a `"storage": { "title": …, "provisioned": …, "flagged": …, "byCluster": … }`, `"network": { … }`, `"planned": { … }` block to BOTH `en/` and `fr/` for BOTH `report.json` and `pptx.json`.

**CRITICAL flatten gotcha (verified `src/hooks/useExport.ts:77-84` + `:50-58`):** the export string bag is `{ ...flattenBundle(report), ...flattenBundle(pptx) }` — **NO namespace prefix**. `report.json` and `pptx.json` are flattened into ONE flat dotted-key map; a key that exists in both (e.g. `cluster.title`) → **pptx silently clobbers report** (it spreads second). Engines read `strings['storage.title'] ?? 'fallback'` (the `?? fallback` pattern at `renderReport.tsx:91`, every slide module). To avoid collision either keep Storage/Network/planned keys structurally identical in both files (intended — same dotted key resolves the same string regardless of which file wins) OR namespace them distinctly. Mirror PR #4: it added slide-chrome keys to both files with matching dotted paths.

**FR conventions (CONTEXT / D-07 / PR #4):** FR uses app terminology — `PRA` for DR, `Gio` for GiB. Storage GiB labels in FR → `Gio`; no pre-formatted numbers in any string (numbers come from `pptxNumber`/`fmtInt`); no editorial verbs (factual-only invariant — never "recommandé/devrait/insuffisant").

**Parity gate:** `src/i18n/keyParity.test.ts` (verified) recursively deep-diffs every namespace EN vs FR — any key added to `en/report.json` MUST land in `fr/report.json` with the identical path or this test fails on `npm run test:run`. No workflow edit needed; it's already wired.

---

### Engine test (new or extend `src/engines/export/pptx/builder.test.ts` / new `chartBundle.test.ts`)

**Analog:** `src/engines/export/buildExportView.test.ts` — `describe/it` + the `host()`/`vm()` fixture-factory builders (`buildExportView.test.ts:16-45`) and `buildEstateView(mergeSnapshotsToEstate([snap]), …)` to produce a real `EstateView`. Any NEW pure helper (e.g. a flag-count derivation in `storageSlide`, or `storageTreemap` data mapping) must be Vitest-gated ≥75% (CLAUDE.md / vsizer ADR-0005 — `engines/` gated). `chartBundle.ts` test would assert `buildChartBundle(view,…).shared.storageTreemap.series[0].type === 'treemap'` and that `byCluster` rows map to `{name,value}`. PPTX slides are structurally smoke-tested via the existing `builder.test.ts` golden-structure pattern (wasm-free — `opts.charts` omitted → "—" panels, per `builder.ts:11-13`).

---

### `.planning/REQUIREMENTS.md` (modify — mechanical bookkeeping)

No code analog. Per CONTEXT bookkeeping decision + AUDIT `tech_debt`: flip stale `Pending` rows for Phases 4/5/9/10 → `Complete`; correct HTM/PPT/DEP rows mislabeled "Phase 7" → "Phase 10"; re-derive PLN-03/04 → `Complete` once F-1 renders+exports. Pure doc edit (lines ~257-333 per CONTEXT).

## Shared Patterns

### Slide design system (apply to all 3 new slides)
**Source:** `src/engines/export/pptx/slides/_layout.ts` (`addHeader` :23, `addKpiRow` :75, `addChartPanel` :125, `addNote` :178; `CONTENT_W`/`M` exports :190)
**Apply to:** storageSlide, networkSlide, plannedSlide — compose ONLY these. The gold factual rule is painted by `addHeader` (`_layout.ts:34-41`) — that IS the D-06 gold marker; never add a second colour or any verdict colour. Chart panel box convention is `{ x: M, y: y2, w: CONTENT_W, h: 7.15 - y2 }` (every existing slide).

### Branded-units conversion
**Source:** `chartBundle.ts:128` / `drSimSlide.ts:34` — `Math.round(Number(xMib) / 1024)` for MiB→GiB.
**Apply to:** storageSlide, plannedSlide, renderReport storage section. ADR-0010: RVTools "MB" is MiB; never raw `* 1.048576`, never `/1000`. Display via `fmtInt`/`pptxNumber` — never pre-format inside an i18n string.

### Factual-only invariant
**Source:** project-wide lint + `renderReport.tsx:9-16` doc-comment, `drSimSlide.ts:2-4` ("No verdict language").
**Apply to:** every new exported string + the D-06 flag KPI. No "recommend/should/poor/good/over/risk/warning". Flags are a count + the gold `.flagged` style only (`renderReport.tsx:63-70` `Metric` `flag` prop; `_layout.ts` gold rule). Mirrors the P9 on-screen gold-marker idiom.

### i18n EN↔FR parity
**Source:** `src/i18n/keyParity.test.ts` (recursive deep key-diff, all namespaces).
**Apply to:** every key in `report.json`/`pptx.json` — EN and FR identical paths or `npm run test:run` fails. Use the `strings['x'] ?? 'fallback'` resolution (every slide + `renderReport.tsx:91`).

## No Analog Found

None. Every Phase 11 file has a strong in-repo analog (the phase is additive routing by design).

## Gotchas Flagged (CLAUDE.md / verified in code)

1. **i18n flatten collision (HIGH — verified `useExport.ts:77-84`):** `report.json` + `pptx.json` flatten into ONE prefix-less dotted-key bag; `pptx` spreads second and silently clobbers any colliding `report` key. Keep new Storage/Network/planned dotted paths collision-free (or identical-by-intent) across both files.
2. **`DataTable.tsx` `inventory:col.<id>` header + flex desync (CLAUDE.md Gotchas):** if the HTML report's exhaustive per-datastore tables reuse `components/inventory/DataTable.tsx`, the `headerFor` prop is CSV-only — visible headers resolve via `useTranslation('inventory') → t('col.<id>')`. A new column `id` needs an `inventory:col.<id>` key in BOTH `i18n/locales/{en,fr}/inventory.json` or the raw key renders. The `<thead>` must use the SAME `flex w-full` + per-cell `flex-1` layout as the virtualized `<tbody>` or columns desync (latent P7 bug — affected all consumers). The plain `<table className="annex-table">` in `renderReport.tsx:193-216` sidesteps this entirely and is the safer mirror for report tables.
3. **grep-gate / security-hook "absence comment" (CLAUDE.md Gotchas):** a `grep -c "<token>" == 0` plan gate and the security hook match doc-comments too. Do NOT write a comment that literally names a forbidden token to document its deliberate absence (e.g. naming the React raw-HTML prop, or `new Date(`). Phrase absence comments without the literal token — `renderReport.tsx:9-16` is the existing safe phrasing model.
4. **No new ECharts registration (verified):** `TreemapChart` is already in `echarts.use([...])` in `renderCharts.ts:26-47` (SSR/PPTX path) and `Chart.tsx:42` (screen). The storage treemap needs ZERO chart-registration edit — `scripts/check-bundle-size.mjs` budget is unaffected (worker chunks excluded; treemap already in the bundle).
5. **Commit prefix:** `<type>(11-NN): …` per the locked plan-id convention.

## Metadata

**Analog search scope:** `src/engines/export/**`, `src/components/{planning,dr,storage,network}/**`, `src/engines/aggregation/**`, `src/i18n/**`, `src/types/estate.ts`, `src/hooks/useExport.ts`
**Files scanned:** ~22 read/inspected
**Pattern extraction date:** 2026-05-19
