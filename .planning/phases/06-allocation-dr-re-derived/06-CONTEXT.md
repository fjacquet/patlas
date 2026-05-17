# Phase 6: Allocation & DR (re-derived) - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-derived P6 (analytics-core replan). Supersedes the UAT-rejected original P4 allocation (04-03) + DR (04-04). Carries UAT decisions **G2, G3** and the resolved **OPEN-1** (two distinct features: measured vs planned).

Delivers:

- **(b) Capacity-planning lens** — a SEPARATE, explicitly-labelled "planned" what-if surface taking user **Personal Ratios (CPU/RAM)** + **Custom Failover**. New top-level surface; never conflated with or overwriting the realized metric.
- **(c) DR simulation rework** — reuse the kept `engines/drSim` engine, reworked to **exactly two modes — Server loss + Site loss** (drop cluster-loss & vCenter-loss); impact = **physical CPU (GHz/cores) + physical RAM** removed, not vCPU; survivor verdict vs physical headroom; reversible/neutral failed-selection UI kept (G3).

**Explicitly OUT of P6:**

- **(a) realized consolidation ratio display** — already shipped in **P5** Operational Insights (RCI-01, calculated, estate + per-cluster). P6 does **NOT** build new realized-ratio UI; G2's "measured" deliverable is satisfied by P5 (DRY). P6 only references it.
- localStorage / cross-session persistence of anything (privacy invariant).
- Networks/vSAN/EOS/trends/exports — owned by P7/P8/P9/P10.

No new top-level capabilities beyond the planning lens + the DR-mode rework.
</domain>

<decisions>
## Implementation Decisions

### Cross-cutting (carried from P4/P5 — locked, not re-asked)

- **D-00:** Calc-from-real-data (P4 D-01): every value computed only from parsed RVTools columns; un-computable → factual "not determinable", never fabricated. G1 lesson applies: factual presentation, **no high/med/low verdict words, no judgement chips**. Privacy/in-memory, single `useMemo` (`useEstateView`), branded units, EN/FR parity, no-editorial-verbs denylist all hold.

### Realized "measured" deliverable (G2) — reconciliation with P5

- **D-01:** P6 adds **NO new realized-ratio UI**. The G2 "measured" value (realized `vCPU ÷ usable-pCPU`, and `vRAM ÷ physRAM` where shown) stays exactly where **P5 Operational Insights** put it (estate + per-cluster, RCI-01). P6 (a) is satisfied by P5; P6 builds only the planning lens (b) + DR rework (c). No duplication (DRY).
- **D-02:** The planning lens may **read** the realized figure (via the single `useEstateView` memo / a stable selector — NO new memo, NO recompute) for the measured-vs-planned contrast, but the realized value is **read-only**, always shown with a "measured" label, and is **never** overwritten or hidden by planning inputs.

### Measured vs Planned distinction (OPEN-1)

- **D-03:** Kept visibly separate via **separate labelled surfaces**. The planning lens is its own clearly-titled area ("Capacity planning — what-if" / "planned"); the realized value carries a "measured" label. They never share a tile or number. Conflation is structurally prevented by placement, not just wording.

### Planning-lens placement & inputs (b)

- **D-04:** The planning lens is a **new 4th top-level ViewToggle segment**: `Dashboard | Inventory | Hosts | Planning`. Reuse the shipped P3/P5 `fieldset` + `aria-pressed` segmented `ViewToggle` idiom (extend, do NOT build a new nav component — consistent with P5 D-01). The Planning screen hosts both the Personal-Ratios inputs and the DR sim together.
- **D-05:** Personal-Ratios input control = **named preset buttons → editable numeric field** (no slider widget). Presets: **1:1, 4:1, 8:1, VDI 10:1** for CPU; clicking a preset fills an editable numeric field the user can override. RAM ratio same pattern. Defaults: **CPU 4:1 / RAM 1:1** (carry the old ALC-02 default intent). The killed ALC slider/preset/URL-hash mechanism is legitimate **here** because this surface is explicitly the "planned" lens, never the realized metric (G2 only killed it as the realized-ratio mechanism).
- **D-06:** Planning-lens what-if state (planned ratios + Custom Failover) is **in-memory only** (Zustand inputs slice). **No URL-hash codec, no localStorage.** "Refresh = data gone" applies uniformly; no shareable-link mechanism to build/maintain.

### DR mode selection UX (c) — G3

- **D-07:** **Server loss** — support **both** an individual-named-host multi-select AND a quick per-cluster host-count option ("N of M in cluster X"). Planner picks the minimal-blast-radius implementation against the kept `drSim` host-loss path; reuse the shipped reversible/neutral failed-selection UI (G3 "keep").
- **D-08:** **Site loss** — site = the fault-domain value of clusters the user **declared stretched** (P4 factual `siteData`: Site A / Site B). Engine removes that site's physical hosts. **Non-stretched workload physically at the lost site = factually LOST**, surfaced as an explicit factual "lost — no DR target" line (G3). No fault-domain metadata ⇒ symmetric 50% split (carry P4 D-03). Whether Site-loss is disabled-with-a-factual-note when zero stretched clusters are declared, vs always-shown, is **Claude's discretion** within this locked intent.
- **D-09:** **Impact metric = physical CPU (GHz/cores) + physical RAM removed, NOT vCPU** (G3). Survivor verdict computed against **physical** headroom. Reuse the shipped `Verdict` enum (`absorbs`/`tight`/`overflows`) and `survivorVerdict` in `drSim/allocate.ts` fed PHYSICAL capacity-vs-load where it fits; factual word + numbers only, no color/traffic-light (G1/denylist). Before/after per-survivor + evacuee total kept (DRS-06 intent). Whether the enum word stays vs pure-numbers-only is **Claude's discretion** within "factual, physical, reuse engine where possible".

### DR trust signals (c) — G3 + Moderate-10

- **D-10:** **Drop the DR `confidence` high/med/low indicator entirely** (DRS-05) — consistent with G1's no-judgement-verdict principle extended to DR (the tool does not grade the user's scenario). **KEEP** the assumptions panel + the factual `caveats` array (Moderate-10; the replan brief explicitly keeps these). Trust = factual "what this does / does not model" text, no verdict word.

### Custom Failover wiring (b ↔ c)

- **D-11:** **Custom Failover is NOT a third DR mode.** It is the **same Server-loss / Site-loss sim run with the planning lens's planned Personal Ratios applied** (what-if: "at planned 8:1, if Site A fails, do survivors absorb?"). Planned ratios feed the **same** `drSim` engine; the measured DR path (real/realized ratios) stays a separate, never-conflated result. Honors G3's exactly-two-modes constraint and the OPEN-1 measured-vs-planned separation.

### Requirements re-derivation (planner action)

- **D-12:** ALC-01..04 and DRS-01..06 in REQUIREMENTS.md are **stale** vs G2/G3/OPEN-1. The planner re-derives Phase-6 requirement IDs from this CONTEXT: realized-ratio requirement is **satisfied-by-P5** (point to RCI-01, no new ALC realized req); planned-lens requirements replace ALC-01..04 (preset+numeric, in-memory, no URL-hash, explicitly-"planned"); DR requirements replace DRS-01..06 with the two-mode/physical-impact/no-confidence-keep-caveats model. Drop DRS-02 (cluster loss), DRS-03 (vCenter loss), DRS-05's confidence clause (keep its caveats clause). Planner updates REQUIREMENTS.md accordingly.

### Claude's Discretion

- Site-loss disabled-state vs always-shown when zero stretched clusters (D-08).
- Whether the `Verdict` enum word is shown vs pure-numbers-only for the physical survivor verdict (D-09).
- Exact label strings (factual, EN/FR parity, no editorial verbs), the Planning-screen layout grid, the minimal-blast-radius wiring of planned ratios into `drSim`, and the precise re-derived requirement IDs/wording (D-12).
</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Replan authority (read first — supersedes the original P4 RESEARCH/PATTERNS/UI-SPEC)

- `.planning/ANALYTICS-CORE-REPLAN.md` — locks G2 (realized = calculated, not selected), G3 (DR = Server+Site, physical impact), OPEN-1 RESOLVED (two distinct features: measured vs planned, never conflated), constraints (privacy/no-DB, keep `drSim`/`allocate`/`aggregateClusters` engine spine — evolve, don't rewrite), RVTools-Analyser function map (#8 allocation, #9 DR).
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-UAT.md` — the 3 spec divergences + locked decisions (G2/G3 are the P6-relevant ones).
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-CONTEXT.md` — D-01 calc-from-real-data principle; G1 factual-no-verdict lesson that D-10 extends to DR; P4 D-03 symmetric-50%-fallback carried into D-08.
- `.planning/phases/05-rich-cluster-host-esx-intelligence/05-CONTEXT.md` — D-01 ViewToggle-extend idiom (P6 D-04 reuses it); RCI-01 realized vCPU:pCPU already shipped (P6 D-01 references, does not rebuild).

### Decision memory (project/feedback — authoritative on intent)

- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_allocation_is_calculated_not_selected.md` — G2 detail (realized ratio calculated & displayed; remove slider/preset/URL-hash as the realized mechanism).
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_dr_modes_server_site_physical.md` — G3 detail (drop cluster/vCenter loss; site = fault domain of stretched; impact = physical CPU+RAM not vCPU).
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_stretched_is_user_decision.md` — G1 lesson (no confidence verdict) that D-10 extends to DR; symmetric-50% no-metadata default.
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/feedback_no_domain_guesses_in_uat.md`, `feedback_inline_execution.md`, `feedback_replan_on_spec_drift.md` — process constraints (user owns ground truth; inline visible execution; replan-on-drift).

### Project specs

- `.planning/PROJECT.md` — privacy/in-memory invariant, single-`useMemo`, branded units, EN/FR parity, no-editorial-verbs denylist, "the report is the product".
- `.planning/ROADMAP.md` ### Phase 6 — the phase boundary banner + `vsizer reuse` (keep `drSim/runScenario.ts` + `allocate.ts` + `aggregateClusters` per-site math; rework modes/metric, do NOT rewrite) + Pitfalls owned (Moderate-10; G2/G3 anti-patterns).
- `.planning/REQUIREMENTS.md` §Allocated Resources / §Disaster Recovery Simulation — ALC-01..04 + DRS-01..06 are STALE; planner re-derives per D-12.

> The original `04-RESEARCH.md` / `04-PATTERNS.md` / `04-UI-SPEC.md` are **pre-replan** artifacts — historical only; the replan brief + this CONTEXT supersede them for the re-derived P6 scope.
</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (KEEP / EVOLVE — validated, do not rewrite)

- `src/engines/drSim/runScenario.ts` + `index.ts` — the kept DR engine. Rework to two modes (Server/Site); strip cluster-loss & vCenter-loss paths; switch the impact metric to physical CPU+RAM. Real-file-validated baseline — evolve, do not rewrite from zero (ROADMAP `vsizer reuse`).
- `src/engines/drSim/allocate.ts` — `Verdict` (`absorbs`/`tight`/`overflows`), `survivorVerdict`, `band`, `worse`. Reuse for the physical survivor verdict (feed physical capacity vs surviving load instead of vCPU). Factual-only by design (denylist comment in-file) — aligns with D-09.
- `src/engines/aggregation/aggregateClusters.ts` — per-site reservation math + ratio-applied capacities. The planned-ratio what-if must compose with this WITHOUT a second `useMemo`.
- `src/components/dr/DrSimPanel.tsx` — shipped DR panel (9.2K). Rework selection UI to Server/Site; keep the reversible/neutral failed-selection UX (G3 "keep"); remove the confidence indicator, keep assumptions+caveats (D-10).
- `src/components/allocation/AllocationSliders.tsx` — the killed ALC slider component. Its preset values inform D-05 presets; it is **repurposed/replaced** by the preset-button + editable-numeric control under the new Planning surface (NOT the realized metric).
- `src/components/inventory/ViewToggle.tsx` (P3, extended P5 to 3 segments) — extend to a 4th "Planning" segment (D-04); reuse the `fieldset`+`aria-pressed` idiom.
- `src/hooks/useEstateView.ts` — the single `useMemo`; realized ratio + per-site math already flow through it. Planned what-if + DR results route through this same memo / stable selectors — NO new memo.

### Established Patterns

- Single `useMemo` (`useEstateView`) is the only store→UI bridge. Planned ratios are Zustand **inputs only**; the planned/DR projections compute inside `buildEstateView` (extend, don't add a memo).
- Drill/view navigation: no router; view-state is in-app component state (like P5's cluster-detail). The Planning segment is a new ViewToggle branch in the App/Dashboard shell.
- Factual captions, em-dash sentinel for "not derivable", no verdict/color (the G1 lesson, now D-10 for DR).
- Branded units (`GHz`/`MiB`/…) — physical DR impact must use branded physical-resource types, never raw vCPU numbers.

### Integration Points

- ViewToggle gains a 4th segment; the Planning view (inputs + DR sim) is a new view-state branch.
- `drSim` public surface changes (two modes, physical impact, no `confidence`) — enumerate every consumer/test fixture and update; coverage gate ≥75% on `engines/drSim`.
- Planned-ratio inputs add a Zustand inputs slice (in-memory, no persist — privacy/D-06); planned what-if reads through the single memo.
- `EstateView` gains a planned-projection + reworked DR-result shape (drop `confidence`, keep `caveats`); produced in aggregation, consumed via the memo.
</code_context>

<specifics>
## Specific Ideas

- Two surfaces, two labels: **"measured"** (realized, read-only, from P5 Operational Insights) vs **"planned"** (the new Planning ViewToggle segment). The realized value is structurally never overwritten by planning inputs.
- Preset values for the planned CPU lens: **1:1, 4:1, 8:1, VDI 10:1**; default CPU 4:1 / RAM 1:1 (echo of the old ALC-02 default, now applied only to the explicitly-"planned" lens).
- Custom Failover is phrased as "the same Server/Site sim, but with my planned ratios" — not a new failure primitive.
- Reference depth target overall: `azure.github.io/RVToolsAnalyzer` (illustrative, not pixel-match).
</specifics>

<deferred>
## Deferred Ideas

- **Named/saved Custom-Failover scenarios** (compose & name a reusable failure set) — considered, NOT chosen for P6 (D-11 picked parameterized-Server/Site instead). If revisited it stays in-memory only (privacy). Note for a future phase if user wants saved what-ifs.
- **URL-hash-shareable planning links** — considered, rejected for P6 (D-06 in-memory only). Revisit only if a "share a sized scenario" requirement appears later.
- vSAN blank-cluster datastore relink → **Phase 9**. Networks/ports/switches → **Phase 9**. ESXi-build→support-state + OS EOS → **Phase 7**. Actual HTML/PPTX export → **Phase 10** (P6 only makes the Planning/DR view-models export-ready via the shared `EstateView` shape).

None of the above are acted on in P6.
</deferred>

---

*Phase: 06-allocation-dr-re-derived*
*Context gathered: 2026-05-17*
