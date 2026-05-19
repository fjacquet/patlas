# Phase 11: Report & Deck Gap Closure - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the two substantive gaps the v1.0 milestone audit (`gaps_found`) found — **no new analytics**, only routing already-shipped view-models into the deliverable and resolving one dead projection:

- **F-2:** Surface the existing Phase 9 view-models (`view.storage`, `view.network`, `view.flags`, `view.vsan`, `view.datastoreDetail`, `view.vmDetail`) in the HTML report **and** the PPTX deck. They render on screen today (StorageView/NetworkView) but reach neither shareable artifact — for a product whose core value is "the report is the product," an entire shipped phase is invisible in the deliverable.
- **F-1:** Resolve `view.plannedView` (PLN-03/04) — currently computed every `buildEstateView` pass and consumed nowhere.
- **Bookkeeping:** Reconcile the stale `REQUIREMENTS.md` traceability so a re-audit can pass.

**Not in scope (scope guard):** any *new* P9 metric/analysis, any new EstateView field, re-deciding Phase 10's locked export architecture. This phase only consumes existing engine output.
</domain>

<decisions>
## Implementation Decisions

### F-1 — view.plannedView fate (PLN-03/04)
- **D-01:** **Render it, and put it in the exports.** `plannedView` becomes a live feature, not removed. PLN-03/04 stay live requirements.
- **D-02:** Surface a **planned-vs-measured estate** view in `PlanningView` (on screen) AND in the HTML report + PPTX deck.
- **D-03 (Claude's discretion):** Exact presentation is Claude's call — **faithful minimal**, mirroring how `drSim`/`plannedDrSim` are already presented in `PlanningView`. Deck stays executive-tight (inherits Phase 10 D-02); HTML sized against the <5 MB / <15 MB budget. Estate-level measured-vs-planned + per-cluster delta is the expected shape; planner picks the precise layout consistent with the existing planning surface.

### F-2 — PPTX deck Phase 9 slides
- **D-04:** **Two new slides — "Storage" and "Network"** (not one combined, not HTML-only). Inherits Phase 10 D-02: each is a *tighter executive* slide; the exhaustive P9 detail lives in the HTML report, not the deck.
- **D-05 (Claude's discretion):** Slide **placement within the fixed PPT-03 order** (title → overview → per-cluster → CPU-Ready annex → EOS → DR → trends → inventory) is Claude's call — choose the most coherent spot; "after per-cluster" is the suggested narrative position but not mandated.
- **D-06:** Threshold-flagged rows appear as a **factual count KPI** on the Storage slide (e.g. "flagged datastores/partitions: N"). **Gold marker only — no traffic-light, no editorial verb** (inherits the locked factual invariant; mirrors the P9 on-screen gold-marker idiom).

### F-2 — P9 charts vs tables
- **D-07:** **Storage = treemap** (size by cluster/datastore consumption — the first-class storage chart from CLAUDE.md's "Charting decision") on **both** the HTML report and the PPTX deck. Built through the single `Chart.tsx` ECharts-SVG site; rasterized for PPTX via the locked `chartToSvg → chartSvgToPng` resvg path (Phase 10 spike decision) and added to `chartBundle.ts`.
- **D-08:** **Network = factual table / count rollup only** (vSwitch / dvSwitch / dvPort / vNetwork counts) — no chart (no natural executive visual).
- **D-09:** **Threshold flags = factual list/count, no chart.**

### F-2 — HTML report Phase 9 depth (not discussed → Claude's Discretion within locked constraints)
- The user did NOT select HTML report depth for discussion. Per Phase 10 D-02 the HTML report carries the *exhaustive* P9 detail (dedicated Storage + Network sections; per-cluster / per-datastore tables; threshold-flagged rows; vSAN-relink shared-LUN as "shared across N clusters"; datastore/VM detail). Planner sizes this against the <5 MB typical / <15 MB hard-ceiling budget on a realistic large estate (the same budget guard Phase 10 applied) — e.g. all clusters inline vs top-N inline + remainder folded. Storage treemap (D-07) is the report's P9 visual; everything else factual tables.

### Bookkeeping — traceability reconciliation (Claude's Discretion, mechanical)
- Fix `REQUIREMENTS.md`: flip the stale `Pending` rows for Phases 4/5/9/10 to `Complete` (they shipped, are SUMMARY-`requirements_completed`-listed, integration-WIRED, and deployed), and correct the **HTM/PPT/DEP rows mislabeled "Phase 7" → "Phase 10"**. Re-derive PLN-03/04 status from the F-1 outcome (now `Complete` once rendered+exported). This is a doc edit, no discussion needed; it lets the re-audit pass.

### Claude's Discretion (summary)
- F-1 presentation shape (D-03); PPTX P9 slide placement (D-05); HTML report P9 section depth & budget trade-off; the mechanical traceability edit. All bounded by the locked carry-forward constraints below.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The gap spec (read first — this phase exists to close it)
- `.planning/v1.0-MILESTONE-AUDIT.md` — the `gaps_found` audit. F-1 (`plannedView` dead), F-2 (P9 absent from report+deck) with file:line evidence; the integration checker's wiring matrix and the exact EstateView fields that are export-absent.

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 11" — the closure-phase entry.
- `.planning/ROADMAP.md` § "Phase 9: Storage / Network / Detailed Views + Threshold Alerting" — what P9 produced (STG/NET/DTL/ALR/VSR), success criteria, the vSAN-relink-via-vInfo.Path / shared-LUN contract.
- `.planning/REQUIREMENTS.md` — STG-01..05, NET-01..05, DTL-01..03, ALR-01..05, VSR-01..05, PLN-03/04 wording; the traceability table to reconcile (lines ~257-333).

### Locked carry-forward decisions (do NOT re-decide)
- `.planning/phases/10-html-pptx-exports-deploy/10-CONTEXT.md` — **D-02** (PPTX = tighter executive subset; HTML carries exhaustive detail — this is why F-2 splits treemap-on-both / detail-in-HTML), **D-07** (active locale only; FR U+202F→U+00A0; FR↔EN key-parity CI gate Minor-7), **D-08** (export = the *active snapshot's* EstateView, not the merged P4 view), and the D-08-discretion note that explicitly punted "whether P9 Storage/Network get dedicated sections" — Phase 11 is the explicit resolution of that punt.
- `.planning/phases/09-storage-network-detailed-views-threshold-alerting/09-CONTEXT.md` + `09-UAT.md` — P9 detail screens were built "one screen-fit area = one slide" expressly for export; the screen-fit contract is the slide contract.
- `CLAUDE.md` § "Charting decision" / "What NOT to Use" — ECharts SVG mandated; treemap is first-class for storage-by-cluster/datastore (D-07); never Canvas for report/deck charts; tree-shaken `Chart.tsx` is the only ECharts site.
- `CLAUDE.md` § "Conventions" / "Gotchas" — factual-only (no "recommend/should/poor/good"); branded units, never raw `* 1.048576`; no pre-formatted numbers in i18n strings; i18n keys land in BOTH en/ and fr/ (key-parity test); the `DataTable.tsx` `inventory:col.<id>` header gotcha + flex `<thead>/<tbody>` desync; the grep-gate / security-hook "absence comment" gotcha.

### In-repo integration points (read before planning)
- `src/engines/export/html/renderReport.tsx` — the pure React report tree (8 HTM-04 sections, `data-chart-slot` placeholders, `exportChartSlots`); F-2 adds Storage/Network sections + plannedView subsection here.
- `src/engines/export/pptx/builder.ts` — the fixed-order slide composition root; F-2 adds Storage + Network slide calls (D-05 placement) + a plannedView slide.
- `src/engines/export/pptx/slides/_layout.ts` — the shared slide design system (`addHeader`/`addKpiRow`/`addChartPanel`/`addNote`); new slides compose these (no per-slide copy-paste).
- `src/engines/export/chartBundle.ts` — where the storage treemap option is added + threaded (note the established inline EN/FR `ChartLabels` map pattern for chart-image strings — keeps chartBundle pure, no i18n-namespace churn).
- `src/engines/export/export.worker.ts` — rasterizes shared/perCluster charts to PNG; the new treemap joins the shared bundle.
- `src/engines/export/buildExportView.ts` — D-08 entry; confirms the export consumes the active snapshot's EstateView (storage/network/flags already present on it).
- `src/types/estate.ts` — `EstateView` shape: `storage`, `network`, `flags`, `vsan`, `datastoreDetail`, `vmDetail`, `plannedView`, `plannedDrSim` (the fields to surface/resolve; ~lines 456-536).
- `src/components/storage/StorageView.tsx`, `src/components/network/NetworkView.tsx`, `src/components/planning/PlanningView.tsx`, `src/components/planning/DrSimPanel.tsx` — the on-screen consumers; the report/deck must present the *same* numbers; PlanningView is where F-1 plannedView renders (mirror the existing `plannedDrSim` panel idiom).
- `src/i18n/locales/{en,fr}/pptx.json` + `report.json` — slide-chrome / report i18n; new Storage/Network/planned strings need EN+FR parity (keyParity.test.ts). Note: slide chrome reads flattened dotted keys via `strings['x'] ?? 'fallback'`.
- `src/i18n/keyParity.test.ts` — the EN↔FR gate; every new key lands in both locales.
- `scripts/check-bundle-size.mjs` — echarts-chunk budget (worker chunks excluded); a new treemap registration must stay within it.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_layout.ts` slide primitives (`addHeader`/`addKpiRow`/`addChartPanel`/`addNote`) — new Storage/Network/planned slides compose these; no new design system.
- `chartBundle.ts` inline EN/FR `ChartLabels` map + `LABELS(locale)` — the established pattern for localized chart-image strings (added during PR #4); reuse it for the storage treemap labels.
- `renderReport.tsx` `data-chart-slot` + `exportChartSlots(view)` + `assembleHtml` SLOT_RE splice — the proven mechanism for inlining a new chart into the HTML report.
- `DataTable.tsx` — virtualized table already used by inventory/storage; report tables can mirror its column model (mind the `inventory:col.<id>` header + flex `<thead>` desync gotcha).
- The locked `chartToSvg → chartSvgToPng` resvg path — the storage treemap rasterizes for PPTX through the exact path the donut/gauge/EOS charts already use.

### Established Patterns
- Engines pure, Vitest-gated ≥75%; `buildEstateView` single pass; components are thin consumers (no second `useMemo`, no `@/engines` import in components). plannedView render in PlanningView must stay a pure prop-consumer of `useEstateView`.
- Factual-only invariant + branded units + no pre-formatted numbers in i18n — applies verbatim to every new exported string and the flag KPI.
- Commit prefix `<type>(11-NN): …`; FR uses app terminology (PRA for DR, Gio for GiB) consistent with the PR #4 slide-chrome work.

### Integration Points
- HTML: new Storage + Network sections + plannedView subsection in `renderReport.tsx`; storage treemap via a new `data-chart-slot`.
- PPTX: new Storage + Network slides + plannedView slide in `builder.ts` (D-05 placement); treemap PNG via `chartBundle.ts` + `export.worker.ts`.
- i18n: new keys in `report.json` + `pptx.json`, EN+FR, parity-gated.
- Bookkeeping: `REQUIREMENTS.md` traceability edit (mechanical).
</code_context>

<specifics>
## Specific Ideas

- Storage treemap is THE P9 visual on both surfaces (user explicitly chose treemap over bar); Network and threshold flags are deliberately table/count-only (no chart).
- Two distinct deck slides ("Storage", "Network") — user explicitly rejected one-combined-slide and HTML-only.
- plannedView is explicitly a *kept* feature with an export presence — user chose the largest-scope option ("Render + put in exports"), rejecting the KISS "just remove it" default.
- Threshold-flagged surfacing must stay factual (gold marker / count) — never a verdict — consistent with the P9 on-screen idiom and the project-wide no-editorial-verbs lint.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within the audit-defined gap-closure scope. (HTML report P9 depth was offered but not selected; it proceeds as Claude's discretion within the locked Phase-10 D-02 + budget constraints, not deferred.)
</deferred>

---

*Phase: 11-report-and-deck-gap-closure*
*Context gathered: 2026-05-19*
