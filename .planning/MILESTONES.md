# Milestones

## v1.0 RVTools Atlas (MVP) (Shipped: 2026-05-19)

**Phases completed:** 11 phases, 43 plans, 74 tasks

**Key accomplishments:**

- Deployable vatlas client shell with React 19 + Vite 8 + Tailwind v4 + i18n FR/EN + light/dark theme + native HTML5 drag-drop, all builds green and GH-Pages-ready at `/vatlas/`.
- Three-layer privacy invariant — a side-effect runtime monkey-patch that throws synchronously on any non-same-origin fetch/XHR/sendBeacon/WebSocket and on any cleartext WebSocket (CWE-319), a `connect-src 'self'` CSP meta tag, and a CI supply-chain gate banning telemetry SDKs and verifying the SheetJS pin — all wired before any business code runs.
- Sheets:
- VINFO_COLS
- The Phase 1 user story landed: drop an RVTools `.xlsx` → a privacy-guarded worker parses it → an inputs-only Zustand `Map<id,Snapshot>` holds it (no aggregates, no persistence) → a capturedAt-sorted sidebar renders a card with filename, vCenter label, capture date (FND-05), RVTools version and row counts — proven end-to-end on the live MiB canary fixture, with refresh-wipes-everything (PAR-05) and the Critical-2 cause-leak both regression-tested.
- Tree-shaken `<Chart>` wrapper (echarts/core + `echarts.use`, `{renderer:'svg'}` injected centrally, reference-equality `React.memo`) plus the Midnight Executive light/dark ECharts theme and a ≤300 KB gz CI bundle gate — the chart primitive every later phase consumes.
- Six vsizer aggregation engines ported with the branded-units retrofit plus three net-new pure engines (osFamily, NAA-deduped perDatastore, perEsx), assembled into a pure buildEstateView with three one-param accounting modes, exposed through the project's single useMemo bridge useEstateView — 99.1% stmt / 85.3% branch engine coverage.
- The 8-component global dashboard tree wired through `useEstateView` + the `<Chart>` SVG wrapper — global summary, OS-family donut, one horizontal-scroll column per cluster, estate CPU-Ready panel, and the three-accounting-mode segmented toggle — with the LIVE echarts bundle gate now passing at 205.5 KiB gz.
- Task 1 — Deps + bundle gate + projection (commit `7fe0bdc`):
- 1. [Rule 3 - Blocking] LIVE @tanstack bundle gate could not measure the chunk
- N separately-dropped RVTools workbooks (and one N-vCenter workbook) now merge into ONE logical estate via row-keyed `viSdkUuid` identity — collision-suffixed, vMotion-deduped — consumed inside the project's single `useMemo`.
- The dormant flat-0.5 reservation is replaced by a factual per-site, per-resource fraction with a never-optimistic confidence enum — validated 0.5/high on the REAL CL_VXB1K_CORE (4 Secondary + 4 UNI) — surfaced through a DRY StretchedPill. The named Pitfall-6 vSAN datastore-attribution fix is correct but proven INERT on real RVTools data (see Deviations).
- Operators model consolidation at configurable CPU/RAM ratios via a keyboard-operable slider toolbar + named presets, with state living ONLY in the URL hash (shareable, refresh-survivable, zero localStorage) and a ReDoS-safe codec — the slider moves the headroom verdict, never `vcpuPerPcpu`.
- Host / cluster / vCenter loss simulated by re-running the SHIPPED aggregation on the survivor row subset — with the 04-02 stretched reservation and 04-03 ratios flowing through — surfaced as a reversible neutral what-if panel with before/after, a gold evacuee total, factual per-survivor verdicts, and an always-visible assumptions + caveats disclosure (the project's #1-risk mitigation). Validated on the real allvCenters estate: vCenter-loss 1373→53 VMs, 5958 evacuee vCPU.
- The rejected auto confidence verdict + low-confidence chip are gone; a factual `siteData` ('detected'/'assumed') now drives a neutral caption — the engine reports where the per-site split came from and never judges the user's stretched declaration. Reservation math is provably unchanged (matrix numbers identical; real-file `CL_VXB1K_CORE` still 0.5).
- Parser additively captures the exact powered-state enum + Template + host model/vendor/ESXi (poweredOn derived, validated-parser regression intact), and the full operational-insights metric set is computed estate-wide AND per-cluster inside the single useEstateView pass — every value from real parsed columns, guest-data factually null when vPartition is absent.
- A new "Hosts" view (estate rollup + per-cluster drill), an estate Operational-Insights tile row beside the kept GlobalSummaryCard, and a cluster-card → one-screen-fit ClusterDetail drill — all pure consumers of the single useEstateView, every value calculated from real RVTools data, validated on the real allvCenters estate.
- 1. [Rule 3 - Blocking] UI consumers had to compile for Task 1's tsc gate
- 1. [Rule 3 - Blocking] JSDoc prose tripped two literal grep acceptance gates
- 1. [Rule 3 - Blocking] Import + JSDoc prose trip literal `grep -c` acceptance gates
- Build-time endoflife.date catalogue: a committed, Zod-validated 11-product snapshot with a single parse-once boundary, a fail-closed maintainer sync script, and a warn-only CI freshness gate that structurally decouples the deploy from third-party uptime.
- Three pure, Zod-free, test-first engines — an OS-string regex bank, an ESXi major-EOL classifier, and a disjoint lifecycle bucketer that reconciles exactly to the entity total with first-class unknown + verbatim raw-string capture.
- The OS end-of-support forecast shipped end-to-end: a 5th read-only ViewToggle segment with always-visible freshness/as-of lines, a reconciling cumulative bucket strip, a neutral SVG forecast chart, a P3 DataTable drill, a verbatim unknown-OS list, and a separate ESXi section — composed in the single buildEstateView pass with EN/FR parity and no verdict color.
- Per-snapshot temporal trend series (DD-A A2 / DD-B B1 / DD-C carry / D-05 ordinal) composed into the single `buildEstateView` pass with zero new memo sites and the shipped aggregates reused so counts reconcile with the dashboard by construction.
- Latest-`capturedAt`-first non-blocking warm-up drain (singleton Worker preserved), the `releaseRawRows` inputs-only DD-C mutation with aggregate-before-empty ordering, and `LineChart` registered with the ≤300 KB gz bundle gate re-verified at 268.0 KiB.
- A navigable, factual In-Session Trends view (real temporal X-axis with D-05 category fallback), per-cluster dashboard sparklines, a no-verdict delta panel, inline-editable capture dates flowing through the shipped `setCapturedAt`, and EN/FR parity — all consuming the single memo with zero new memo sites; user-verified against all six ROADMAP success criteria.
- Four OPTIONAL RVTools network sheets (vNetwork/vSwitch/dvSwitch/dvPort) + the vInfo.path vSAN-relink key added to the validated parser with zero regression — MiB canary byte-unchanged, parser+merge+store 101/101.
- Three pure engines — the vInfo.Path vSAN relink (closes the STR-04 under-count), two-lens storage-by-X, and the network topology rollup — all ≥75% covered (100/100/94), full suite 375/375.
- The four P9 pure projections now compose in the single buildEstateView pass and are reachable via the one useEstateView memo, driven by an in-memory thresholds slice — full suite 383/383, no second memo introduced.
- ViewToggle gains Storage/Network, the StorageView shell ships with lens/scope/threshold controls + treemap/stacked-bar via the single Chart site + screen-fit Datastore/VM drills — backed by a user-chosen LC-4 engine-surface extension. Full suite 403/403, bundle OK.
- NetworkView (3 tables + factual degrade), the ESX storage+network drill augmenting Hosts, and the MANDATORY real-file vSAN relink gate that RAN on the present 75-blank-cluster workbook and PASSED — STR-04 closure proven on real data. Full suite 409/409.
- The single genuine Phase-10 unknown is resolved: `@resvg/resvg-wasm` rasterizes ECharts-SSR SVG (treemap + heatmap) to valid PNGs with no DOM, and `pptxgenjs@4.0.1` emits a valid `.pptx` from a Web Worker — both locked into 10-SPIKE-DECISION.md for plans 02/04.
- The shared, rasterizer-independent export spine is in: a pure D-08/D-09 `buildExportView` proven equivalent to the single-snapshot dashboard view (A2), a DOM-free `chartToSvg` SSR engine on the project's tree-shaken registry, and EN+FR `report`/`pptx` namespaces guarded by a recursive key-parity CI gate. 31/31 export+i18n tests green.
- The product itself: one call yields a single self-contained offline `.html` — `renderToStaticMarkup` of a typed pure tree, all 8 HTM-04 sections (trends omitted at <2 snapshots, D-09), XSS-safe, crisp inline ECharts-SSR SVG charts, under 5 MB typical / 15 MB on a 10k-VM fixture. 20/20 html tests, 47/47 export+i18n.
- `buildPptx` produces a valid OOXML deck in the fixed PPT-03 order — one slide per cluster always (D-01), trends conditional (D-09), every chart a PowerPoint-renderable PNG (never SVG — Pitfall 1), locale-correct numbers incl. the net-new FR U+202F→U+00A0 substitution. 59/59 export+i18n tests, supply/bundle green.
- The click→download path is live and self-verified end-to-end in a real browser: Export HTML yields a self-contained offline `.html` (16 inline SVG charts, 7 sections, D-05 name); Export PPTX yields a valid OOXML deck (24 slides, embedded PNG charts — resvg-wasm worked in the worker, Pitfall-1 satisfied). DEP-01/DEP-02 confirmed by the existing pipeline. 67/67 export+i18n+hook+component tests.
- [Rule 1 - Criterion imprecision] Task 1 `grep -c "storageTreemap" ≥ 3`
- [Rule 1 - State already advanced] STG/NET rows pre-flipped
- [Rule 1 - Criterion-proxy imprecision] Task 1 `view.plannedView ≥ 2`
- [Rule 2 - Type-driven guard] Task 2 worker treemap set

---
