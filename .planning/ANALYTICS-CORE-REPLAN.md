# Analytics-Core Replan Brief (roadmap-scoped)

**Status:** planning input — consumed by ROADMAP rework + per-phase discuss/plan. Not a spec; the OPEN items below must be resolved in discussion before planning.

**Trigger:** Phase-4 UAT surfaced 3 spec divergences + a "far richer per-cluster intelligence" gap. User call: "we are at a failure point — return to planning completely." Scope chosen: **rework the analytics-core scope across the roadmap**, **keep the shipped Phase-4 engine spine as a baseline and evolve it** (do not discard).

**Reference model:** `azure.github.io/RVToolsAnalyzer` — illustrative of the *depth* wanted (a good example, not a pixel/fidelity target). Canonical scope = the RVTools Analyser function list below.

---

## Hard constraints (carry into every phase)

- **Privacy / architecture invariant is NON-negotiable** (PROJECT.md): vatlas stays **100% client-side, in-memory, no upload, no database, no localStorage of dataset rows**. RVTools Analyser persists to a DB — we adopt its *analytical surface*, NOT its storage model. "Refresh = data gone" stays.
- **Keep the validated Phase-4 engine spine** (real-file-validated): `engines/snapshotMerge` (multi-vCenter merge), per-site stretched math in `aggregateClusters`, `engines/drSim`. Evolve; don't rewrite from zero.
- Stack unchanged (React 19 / TS strict / Vite / Tailwind v4 / Zustand / ECharts SVG / pptxgenjs). Single-`useMemo` invariant (`useEstateView`) stays. Branded units. EN/FR i18n parity.

## Locked UAT decisions (must be honored by the replan)

- **G1 — Stretched is the user's declaration.** Drop the auto `stretchedConfidence` high/med/low verdict + the low-confidence chip (no judgement of the user's call). Show site-data **factually** (present vs inferred). No fault-domain metadata ⇒ assume symmetric 50% reservation; real per-site split when data present. (memory: stretched-is-user-decision-no-confidence-judgement)
- **G2 — Realized consolidation ratio is CALCULATED & displayed**, not a user-selected what-if: `vCPU allocated ÷ usable physical cores` (+ `vRAM ÷ physical RAM`). Remove the ALC slider/preset/URL-hash *as the realized-ratio mechanism*. (memory: allocation-ratio-calculated-not-selected) — **see OPEN-1, conflicts with reference #8.**
- **G3 — DR modes = Server loss + Site loss only.** Drop cluster-loss & vCenter-loss. Site = fault-domain value of clusters the user declared stretched; non-stretched workload at a lost site = **lost** (no DR target). Impact metric = **physical CPU (GHz/cores) + physical RAM** removed, not vCPU. Reversible/neutral failed-selection UI is correct — keep. (memory: dr-modes-server-site-physical-impact)
- **Process:** never assert domain ground truth in UAT/discussion (which clusters are stretched/tagged) — user owns it. (memory: no-domain-guesses-in-uat)

## Open decisions (resolve in discuss-phase BEFORE planning — do NOT assume)

- **OPEN-1 (load-bearing): G2 vs reference #8.** UAT G2 says "calculated, no user ratios." RVTools Analyser #8 explicitly offers "Personal Ratios (CPU and RAM) and Custom Failovers." Likely reconciliation to confirm with user: *realized* consolidation is calculated & always shown (G2); a SEPARATE **capacity-planning** lens may accept user **Personal Ratios + Custom Failover** inputs for sizing/headroom (reference #8). Are these two distinct features, or is #8 rejected? Decides whether any ratio input UI returns and how DR "Custom Failover" relates to G3's site/server model.
- **OPEN-2:** RVTools Analyser is single-app-with-DB + multi-screen nav. vatlas is drop-and-go client app. How far do we mirror its navigation taxonomy (dedicated Clusters/ESX/VMs/Storage/Network/Stats screens) vs the current Dashboard⟷Inventory ViewToggle? Affects phase count.
- **OPEN-3:** Threshold **alerting** (#12/#14: filesystem & LU thresholds, partition alerts) introduces user-config + a config surface. In-scope for this milestone or deferred?

## RVTools Analyser functions → state → target ROADMAP home

| # | Function | Current state | Target |
|---|----------|---------------|--------|
| 1 | Global vCenter display (clusters/ESX/VMs Win/Linux), table per-cluster | Shipped P2/P3 but SHALLOW | **Rework P4**: far richer per-cluster card (see Gap below) |
| 2 | Complete inventory: tree views, tables, graphs | Tree+tables P3; graphs thin | Evolve P3/P4 (add per-entity graphs) |
| 3 | Multiple vCenter aggregation | **Shipped P4-01 (baseline-keep)** | Keep; evolve labels per G1 |
| 4 | Detailed asset inventory by OS | OS donut P2; partial | Evolve (dedicated OS asset view) |
| 5 | OS End-of-Support (Linux/Win/ESX) 3/6/9/12mo | Planned P5, not built | **P5** (unchanged intent) |
| 6 | vCenter Trends (clusters/ESX/DS/VMs/vCPU/vRAM/Disks evolution) | Planned P6, not built | **P6** (unchanged intent) |
| 7 | ESX Summary — all ESX in one window | **MISSING** | **New phase / P4-adjacent** dedicated Hosts/ESX view |
| 8 | Allocated Resources w/ Personal Ratios + Custom Failovers | P4-03 built then **rejected (G2)** | **OPEN-1** — re-derive |
| 9 | DR Simulations, 1+ vCenters | **Shipped P4-04 (baseline-keep)**; modes wrong | Rework per **G3**; keep engine |
| 10 | Storage Views: disk sizes by Cluster/ESX/VM/Datastore | Datastore table P3; partial | **New / evolve** storage view |
| 11 | Statistics Reports for ESX & VMs | **MISSING** | **New** stats view |
| 12 | Detailed views Clusters/ESX/VM/Datastore + Disk/Partition **threshold alerting** + Ports/Switches | **MISSING** (no network, no alerting) | **New** — depends OPEN-3 |
| 13 | HTML Report generation | Planned P7, not built | **P7** (unchanged intent) |
| 14 | Personal config: thresholds, viewers, screen/graph colors | theme/lang only | **OPEN-3** — config surface scope |

## The richer per-cluster gap (the new requirement, concretely)

Current `ClusterColumn` shows: host count, VM count, OS mini-bar, datastore count, physical/consumed GHz, CPU/RAM gauges, CPU-Ready, stretched block. RVTools Analyser-grade depth additionally wants, per cluster (and as estate rollups — the screenshot's "Operational Insights"):

- **CPU overcommit** ratio (vCPU ÷ physical cores) — realized, calculated (G2).
- **Avg CPU usage** (weighted by cores) / **Avg memory usage** (weighted by host memory) — point-in-time.
- **Hosts on ESXi < 8.x** / ESXi-version lifecycle posture.
- **Hardware lifecycle** (hosts out of vendor support).
- Powered-on / off / suspended / template VM breakdown; provisioned vs in-use; datastore footprint incl .vswp+snapshots; guest data.
- Std-switch port groups / NSX posture; network detail.
- Total physical cores / total host memory rollups.

## Proposed ROADMAP reshape (DRAFT for discussion — not final)

Keep Foundation(1)/Aggregation(2)/Inventory(3) as shipped. Analytics-core band re-derived:

- **P4 — Multi-vCenter + Rich Cluster/Host Intelligence:** keep merge engine; rework stretched per G1; add the deep per-cluster + ESX-Summary + operational-insights surface (#1,3,7, parts of 2/4/10/11).
- **P4b/P5 — Allocation & DR (re-derived):** resolve OPEN-1; DR per G3 (keep drSim engine, server+site, physical impact).
- **P-EOS:** OS/ESX end-of-support (#5).
- **P-Trends:** in-session trends (#6).
- **P-Storage/Network/Detailed + Alerting:** #10/#12/#14 (scope per OPEN-2/3).
- **P-Exports+Deploy:** HTML report + PPTX + GitHub Pages (#13).

Exact phase boundaries/count = the ROADMAP-rework output, informed by OPEN-1/2/3.

## Recommended next commands

1. Resolve **OPEN-1/2/3** with the user (discussion).
2. Restructure ROADMAP phases from this brief (`/gsd-phase` edits, or roadmap re-derivation).
3. Per reshaped phase: `/gsd-discuss-phase` → `/gsd-plan-phase`.

Carry-ins: `04-0x-SUMMARY.md`, `04-UAT.md` (Gaps), `.planning` memory decisions (G1/G2/G3 + process).
