# Phase 4: Multi-vCenter Merge & Factual Labels - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 04-multi-vcenter-stretched-allocation-dr
**Areas discussed:** Old-plans gate, Calculation principle, Factual site-data presentation, Requirement rewording, vSAN datastore attribution, Stretched pill UX, Mixed-version signal, Collision-suffix label, Stretched on suffixed clusters

---

## Old-plans gate

| Option | Description | Selected |
|--------|-------------|----------|
| Continue, replan P4 after | Capture re-derived context; old 04-0x plans stay as history | ✓ |
| Archive old plans first | Move old artifacts to archive subfolder | |
| Cancel | Stop discussion | |

**User's choice:** Continue, replan P4 after
**Notes:** Old 04-01..04 plans superseded by the analytics-core replan; 04-01 merge kept as baseline.

## Calculation principle (free-text "calculation available using our datas")

**User's choice:** Confirmed — only surface metrics calculable from real parsed RVTools data; nothing invented. Deep metric catalogue is Phase 5; P5 must render every metric **globally and per-cluster**. P4 applies the principle narrowly to the G1 site-data + per-site reservation.
**Notes:** Captured as locked cross-cutting principle D-01 + P5 forward-note.

## Factual site-data presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Tagged: per-site rows + "site data: detected" | Site A/B + Reservation % + neutral caption | ✓ |
| Tagged: per-site rows only | No caption | |
| Tagged: per-site rows + source detail | Names the basis | |
| Inferred: Reservation % + "symmetric split assumed" | + neutral caption, no Site A/B | ✓ |
| Inferred: Reservation % only, em-dash sites | | |
| Inferred: Reservation % only, silent | | |

**User's choice:** Tagged → rows + "site data: detected"; Inferred → Reservation % + "symmetric split assumed (no site data)".
**Notes:** Confidence verdict + chip fully removed (G1). Reservation math unchanged.

## Requirement rewording

| Option | Description | Selected |
|--------|-------------|----------|
| STR-03 → factual; retire STR-04 | Restate, keep IDs | |
| Merge into one STR-03, drop STR-04 ID | Single factual requirement | ✓ |
| You decide wording | Planner discretion | |

**User's choice:** Merge into one STR-03, drop STR-04 ID.

## vSAN blank-cluster datastore attribution

| Option | Description | Selected |
|--------|-------------|----------|
| vInfo VM→datastore→cluster relink | Calculated from real data | ✓ |
| Accept descope | Stays estate-total only | |
| Relink if data exists, else descope | Evidence-based | |
| Defer to Phase 9 (Storage) | P4 documents limitation only | ✓ |
| Do it in Phase 4 now | | |
| Engine P4, surfacing P9 | | |

**User's choice:** vInfo relink approach, **deferred to Phase 9**. P4 documents the known limitation pointer only.

## Stretched pill UX

| Option | Description | Selected |
|--------|-------------|----------|
| In cluster card (shipped placement) | No relocation | ✓ |
| Cluster card, collapsed by default | Behind expander | |
| You decide | Planner aligns w/ P5 | |
| Global echo: Yes — factual count | "N clusters marked stretched" | ✓ |
| Global echo: No — per-cluster only | | |
| Global echo: Defer to P5 | | |

**User's choice:** Keep shipped placement; add factual estate-level "N clusters marked stretched".

## Mixed RVTools-version signal

| Option | Description | Selected |
|--------|-------------|----------|
| Factual estate note | Lists distinct versions | |
| Per-vCenter only, no estate note | MVC-04 card sufficient | ✓ |
| Estate note only when they differ | | |

**User's choice:** Per-vCenter only, no estate note.

## Collision-suffix label & cross-view consistency

| Option | Description | Selected |
|--------|-------------|----------|
| vMetaData Server → viSdkServer → snapshot label; identical everywhere | Shipped order, one canonical name | ✓ |
| Same order, views may differ | | |
| You decide / planner aligns | | |

**User's choice:** Shipped resolution order; suffixed name byte-identical across dashboard / tree / exports.

## Stretched on collision-suffixed clusters

| Option | Description | Selected |
|--------|-------------|----------|
| Independent (per real cluster) | Matches MVC-02 / G1 | ✓ |
| Independent + optional manual link | | |
| Linked (treat same base name as one) | Initially picked, then reversed | |

**User's choice:** Initially "Linked"; after the MVC-02/G1 conflict was surfaced, **re-decided to Independent (per real cluster)**.
**Notes:** Conflict surfaced rather than silently overridden; user owns the final call.

## Claude's Discretion

- Exact prose of reworded STR-03 and the neutral caption/echo strings (follow captured factual intent, EN/FR parity, no editorial verbs).

## Deferred Ideas

- vSAN blank-cluster datastore relink → Phase 9 (vInfo VM→datastore→cluster).
- Full inventory clusters/hosts/VM/datastore (deeper) → Phase 5; **networks (ports/switches) → Phase 9 (new requirement)**.
- P5 metric catalogue must render globally AND per-cluster.
- Allocation (G2) + DR modes/metric (G3) → Phase 6.
