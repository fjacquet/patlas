# Phase 4: Multi-vCenter Merge & Factual Labels - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-derived P4 (analytics-core replan). Delivers: the **validated multi-vCenter merge engine spine kept as baseline** (`engines/snapshotMerge`, `aggregateClusters` per-site math, `engines/drSim` — already real-file-validated, NOT rewritten) + per-vCenter/RVTools-version labels + cluster-collision suffixing, **plus the G1 stretched rework**: the Étendu/Stretched pill stays the user's declaration, the engine adapts the per-site reservation, and site data is reported **factually** (real-split vs assumed-symmetric) — NO confidence verdict, NO judgement chip.

**Explicitly OUT of P4:** allocation (G2 → re-derived **P6**), DR modes/metric (G3 → re-derived **P6**), the vSAN blank-cluster datastore relink (→ **P9**), deep per-entity metric catalogue (→ **P5**), networks inventory (→ **P9**). Discussion clarified HOW to implement the re-derived P4 only.
</domain>

<decisions>
## Implementation Decisions

### Calculation principle (cross-cutting, locked)

- **D-01:** Every metric/indicator vatlas surfaces is **calculated only from columns actually parsed out of the RVTools workbook** — nothing invented, assumed, or hard-coded. In P4 this binds the G1 site-data indicator + per-site reservation to real columns only (`VHostRow.faultDomain`, host `sockets`/`cores`/`speedMhz`/`memoryMib`, `vInfo`). If a value cannot be computed from real data it is shown as a factual "not determinable", never fabricated.

### G1 stretched — factual site-data presentation

- **D-02:** Cluster HAS fault-domain data (real per-site split computable) → card shows **Site A / Site B GHz+RAM rows + Reservation %** plus a neutral caption **"site data: detected"**. No verdict word.
- **D-03:** Cluster has NO fault-domain data (symmetric 50 % assumed) → card shows **Reservation % + caption "symmetric split assumed (no site data)"**. **No Site A/B rows** (nothing real to show).
- **D-04:** The killed `stretchedConfidence` high/med/low verdict and the `LowConfidenceChip` are **removed entirely** (UAT G1). Reservation math itself is UNCHANGED from the kept engine (real per-resource `maxSiteCap/totalCap` when tagged; symmetric 0.5 when inferred).
- **D-05:** Pill + the per-site/reservation block stay in the **shipped cluster-card placement** (footer band, aria-pressed idiom) — no relocation in P4 (P5 card rework may re-layout later).
- **D-06:** Add a neutral **estate-level factual line "N clusters marked stretched"** (a count of the user's declarations echoed back; consistent with the globally-and-per-cluster principle; no judgement).

### G1 stretched — behavior on merged/collision clusters

- **D-07:** Collision-suffixed clusters are **distinct physical clusters** (MVC-02 no-silent-merge). Stretched is toggled **independently per suffixed cluster** — toggling `CL_X (vc-a)` does NOT affect `CL_X (vc-b)`. (User re-decided away from "linked" once the MVC-02/G1 conflict was surfaced.)

### Merge spine labels & version signal

- **D-08:** Cluster-collision suffix is `"<cluster> (<label>)"`; label resolution order is the shipped **vMetaData Server → row `viSdkServer` → snapshot `vCenterLabel`**. The resolved suffixed cluster name MUST be **byte-identical across dashboard, inventory tree, and exports** (one canonical name from the merge engine — no per-view variants).
- **D-09:** Mixed RVTools versions across merged snapshots → **per-vCenter snapshot card only** (MVC-04, already shipped). **No estate-level mixed-version note.**

### Requirements rewording (REQUIREMENTS.md is stale vs G1)

- **D-10:** Collapse STR-03 + STR-04 into a **single factual STR-03**: *"User sees, factually, whether a stretched cluster's per-site split comes from real fault-domain data (Site A/B shown) or an assumed symmetric split — no high/med/low verdict, no warning chip."* **Drop the STR-04 ID entirely** from REQUIREMENTS.md (the warning-chip requirement is retired by G1). MVC-01..04 unchanged. Planner updates REQUIREMENTS.md accordingly.

### Claude's Discretion

- None material — every gray area was decided by the user. Exact prose of the reworded STR-03 and the neutral caption strings follow the captured intent (factual, no editorial verbs per PROJECT.md line 39 denylist + i18n EN/FR parity).
</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Replan authority (read first — supersedes the original P4 RESEARCH/PATTERNS/UI-SPEC)

- `.planning/ANALYTICS-CORE-REPLAN.md` — the roadmap-scoped replan brief; locks G1/G2/G3, OPEN-1 resolution, constraints (privacy/no-DB, keep engine spine), RVTools-Analyser function map.
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-UAT.md` — the 3 spec divergences + locked decisions + Gaps (G1 is the P4-relevant one).
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-02-SUMMARY.md` — records the RVTools-`Hosts`-is-a-count finding (vSAN attribution, now a P9 item).

### Decision memory (project/feedback — authoritative on intent)

- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/project_stretched_is_user_decision.md` — G1 detail (stretched = user declaration, factual site-data, symmetric-50% default).
- `~/.claude/projects/.../memory/project_rvtools_vdatastore_hosts_is_count.md` — why vSAN attribution is deferred to P9.
- `~/.claude/projects/.../memory/feedback_no_domain_guesses_in_uat.md`, `feedback_inline_execution.md`, `feedback_replan_on_spec_drift.md` — process constraints (user owns ground truth; inline visible execution; replan-on-drift).

### Project specs

- `.planning/PROJECT.md` — privacy/in-memory invariant, single-`useMemo`, branded units, i18n EN/FR parity, "no editorial verbs" denylist.
- `.planning/REQUIREMENTS.md` §MVC/§STR — MVC-01..04 (done); STR-03/STR-04 to be reworded per D-10.
- `.planning/ROADMAP.md` ### Phase 4 — the redefined boundary banner.

> The original `04-RESEARCH.md` / `04-PATTERNS.md` / `04-UI-SPEC.md` are **pre-replan** artifacts — historical only; the replan brief + this CONTEXT supersede them for the re-derived scope.
</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets (KEEP — validated, do not rewrite)

- `src/engines/snapshotMerge/*` — merge engine + vCenter index + collision suffix + vMotion dedupe (real-file-validated: 3 vCenters / 1446 VMs on allvCenters.xlsx). Keep as-is.
- `src/engines/aggregation/aggregateClusters.ts` — per-site reservation math (`reservationFor`, per-resource `maxSiteCap/totalCap`, symmetric-0.5 fallback). Keep the MATH; only the confidence-labelling output changes (D-04).
- `src/components/stretched/StretchedPill.tsx` — pill (keep); `LowConfidenceChip` (delete per D-04).
- `src/components/dashboard/ClusterColumn.tsx` — stretched block placement (keep, D-05); replace Confidence row + chip with the factual caption (D-02/D-03).
- `src/store/snapshotStore.ts` — `stretchedClusters` inputs-only Set slice (keep; in-memory, no persist — privacy).
- `src/hooks/useEstateView.ts` — single `useMemo`; merge + aggregate already wired (keep the invariant).

### Established Patterns

- Factual neutral captions reuse the shipped em-dash sentinel + `text-slate-*` idiom; no traffic-light, no editorial verbs.
- `ClusterAggregate` is constructed ONLY in `aggregateClusters` — type changes (drop `stretchedConfidence`, add a factual site-data indicator field) ripple only there + test fixtures (`globals.test.ts`).

### Integration Points

- The `estate-level "N clusters marked stretched"` line (D-06) reads `stretchedClusters.size` via the single memo / a stable selector — must not introduce a second `useMemo`.
</code_context>

<specifics>
## Specific Ideas

- Captions are exact-intent: "site data: detected" (tagged) / "symmetric split assumed (no site data)" (inferred) — neutral, factual, EN/FR. No "low/poor/confidence".
- Estate line wording: "N clusters marked stretched" (count echo, neutral).
- Reference depth target overall: `azure.github.io/RVToolsAnalyzer` (illustrative, not pixel-match) — but the deep catalogue is P5, not P4.
</specifics>

<deferred>
## Deferred Ideas (forward to the right phases — do not act in P4)

- **vSAN / blank-`Cluster name` datastore attribution → Phase 9.** Approach decided: **vInfo VM→datastore→cluster relink** (calculated from real data; researcher must confirm `vInfo` carries a usable VM→datastore/path column). P4 only **documents the known per-cluster storage under-count limitation** + this chosen approach as a pointer; no engine change in P4.
- **Full inventory for clusters / hosts / VM / datastore / networks** (user request 2026-05-17): cluster/host/VM/datastore tree+tables already shipped in **Phase 3**; **deeper per-entity intelligence → Phase 5**; **networks (ports / switches / port-groups) is NEW → Phase 9** — flag "networks inventory" as an explicit P9 requirement during P9 discuss.
- **P5 forward-note:** the full Rich-Intelligence metric catalogue must render **both globally (estate) and per-cluster** — every metric, both scopes (user-stated principle). Carry into P5 CONTEXT.
- Allocation (G2) and DR modes/metric (G3) → re-derived **Phase 6** (already in ROADMAP/replan brief).

</deferred>

---

*Phase: 04-multi-vcenter-stretched-allocation-dr*
*Context gathered: 2026-05-17*
