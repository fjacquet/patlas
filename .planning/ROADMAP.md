# Roadmap: vatlas

## Overview

vatlas is built bottom-up under horizontal layers: foundations first (parser, units, privacy guard, Web Worker boundary, store), then a single-snapshot aggregation + global dashboard that proves the visual stack end-to-end, then inventory navigation over the same data, then the analytics core (multi-vCenter merge, stretched-cluster pill, allocation sliders, DR simulation) that turns vatlas from a viewer into an atlas, then the independent OS End-of-Support forecast, then multi-snapshot trends (which depend on stable multi-vCenter identity keys), and finally the two exports (HTML report + PPTX deck) that together carry "the report is the product" out of the browser. i18n + theme + drag-drop UX accrue continuously across every phase; the GitHub Pages deploy lands with the exports. Each phase delivers an observable, hand-checkable capability â no horizontal layer is split across phases (no "Phase 1: all models, Phase 2: all APIs"); instead, each phase is one vertical analytics capability rendered against the same engine spine.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Invariants** - Bootstrap, parser-in-Worker, privacy guard, branded units, immutable snapshot store (completed 2026-05-15)
- [x] **Phase 2: Aggregation & Global Dashboard** - Single-snapshot cluster aggregates + ECharts-driven dashboard with three accounting modes
- [x] **Phase 3: Inventory Navigation** - Virtualised cluster â ESX â VM tree with sortable/filterable tables and CSV export (completed 2026-05-16)
- [x] **Phase 4: Multi-vCenter Merge & Factual Labels** - REDEFINED (analytics-core replan): validated merge engine spine (kept) + per-vCenter/RVTools labels + stretched as the user's declaration with FACTUAL site-data (G1). Its allocation/DR-UI parts are superseded by Phase 6.
- [ ] **Phase 5: Rich Cluster / Host / ESX Intelligence** - NEW: deep per-cluster card + one-window ESX Summary + operational insights (realized CPU overcommit, avg CPU/mem, ESXi & hardware lifecycle, powered/off/susp/template, footprints)
- [ ] **Phase 6: Allocation & DR (re-derived)** - NEW: realized consolidation displayed (G2) + separate capacity-planning lens (Personal Ratios + Custom Failover, OPEN-1) + DR server/site loss, physical impact (G3); reuses kept drSim engine
- [ ] **Phase 7: OS End-of-Support Forecast** - Bundled endoflife.date catalogue, 3/6/9/12-month at-risk with drill-down
- [ ] **Phase 8: In-Session Trends** - Multi-snapshot timelines, per-cluster sparklines, delta panel, temporal X-axis
- [ ] **Phase 9: Storage / Network / Detailed Views + Threshold Alerting** - NEW: storage by cluster/ESX/VM/datastore, ports/switches, disk/partition threshold alerting (scope per OPEN-2/3)
- [ ] **Phase 10: HTML + PPTX Exports & Deploy** - Self-contained HTML report, factual PPTX deck, GitHub Pages CI

## Phase Details

### Phase 1: Foundation & Invariants

**Goal**: Ship the engine spine vatlas's entire feature surface depends on â a parser that runs off the main thread, a privacy guard that throws on any non-same-origin request, a branded units module that makes "MB-is-MiB" bugs unrepresentable, and an immutable Zustand snapshot store â so that every later phase can assume those invariants without retrofit. The user-observable outcome at the end of this phase is a deployable shell that ingests a real RVTools workbook in a Web Worker, validates it against Zod schemas, refuses any outbound network call, and shows the parsed snapshot in a snapshot-list sidebar with its vCenter label, RVTools version, and capture date â no aggregates yet, no charts, just proof that the foundations hold under a real 30 MB workbook.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, PAR-01, PAR-02, PAR-03, PAR-04, PAR-05, PRV-01, PRV-02, PRV-03
**Success Criteria** (what must be TRUE):

  1. A user drops an RVTools 4.4 workbook on a public-URL page and sees a snapshot card render (filename, vCenter label, capture date, RVTools version) without the tab freezing, on a 30 MB / 10k-VM fixture
  2. A user refreshes the page after dropping a workbook and confirms the data is gone (no `localStorage` / `IndexedDB` / `OPFS` of dataset rows)
  3. A user drops a malformed workbook (missing `vInfo` sheet) and sees a clear error naming the missing sheet, not a stack trace
  4. A developer opens DevTools Network tab during full app usage and sees zero non-same-origin requests; any attempt to `fetch('https://example.com')` from the console throws synchronously
  5. The `engines/parser/` and `engines/units/` modules ship with â¥75 % Vitest coverage, including the RVTools-MiB canary fixture that fails if a `* 1.048576` factor is ever reintroduced
**Plans**: TBD
**vsizer reuse**: `parseXlsx.ts`, `adapters/columnMap.ts`, `synthesizeOrphanClusters.ts`, `normalizeColumns.ts` (port unchanged); `adapters/rvtools.ts`, `schemas.ts` (port + extend with OS column, `VDatastoreRow`, `VPartitionRow`); drop `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts` entirely; port `biome.json`, `vitest.config.ts`, `tsconfig.*.json`, `src/test/setup.ts` verbatim
**Pitfalls owned**: Critical-1 (MB-is-MiB ADR + canary fixture + branded `MiB`/`GiB` types), Critical-2 (runtime fetch/XHR/WS/Beacon guard, CSP meta `connect-src 'self'`, CI denylist on telemetry packages, no source-map upload, no service worker), Critical-5 (Web Worker parsing + `{ dense: true }` + eager raw-cell drop), Moderate-1 (column alias dictionary for RVTools 3.10/3.11/4.0/4.4 drift), Minor-1 (trim every identifier in Zod), Minor-3 (custom preprocessors so empty cell â  0), Minor-5 (skip RVTools internal/summary rows)

### Phase 2: Aggregation & Global Dashboard

**Goal**: Turn one parsed snapshot into the headline view RVTools admins recognize â one column per cluster, OS-family breakdown, per-cluster physical/consumed GHz, vCPU allocation, mean CPU %/RAM %, CPU Ready % â driven by the ported vsizer aggregation math plus new `perDatastore` (NAA-keyed) and `perEsx` engines, and rendered through a single `useEstateView` hook that becomes the one bridge from the store to every downstream UI and export. This phase also lands the ECharts SVG-renderer infrastructure (`<Chart>` wrapper, tree-shaken imports, Midnight Executive theme tokens) so every later phase consumes the same chart primitives and the HTML-export concern dissolves.
**Depends on**: Phase 1
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06, VIZ-01, VIZ-02, VIZ-03
**Success Criteria** (what must be TRUE):

  1. A user drops an RVTools workbook and sees the global dashboard render in under 3 seconds for a 5000-VM estate, with one column per cluster showing ESX count, VM count (split by Windows/Linux/Other), datastore count, physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU allocation ratio, and CPU Ready %
  2. A user toggles between Configured / Active / Storage-realistic accounting modes and sees three distinct totals (the powered-off-VM trap surfaced explicitly)
  3. A user views the OS-family donut and sees Windows / Linux / Other breakdowns at both global and per-cluster level
  4. Every chart on the dashboard renders as inline `<svg>` (verified by DevTools), confirming the SVG renderer is wired correctly for the eventual HTML export
  5. The ECharts bundle lands at â¤300 KB gzipped (CI size-budget gate), proving tree-shaking is effective
  6. `engines/aggregation/` ships with â¥75 % Vitest coverage including the hyperthreads-vs-physical-cores test and the 2-socket Ã 12-core Ã 2600 MHz = 62.4 GHz unit test
**Plans**: 3 plans

- [x] 02-01-PLAN.md â ECharts SVG infra: `<Chart>` wrapper, Midnight Executive theme (light+dark), CI bundle-size gate (â¤300 KB gz)
- [x] 02-02-PLAN.md â Aggregation engines (vsizer port+brand retrofit, perDatastore/perEsx/osFamily, 3 accounting modes) + useEstateView bridge
- [x] 02-03-PLAN.md â Dashboard UI per UI-SPEC (summary card, per-cluster columns, OS donut, CPU Ready, accounting toggle) + i18n + App wiring
**UI hint**: yes
**vsizer reuse**: `engines/aggregation/ghz.ts`, `perCluster.ts`, `vinfoMerge.ts`, `aggregateClusters.ts`, `globals.ts`, `contention.ts` (port unchanged); `utils/format.ts` (port unchanged); new files `perDatastore.ts`, `perEsx.ts`; rewrite `store/datasetStore.ts` shape (multi-snapshot model); `index.css` Midnight Executive palette tokens (port)
**Pitfalls owned**: Critical-6 (three accounting modes surfaced in the engine output + UI default to Active for CPU/RAM, Configured for storage), Moderate-4 (consolidation ratio against physical cores, not threads), Moderate-5 (MHzâGHz branded conversion, configured-vs-reserved RAM separation), Moderate-9 (chart re-render storm mitigation: `<Chart>` memo + selector-level data memoisation), Moderate-11 (datastore NAA-keyed aggregation â no double-count of shared LUNs)

### Phase 3: Inventory Navigation

**Goal**: Make the parsed estate browsable at scale â virtualised tree (vCenter â Datacenter â Cluster â ESX â VM) that stays responsive at 10k+ VMs, sortable/filterable tables for VMs / ESX hosts / datastores, column show/hide, CSV export of the current filter â all consuming existing `perCluster` / `perEsx` / `perDatastore` outputs without adding new engines. This is the phase that proves vatlas survives a real production-sized workbook in the DOM, not just in memory.
**Depends on**: Phase 2
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06
**Success Criteria** (what must be TRUE):

  1. A user opens the inventory tree on a 10000-VM fixture and expands/collapses nodes without dropping below 30 fps (verified by Performance tab)
  2. A user sorts the VM table by `Provisioned MiB` descending and the sort completes in under 200 ms on the same fixture
  3. A user types in the table filter and sees results update within 100 ms (debounced) without re-rendering charts on the dashboard
  4. A user exports the current filtered VM table to CSV and the downloaded file contains exactly the rows visible in the UI (filter respected, column hide respected)
  5. A user views the datastore table and confirms a shared LUN visible in two clusters appears once (NAA-keyed dedupe)
**Plans**: 3 plans

- [x] 03-01-PLAN.md â Table infra: TanStack deps + bundle gate, csv.ts/oneLine.ts, VmDisplayRow projection, generic DataTable/ColumnPicker/ViewToggle (no wiring)
- [x] 03-02-PLAN.md â Three object tables: vm/esx/datastore ColumnDefs + thin wrappers, CSV-of-filterÃvisible + NAA-preserved gates
- [x] 03-03-PLAN.md â Tree + shell + inventory i18n EN/FR + App ViewToggle wiring + 10k synthetic fixture + stress/e2e + LIVE tanstack bundle gate
**UI hint**: yes
**vsizer reuse**: `utils/csv.ts` (port unchanged); TanStack Table column-definition patterns from vsizer's existing tables (port + extend); no new engines (consumes `perEsx`, `perDatastore`, `vmsByCluster` from Phase 2)
**Pitfalls owned**: part of Critical-5 (memory budget on 10k+ VM trees â `@tanstack/react-virtual` mandatory, lazy children expansion, snapshot retention policy when N > 4 snapshots), Minor-2 (multi-line cells in VM descriptions/annotations: `oneLine()` at the display boundary, preserve original for CSV)

### Phase 4: Multi-vCenter Merge & Factual Labels

> **REDEFINED 2026-05-16 — analytics-core replan** (`.planning/ANALYTICS-CORE-REPLAN.md`).
> Original P4 ("Multi-vCenter, Stretched, Allocation & DR") was executed (commits `04-01..04`, real-file-validated) but UAT rejected its allocation, DR-mode, and stretched-confidence design. The validated **engine spine is KEPT as baseline** (`engines/snapshotMerge`, `aggregateClusters` per-site math, `engines/drSim`). This phase is now rescoped to: that merge spine + per-vCenter/RVTools labels + the **G1** stretched rework (stretched = the user's declaration; engine adapts the per-site reservation and reports site data FACTUALLY — no auto high/med/low confidence verdict, no judgement chip; no fault-domain metadata ⇒ symmetric 50 %).
> **Allocation moves to Phase 6 (UAT G2 — calculated, not slider-selected). DR modes/metric move to Phase 6 (UAT G3 — Server+Site loss, physical impact).** Requirements still owned here: MVC-01..04 (done), STR-01..03 (reworked per G1), STR-04 retired (merged into factual STR-03). The original Goal/Success/Plans text below is **superseded** by this banner and retained only as history.
>
> **Re-derived plans (authoritative):**
> - [x] `04-01` — multi-vCenter merge engine spine — DONE, real-file-validated, kept as baseline
> - [x] `04-05` — G1 stretched rework: factual `siteData` (detected/assumed) replaces confidence verdict+chip; reservation math unchanged; estate "N clusters marked stretched"; merge STR-03 / drop STR-04 — DONE 2026-05-17, real-file-validated
> - 04-02/03/04 superseded (02 math kept in 04-01 baseline; 03 allocation→P6; 04 DR→P6)

**Goal**: Turn vatlas from a single-snapshot viewer into the analytics atlas â merge N RVTools workbooks into one logical estate keyed on `(VI SDK UUID, vm_bios_uuid)` (never silent merge on names), surface the Ãtendu/Stretched pill with per-site reservation math and a `confidence` indicator, expose CPU/RAM allocation sliders with named presets and URL-hash-only persistence, and ship the three DR simulation modes (host loss, cluster loss, vCenter loss) with an explicit assumptions panel and `caveats` array. This is the phase where the engine spine becomes the product â every later capability (EOS, trends, exports) reads the merged estate, not raw snapshots.
**Depends on**: Phase 2
**Requirements**: MVC-01, MVC-02, MVC-03, MVC-04, STR-01, STR-02, STR-03, STR-04, ALC-01, ALC-02, ALC-03, ALC-04, DRS-01, DRS-02, DRS-03, DRS-04, DRS-05, DRS-06
**Success Criteria** (what must be TRUE):

  1. A user drops two RVTools workbooks from different vCenters that have a colliding cluster name (`Cluster-Prod`) and sees both clusters in the tree with vCenter-name suffix disambiguation, with the estate-wide VM total equal to the sum of per-vCenter totals (no double-count, no silent merge)
  2. A user toggles the Ãtendu/Stretched pill on a 6+4 asymmetric cluster and sees a per-site reservation (not flat 50 %) applied to survivor capacity, with a `low` confidence chip displayed because site/fault-domain metadata was inferred
  3. A user adjusts the CPU allocation slider from 4:1 to 8:1 and sees the consolidation ratio recompute against physical cores (not threads) without a `localStorage` write, with the new ratio reflected in the URL hash
  4. A user simulates the loss of one entire vCenter and sees before/after per-survivor numbers, an evacuee total, and an assumptions panel listing what the sim does and does not model (HA admission control, anti-affinity, restart priority)
  5. Every DR result carries a `confidence` indicator (`high`/`medium`/`low`) and a `caveats` array, displayed in the UI as a warning chip and tooltip
  6. `engines/snapshotMerge/`, `engines/aggregation/aggregateClusters.ts` (stretched math), and `engines/drSim/` ship with â¥75 % Vitest coverage including the 4+4 / 6+4 / 8+0 / 2+2 stretched-cluster test matrix and the colliding-cluster-name + vMotioned-VM dedupe fixture
**Plans**: 4 plans

- [x] 04-01-PLAN.md — Multi-vCenter merge engine + columnar-vMetaData/fault-domain parser prerequisites + single-memo multi-snapshot contract + MVC-04 labels (MVC-01..04)
- [x] 04-02-PLAN.md — Stretched per-site reservation + confidence + pill/chip + Hosts→cluster datastore attribution (STR-01..03 done; STR-04 vSAN under-count OPEN — RVTools `Hosts` is a count not a name list, see 04-02-SUMMARY)
- [x] 04-03-PLAN.md — Allocation sliders + presets + URL-hash codec + ALC-04 guard (ALC-01..04)
- [x] 04-04-PLAN.md — DR simulation engine (3 modes) + panel + assumptions + caveats (DRS-01..06)
**UI hint**: yes
**vsizer reuse**: `engines/parser/resolveClusterCollisions.ts` (port + generalise to `vCenterLabel`); `engines/aggregation/aggregateClusters.ts` stretched-cluster DR math (port unchanged, then extend with per-site reservation); ADR-0007 inherited verbatim and extended; new files `engines/snapshotMerge/mergeSnapshotsToEstate.ts`, `vCenterIndex.ts`, `engines/drSim/runScenario.ts`, `allocate.ts`
**Pitfalls owned**: Critical-3 (asymmetric stretched-cluster 50 % rule conditional â per-site math + confidence field + warning chip), Critical-4 (multi-vCenter aggregation keyed on `(VI SDK UUID, cluster_moref)` and `vm_bios_uuid`, secondary `vm_instance_uuid`; cluster-name collision visual suffix; mixed-RVTools-versions warning), Moderate-10 (DR sim trust â assumptions panel, `caveats` array, reservation-vs-capacity check, anti-affinity rules surfaced as soft constraints if `vRP`/`dvSwitch` expose them)

### Phase 5: Rich Cluster / Host / ESX Intelligence

**NEW — analytics-core replan.** Closes the "far richer per-cluster intelligence" gap; reference depth = RVTools Analyser functions #1,2,4,7,11 (see `.planning/ANALYTICS-CORE-REPLAN.md`).
**Goal**: Replace the shallow cluster card with RVTools-Analyser-grade depth + a one-window ESX/Host summary: per-cluster + estate operational insights — realized CPU overcommit (`vCPU / usable-pCPU`, calculated, G2), avg CPU usage (core-weighted) / avg memory usage (host-mem-weighted), hosts on ESXi < 8.x + ESXi-version lifecycle posture, hardware lifecycle (hosts out of vendor support), powered-on/off/suspended/template breakdown, provisioned vs in-use, datastore footprint (incl .vswp+snapshots), guest data, total physical cores / host memory rollups. All client-side, in-memory (privacy invariant — NO database).
**Depends on**: Phase 4 (consumes the merged estate)
**Requirements**: TBD — re-derive in discuss-phase (RVTools-Analyser #1,2,4,7,11; richer-cluster gap in replan brief)
**Success Criteria**: TBD — re-derive in discuss-phase
**Plans**: TBD
**UI hint**: yes
**Pitfalls owned**: realized ratio calculated not invented (G2); lifecycle data factual (no editorial verbs); single-`useMemo` invariant preserved

### Phase 6: Allocation & DR (re-derived)

**NEW — analytics-core replan.** Supersedes original P4 allocation (04-03) + DR (04-04). Carries UAT decisions G2, G3 and the resolved OPEN-1.
**Goal**: (a) Display the **realized** consolidation ratio (`vCPU / usable-pCPU`, `vRAM / physRAM`) as a calculated measured output — no input (G2). (b) A SEPARATE, explicitly-labelled **capacity-planning lens** accepting user **Personal Ratios (CPU/RAM) + Custom Failover** for what-if sizing (OPEN-1 resolved: two distinct features, "measured" vs "planned", never conflated, never overwriting the realized value). (c) **DR simulation** reusing the kept `engines/drSim` engine, reworked to exactly two modes — **Server loss** + **Site loss** (drop cluster/vCenter); Site = fault-domain of clusters the user declared stretched; non-stretched workload at a lost site = LOST (no DR target); impact = **physical CPU (GHz/cores) + physical RAM** removed, not vCPU; survivor verdict vs physical headroom; reversible/neutral failed-selection UI kept (G3). Custom Failover (b) reconciles with this DR model.
**Depends on**: Phase 4, Phase 5
**Requirements**: TBD — re-derive in discuss-phase (carries UAT G2/G3, OPEN-1; replaces ALC-01..04, DRS-01..06)
**Success Criteria**: TBD — re-derive in discuss-phase
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: keep shipped `engines/drSim/runScenario.ts` + `allocate.ts` + `aggregateClusters` per-site math — rework modes/metric, do NOT rewrite from zero
**Pitfalls owned**: Moderate-10 (DR trust — assumptions panel + caveats, kept); G2/G3 anti-patterns (no invented ratios; DR units = server/site with physical impact)

### Phase 7: OS End-of-Support Forecast

**Goal**: Independent of multi-vCenter, ship the lifecycle conversation â bundled `endoflife.date` catalogue refreshed at CI build time, OS-string normalizer with regex bank that handles RHEL 8's four variants and Oracle Linux's three, ESX build â support state classifier, lifecycle bucketing at 3/6/9/12-month horizons plus an explicit "overdue" bucket (RHEL 7, Windows Server 2012 R2 are already past), and one-click drill from any bucket to the affected VM list. The phase ends with the EOS catalogue locked in via Zod-validated build-time sync and a `lastVerified` date surfaced in the UI.
**Depends on**: Phase 2 (uses `vinfo` rows and `vhost` builds from aggregation outputs)
**Requirements**: EOS-01, EOS-02, EOS-03, EOS-04, EOS-05, EOS-06
**Success Criteria** (what must be TRUE):

  1. A user opens the EOS forecast view and sees at-risk VM counts at +3, +6, +9, +12 months plus an "overdue" bucket, with each bucket clickable to drill into the affected VM list
  2. A user views the unknown-OS bucket and sees actual unrecognized OS strings (not silently dropped), giving the maintainer a concrete signal to extend the normalizer
  3. A user sees ESX hosts classified by build â support state (e.g., ESXi 7.0 â past EOS as of 2025-10-02, ESXi 8.0 â supported until 2027-10-11)
  4. A user views the `lastVerified` date on the EOS catalogue and confirms it is within 90 days of the deploy date (CI warns when older)
  5. The OS normalizer achieves <5 % unknown-OS rate on a fixture of 50+ real OS strings harvested from existing RVTools exports
  6. `engines/eos/` ships with â¥75 % Vitest coverage including the RHEL-8-four-variants and Oracle-Linux-three-variants normalization tests
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: nothing direct (new engine module); reuses `utils/format.ts` and `<Chart>` infrastructure from Phase 2
**Pitfalls owned**: Moderate-6 (OS naming variants, `endoflife.date` catalogue source, lifecycle bucketing with "overdue" bucket, extended-support tiers surfaced with asterisks, `lastVerified` CI warning), Minor-4 (case-insensitive OS string matching with original preserved for display)

### Phase 8: In-Session Trends

**Goal**: Make the multi-snapshot story honest â load 2â12 monthly RVTools snapshots together, run aggregation once per snapshot, produce a temporal (not categorical) timeline keyed on actual `capturedAt` dates, render line charts of headline metrics, per-cluster sparklines on the dashboard, a delta panel showing what changed between consecutive snapshots, and snapshot metadata (vCenter label + RVTools version) per timeline point. Background-parse non-default snapshots so the dashboard stays interactive while trends warm up; release older raw rows when N > 4 snapshots are loaded.
**Depends on**: Phase 4 (needs stable `(VI SDK UUID, vm_bios_uuid)` keys for cross-snapshot identity)
**Requirements**: TRD-01, TRD-02, TRD-03, TRD-04, TRD-05
**Success Criteria** (what must be TRUE):

  1. A user drops 12 monthly RVTools workbooks (~360 MB total) and the dashboard is interactive within 5 seconds while trends warm up in the background, with a "trends preparing â N/12" indicator
  2. A user views the trends chart and sees the X-axis use actual capture dates (e.g., 2026-01-31, 2026-02-15, 2026-03-30 with non-uniform spacing) â not evenly-spaced categorical labels
  3. A user sees per-cluster sparklines on the dashboard cards when 2+ snapshots are loaded
  4. A user views the delta panel and sees what changed between consecutive snapshots (e.g., "+12 VMs, -3 powered-on, +480 GiB allocated")
  5. A user refreshes the page and confirms trends are gone (no cross-session persistence â `localStorage` of dataset rows is forbidden)
  6. A user sees each snapshot's vCenter label and RVTools version in the snapshot list (e.g., "vCenter-A / RVTools 4.4")
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: nothing direct (new engine module); reuses `<Chart>` from Phase 2 and the aggregation pipeline from Phase 2
**Pitfalls owned**: Minor-6 (timestamp drift across snapshots â temporal X-axis, capture-date inference order: explicit user input â filename ISO â `vSource` sheet â file mtime â ordinal), part of Critical-5 (memory budget â release older raw rows when N > 4, keep only aggregated time-series for older snapshots)

### Phase 9: Storage / Network / Detailed Views + Threshold Alerting

**NEW — analytics-core replan.** Reference = RVTools Analyser functions #10, #12, #14. Scope is bounded by **OPEN-2** (how far to mirror the dedicated-screen nav taxonomy vs the current Dashboard⟷Inventory ViewToggle) and **OPEN-3** (whether threshold alerting + a user-config surface is in this milestone) — both resolved in discuss-phase before planning.
**Goal**: Storage views (total disk sizes by Cluster / ESX / VM / Datastore), detailed Cluster/ESX/VM/Datastore views with disk & partition **threshold alerting**, ports & switches (network) detail, and the personal-config surface for thresholds (filesystem / logical units) — all client-side, in-memory.
**Depends on**: Phase 4, Phase 5
**Requirements**: TBD — re-derive in discuss-phase (RVTools-Analyser #10/#12/#14; OPEN-2/3)
**Success Criteria**: TBD — re-derive in discuss-phase
**Plans**: TBD
**UI hint**: yes
**Pitfalls owned**: threshold config must not breach the privacy invariant (UI prefs only, never dataset rows); factual alerting (no editorial verbs)

### Phase 10: HTML + PPTX Exports & Deploy

**Goal**: Close the loop â "the report is the product" â by shipping two synthesis surfaces (single-file self-contained HTML report + factual PPTX deck) that consume every view-model from Phases 2/4/5/6 through the same `EstateView` shape, plus the polish that makes the result trustworthy in shareable form (i18n FR + EN with CI key-diff gate, light/dark theme, data-freshness header/footer, methodology footer) and the GitHub Pages deploy that puts it at `fjacquet.github.io/vatlas/`. Both exports run in a Web Worker to keep the UI interactive during a 5-30 MB synthesis.
**Depends on**: Phase 2, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9 (consumes every analytics view-model)
**Requirements**: HTM-01, HTM-02, HTM-03, HTM-04, HTM-05, PPT-01, PPT-02, PPT-03, PPT-04, DEP-01, DEP-02
**Success Criteria** (what must be TRUE):

  1. A user clicks the HTML export button and downloads a single `.html` file that opens in any browser offline, with no network requests, no JS execution required to view it, and crisp inline SVG charts at every zoom level
  2. A user's HTML report is under 5 MB for a typical 5000-VM estate and under 15 MB for a 36000-VM estate (the hard ceiling), containing cover / executive headlines / per-cluster / EOS forecast / DR results / trends / annex / methodology footer
  3. A user clicks the PPTX export button and downloads a deck using the Midnight Executive palette with locale-formatted numbers (FR uses U+00A0 thousands separator after U+202F substitution, EN uses `,`) â no "Repair errors" when opening in PowerPoint
  4. A user opens both the HTML report and the PPTX deck and confirms they carry factual numbers only (no editorial recommendations â i18n string lint enforces "recommend/should/poor/good" denylist)
  5. A user accesses vatlas at `https://fjacquet.github.io/vatlas/` and confirms every UI string is available in both FR and EN (CI key-diff gate prevents drift), with light/dark theme working
  6. The CI pipeline runs typecheck â lint â test â build â deploy on every push to `main`, with the SheetJS tarball pinning verified and the telemetry-package denylist enforced
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: `engines/export/pptx/builder.ts` (port + extend); `engines/export/pptx/slides/*.ts` title/overview/cluster/contention (port unchanged); `engines/export/pptx/primitives/*.ts` (port unchanged); `src/i18n/` scaffolding (port + add `inventory`, `eos`, `dr`, `trends`, `report` namespaces); `.github/workflows/static.yml` (port + tweak `base: '/vatlas/'`); new files `engines/export/html/renderReport.tsx`, `inlineAssets.ts`, `renderCharts.ts`, `assembleHtml.ts`, `engines/export/pptx/slides/eosSlide.ts`, `drSimSlide.ts`, `trendsSlide.ts`, `inventorySlide.ts`, `primitives/chartSvg.ts`
**Pitfalls owned**: Moderate-2 (French locale U+202F â U+00A0 substitution for PPTX, centralized formatters, no pre-formatted numbers in translation strings), Moderate-7 (HTML report self-hosted subset fonts as base64 `@font-face`, no external references, CSP meta in exported HTML, inline SVG charts via `chart.renderToSVGString()`, anchor-id namespacing per snapshot, < 5 MB / < 15 MB size budget), Moderate-8 (pptxgenjs `pptxText` wrapper for autoFit/control-char/font-overflow, `pptxSafeFormat` for locale, golden-PPTX snapshot CI test), Minor-7 (i18n FRâEN key-diff CI gate)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 â 2 â 3 â 4 â 5 â 6 â 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Invariants | 5/5 | Complete   | 2026-05-15 |
| 2. Aggregation & Global Dashboard | 3/3 | Complete   | 2026-05-16 |
| 3. Inventory Navigation | 3/3 | Complete | 2026-05-16 |
| 4. Multi-vCenter Merge & Factual Labels | 2/2 | Complete (re-derived) — 04-01 merge baseline + 04-05 G1 rework, real-file-validated | 2026-05-17 |
| 5. Rich Cluster / Host / ESX Intelligence | 0/TBD | Not started (NEW) | - |
| 6. Allocation & DR (re-derived) | 0/TBD | Not started (NEW; carries UAT G2/G3, OPEN-1) | - |
| 7. OS End-of-Support Forecast | 0/TBD | Not started | - |
| 8. In-Session Trends | 0/TBD | Not started | - |
| 9. Storage / Network / Detailed Views + Threshold Alerting | 0/TBD | Not started (NEW; scope per OPEN-2/3) | - |
| 10. HTML + PPTX Exports & Deploy | 0/TBD | Not started | - |
