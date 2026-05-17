# Phase 5: Rich Cluster / Host / ESX Intelligence - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the shallow per-cluster card with RVTools-Analyser-grade depth, add a dedicated **Hosts/ESX view** and a **drill-in per-cluster detail screen**, and surface estate "Operational Insights" — every metric **calculated from parsed RVTools columns** and rendered **both globally and per-cluster**. Reference depth = RVTools-Analyser functions #1,2,4,7,11 (illustrative, not pixel-match).

**OUT of P5:** networks/ports/switches inventory (→ P9), vSAN blank-cluster datastore relink (→ P9), allocation & DR (→ P6), ESXi-build→support-state classification (→ P7/EOS), the actual PPTX/HTML export generation (→ P10 — P5 only makes the per-cluster detail view export-ready/screen-fit). No new top-level capabilities beyond the metric depth + the Hosts view + the cluster-detail drill.
</domain>

<decisions>
## Implementation Decisions

### Navigation taxonomy (OPEN-2 — RESOLVED)

- **D-01:** Hybrid. **Extend the shipped P3 ViewToggle** (the `fieldset` + `aria-pressed` segmented idiom — reuse, do NOT build a new nav component) with **one new top-level segment: "Hosts"**. Dashboard | Inventory | Hosts.
- **D-02:** Clusters stay on the enriched Dashboard (no "Clusters" top-level segment). A **drill-in per-cluster detail screen** is reached BY CLICKING a dashboard cluster card (the card is the drill entry point) — it is a drill target, NOT a 4th ViewToggle segment.

### Hosts/ESX view (RVTools #7 "all ESX in one window")

- **D-03:** Layout = **estate host-rollup on top + expandable per-cluster host lists** (two-level; satisfies globally-and-per-cluster for hosts).
- **D-04:** Per-host columns (all from `vHost`/`perEsx`/`vInfo`): hostName, cluster, sockets, cores, speed (GHz), memory, mean CPU %, mean RAM %, powered-on VM count, ESXi version (factual text), fault domain, host model, host vendor. **Host model/vendor are plain text only — NO vendor end-of-support / lifecycle verdict** (not present in RVTools; calc-from-real-data).

### Metric catalogue (full set — all derivable from parsed columns)

- **D-05:** realized CPU overcommit (`vCPU ÷ usable-pCPU`) · avg CPU usage (core-weighted) · avg memory usage (host-mem-weighted) · powered-state breakdown · provisioned-vs-in-use · datastore footprint incl `.vswp`+snapshots · guest data · total physical cores / total host memory rollups.
- **D-06:** Every metric in D-05 renders **both at estate scope AND per-cluster** (locked principle).

### Parser extension (deliberate, scoped)

- **D-07:** Extend the parser/schema to capture the real RVTools `Powerstate` (poweredOn / poweredOff / **suspended**) AND the `Template` flag, so the powered-state breakdown is exact (e.g. "67 total · 7 off · 0 suspended · 4 templates"). This TOUCHES the validated parser — it MUST ship with regression coverage proving existing parse behavior is unchanged (MiB canary + existing fixtures green). Replace/extend the current boolean `poweredOn` derivation; keep a `poweredOn` accessor for existing consumers OR update them — planner decides minimal-blast-radius.

### Lifecycle boundary

- **D-08:** P5 shows ESXi version + host model/vendor as **plain factual text only**. ESXi-build→support-state classification stays **Phase 7 (EOS)** — do NOT duplicate it here. Hardware vendor EOS is **never** promised (not in RVTools).

### Presentation

- **D-09:** Estate: keep the shipped P2 `GlobalSummaryCard` (core totals) **AND** add a new **"Operational Insights" stat-tile row** on the Dashboard for the D-05 depth (RVTools-Analyser style).
- **D-10:** Per-cluster: the dashboard `ClusterColumn` **cards remain the drill ENTRY POINT**; clicking one opens a **dedicated single-cluster detail screen** showing the FULL D-05 metric set for that cluster, **deliberately laid out to fit one screen** and structured so **Phase 10 can snapshot it as exactly one PPTX slide per cluster**. P5 builds the screen-fit export-ready view; P5 does NOT generate the .pptx.

### Claude's Discretion

- Exact tile/column ordering, label strings (factual, EN/FR parity, no editorial verbs), the screen-fit layout grid for the cluster-detail view, and the minimal-blast-radius approach for the `poweredOn`→`Powerstate` parser change.
</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Replan authority

- `.planning/ANALYTICS-CORE-REPLAN.md` — P5 maps to RVTools-Analyser #1,2,4,7,11 + the enumerated richer-cluster gap; constraints (privacy/no-DB, calc-from-real-data, globally-and-per-cluster).
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-CONTEXT.md` §Deferred/forward — the P5 forward-notes that seeded this phase.
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-UAT.md` — the spec-divergence history that set the calc-from-real-data / no-judgement principles.

### Decision memory

- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_allocation_is_calculated_not_selected.md` — calc-from-real-data principle (realized ratio displayed, not invented).
- `~/.claude/projects/.../memory/feedback_no_domain_guesses_in_uat.md` — user owns ground truth; describe behavior, don't assert estate facts.
- `~/.claude/projects/.../memory/project_rvtools_vdatastore_hosts_is_count.md` — example of an RVTools-schema feasibility limit (why feasibility flags matter).

### Project specs

- `.planning/PROJECT.md` — privacy/in-memory invariant, single-`useMemo`, branded units, EN/FR parity, no-editorial-verbs denylist, "the report is the product".
- `.planning/ROADMAP.md` ### Phase 5 — the phase boundary.
- `.planning/REQUIREMENTS.md` — P5 requirement IDs to be DERIVED by the planner (no GVD/INV-depth IDs exist yet; planner adds them per this CONTEXT + RVTools-Analyser #1/2/4/7/11).

> The original `04-RESEARCH.md`/`04-PATTERNS.md`/`04-UI-SPEC.md` are pre-replan and NOT P5 references.
</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `src/components/inventory/{DataTable,ColumnPicker,ViewToggle}.tsx` (P3) — extend ViewToggle for the "Hosts" segment; reuse DataTable/ColumnPicker/CSV idiom for the host rollup tables.
- `src/components/dashboard/{GlobalSummaryCard,ClusterColumn}.tsx` (P2) — GlobalSummaryCard kept + Operational-Insights row added; ClusterColumn becomes the drill entry point.
- `src/engines/aggregation/{aggregateClusters,perEsx,perDatastore,globals}.ts` — extend with the D-05 derivations (still pure; all new metrics computed here, consumed via the single `useEstateView` memo — NO new memo).
- `src/engines/parser/{adapters/rvtools,schemas,normalizeColumns}.ts` + `src/types/{vinfo,vhost,snapshot}.ts` — the D-07 Powerstate/Template extension site.

### Established Patterns

- Single `useMemo` (`useEstateView`) is the only store→UI bridge — all P5 metrics flow through `buildEstateView`/`EstateView`; estate + per-cluster shapes already exist (extend, don't add a memo).
- Branded units; em-dash sentinel for "not derivable"; factual captions, no verdict (the G1 lesson).
- Drill navigation: no router in the app shell today — the cluster-detail screen is in-app view state (component state lifted in the dashboard, like `mode`), NOT a 2nd `useMemo`, NOT URL routing.

### Integration Points

- ViewToggle now has 3 segments; the Hosts view + cluster-detail screen are new view-state branches in the App/Dashboard shell.
- `EstateView` gains the D-05 fields + a per-cluster detail projection; `aggregateClusters`/`perEsx` produce them.
- D-07 parser change ripples to every `poweredOn` consumer — enumerate and update or shim.
</code_context>

<specifics>
## Specific Ideas

- Reference: `azure.github.io/RVToolsAnalyzer` Summary/Operational-Insights depth + the screenshot's "67 total · 7 off · 0 suspended · 4 templates" / "vInfo In Use — incl .vswp + snapshots" framing (illustrative target, not pixel-match).
- The per-cluster detail screen is the unit of PPTX export later: "one screen fit = one slide" is a hard layout constraint for P5's cluster-detail view.
</specifics>

<deferred>
## Deferred Ideas

- **Networks (ports / switches / port-groups) inventory** → Phase 9 (NOT P5).
- **vSAN blank-cluster datastore attribution** (vInfo VM→datastore→cluster relink) → Phase 9.
- **ESXi-build→support-state + OS EOS forecasting** → Phase 7.
- **Allocation lens (Personal Ratios + Custom Failover) & DR** → Phase 6.
- **Actual PPTX/HTML export generation** → Phase 10 (P5 only makes the cluster-detail view screen-fit/export-ready).

### Feasibility flags for the planner/researcher (do NOT assume)

- **vPartition reliability:** "guest data" (D-05) needs reliable `vPartition` aggregation across RVTools versions — confirm the sheet/columns are parsed and present before promising the metric; fall back to factual "guest data not available" if absent (calc-from-real-data).
- **Powerstate/Template columns:** confirm RVTools carries `Powerstate` (on/off/suspended) + `Template` across 3.x/4.x before the D-07 schema change; the extension must not regress the existing parser (MiB canary + fixtures).

</deferred>

---

*Phase: 05-rich-cluster-host-esx-intelligence*
*Context gathered: 2026-05-17*
