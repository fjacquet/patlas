# Phase 5: Rich Cluster / Host / ESX Intelligence - Discussion Log

> **Audit trail only.** Not consumed by downstream agents — decisions are in CONTEXT.md.

**Date:** 2026-05-17
**Phase:** 05-rich-cluster-host-esx-intelligence
**Areas discussed:** Navigation taxonomy (OPEN-2), ESX/Host Summary shape, Metric catalogue + lifecycle boundary, Global + per-cluster presentation

---

## Navigation taxonomy (OPEN-2)

| Option | Selected |
|--------|----------|
| Add dedicated screens to ViewToggle | |
| Enrich in place, no new nav | |
| Hybrid: enrich dashboard + ONE new ESX/Host screen | ✓ |
| Nav pattern: extend the shipped ViewToggle | ✓ |

**User's choice:** Hybrid; extend shipped ViewToggle with one "Hosts" segment. (Refined later in Area 4: also a drill-in per-cluster detail screen.)

## ESX/Host Summary shape

| Option | Selected |
|--------|----------|
| Sortable host table (reuse P3 DataTable) | |
| Per-host cards grid | |
| Estate host-rollup + drill | ✓ |
| Columns: core capacity + utilization + VM count | |
| Columns: core set + model/vendor | ✓ |
| Columns: minimal | |

**User's choice:** Estate host-rollup + expandable per-cluster drill; core set + model/vendor (model/vendor plain text, no lifecycle verdict).

## Metric catalogue + lifecycle boundary

| Option | Selected |
|--------|----------|
| Full set | ✓ |
| Full set minus guest-data | |
| You decide the cut | |
| Factual only in P5; support-state → P7 | ✓ |
| Pull ESXi support-state into P5 | |
| Defer ESXi version display too | |
| Extend parser: on/off/suspended/template | ✓ |
| On/off only (no parser change) | |
| Extend if columns exist, else on/off | |

**User's choice:** Full metric set; ESXi/hardware factual only (support-state → P7); extend parser for exact Powerstate + Template.
**Notes:** Parser extension touches validated parser → regression coverage mandated; vPartition reliability flagged for guest-data.

## Global + per-cluster presentation

| Option | Selected |
|--------|----------|
| Estate: new Operational-Insights tile row | |
| Estate: enrich GlobalSummaryCard | |
| Estate: both card + insights row | ✓ |
| Per-cluster: enrich ClusterColumn cards | |
| Per-cluster: clusters×metrics matrix | |
| Per-cluster: free-text (Other) | ✓ |

**User's choice:** Estate = both (GlobalSummaryCard + Operational-Insights row). Per-cluster = free-text: "drill from global view to dedicated cluster view with full details, easy to export a pptx, 1 screen fit".
**Notes:** Reflected back and confirmed (plain-text follow-up): per-cluster = dedicated detail screen drilled from estate; one-screen-fit sized to one PPTX slide per cluster (PPTX generation stays P10); dashboard cluster cards are the drill entry point.

## Claude's Discretion

- Tile/column ordering, factual label strings (EN/FR, no editorial verbs), screen-fit grid for the cluster-detail view, minimal-blast-radius poweredOn→Powerstate parser change.

## Deferred Ideas

- Networks (ports/switches) → P9 · vSAN relink → P9 · ESXi support-state/OS EOS → P7 · allocation+DR → P6 · actual PPTX/HTML export → P10.
- Feasibility flags: vPartition reliability for guest-data; Powerstate/Template column presence across RVTools versions.
