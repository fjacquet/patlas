<!-- generated-by: gsd-doc-writer -->
# Product Requirements Document: vatlas

**Status:** Current through Phase 6 (completed 2026-05-17)
**Document date:** 2026-05-17
**Sources reconciled:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, and the replan ADRs (`docs/adr/0020`, `0021`, `0022`). Where `.planning/PROJECT.md` (which predates the analytics-core replan) conflicts with the newer sources, the newer source is authoritative and is reflected here.

---

## 1. Overview & Core Value

vatlas is a 100% client-side web app that turns one or more RVTools `.xlsx` exports into a navigable, visual atlas of a VMware estate: a global dashboard, inventory tree views, allocation and DR analysis, OS End-of-Support forecasting, and in-session trends across multiple snapshots. It exports the result as a shareable HTML report and a PPTX deck. It is the broader sibling of vsizer and follows the same architectural mold (drop file in browser, see numbers, export, leave), with a much larger feature surface.

**Core value:** A user drops an RVTools workbook and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate, without uploading a single byte. The report is the product.

The reference tool is the legacy RVTools Analyser desktop application (Windows, persistent database). vatlas rebuilds its analytic value in a browser, ephemeral, and RVTools-only.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Parse RVTools `.xlsx` workbooks (versions 3.10, 3.11, 4.0, 4.4) off the main thread, with branded units that make MB-is-MiB and MHz-vs-GHz errors unrepresentable.
- Present a global vCenter dashboard, navigable inventory at 10k+ VM scale, rich per-cluster and per-host operational insights, a capacity-planning what-if lens, a two-mode DR simulation, OS End-of-Support forecasting, and in-session multi-snapshot trends.
- Produce a single self-contained shareable HTML report and a factual PPTX deck, both carrying numbers only (no editorial recommendations).
- Run entirely in the browser in French or English, with light and dark themes, deployed publicly to GitHub Pages.

### 2.2 Non-Goals (explicit Out of Scope)

| Excluded | Reason |
|----------|--------|
| Live Optics ingestion | RVTools-only is an explicit narrowing vs. vsizer; reduces parser surface |
| Cross-session persistence (database / IndexedDB / OPFS / `localStorage` of dataset rows) | Breaks the privacy invariant — refresh = data gone |
| Backend / server / file upload | 100% client-side is a hard product invariant |
| Telemetry of parsed contents (even anonymous) | Same privacy invariant |
| Editorial recommendations in reports | vatlas carries numbers only — narrative stays with the presenter |
| Real-time vCenter API connection | RVTools workbook is the only input |
| Right-sizing recommendation engine | RVTools snapshots lack peak-active data |
| Saved scenarios / accounts / shared dashboards | Requires backend, breaks privacy invariant |
| Mobile / touch-first UX | 10k+ row tables are not a mobile use case |
| In-browser editing of inventory rows | RVTools is source of truth |
| Source-map upload in CI | Could leak repo internals |
| Service worker | Increases attack surface; no value for ephemeral data |
| `.zip` bundle ingestion of multiple workbooks | Deferred to v2 (ZIP-01); not in v1 |

---

## 3. Constraints

The binding tech stack, privacy invariant, and engineering principles are defined in `CLAUDE.md` (Project + Constraints sections) and detailed in `docs/ARCHITECTURE.md`. Summary:

- **Tech stack:** React 19, TypeScript (strict), Vite 8, Tailwind v4, Zustand 5, react-i18next, Zod (parser boundary only), SheetJS (`xlsx@0.20.3` from the official tarball, not the CVE-affected npm package — ADR-0002), pptxgenjs ^4 (mandated for the Phase 10 PPTX export, not yet installed), Biome, Vitest + @testing-library/react, Apache ECharts via `echarts-for-react` with the SVG renderer mandated project-wide and tree-shaken imports.
- **Privacy invariant (ADR-0001, ADR-0004):** No fetch ships workbook bytes; no telemetry of parsed contents; no `localStorage`/`IndexedDB`/`OPFS` of dataset rows. A runtime guard throws synchronously on any non-same-origin request; a CSP `connect-src 'self'` meta tag is defense in depth; a CI denylist blocks telemetry packages. Only `vatlas-lang` and `vatlas-theme` keys may write to `localStorage`. Refresh = data gone.
- **Units (ADR-0010):** RVTools "MB" values are read directly as MiB with no `* 1.048576` conversion. Branded `MiB`/`GiB`/`TiB`/`MHz`/`GHz` types enforce this at compile time.
- **Engineering principles (binding):** KISS, DRY, functional programming. Engines are pure functions (no React/DOM/Zustand; Zod only at the parser boundary). The Zustand store holds inputs only. `useEstateView` is the single `useMemo` bridge from store to UI/exports. No premature abstractions, no class hierarchies for domain logic, no copy-paste between phases.
- **Deploy target:** GitHub Pages static site at `fjacquet.github.io/vatlas/`, via a CI pipeline running typecheck → lint → test → build → deploy on every push to `main`.
- **Input format:** RVTools `.xlsx` only.

---

## 4. Functional Requirements by Area

Requirement IDs are the canonical IDs from `.planning/REQUIREMENTS.md`. Each area is marked against the 10-phase roadmap: Phases 1–6 are shipped (completed 2026-05-15 through 2026-05-17); Phases 7–10 are planned.

### 4.1 Foundation, Parser, Units & Privacy — Phase 1 (Shipped 2026-05-15)

- **FND-01..05:** 100% client-side at a public URL; drag-and-drop zone for one or more `.xlsx` files; full FR/EN/DE/IT i18n with auto-detect then toggle; light/dark theme; visible workbook capture-date indicator.
- **PAR-01..05:** Parsing in a Web Worker without blocking the UI; clear error naming a missing sheet/column on schema mismatch; RVTools 3.10/3.11/4.0/4.4 column-drift resolved via an alias dictionary; memory/storage fields preserved as MiB (no `* 1.048576`); refresh confirms data is gone.
- **PRV-01..03:** No non-same-origin request after load (runtime guard throws); CSP meta `connect-src 'self'`; no telemetry/analytics SDKs (denied at CI).

Status: all 13 requirements Complete.

### 4.2 Aggregation & Global Dashboard — Phase 2 (Shipped 2026-05-16)

- **DSH-01..06:** Global vCenter dashboard, one column per cluster (ESX, VM by Windows/Linux/Other, datastore counts); estate-wide summary card; per-cluster physical/consumed GHz, mean CPU%/RAM%, vCPU allocation; OS-family breakdown at global and per-cluster level; CPU Ready % from `vInfo.Overall Cpu Readiness` with mean/max/count above the 5% threshold; three accounting modes (Configured / Active / Storage-realistic) with a visible toggle.
- **VIZ-01..03:** Crisp SVG charts at every zoom level (ECharts SVG renderer everywhere); chart families — stacked bar, donut, treemap, heatmap, calendar-heatmap, line, gauge, sparkline; consistent Midnight Executive theming.

Status: all 9 requirements Complete.

### 4.3 Inventory Navigation — Phase 3 (Shipped 2026-05-16)

- **INV-01..06:** Virtualised inventory tree (vCenter → Datacenter → Cluster → ESX → VM) responsive at 10k+ VMs; sortable/filterable tables for VMs, ESX hosts, and datastores (datastores keyed on NAA/UUID, no double-count of shared LUNs); CSV export of the current filtered view; per-table column show/hide.

Status: all 6 requirements Complete.

### 4.4 Multi-vCenter Merge & Factual Labels — Phase 4 (Shipped 2026-05-17, re-derived)

> Phase 4 was redefined under the analytics-core replan. The validated merge engine spine is kept as baseline; its allocation and DR-UI parts moved to Phase 6; stretched was reworked per UAT decision G1 (ADR-0022).

- **MVC-01..04:** Multiple RVTools workbooks from different vCenters treated as one logical estate, keyed on `(VI SDK UUID, vm_bios_uuid)` for cross-vCenter vMotion dedupe; visual suffix (no silent merge) on colliding cluster names; per-snapshot vCenter label and RVTools version in the snapshot list.
- **STR-01..03:** User toggles a cluster's "Étendu / Stretched" pill; per-site CPU/RAM reservation applied factually (asymmetric splits honoured, e.g. 6+4) when fault-domain data is present; provenance shown factually as "detected" vs "assumed" — no high/medium/low verdict, no warning chip. The former STR-04 low-confidence-chip requirement is retired and merged into the factual STR-03.

Per ADR-0022: stretched status is the user's declaration; the tool never auto-derives or grades it. When no fault-domain metadata exists, a symmetric 50/50 split is assumed and labelled as such (`SYMMETRIC_FRACTION = 0.5`). The RVTools `vDatastore` "Hosts" column is a count, not a host-name list, so a datastore→cluster→site auto-join is not attempted (documented descope, not a silent gap).

Status: MVC-01..04 and STR-01..03 Complete.

### 4.5 Rich Cluster / Host / ESX Intelligence — Phase 5 (Shipped 2026-05-17)

- **RCI-01..05:** RVTools-Analyser-grade operational insights at estate and per-cluster scope — realized vCPU:pCPU overcommit, core-weighted average CPU %, host-mem-weighted average memory %, powered-on/off/suspended/template breakdown, provisioned-vs-in-use, datastore footprint, guest data, total cores and host memory — every value calculated from parsed RVTools columns, nothing invented; a dedicated one-window Hosts/ESX view (estate rollup + expandable per-cluster host lists with factual ESXi version, fault domain, model/vendor — no lifecycle verdict); an estate Operational Insights tile row on the dashboard; an em-dash sentinel for any metric that cannot be derived (never an invented 0); a single-cluster detail drill-down, one-screen-fit and export-ready.

Status: all 5 requirements Complete.

### 4.6 Allocation / Capacity Planning — Phase 6 (Shipped 2026-05-17, re-derived)

> The original ALC-01..04 ("Allocated Resources") slider/preset/URL-hash design was rejected at Phase-4 UAT (decision G2 / OPEN-1) and is retired (ADR-0020). The realized "measured" consolidation ratio is satisfied by Phase 5 RCI-01 (calculated, no input); Phase 6 builds no new realized-ratio UI (DRY). The capacity-planning what-if is the new, explicitly-distinct surface (PLN-01..04). The killed slider / URL-hash mechanism is forbidden to reintroduce.

- **PLN-01:** A separate, explicitly-labelled "Capacity planning — what-if (planned)" surface as a 4th top-level ViewToggle segment, structurally distinct from the realized "measured" value and never overwriting or hiding it.
- **PLN-02:** Planned CPU and RAM ratios via named preset buttons (CPU 1:1 / 4:1 / 8:1 / VDI 10:1; RAM same pattern) filling an editable numeric field; defaults CPU 4:1 / RAM 1:1; no slider widget.
- **PLN-03:** Planned ratios held in-memory only (Zustand inputs slice); no URL-hash codec, no `localStorage` — refresh = data gone.
- **PLN-04:** Planned what-if recomputes against physical cores (not hyperthreads) through the single `useEstateView` memo; the measured reference shown read-only with a "measured" qualifier pointing at Phase 5 Operational Insights — never conflated.

Status: PLN-01..04 Complete. (Old ALC-01..04 retired/re-derived.)

### 4.7 Disaster Recovery Simulation — Phase 6 (Shipped 2026-05-17, re-derived)

> The original DRS-01..06 four-mode, vCPU-impact, confidence-graded design was rejected at Phase-4 UAT (decision G3 / D-09 / D-10) and re-derived as DRX-01..06 (ADR-0021). Cluster-loss (old DRS-02) and vCenter-loss (old DRS-03) are dropped. The high/medium/low confidence clause is dropped entirely. The validated `engines/drSim` engine is evolved, not rewritten.

- **DRX-01:** Server loss — individual named-host multi-select AND a per-cluster "N of M hosts in cluster X" stepper; reversible/neutral failed-selection UI (no red, no alarm icon, no confirmation dialog).
- **DRX-02:** Site loss — site = the fault-domain value of clusters the user declared stretched (Site A / Site B); the engine removes that site's physical hosts; non-stretched workload physically at the lost site is surfaced as an explicit factual "lost — no DR target" line; no fault-domain metadata ⇒ symmetric 50% split.
- **DRX-03:** DR impact reported as physical CPU removed (GHz / cores) + physical RAM removed (MiB) — never vCPU; per-survivor verdict against physical headroom using the reused `Verdict` enum, rendered as a factual word + numbers with no color/traffic-light.
- **DRX-04:** Explicit assumptions panel listing what the sim does and does not model.
- **DRX-05:** A factual `caveats[]` array on every DR result (i18n key suffixes, no editorial verb, no number); no `confidence` indicator anywhere.
- **DRX-06:** Before/after per-survivor numbers and evacuated total for every scenario; a single in-panel "Apply planned ratios to this scenario" affordance (Custom Failover — not a 3rd mode) re-runs the same Server/Site sim with the planning lens's planned ratios, never conflated with the measured DR result.

Status: DRX-01..06 Complete. (Old DRS-01..06 retired/dropped.)

### 4.8 OS End-of-Support Forecast — Phase 7 (Planned)

- **EOS-01..06:** EOS forecast view with at-risk counts at +3/+6/+9/+12 months plus an "overdue" bucket (RHEL 7, Windows Server 2012 R2, ESXi 7.0, etc.); clickable buckets drilling into the affected VM list; ESX hosts classified by build → support state (patch-level and major-version EOS); an "unknown OS" bucket for unmatched OS strings (not silently dropped); a `lastVerified` date on the EOS catalogue, refreshed at CI build time from endoflife.date.

Status: not started (Phase 7).

### 4.9 In-Session Trends — Phase 8 (Planned)

- **TRD-01..05:** Load 2–12 monthly RVTools snapshots together and see headline metrics evolve; temporal X-axis using actual capture dates (not categorical labels); per-cluster sparklines on the dashboard when multiple snapshots are loaded; a delta panel showing what changed between consecutive snapshots; refresh confirms trends are gone (no cross-session persistence).

Status: not started (Phase 8).

### 4.10 Storage / Network / Detailed Views + Threshold Alerting — Phase 9 (Planned)

Storage views (total disk sizes by Cluster / ESX / VM / Datastore), detailed Cluster/ESX/VM/Datastore views with disk and partition threshold alerting, ports and switches (network) detail, and a personal-config surface for thresholds (UI preferences only, never dataset rows). Requirements and success criteria are to be re-derived in the discuss-phase step, bounded by OPEN-2 and OPEN-3 (see Section 5).

Status: not started (Phase 9; new under the analytics-core replan).

### 4.11 HTML Report & PPTX Exports + Deploy — Phase 10 (Planned)

- **HTM-01..05:** One-click download of a single self-contained `.html` file; opens offline with no JS execution required and crisp inline SVG charts; under 5 MB for a typical estate and under 15 MB for the largest supported (hard ceiling); contains cover, executive headlines, per-cluster, EOS forecast, DR results, trends, annex, methodology footer; factual numbers only (no editorial recommendations).
- **PPT-01..04:** One-click PPTX deck using the same neutral Midnight Executive palette as vsizer; includes title, overview, per-cluster, conditional CPU Ready annex, EOS, DR, trends, inventory summary; locale-formatted numbers (FR `,` with U+00A0 thousands separator, EN `.` with `,` thousands separator).
- **DEP-01..02:** Public access at `fjacquet.github.io/vatlas/`; deploy is the result of a CI pipeline running typecheck → lint → test → build → deploy on every push to `main`.

Status: not started (Phase 10).

### 4.12 Requirement Status Summary

| Area | IDs | Phase | Status |
|------|-----|-------|--------|
| Foundation / Parser / Privacy | FND-01..05, PAR-01..05, PRV-01..03 | 1 | Shipped 2026-05-15 |
| Aggregation / Dashboard / Viz | DSH-01..06, VIZ-01..03 | 2 | Shipped 2026-05-16 |
| Inventory Navigation | INV-01..06 | 3 | Shipped 2026-05-16 |
| Multi-vCenter / Stretched | MVC-01..04, STR-01..03 | 4 | Shipped 2026-05-17 (re-derived) |
| Rich Cluster / Host / ESX Intelligence | RCI-01..05 | 5 | Shipped 2026-05-17 |
| Capacity Planning (what-if) | PLN-01..04 | 6 | Shipped 2026-05-17 (re-derived; old ALC-01..04 retired) |
| DR Simulation | DRX-01..06 | 6 | Shipped 2026-05-17 (re-derived; old DRS-01..06 retired/dropped) |
| OS End-of-Support Forecast | EOS-01..06 | 7 | Planned |
| In-Session Trends | TRD-01..05 | 8 | Planned |
| Storage / Network / Detailed Views | TBD (RVTools-Analyser #10/#12/#14) | 9 | Planned (scope per OPEN-2/3) |
| HTML / PPTX Exports + Deploy | HTM-01..05, PPT-01..04, DEP-01..02 | 10 | Planned |

v1 requirement total: 68 (counted in `.planning/REQUIREMENTS.md`). 6 of 10 phases shipped.

---

## 5. Open Questions

These are unresolved scope questions carried in the roadmap; OPEN-1 is resolved, OPEN-2 and OPEN-3 are open and gate Phase 9 planning.

- **OPEN-1 — Capacity-planning what-if vs. realized ratio (RESOLVED, Phase 6).** Resolved as two distinct, never-conflated features: the realized "measured" consolidation (calculated, Phase 5 RCI-01) and a separate, explicitly-labelled "planned" capacity-planning lens (PLN-01..04). The planned lens never overwrites or hides the measured value. Recorded in ADR-0020.
- **OPEN-2 — Detailed-views navigation taxonomy (OPEN, gates Phase 9).** How far to mirror the dedicated-screen navigation taxonomy of RVTools Analyser versus the current Dashboard ⟷ Inventory ViewToggle. To be resolved in the Phase 9 discuss-phase step before planning. (Note: Phase 5 already resolved a hybrid ViewToggle 'Hosts' segment + cluster-detail drill for its own scope.)
- **OPEN-3 — Threshold alerting + user-config surface (OPEN, gates Phase 9).** Whether disk/partition threshold alerting and a user-configurable threshold surface are in this milestone. The threshold config must remain UI-preferences only and never breach the privacy invariant. To be resolved in the Phase 9 discuss-phase step before planning.

---

## 6. References

- `CLAUDE.md` — Project + Constraints (binding tech stack, privacy invariant, engineering principles).
- `docs/ARCHITECTURE.md` — system architecture, engine spine, store and `useEstateView` design.
- `docs/adr/0001-privacy-invariant.md` — privacy invariant (runtime guard, CSP, CI denylist).
- `docs/adr/0002-sheetjs-xlsx-cdn-tarball-pin.md` — SheetJS tarball pin (CVE avoidance).
- `docs/adr/0004-no-localstorage-of-dataset-rows.md` — no persistence of dataset rows.
- `docs/adr/0010-rvtools-mb-as-mib.md` — RVTools "MB" treated as MiB.
- `docs/adr/0020-allocation-ratio-is-calculated-not-selected.md` — allocation is calculated; planned lens is separate.
- `docs/adr/0021-dr-modes-server-and-site-physical-impact.md` — DR = Server + Site loss, physical impact, no confidence.
- `docs/adr/0022-stretched-cluster-is-a-user-declaration.md` — stretched is the user's declaration; factual per-site data.
- `.planning/REQUIREMENTS.md` — canonical requirement IDs and traceability.
- `.planning/ROADMAP.md` — the 10-phase roadmap and per-phase detail.
