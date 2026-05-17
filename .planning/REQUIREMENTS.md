# Requirements: vatlas

**Defined:** 2026-05-15
**Core Value:** A user drops one or more RVTools workbooks and walks away with a polished, shareable HTML report and PPTX deck describing their VMware estate — without uploading a single byte. The report is the product.

## v1 Requirements

### Foundation

- [x] **FND-01**: User loads the app at a public URL and the entire app runs 100 % client-side (no workbook bytes ever leave the browser)
- [x] **FND-02**: User sees a clear drag-and-drop zone for one or more RVTools `.xlsx` files on first load
- [x] **FND-03**: User can use the app entirely in French or English (i18n FR + EN, language auto-detected then user-toggleable)
- [x] **FND-04**: User can switch between a light and a dark visual theme
- [x] **FND-05**: User sees a visible "workbook capture date" indicator wherever data is displayed (header + footer of every export)

### Parsing

- [x] **PAR-01**: User drops an RVTools `.xlsx` file and the app parses it without blocking the UI (Web Worker)
- [x] **PAR-02**: User sees a clear error naming the missing sheet or column when a workbook does not match the RVTools schema
- [x] **PAR-03**: User can load workbooks from RVTools 3.10, 3.11, 4.0, and 4.4 — column-name drift is resolved transparently via an alias dictionary
- [x] **PAR-04**: User's workbook is parsed with all memory/storage fields preserved as MiB (no `* 1.048576` inflation — RVTools "MB" is MiB)
- [x] **PAR-05**: User can refresh the page and confirm the data is gone (no `localStorage` / `IndexedDB` / `OPFS` persistence of dataset rows)

### Global Dashboard

- [x] **DSH-01**: User sees a global vCenter dashboard with one column per cluster, showing counts of ESX, VMs (Windows / Linux / Other), datastores
- [x] **DSH-02**: User sees a global summary card with estate-wide totals (clusters, ESX, VMs, datastores, vCPU, vRAM, storage)
- [x] **DSH-03**: User sees per-cluster physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU allocation
- [x] **DSH-04**: User sees an OS-family breakdown (donut or stacked bar) at the global and per-cluster level
- [x] **DSH-05**: User sees CPU Ready % (from `vInfo.Overall Cpu Readiness`) where available — mean, max, count above the 5 % VMware-warning threshold
- [x] **DSH-06**: User sees three accounting modes (Configured / Active / Storage-realistic) with a visible toggle; defaults are sensible per metric

### Inventory Navigation

- [x] **INV-01**: User can navigate an inventory tree (vCenter → Datacenter → Cluster → ESX → VM) that stays responsive on estates with 10 000+ VMs
- [x] **INV-02**: User can view a sortable, filterable table of VMs with the columns RVTools provides
- [x] **INV-03**: User can view a sortable, filterable table of ESX hosts
- [x] **INV-04**: User can view a sortable, filterable table of datastores keyed on NAA/UUID (no double-count of shared LUNs)
- [x] **INV-05**: User can export the current filtered table view as CSV
- [x] **INV-06**: User can show/hide columns per table

### Multi-vCenter

- [ ] **MVC-01**: User drops multiple RVTools workbooks from different vCenters and the app treats them as one logical estate
- [ ] **MVC-02**: User sees a visual suffix (no silent merge) when two vCenters have identically-named clusters
- [ ] **MVC-03**: User's estate is keyed on `(VI SDK UUID, vm_bios_uuid)` so vMotion across vCenters is correctly deduplicated
- [ ] **MVC-04**: User sees each loaded snapshot's vCenter label and RVTools version in the snapshot list

### Stretched Clusters

- [ ] **STR-01**: User can toggle a cluster's "Étendu / Stretched" pill to mark it as a stretched cluster
- [ ] **STR-02**: User sees CPU and RAM reservation applied per-site (not a flat 50 %) when the cluster is asymmetric (e.g. 6+4)
- [ ] **STR-03**: User sees, factually, whether a stretched cluster's per-site split comes from real fault-domain data (Site A/B shown) or an assumed symmetric split — no high/medium/low verdict, no warning chip (UAT G1; the former low-confidence-chip requirement is retired/merged here)

<!-- Forward note (analytics-core replan): vSAN blank-`Cluster name` datastore
     attribution (vInfo VM→datastore→cluster relink) and full networks
     inventory (ports/switches) are deferred to Phase 9 — NOT Phase-4
     requirements. -->

### Rich Cluster / Host / ESX Intelligence (Phase 5 — analytics-core replan)

- [ ] **RCI-01**: User sees RVTools-Analyser-grade operational insights (realized vCPU:pCPU overcommit, core-weighted avg CPU %, host-mem-weighted avg memory %, powered-on/off/suspended/template breakdown, provisioned-vs-in-use, datastore footprint, guest data, total cores/host-memory) at BOTH estate scope and per-cluster — every value calculated from parsed RVTools columns, nothing invented
- [ ] **RCI-02**: User can open a dedicated one-window Hosts/ESX view (estate host-rollup + expandable per-cluster host lists) showing per-host capacity/utilization, ESXi version, fault domain, and host model/vendor as plain factual text (no lifecycle verdict)
- [ ] **RCI-03**: User sees the estate "Operational Insights" tile row on the dashboard alongside the shipped GlobalSummaryCard
- [ ] **RCI-04**: A metric that cannot be derived from the export (e.g. guest data when vPartition is absent) renders a factual em-dash sentinel, never an invented 0
- [ ] **RCI-05**: User clicks a dashboard cluster card and drills into a dedicated single-cluster detail screen showing that cluster's full metric set, laid out one-screen-fit (export-ready so Phase 10 = one PPTX slide per cluster), with a back affordance

### Allocated Resources

> **RE-DERIVED 2026-05-17 (Phase 6, CONTEXT D-12).** ALC-01..04 were STALE
> against UAT G2/OPEN-1. The realized (`vCPU ÷ usable-pCPU`, `vRAM ÷ physRAM`)
> "measured" consolidation requirement is **SATISFIED-BY-P5 — see RCI-01**
> (calculated, estate + per-cluster, no input). Phase 6 builds NO new realized-
> ratio UI (DRY). The capacity-planning "planned" lens (OPEN-1 (b)) is the
> NEW, explicitly-distinct what-if surface; its requirements are PLN-01..04
> below. The killed slider / URL-hash mechanism (old ALC-01/03) is **retired**
> — replaced by in-memory preset+numeric on the explicitly-"planned" lens.

- [x] **PLN-01**: User opens a separate, explicitly-labelled "Capacity planning — what-if (planned)" surface (a 4th top-level ViewToggle segment) that is structurally distinct from the realized "measured" value and never overwrites or hides it (D-03/D-04)
- [x] **PLN-02**: User sets a Planned CPU ratio and Planned RAM ratio via named preset buttons (CPU 1:1 / 4:1 / 8:1 / VDI 10:1; RAM same pattern) that fill an editable numeric field the user can override; defaults are CPU 4:1 / RAM 1:1 (D-05) — no slider widget
- [x] **PLN-03**: User's planned ratios are held in-memory only (Zustand inputs slice); there is NO URL-hash codec and NO `localStorage` of planned inputs — refresh = data gone (D-06)
- [x] **PLN-04**: User sees the planned what-if recompute against physical cores (not hyperthreads) through the single `useEstateView` memo, with the realized "measured" reference shown read-only with a "measured" qualifier pointing at P5 Operational Insights (D-02 — never conflated)

### Disaster Recovery Simulation

> **RE-DERIVED 2026-05-17 (Phase 6, CONTEXT D-12).** DRS-01..06 were STALE
> against UAT G3. Cluster-loss (old DRS-02) and vCenter-loss (old DRS-03) are
> **dropped**. The `confidence` high/med/low clause of old DRS-05 is **dropped**
> (D-10 — no judgement of the user's scenario); its `caveats` + assumptions
> clause is **kept** (Moderate-10). New IDs DRX-01..06 model exactly two modes
> (Server + Site loss), physical impact (GHz/cores + physical RAM, never vCPU),
> and the survivor verdict vs physical headroom. The kept `engines/drSim` engine
> is evolved, not rewritten (ROADMAP `vsizer reuse`).

- [x] **DRX-01**: User simulates **Server loss** — both an individual named-host multi-select AND a per-cluster "N of M hosts in cluster X" quick stepper — and sees survivor cluster capacity, with the shipped reversible/neutral failed-selection UI kept (no red, no alarm icon, no confirmation dialog) (D-07/G3)
- [x] **DRX-02**: User simulates **Site loss** — site = the fault-domain value of clusters the user declared stretched (Site A / Site B); the engine removes that site's physical hosts; non-stretched workload physically at the lost site is surfaced as an explicit factual "lost — no DR target" line; no fault-domain metadata ⇒ symmetric 50 % split (D-08)
- [x] **DRX-03**: User sees the DR impact as **physical CPU removed (GHz / cores) + physical RAM removed (MiB)** — never vCPU — and the per-survivor verdict computed against **physical** headroom using the reused `Verdict` enum, rendered as a factual word + numbers with no color/traffic-light (D-09)
- [x] **DRX-04**: User sees an explicit assumptions panel listing what the sim DOES and DOES NOT model (kept verbatim-pattern from the shipped `assumptions.*`, content updated to the two-mode/physical model) (D-10/Moderate-10)
- [x] **DRX-05**: User sees a factual `caveats[]` array on every DR result (i18n key suffixes, no editorial verb, no number); there is NO `confidence` indicator anywhere (the high/med/low clause is removed entirely) (D-10)
- [x] **DRX-06**: User sees before/after per-survivor numbers and the evacuated total for every DR scenario; the user may toggle a single in-panel "Apply planned ratios to this scenario" affordance (Custom Failover — NOT a 3rd mode) that re-runs the same Server/Site sim with the planning lens's planned ratios, never conflated with the measured DR result (D-11/DRS-06 intent)

### OS End-of-Support Forecast

- [x] **EOS-01**: User sees an EOS forecast view with at-risk counts at +3, +6, +9, +12 months
- [x] **EOS-02**: User sees an "overdue" bucket for VMs/hosts on already-EOS OSes (RHEL 7, Windows Server 2012 R2, ESXi 7.0, etc.)
- [x] **EOS-03**: User can click a bucket to drill into the affected VM list
- [x] **EOS-04**: User sees ESX hosts classified by build → support state, including patch-level and major-version EOS
- [x] **EOS-05**: User sees an "unknown OS" bucket when a VM's OS string cannot be matched to the catalogue (rather than silently dropped)
- [x] **EOS-06**: User sees a `lastVerified` date on the EOS catalogue (refreshed at CI build time from endoflife.date)

### In-Session Trends

- [x] **TRD-01**: User can load 2–12 monthly RVTools snapshots together and see headline metrics evolve over time
- [x] **TRD-02**: User sees a temporal X-axis (actual capture dates, not categorical labels) on every trend chart
- [x] **TRD-03**: User sees per-cluster sparklines on the dashboard when multiple snapshots are loaded
- [x] **TRD-04**: User sees a delta panel showing what changed between consecutive snapshots
- [x] **TRD-05**: User can refresh the page and confirm trends are gone (no cross-session persistence)

### Storage / Network / Detailed Views + Threshold Alerting (Phase 9 — analytics-core replan)

> **DERIVED 2026-05-17 (Phase 9, CONTEXT D-01..D-11 + RVTools-Analyser #10/#12/#14).**
> No storage/network/alerting/relink IDs existed before this phase; derived here
> following the P5/P6 re-derivation precedent. Grouping per 09-RESEARCH:
> **STG** = storage views (#10), **NET** = network inventory (#12),
> **DTL** = detail drills (#12), **ALR** = threshold alerting (#12/#14),
> **VSR** = vSAN VM->datastore->cluster relink (closes the open STR-04 under-count).
> Store is `src/store/snapshotStore.ts` (NOT `datastoreStore.ts`); the relink join
> key is `vInfo.Path` (NOT `vDisk."Disk Path"`) — both binding empirical corrections.

- [ ] **STG-01**: User's storage is rolled up by Cluster / ESX / VM / Datastore through pure engine projections that compose into the single `buildEstateView` pass (no second `useMemo`)
- [ ] **STG-02**: User sees a consumption lens (provisioned vs in-use, incl `.vswp`+snapshots) whose totals reconcile to the estate total with no double-count of shared LUNs
- [ ] **STG-03**: User sees a capacity lens (capacity vs used vs free) from NAA-deduped datastores, never re-summing shared-LUN capacity
- [ ] **STG-04**: User opens a dedicated top-level "Storage" ViewToggle segment (the extended `fieldset`+`aria-pressed` idiom) and switches the two lenses via the shipped accounting-toggle idiom; primary visual = ECharts treemap (consumption) / stacked-bar (capacity) through the single SVG `<Chart>` site, with the P3 DataTable + ColumnPicker + CSV alongside
- [ ] **STG-05**: A storage value not derivable (e.g. an unrelinkable blank-`Cluster name` datastore's cluster identity) renders a factual em-dash sentinel, never fabricated onto a cluster
- [ ] **NET-01**: User's RVTools `vInfo.Path` is parsed (the `[datastore] vm/vm.vmx` token) without regressing the validated parser (MiB canary + existing fixtures green — the P5 D-07 regression-gated-parser-change pattern)
- [ ] **NET-02**: User's workbook is parsed for vNetwork / vSwitch / dvSwitch / dvPort as OPTIONAL sheets — absent ⇒ collected warning + `[]`, never a throw (the shipped `vDatastore`/`vPartition` factual-degrade pattern)
- [ ] **NET-03**: User's parsed network sheets are validated by Zod schemas at the parser boundary; invalid rows are dropped + reported, never thrown unchecked
- [ ] **NET-04**: User sees network topology rollups (standard vSwitch, distributed dvSwitch+dvPort, uplinks, portgroup VLANs, VM→portgroup mapping) produced as a pure projection in the single `buildEstateView` pass
- [ ] **NET-05**: User opens a dedicated top-level "Network" ViewToggle segment showing the vSwitch / dvSwitch+dvPort / vNetwork tables via the P3 DataTable idiom; when network sheets are absent the view shows a single factual "network inventory not available in this export" line — no error styling, no icon, no crash, no editorial verb
- [ ] **DTL-01**: User clicks a datastore row and drills into a screen-fit, export-ready Datastore detail (capacity / provisioned / in-use / free, VMs-on-it, host count, threshold flag marker) with a back affordance — lifted in-app view-state (the P5 `ClusterDetail` precedent), no router, no 2nd `useMemo`
- [ ] **DTL-02**: User clicks a VM row and drills into a screen-fit VM detail (vCPU/vRAM, disks, partitions with per-row threshold flag marker, portgroups/switches, datastores) with a back affordance
- [ ] **DTL-03**: User clicks a host in the Hosts view and drills into a screen-fit ESX storage+network detail (datastores mounted + vSwitch/dvSwitch/uplinks per host) that augments the shipped Hosts view (does not duplicate the P5 cluster-detail drill)
- [ ] **ALR-01**: User's disk/partition/datastore/LU threshold alerting is computed as a pure factual projection — per-row booleans + counts only, no verdict, no editorial verb, no traffic-light color (D-04)
- [ ] **ALR-02**: User's filesystem alert fires at the configured "% used" (`consumedMib/capacityMib`, default ≥ 90 % used), the datastore alert at the configured datastore used % (default > 85 % used), the LU alert at the configured NAA-keyed-datastore used % (default > 85 %)
- [ ] **ALR-03**: User's threshold config is held in the in-memory Zustand inputs slice (the `plannedRatios` precedent) — REPLACE-never-mutate, NO new `localStorage` key, NO URL-hash; `clearAll`/refresh restores the defaults
- [ ] **ALR-04**: User's threshold flags compose into the single `buildEstateView` pass and are reachable through the one sanctioned `useEstateView` memo (no second `useMemo`)
- [ ] **ALR-05**: User edits the filesystem / datastore / LU threshold percentages in an in-memory config surface (the `PlannedRatiosControl` idiom: native numeric inputs + `safeNum` on-commit fallback, no error state) and the flagged-row marker (`bg-accent-500/15` + `border-l-2 border-accent-500`, no traffic-light) updates
- [ ] **VSR-01**: User's blank-`Cluster name` datastore is attributed to a cluster via the `vInfo.Path` VM→datastore→cluster relink — the only valid blank-cluster attribution path (`vDatastore.Hosts` is a host *count*, not a name list)
- [ ] **VSR-02**: User's blank-cluster datastore that no VM references stays estate-only with an em-dash, never fabricated onto a cluster (the no-domain-guesses invariant)
- [ ] **VSR-03**: User's datastore whose referencing VMs span multiple clusters is surfaced as a factual "shared across N clusters" line, excluded from single-cluster rollups, with no proportional allocation guess and no double-count (D-10)
- [ ] **VSR-04**: User's `VInfoRow.path` schema change ripples through `VInfoRowSchema` + every `VInfoRow` test literal without regressing existing consumers (default `''`; the P5 D-07 blast-radius pattern)
- [ ] **VSR-05**: The vSAN relink is validated against the real 75-blank-`Cluster name` workbook (`20260430_1400_allvCenters.xlsx`) asserting a non-zero relink count — the STR-04 regression guard the binding decision memory demands (unit tests alone are insufficient); the test skips gracefully when the file is absent

### Visual UX (charts as first-class)

- [x] **VIZ-01**: User sees crisp SVG charts at every zoom level (Apache ECharts with `{ renderer: 'svg' }` everywhere)
- [x] **VIZ-02**: User sees the following chart families used throughout: stacked bar, donut, treemap (datastore footprint), heatmap (cluster × time), calendar-heatmap (EOS), line (trends), gauge (allocation), sparkline (per-row trend)
- [x] **VIZ-03**: User sees consistent theming (Midnight Executive palette) across all charts

### HTML Report Export

- [ ] **HTM-01**: User clicks one button and downloads a single self-contained `.html` file describing the estate
- [ ] **HTM-02**: User opens the exported HTML offline, with no JS execution required to view it, and sees crisp inline SVG charts
- [ ] **HTM-03**: User's HTML report is < 5 MB for a typical estate and < 15 MB for the largest supported (hard ceiling)
- [ ] **HTM-04**: User's HTML report contains: cover · executive headlines · per-cluster · EOS forecast · DR results · trends · annex · methodology footer
- [ ] **HTM-05**: User's HTML report carries factual numbers only — no editorial recommendations ("you should consolidate cluster X")

### PPTX Export

- [ ] **PPT-01**: User clicks one button and downloads a PPTX deck describing the estate
- [ ] **PPT-02**: User's PPTX uses the same neutral, brand-free Midnight Executive palette as vsizer
- [ ] **PPT-03**: User's PPTX includes: title · overview · per-cluster · CPU Ready annex (conditional) · EOS · DR · trends · inventory summary
- [ ] **PPT-04**: User's PPTX numbers are locale-formatted (FR `,` and U+00A0 thousands separator, EN `.` and `,` thousands separator)

### Privacy & Security

- [x] **PRV-01**: User's browser never makes a non-same-origin network request after the app is loaded (runtime `fetch`/`XHR`/`WS`/`Beacon` guard throws on any attempt)
- [x] **PRV-02**: User loads an app whose CSP meta tag is `connect-src 'self'`
- [x] **PRV-03**: User's app has no telemetry / analytics SDKs of any kind (Sentry, PostHog, Datadog, etc. denied at CI)

### Deployment

- [ ] **DEP-01**: User can access vatlas at the public URL `fjacquet.github.io/vatlas/`
- [ ] **DEP-02**: User's deploy is the result of a CI pipeline that runs typecheck → lint → test → build → deploy on every push to `main`

## v2 Requirements

### DR scenario presets

- **DR2-01**: User can pick a preset DR scenario from a menu ("lose largest cluster", "lose vCenter A", "lose left-side of stretched")

### Snapshot diff

- **DIF-01**: User can open a side-by-side comparison view showing what changed between any two loaded snapshots

### Estate treemap headline

- **TRM-01**: User sees an estate-wide treemap as a headline visual on the dashboard

### Cluster × time heatmap

- **HM2-01**: User sees a heatmap of clusters × time showing a chosen metric (CPU% / RAM% / VM count) when 3+ snapshots are loaded

### Multi-file `.zip` bundle ingestion

- **ZIP-01**: User can drop a `.zip` of multiple RVTools workbooks and the app parses them all

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live Optics ingestion | RVTools-only is an explicit narrowing vs. vsizer; reduces parser surface |
| Cross-session persistence (DB / IndexedDB / OPFS / localStorage of rows) | Breaks the vsizer privacy invariant — refresh = data gone |
| Backend / server / file upload | 100 % client-side is a hard product invariant |
| Telemetry of parsed contents (even anonymous) | Same privacy invariant; reputation risk on operator-facing tools |
| Editorial recommendations in reports | Like vsizer, vatlas carries numbers only — narrative stays with the presenter |
| Real-time vCenter API connection | RVTools workbook is the only input; would re-introduce a network requirement |
| Right-sizing recommendation engine | RVTools snapshots lack peak-active data; unsound recommendations |
| Saved scenarios / accounts / shared dashboards | Requires backend, breaks privacy invariant |
| Mobile / touch-first UX | 10k+ row tables are not a mobile use case |
| In-browser editing of inventory rows | RVTools is source of truth; would invite drift |
| Source-map upload in CI | Could leak repo internals; no telemetry pipeline anyway |
| Service worker | Increases attack surface; offers no value for ephemeral data |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| PAR-01 | Phase 1 | Complete |
| PAR-02 | Phase 1 | Complete |
| PAR-03 | Phase 1 | Complete |
| PAR-04 | Phase 1 | Complete |
| PAR-05 | Phase 1 | Complete |
| PRV-01 | Phase 1 | Complete |
| PRV-02 | Phase 1 | Complete |
| PRV-03 | Phase 1 | Complete |
| DSH-01 | Phase 2 | Complete |
| DSH-02 | Phase 2 | Complete |
| DSH-03 | Phase 2 | Complete |
| DSH-04 | Phase 2 | Complete |
| DSH-05 | Phase 2 | Complete |
| DSH-06 | Phase 2 | Complete |
| VIZ-01 | Phase 2 | Complete |
| VIZ-02 | Phase 2 | Complete |
| VIZ-03 | Phase 2 | Complete |
| INV-01 | Phase 3 | Complete |
| INV-02 | Phase 3 | Complete |
| INV-03 | Phase 3 | Complete |
| INV-04 | Phase 3 | Complete |
| INV-05 | Phase 3 | Complete |
| INV-06 | Phase 3 | Complete |
| MVC-01 | Phase 4 | Pending |
| MVC-02 | Phase 4 | Pending |
| MVC-03 | Phase 4 | Pending |
| MVC-04 | Phase 4 | Pending |
| STR-01 | Phase 4 | Pending |
| STR-02 | Phase 4 | Pending |
| STR-03 | Phase 4 | Pending |
| RCI-01 | Phase 5 | Pending |
| RCI-02 | Phase 5 | Pending |
| RCI-03 | Phase 5 | Pending |
| RCI-04 | Phase 5 | Pending |
| RCI-05 | Phase 5 | Pending |
| ~~ALC-01~~ | Phase 6 | Retired — slider/URL-hash killed (G2); → PLN-02 in-memory preset+numeric |
| ~~ALC-02~~ | Phase 6 | Re-derived → PLN-02 (CPU 4:1 / RAM 1:1 default kept) |
| ~~ALC-03~~ | Phase 6 | Retired — URL-hash forbidden (D-06); → PLN-03 in-memory only |
| ~~ALC-04~~ | Phase 5 | Realized ratio satisfied-by-P5 (RCI-01); planned what-if → PLN-04 |
| PLN-01 | Phase 6 | Complete |
| PLN-02 | Phase 6 | Complete |
| PLN-03 | Phase 6 | Complete |
| PLN-04 | Phase 6 | Complete |
| ~~DRS-01~~ | Phase 6 | Re-derived → DRX-01 (Server loss) |
| ~~DRS-02~~ | Phase 6 | Dropped — cluster-loss removed (G3) |
| ~~DRS-03~~ | Phase 6 | Dropped — vCenter-loss removed (G3) |
| ~~DRS-04~~ | Phase 6 | Re-derived → DRX-04 (assumptions kept) |
| ~~DRS-05~~ | Phase 6 | Confidence clause dropped (D-10); caveats clause → DRX-05 |
| ~~DRS-06~~ | Phase 6 | Re-derived → DRX-06 (physical before/after + Custom Failover) |
| DRX-01 | Phase 6 | Complete |
| DRX-02 | Phase 6 | Complete |
| DRX-03 | Phase 6 | Complete |
| DRX-04 | Phase 6 | Complete |
| DRX-05 | Phase 6 | Complete |
| DRX-06 | Phase 6 | Complete |
| EOS-01 | Phase 7 | Complete |
| EOS-02 | Phase 7 | Complete |
| EOS-03 | Phase 7 | Complete |
| EOS-04 | Phase 7 | Complete |
| EOS-05 | Phase 7 | Complete |
| EOS-06 | Phase 7 | Complete |
| TRD-01 | Phase 8 | Complete |
| TRD-02 | Phase 8 | Complete |
| TRD-03 | Phase 8 | Complete |
| TRD-04 | Phase 8 | Complete |
| TRD-05 | Phase 8 | Complete |
| STG-01 | Phase 9 | Pending |
| STG-02 | Phase 9 | Pending |
| STG-03 | Phase 9 | Pending |
| STG-04 | Phase 9 | Pending |
| STG-05 | Phase 9 | Pending |
| NET-01 | Phase 9 | Pending |
| NET-02 | Phase 9 | Pending |
| NET-03 | Phase 9 | Pending |
| NET-04 | Phase 9 | Pending |
| NET-05 | Phase 9 | Pending |
| DTL-01 | Phase 9 | Pending |
| DTL-02 | Phase 9 | Pending |
| DTL-03 | Phase 9 | Pending |
| ALR-01 | Phase 9 | Pending |
| ALR-02 | Phase 9 | Pending |
| ALR-03 | Phase 9 | Pending |
| ALR-04 | Phase 9 | Pending |
| ALR-05 | Phase 9 | Pending |
| VSR-01 | Phase 9 | Pending |
| VSR-02 | Phase 9 | Pending |
| VSR-03 | Phase 9 | Pending |
| VSR-04 | Phase 9 | Pending |
| VSR-05 | Phase 9 | Pending |
| HTM-01 | Phase 7 | Pending |
| HTM-02 | Phase 7 | Pending |
| HTM-03 | Phase 7 | Pending |
| HTM-04 | Phase 7 | Pending |
| HTM-05 | Phase 7 | Pending |
| PPT-01 | Phase 7 | Pending |
| PPT-02 | Phase 7 | Pending |
| PPT-03 | Phase 7 | Pending |
| PPT-04 | Phase 7 | Pending |
| DEP-01 | Phase 7 | Pending |
| DEP-02 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 91 total (the original 68 + 23 derived Phase-9 IDs: STG 5 + NET 5 + DTL 3 + ALR 5 + VSR 5 = 23). Phase 9 was roadmap-marked "Requirements: TBD — re-derive in discuss-phase"; derived 2026-05-17 in plan-phase per CONTEXT D-01..D-11 + RVTools-Analyser #10/#12/#14
- Mapped to phases: 91 (68 original + 23 Phase-9 derived)
- Unmapped: 0

**Note:** The "56 total" figure in earlier drafts was a miscount — the actual v1 requirement total is **68**. Coverage remains 100 %.

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-17 — Phase 9 requirement IDs (STG/NET/DTL/ALR/VSR) derived during plan-phase per CONTEXT D-01..D-11*
