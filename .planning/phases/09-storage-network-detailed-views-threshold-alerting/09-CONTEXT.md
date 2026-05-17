# Phase 9: Storage / Network / Detailed Views + Threshold Alerting - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver RVTools-Analyser-grade **storage views** (disk sizes by Cluster / ESX / VM / Datastore), **detailed Datastore/VM/ESX views**, a **ports & switches network inventory**, and **in-memory disk/partition threshold alerting** with a user-editable config surface — all 100 % client-side, in-memory. Reference depth = RVTools-Analyser functions **#10 / #12 / #14** (illustrative, not pixel-match).

OPEN-2 and OPEN-3 (the two roadmap-bounded open decisions for this phase) are RESOLVED below (D-01, D-04).

**OUT of P9:** the actual HTML/PPTX export generation (→ P10 — P9 only makes its views consume `EstateView` and stay screen-fit/export-ready); GitHub Pages deploy (→ P10); any persisted-to-disk threshold config (explicitly rejected — D-05); cross-session persistence of dataset rows (privacy invariant). No new top-level capabilities beyond storage views + network inventory + detail drills + threshold alerting.
</domain>

<decisions>
## Implementation Decisions

### Threshold alerting & config surface (OPEN-3 — RESOLVED)
- **D-01:** Threshold alerting **IS in this milestone** (not deferred).
- **D-02:** Config is held **in-memory only** — a Zustand *inputs* slice (same class as `plannedRatios` from P6). **NO new `localStorage` key**, NO `vatlas-thresholds`, no URL-hash. Refresh ⇒ defaults restored. This is the strictest privacy reading and adds zero new persistence surface.
- **D-03:** Default thresholds mirror **RVTools-Analyser defaults**: guest filesystem alert at **< 10 % free (≥ 90 % used)**, datastore alert at **> 85 % used**. LU/logical-unit threshold default chosen by Claude during planning on the same factual basis (documented in PLAN). All user-editable at runtime.
- **D-04:** Alert presentation is **factual only** — counts and flagged rows (e.g. "N partitions ≥ 90 % used", row highlight / badge), **no verdict, no editorial verb, no traffic-light color**. Reuse the established factual-caption + em-dash-sentinel idioms.

### Navigation taxonomy (OPEN-2 — RESOLVED)
- **D-05:** Add **two new top-level ViewToggle segments: "Storage" and "Network"**. ViewToggle becomes 8 segments (Dashboard · Inventory · Hosts · Planning · EOS · Trends · Storage · Network). **Extend the shipped `fieldset`+`aria-pressed` ViewToggle** (P3/P5/P8 idiom) — do NOT build a new nav component.
- **D-06:** Detail screens are **click-drill in-app view-state branches** (the P5 pattern — lifted component state, NOT URL routing, NOT a 2nd `useMemo`). New detail drills this phase: **Datastore detail**, **VM detail**, and an **ESX storage+network detail** that *augments* the shipped P5 Hosts view (does NOT duplicate the P5 cluster-detail drill or Hosts rollup).
  - **Datastore detail:** capacity / provisioned / in-use / free, VMs on it, host count, threshold flags.
  - **VM detail:** vCPU/vRAM, disks, partitions (with threshold flags), portgroups/switches, datastores — the per-VM surface that ties storage + network + alerting together.
  - **ESX detail:** datastores mounted + vSwitch/dvSwitch/uplinks per host, attached to the existing Hosts view (not a new top-level screen).

### Storage views (RVTools-Analyser #10)
- **D-07:** Storage-by-X (Cluster / ESX / VM / Datastore) ships **both lenses behind a toggle**: (a) provisioned vs in-use (incl `.vswp` + snapshots — the P5 framing) and (b) datastore capacity vs used vs free. Reuse the **shipped accounting-toggle idiom** (Configured/Active/Storage-realistic `fieldset` pattern) for the lens switch — do NOT invent a new toggle.
- **D-08:** Primary visual = **datastore-footprint treemap** (VIZ-02 already mandates a treemap for datastore footprint; ECharts treemap, SVG renderer) for the consumption lens; stacked-bar for the capacity lens. Tables alongside (reuse the P3 `DataTable`/`ColumnPicker`/CSV idiom; remember the `inventory:col.<id>` header-key gotcha for any new column ids).

### vSAN / blank-`Cluster name` datastore attribution
- **D-09:** **Implement the vInfo VM→datastore→cluster relink** (the relink P5 explicitly deferred to P9). Closes the STR-04 / Pitfall-6 vSAN storage under-count. The relink is the ONLY valid cluster-identity path for blank-`Cluster name` rows (`vDatastore.Hosts` is a host *count*, never a name list — see memory ref). MUST be real-file-validated against `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` (75 blank-cluster datastores) — unit tests are insufficient (the lesson from the original STR-04 surfacing).
- **D-10:** **Shared-LUN edge case (datastore whose VMs span multiple clusters) — Claude's discretion** during planning: pick the **minimal-inference, factual** approach (proportional-by-VM-provisioned split that preserves the estate total with no double-count, OR an explicit "shared across N clusters" factual line excluded from single-cluster rollups), decide in PLAN, document the choice + rationale, and validate against a real multi-cluster file. No silent allocation guesses (no-domain-guesses principle).

### Network inventory (RVTools-Analyser #12)
- **D-11:** **Full vSwitch/dvSwitch topology**: regression-gated parser extension for **vNetwork + vSwitch + dvSwitch (+ dvPort when present)** — standard vs distributed switch inventory, uplinks, portgroup VLANs, VM→portgroup mapping. This TOUCHES the validated parser (the P5 D-07 pattern): it MUST ship with regression coverage proving existing parse behavior is unchanged (MiB canary + existing fixtures green), and the new sheets are **OPTIONAL** — absent ⇒ collected warning + factual "network inventory not available" degrade (the existing `vDatastore`/`vPartition` optional-sheet pattern), never a throw.

### Claude's Discretion
- LU/logical-unit default threshold value (D-03), exact tile/column ordering and EN/FR factual label strings (no editorial verbs, parity required), the screen-fit layout grids for the three new detail drills, the treemap/stacked-bar option configs, the shared-LUN attribution approach (D-10), the minimal-blast-radius parser-extension shape (new optional sheets + types without regressing existing consumers), and the plan/wave breakdown (this is a large phase — likely a parser-extension plan, a storage+vSAN-relink engine plan, a threshold-engine + in-memory config-slice plan, and the two view-shell + detail-drill plans; planner decides waves/dependencies).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Replan authority & phase scope
- `.planning/ANALYTICS-CORE-REPLAN.md` — P9 maps to RVTools-Analyser **#10 / #12 / #14**; OPEN-2/OPEN-3 framing (now resolved here); hard constraints (100 % client-side, no DB, no localStorage of dataset rows, calc-from-real-data, single-`useMemo`, branded units, EN/FR parity).
- `.planning/ROADMAP.md` ### Phase 9 — the phase boundary + "Pitfalls owned" (threshold config = UI prefs only never dataset rows; factual alerting).
- `.planning/phases/05-rich-cluster-host-esx-intelligence/05-CONTEXT.md` §Deferred — the explicit P5→P9 forward-notes that seeded this phase (networks/ports/switches inventory; vSAN blank-cluster datastore vInfo relink) + the vPartition-reliability feasibility flag.

### Requirements
- `.planning/REQUIREMENTS.md` — P9 requirement IDs MUST be **DERIVED by the planner** (no storage/network/alerting IDs exist yet; add per this CONTEXT + RVTools-Analyser #10/#12/#14, mirror the P5/P6 re-derivation pattern, update the Traceability table).

### Decision memory (binding)
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_rvtools_vdatastore_hosts_is_count.md` — `vDatastore.Hosts` is a COUNT not a name list; vInfo relink is the only blank-cluster attribution path; STR-04 was an open descope now being closed by D-09.
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/feedback_no_domain_guesses_in_uat.md` — user owns ground truth; describe behavior factually, no estate-fact assertions (drives D-10).
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/feedback_always_update_documentation.md` — bring REQUIREMENTS/ROADMAP/STATE in line with shipped work before declaring done.

### Project specs
- `.planning/PROJECT.md` — privacy/in-memory invariant, single-`useMemo`, branded units, EN/FR parity, no-editorial-verbs denylist, "the report is the product".
- `CLAUDE.md` §Gotchas — `DataTable` `inventory:col.<id>` header-key requirement; Biome-not-ESLint lint command; privacy guard throws (no network calls); doc-comment/grep-gate token-absence gotcha.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ViewToggle.tsx` — extend with the two new "Storage"/"Network" segments (the `fieldset`+`aria-pressed` idiom; P3/P5/P8 precedent).
- `src/components/inventory/{DataTable,ColumnPicker,DatastoreTable}.tsx` — reuse for storage/network tables + CSV-of-filtered; `DatastoreTable` is the starting point for the enriched datastore views.
- `src/components/dashboard/` accounting-toggle idiom (Configured/Active/Storage-realistic `fieldset`) — reuse for the D-07 storage-lens toggle.
- `src/components/cluster/` (P5 cluster-detail drill) + `src/components/hosts/` (P5 Hosts view) — the click-drill view-state pattern to copy for the three new detail screens; the ESX detail (D-06) augments `hosts/`.
- `src/engines/aggregation/{perDatastore,perEsx,perCluster,estateView,guestData}.ts` — extend (still pure) with storage-by-X derivations + the vInfo relink; all new metrics flow through the single `buildEstateView`/`EstateView` (NO new memo).
- `src/store/datasetStore.ts` (P6 `plannedRatios` in-memory inputs slice) — the exact precedent for the D-02 in-memory thresholds slice.
- `src/engines/parser/adapters/rvtools.ts` + `schemas.ts` + `src/types/{snapshot,vinfo,vhost}.ts` — the D-11 network-sheet extension site; mirror the existing OPTIONAL-sheet handling (`vDatastore`/`vPartition`: absent → empty array + collected warning, never throw).

### Established Patterns
- Single `useMemo` (`useEstateView`) is the only store→UI bridge — every P9 metric (storage-by-X, relinked vSAN attribution, threshold flags) composes inside `buildEstateView`/`EstateView`; estate + per-cluster shapes already exist (extend, don't add a memo).
- Parser extensions are regression-gated: MiB canary + existing fixtures must stay green; new sheets OPTIONAL with factual-degrade (P5 D-07 lesson).
- Branded units (`MiB`/`GiB`); em-dash sentinel for "not derivable"; factual captions, no verdict/editorial verb; EN/FR i18n parity (new namespaces likely `storage`, `network`, `alerts` — keys in BOTH `en/` and `fr/`).
- Detail navigation = lifted in-app view-state (no router, no URL), the P5 cluster-detail precedent.

### Integration Points
- ViewToggle gains 2 segments; Storage/Network views + 3 detail drills are new view-state branches in the App/Dashboard shell.
- `EstateView` gains storage-by-X projections, relinked-datastore attribution, and a threshold-flag projection driven by the in-memory thresholds slice.
- D-11 parser change ripples to snapshot/types and any sheet-count assertions — enumerate and extend without regressing existing consumers.
- D-09 vSAN relink interacts with `perDatastore` (NAA dedupe) and `perCluster` storage rollups — must not double-count shared LUNs (the P2/P3 NAA-keyed invariant).
</code_context>

<specifics>
## Specific Ideas

- Reference: `azure.github.io/RVToolsAnalyzer` storage/network/detailed-view depth + #14 personal-config (thresholds) framing — illustrative target, not pixel-match.
- Real-file validation target for the vSAN relink (D-09): `~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx` (75 blank-`Cluster name` datastores) — unit tests alone are insufficient; the relink + shared-LUN choice must be checked on this file (and a real multi-cluster file) before the phase is declared done.
- The three new detail screens should stay screen-fit / export-ready so Phase 10 can snapshot them (the P5 "one screen fit = one slide" constraint extended to datastore/VM/ESX detail).
</specifics>

<deferred>
## Deferred Ideas

- **Persisted threshold config** (a `vatlas-thresholds` localStorage UI-pref key) — explicitly rejected for this milestone (D-02, strictest privacy reading). Revisit only as a future opt-in if users ask for cross-session threshold memory.
- **Conservative/earlier-warning default threshold preset** — not the chosen default (D-03 uses RVTools-Analyser defaults); could become a selectable preset in a later phase if requested.
- **Storage/network analytics beyond inventory + thresholds** (e.g. IOPS/latency trends, capacity-forecast projections) — not in RVTools exports / out of scope; potential v2.

None deferred to a *specific* later phase — discussion stayed within the P9 storage/network/detailed/alerting domain.
</deferred>

---

*Phase: 09-storage-network-detailed-views-threshold-alerting*
*Context gathered: 2026-05-17*
