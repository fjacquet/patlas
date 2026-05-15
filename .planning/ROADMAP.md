# Roadmap: vatlas

## Overview

vatlas is built bottom-up under horizontal layers: foundations first (parser, units, privacy guard, Web Worker boundary, store), then a single-snapshot aggregation + global dashboard that proves the visual stack end-to-end, then inventory navigation over the same data, then the analytics core (multi-vCenter merge, stretched-cluster pill, allocation sliders, DR simulation) that turns vatlas from a viewer into an atlas, then the independent OS End-of-Support forecast, then multi-snapshot trends (which depend on stable multi-vCenter identity keys), and finally the two exports (HTML report + PPTX deck) that together carry "the report is the product" out of the browser. i18n + theme + drag-drop UX accrue continuously across every phase; the GitHub Pages deploy lands with the exports. Each phase delivers an observable, hand-checkable capability — no horizontal layer is split across phases (no "Phase 1: all models, Phase 2: all APIs"); instead, each phase is one vertical analytics capability rendered against the same engine spine.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Invariants** - Bootstrap, parser-in-Worker, privacy guard, branded units, immutable snapshot store (completed 2026-05-15)
- [ ] **Phase 2: Aggregation & Global Dashboard** - Single-snapshot cluster aggregates + ECharts-driven dashboard with three accounting modes
- [ ] **Phase 3: Inventory Navigation** - Virtualised cluster → ESX → VM tree with sortable/filterable tables and CSV export
- [ ] **Phase 4: Multi-vCenter, Stretched, Allocation & DR Simulation** - The analytics core: merge N workbooks, stretched pill, sliders, three DR modes
- [ ] **Phase 5: OS End-of-Support Forecast** - Bundled endoflife.date catalogue, 3/6/9/12-month at-risk with drill-down
- [ ] **Phase 6: In-Session Trends** - Multi-snapshot timelines, per-cluster sparklines, delta panel, temporal X-axis
- [ ] **Phase 7: HTML + PPTX Exports & Deploy** - Self-contained HTML report, factual PPTX deck, GitHub Pages CI

## Phase Details

### Phase 1: Foundation & Invariants

**Goal**: Ship the engine spine vatlas's entire feature surface depends on — a parser that runs off the main thread, a privacy guard that throws on any non-same-origin request, a branded units module that makes "MB-is-MiB" bugs unrepresentable, and an immutable Zustand snapshot store — so that every later phase can assume those invariants without retrofit. The user-observable outcome at the end of this phase is a deployable shell that ingests a real RVTools workbook in a Web Worker, validates it against Zod schemas, refuses any outbound network call, and shows the parsed snapshot in a snapshot-list sidebar with its vCenter label, RVTools version, and capture date — no aggregates yet, no charts, just proof that the foundations hold under a real 30 MB workbook.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, PAR-01, PAR-02, PAR-03, PAR-04, PAR-05, PRV-01, PRV-02, PRV-03
**Success Criteria** (what must be TRUE):

  1. A user drops an RVTools 4.4 workbook on a public-URL page and sees a snapshot card render (filename, vCenter label, capture date, RVTools version) without the tab freezing, on a 30 MB / 10k-VM fixture
  2. A user refreshes the page after dropping a workbook and confirms the data is gone (no `localStorage` / `IndexedDB` / `OPFS` of dataset rows)
  3. A user drops a malformed workbook (missing `vInfo` sheet) and sees a clear error naming the missing sheet, not a stack trace
  4. A developer opens DevTools Network tab during full app usage and sees zero non-same-origin requests; any attempt to `fetch('https://example.com')` from the console throws synchronously
  5. The `engines/parser/` and `engines/units/` modules ship with ≥75 % Vitest coverage, including the RVTools-MiB canary fixture that fails if a `* 1.048576` factor is ever reintroduced
**Plans**: TBD
**vsizer reuse**: `parseXlsx.ts`, `adapters/columnMap.ts`, `synthesizeOrphanClusters.ts`, `normalizeColumns.ts` (port unchanged); `adapters/rvtools.ts`, `schemas.ts` (port + extend with OS column, `VDatastoreRow`, `VPartitionRow`); drop `detectSource.ts`, `adapters/liveoptics.ts`, `extractWorkbook.ts` entirely; port `biome.json`, `vitest.config.ts`, `tsconfig.*.json`, `src/test/setup.ts` verbatim
**Pitfalls owned**: Critical-1 (MB-is-MiB ADR + canary fixture + branded `MiB`/`GiB` types), Critical-2 (runtime fetch/XHR/WS/Beacon guard, CSP meta `connect-src 'self'`, CI denylist on telemetry packages, no source-map upload, no service worker), Critical-5 (Web Worker parsing + `{ dense: true }` + eager raw-cell drop), Moderate-1 (column alias dictionary for RVTools 3.10/3.11/4.0/4.4 drift), Minor-1 (trim every identifier in Zod), Minor-3 (custom preprocessors so empty cell ≠ 0), Minor-5 (skip RVTools internal/summary rows)

### Phase 2: Aggregation & Global Dashboard

**Goal**: Turn one parsed snapshot into the headline view RVTools admins recognize — one column per cluster, OS-family breakdown, per-cluster physical/consumed GHz, vCPU allocation, mean CPU %/RAM %, CPU Ready % — driven by the ported vsizer aggregation math plus new `perDatastore` (NAA-keyed) and `perEsx` engines, and rendered through a single `useEstateView` hook that becomes the one bridge from the store to every downstream UI and export. This phase also lands the ECharts SVG-renderer infrastructure (`<Chart>` wrapper, tree-shaken imports, Midnight Executive theme tokens) so every later phase consumes the same chart primitives and the HTML-export concern dissolves.
**Depends on**: Phase 1
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06, VIZ-01, VIZ-02, VIZ-03
**Success Criteria** (what must be TRUE):

  1. A user drops an RVTools workbook and sees the global dashboard render in under 3 seconds for a 5000-VM estate, with one column per cluster showing ESX count, VM count (split by Windows/Linux/Other), datastore count, physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU allocation ratio, and CPU Ready %
  2. A user toggles between Configured / Active / Storage-realistic accounting modes and sees three distinct totals (the powered-off-VM trap surfaced explicitly)
  3. A user views the OS-family donut and sees Windows / Linux / Other breakdowns at both global and per-cluster level
  4. Every chart on the dashboard renders as inline `<svg>` (verified by DevTools), confirming the SVG renderer is wired correctly for the eventual HTML export
  5. The ECharts bundle lands at ≤300 KB gzipped (CI size-budget gate), proving tree-shaking is effective
  6. `engines/aggregation/` ships with ≥75 % Vitest coverage including the hyperthreads-vs-physical-cores test and the 2-socket × 12-core × 2600 MHz = 62.4 GHz unit test
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: `engines/aggregation/ghz.ts`, `perCluster.ts`, `vinfoMerge.ts`, `aggregateClusters.ts`, `globals.ts`, `contention.ts` (port unchanged); `utils/format.ts` (port unchanged); new files `perDatastore.ts`, `perEsx.ts`; rewrite `store/datasetStore.ts` shape (multi-snapshot model); `index.css` Midnight Executive palette tokens (port)
**Pitfalls owned**: Critical-6 (three accounting modes surfaced in the engine output + UI default to Active for CPU/RAM, Configured for storage), Moderate-4 (consolidation ratio against physical cores, not threads), Moderate-5 (MHz→GHz branded conversion, configured-vs-reserved RAM separation), Moderate-9 (chart re-render storm mitigation: `<Chart>` memo + selector-level data memoisation), Moderate-11 (datastore NAA-keyed aggregation — no double-count of shared LUNs)

### Phase 3: Inventory Navigation

**Goal**: Make the parsed estate browsable at scale — virtualised tree (vCenter → Datacenter → Cluster → ESX → VM) that stays responsive at 10k+ VMs, sortable/filterable tables for VMs / ESX hosts / datastores, column show/hide, CSV export of the current filter — all consuming existing `perCluster` / `perEsx` / `perDatastore` outputs without adding new engines. This is the phase that proves vatlas survives a real production-sized workbook in the DOM, not just in memory.
**Depends on**: Phase 2
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06
**Success Criteria** (what must be TRUE):

  1. A user opens the inventory tree on a 10000-VM fixture and expands/collapses nodes without dropping below 30 fps (verified by Performance tab)
  2. A user sorts the VM table by `Provisioned MiB` descending and the sort completes in under 200 ms on the same fixture
  3. A user types in the table filter and sees results update within 100 ms (debounced) without re-rendering charts on the dashboard
  4. A user exports the current filtered VM table to CSV and the downloaded file contains exactly the rows visible in the UI (filter respected, column hide respected)
  5. A user views the datastore table and confirms a shared LUN visible in two clusters appears once (NAA-keyed dedupe)
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: `utils/csv.ts` (port unchanged); TanStack Table column-definition patterns from vsizer's existing tables (port + extend); no new engines (consumes `perEsx`, `perDatastore`, `vmsByCluster` from Phase 2)
**Pitfalls owned**: part of Critical-5 (memory budget on 10k+ VM trees — `@tanstack/react-virtual` mandatory, lazy children expansion, snapshot retention policy when N > 4 snapshots), Minor-2 (multi-line cells in VM descriptions/annotations: `oneLine()` at the display boundary, preserve original for CSV)

### Phase 4: Multi-vCenter, Stretched, Allocation & DR Simulation

**Goal**: Turn vatlas from a single-snapshot viewer into the analytics atlas — merge N RVTools workbooks into one logical estate keyed on `(VI SDK UUID, vm_bios_uuid)` (never silent merge on names), surface the Étendu/Stretched pill with per-site reservation math and a `confidence` indicator, expose CPU/RAM allocation sliders with named presets and URL-hash-only persistence, and ship the three DR simulation modes (host loss, cluster loss, vCenter loss) with an explicit assumptions panel and `caveats` array. This is the phase where the engine spine becomes the product — every later capability (EOS, trends, exports) reads the merged estate, not raw snapshots.
**Depends on**: Phase 2
**Requirements**: MVC-01, MVC-02, MVC-03, MVC-04, STR-01, STR-02, STR-03, STR-04, ALC-01, ALC-02, ALC-03, ALC-04, DRS-01, DRS-02, DRS-03, DRS-04, DRS-05, DRS-06
**Success Criteria** (what must be TRUE):

  1. A user drops two RVTools workbooks from different vCenters that have a colliding cluster name (`Cluster-Prod`) and sees both clusters in the tree with vCenter-name suffix disambiguation, with the estate-wide VM total equal to the sum of per-vCenter totals (no double-count, no silent merge)
  2. A user toggles the Étendu/Stretched pill on a 6+4 asymmetric cluster and sees a per-site reservation (not flat 50 %) applied to survivor capacity, with a `low` confidence chip displayed because site/fault-domain metadata was inferred
  3. A user adjusts the CPU allocation slider from 4:1 to 8:1 and sees the consolidation ratio recompute against physical cores (not threads) without a `localStorage` write, with the new ratio reflected in the URL hash
  4. A user simulates the loss of one entire vCenter and sees before/after per-survivor numbers, an evacuee total, and an assumptions panel listing what the sim does and does not model (HA admission control, anti-affinity, restart priority)
  5. Every DR result carries a `confidence` indicator (`high`/`medium`/`low`) and a `caveats` array, displayed in the UI as a warning chip and tooltip
  6. `engines/snapshotMerge/`, `engines/aggregation/aggregateClusters.ts` (stretched math), and `engines/drSim/` ship with ≥75 % Vitest coverage including the 4+4 / 6+4 / 8+0 / 2+2 stretched-cluster test matrix and the colliding-cluster-name + vMotioned-VM dedupe fixture
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: `engines/parser/resolveClusterCollisions.ts` (port + generalise to `vCenterLabel`); `engines/aggregation/aggregateClusters.ts` stretched-cluster DR math (port unchanged, then extend with per-site reservation); ADR-0007 inherited verbatim and extended; new files `engines/snapshotMerge/mergeSnapshotsToEstate.ts`, `vCenterIndex.ts`, `engines/drSim/runScenario.ts`, `allocate.ts`
**Pitfalls owned**: Critical-3 (asymmetric stretched-cluster 50 % rule conditional — per-site math + confidence field + warning chip), Critical-4 (multi-vCenter aggregation keyed on `(VI SDK UUID, cluster_moref)` and `vm_bios_uuid`, secondary `vm_instance_uuid`; cluster-name collision visual suffix; mixed-RVTools-versions warning), Moderate-10 (DR sim trust — assumptions panel, `caveats` array, reservation-vs-capacity check, anti-affinity rules surfaced as soft constraints if `vRP`/`dvSwitch` expose them)

### Phase 5: OS End-of-Support Forecast

**Goal**: Independent of multi-vCenter, ship the lifecycle conversation — bundled `endoflife.date` catalogue refreshed at CI build time, OS-string normalizer with regex bank that handles RHEL 8's four variants and Oracle Linux's three, ESX build → support state classifier, lifecycle bucketing at 3/6/9/12-month horizons plus an explicit "overdue" bucket (RHEL 7, Windows Server 2012 R2 are already past), and one-click drill from any bucket to the affected VM list. The phase ends with the EOS catalogue locked in via Zod-validated build-time sync and a `lastVerified` date surfaced in the UI.
**Depends on**: Phase 2 (uses `vinfo` rows and `vhost` builds from aggregation outputs)
**Requirements**: EOS-01, EOS-02, EOS-03, EOS-04, EOS-05, EOS-06
**Success Criteria** (what must be TRUE):

  1. A user opens the EOS forecast view and sees at-risk VM counts at +3, +6, +9, +12 months plus an "overdue" bucket, with each bucket clickable to drill into the affected VM list
  2. A user views the unknown-OS bucket and sees actual unrecognized OS strings (not silently dropped), giving the maintainer a concrete signal to extend the normalizer
  3. A user sees ESX hosts classified by build → support state (e.g., ESXi 7.0 → past EOS as of 2025-10-02, ESXi 8.0 → supported until 2027-10-11)
  4. A user views the `lastVerified` date on the EOS catalogue and confirms it is within 90 days of the deploy date (CI warns when older)
  5. The OS normalizer achieves <5 % unknown-OS rate on a fixture of 50+ real OS strings harvested from existing RVTools exports
  6. `engines/eos/` ships with ≥75 % Vitest coverage including the RHEL-8-four-variants and Oracle-Linux-three-variants normalization tests
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: nothing direct (new engine module); reuses `utils/format.ts` and `<Chart>` infrastructure from Phase 2
**Pitfalls owned**: Moderate-6 (OS naming variants, `endoflife.date` catalogue source, lifecycle bucketing with "overdue" bucket, extended-support tiers surfaced with asterisks, `lastVerified` CI warning), Minor-4 (case-insensitive OS string matching with original preserved for display)

### Phase 6: In-Session Trends

**Goal**: Make the multi-snapshot story honest — load 2–12 monthly RVTools snapshots together, run aggregation once per snapshot, produce a temporal (not categorical) timeline keyed on actual `capturedAt` dates, render line charts of headline metrics, per-cluster sparklines on the dashboard, a delta panel showing what changed between consecutive snapshots, and snapshot metadata (vCenter label + RVTools version) per timeline point. Background-parse non-default snapshots so the dashboard stays interactive while trends warm up; release older raw rows when N > 4 snapshots are loaded.
**Depends on**: Phase 4 (needs stable `(VI SDK UUID, vm_bios_uuid)` keys for cross-snapshot identity)
**Requirements**: TRD-01, TRD-02, TRD-03, TRD-04, TRD-05
**Success Criteria** (what must be TRUE):

  1. A user drops 12 monthly RVTools workbooks (~360 MB total) and the dashboard is interactive within 5 seconds while trends warm up in the background, with a "trends preparing — N/12" indicator
  2. A user views the trends chart and sees the X-axis use actual capture dates (e.g., 2026-01-31, 2026-02-15, 2026-03-30 with non-uniform spacing) — not evenly-spaced categorical labels
  3. A user sees per-cluster sparklines on the dashboard cards when 2+ snapshots are loaded
  4. A user views the delta panel and sees what changed between consecutive snapshots (e.g., "+12 VMs, -3 powered-on, +480 GiB allocated")
  5. A user refreshes the page and confirms trends are gone (no cross-session persistence — `localStorage` of dataset rows is forbidden)
  6. A user sees each snapshot's vCenter label and RVTools version in the snapshot list (e.g., "vCenter-A / RVTools 4.4")
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: nothing direct (new engine module); reuses `<Chart>` from Phase 2 and the aggregation pipeline from Phase 2
**Pitfalls owned**: Minor-6 (timestamp drift across snapshots — temporal X-axis, capture-date inference order: explicit user input → filename ISO → `vSource` sheet → file mtime → ordinal), part of Critical-5 (memory budget — release older raw rows when N > 4, keep only aggregated time-series for older snapshots)

### Phase 7: HTML + PPTX Exports & Deploy

**Goal**: Close the loop — "the report is the product" — by shipping two synthesis surfaces (single-file self-contained HTML report + factual PPTX deck) that consume every view-model from Phases 2/4/5/6 through the same `EstateView` shape, plus the polish that makes the result trustworthy in shareable form (i18n FR + EN with CI key-diff gate, light/dark theme, data-freshness header/footer, methodology footer) and the GitHub Pages deploy that puts it at `fjacquet.github.io/vatlas/`. Both exports run in a Web Worker to keep the UI interactive during a 5-30 MB synthesis.
**Depends on**: Phase 2, Phase 4, Phase 5, Phase 6 (consumes every view-model)
**Requirements**: HTM-01, HTM-02, HTM-03, HTM-04, HTM-05, PPT-01, PPT-02, PPT-03, PPT-04, DEP-01, DEP-02
**Success Criteria** (what must be TRUE):

  1. A user clicks the HTML export button and downloads a single `.html` file that opens in any browser offline, with no network requests, no JS execution required to view it, and crisp inline SVG charts at every zoom level
  2. A user's HTML report is under 5 MB for a typical 5000-VM estate and under 15 MB for a 36000-VM estate (the hard ceiling), containing cover / executive headlines / per-cluster / EOS forecast / DR results / trends / annex / methodology footer
  3. A user clicks the PPTX export button and downloads a deck using the Midnight Executive palette with locale-formatted numbers (FR uses U+00A0 thousands separator after U+202F substitution, EN uses `,`) — no "Repair errors" when opening in PowerPoint
  4. A user opens both the HTML report and the PPTX deck and confirms they carry factual numbers only (no editorial recommendations — i18n string lint enforces "recommend/should/poor/good" denylist)
  5. A user accesses vatlas at `https://fjacquet.github.io/vatlas/` and confirms every UI string is available in both FR and EN (CI key-diff gate prevents drift), with light/dark theme working
  6. The CI pipeline runs typecheck → lint → test → build → deploy on every push to `main`, with the SheetJS tarball pinning verified and the telemetry-package denylist enforced
**Plans**: TBD
**UI hint**: yes
**vsizer reuse**: `engines/export/pptx/builder.ts` (port + extend); `engines/export/pptx/slides/*.ts` title/overview/cluster/contention (port unchanged); `engines/export/pptx/primitives/*.ts` (port unchanged); `src/i18n/` scaffolding (port + add `inventory`, `eos`, `dr`, `trends`, `report` namespaces); `.github/workflows/static.yml` (port + tweak `base: '/vatlas/'`); new files `engines/export/html/renderReport.tsx`, `inlineAssets.ts`, `renderCharts.ts`, `assembleHtml.ts`, `engines/export/pptx/slides/eosSlide.ts`, `drSimSlide.ts`, `trendsSlide.ts`, `inventorySlide.ts`, `primitives/chartSvg.ts`
**Pitfalls owned**: Moderate-2 (French locale U+202F → U+00A0 substitution for PPTX, centralized formatters, no pre-formatted numbers in translation strings), Moderate-7 (HTML report self-hosted subset fonts as base64 `@font-face`, no external references, CSP meta in exported HTML, inline SVG charts via `chart.renderToSVGString()`, anchor-id namespacing per snapshot, < 5 MB / < 15 MB size budget), Moderate-8 (pptxgenjs `pptxText` wrapper for autoFit/control-char/font-overflow, `pptxSafeFormat` for locale, golden-PPTX snapshot CI test), Minor-7 (i18n FR↔EN key-diff CI gate)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Invariants | 5/5 | Complete   | 2026-05-15 |
| 2. Aggregation & Global Dashboard | 0/TBD | Not started | - |
| 3. Inventory Navigation | 0/TBD | Not started | - |
| 4. Multi-vCenter, Stretched, Allocation & DR Simulation | 0/TBD | Not started | - |
| 5. OS End-of-Support Forecast | 0/TBD | Not started | - |
| 6. In-Session Trends | 0/TBD | Not started | - |
| 7. HTML + PPTX Exports & Deploy | 0/TBD | Not started | - |
