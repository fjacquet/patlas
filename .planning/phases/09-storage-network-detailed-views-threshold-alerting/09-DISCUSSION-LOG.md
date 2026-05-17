# Phase 9: Storage / Network / Detailed Views + Threshold Alerting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 09-storage-network-detailed-views-threshold-alerting
**Areas discussed:** Threshold alerting scope (OPEN-3), Navigation taxonomy (OPEN-2), vSAN datastore attribution, Network detail depth, Threshold defaults, Detail-screen delta vs P5, Storage view metric/visual, Shared-LUN edge case

---

## Threshold alerting scope (OPEN-3)

| Option | Description | Selected |
|--------|-------------|----------|
| In — in-memory config | Alerting ships now; config in-memory only (Zustand inputs slice); zero new persistence keys; factual lines no verdict | ✓ |
| In — persisted UI-pref key | Alerting ships now; thresholds saved to a new vatlas-thresholds localStorage key | |
| Deferred to v2 | Storage/network VIEWS only; alerting + config → v2 | |

**User's choice:** In — in-memory config
**Notes:** Strictest privacy reading; mirrors the P6 `plannedRatios` in-memory inputs-slice precedent. Refresh = defaults restored.

---

## Navigation taxonomy (OPEN-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Two new ViewToggle segments | 'Storage' + 'Network' top-level segments (8 total); detail via click-drill | ✓ |
| One 'Storage & Network' segment | Single segment with internal sub-tabs | |
| Fold into Inventory + Hosts | No new top-level segments | |

**User's choice:** Two new ViewToggle segments
**Notes:** Extends the shipped P3/P5/P8 `fieldset`+`aria-pressed` ViewToggle idiom; closest mirror of RVTools-Analyser dedicated screens.

---

## vSAN / blank-`Cluster name` datastore attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Accept factual descope | Blank-cluster datastores → explicit 'Unattributed' bucket; closes STR-04 as descoped | |
| Implement vInfo relink | Build VM→datastore→cluster relink; closes the STR-04 under-count | ✓ |

**User's choice:** Implement vInfo relink
**Notes:** vInfo relink is the only valid cluster-identity path (vDatastore.Hosts is a count). Real-file validation against the 75-blank-cluster file is mandatory (unit tests insufficient — the original STR-04 lesson).

---

## Network (ports/switches) detail depth

| Option | Description | Selected |
|--------|-------------|----------|
| VM-portgroup inventory only | Parse vNetwork only; lowest regression risk | |
| Full vSwitch/dvSwitch topology | Parse vNetwork + vSwitch + dvSwitch (+ dvPort); richer #12 fidelity | ✓ |
| Network deferred, storage-only P9 | Drop network detail from P9 | |

**User's choice:** Full vSwitch/dvSwitch topology
**Notes:** Regression-gated parser extension (P5 D-07 pattern); new sheets OPTIONAL with factual-degrade, never a throw.

---

## Default thresholds for in-memory alerting

| Option | Description | Selected |
|--------|-------------|----------|
| RVTools-Analyser defaults | Filesystem < 10 % free (≥ 90 % used); datastore > 85 % used | ✓ |
| Conservative (earlier warning) | Filesystem < 20 % free; datastore > 75 % used | |
| You decide per metric | Claude picks defensible defaults per metric | |

**User's choice:** RVTools-Analyser defaults
**Notes:** Familiar to reference-tool users; LU/logical-unit default left to Claude on the same factual basis. All user-editable at runtime.

---

## Detail-screen delta vs P5 (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Datastore detail | Dedicated datastore drill: capacity/provisioned/in-use/free, VMs, hosts, flags | ✓ |
| VM detail | Per-VM drill tying storage + network + alerting | ✓ |
| ESX detail (network/storage) | Augments the P5 Hosts view with per-host storage+network | ✓ |

**User's choice:** All three (Datastore + VM + ESX detail)
**Notes:** ESX detail augments the shipped P5 Hosts view rather than duplicating the P5 cluster-detail drill.

---

## Storage-by-X breakdown — metric & visual

| Option | Description | Selected |
|--------|-------------|----------|
| Provisioned + in-use, treemap | Consumption framing; datastore-footprint treemap | |
| Capacity/free/used, bar | Capacity framing; stacked-bar | |
| Both, toggled | Both lenses behind an accounting-style toggle | ✓ |

**User's choice:** Both, toggled
**Notes:** Reuses the shipped Configured/Active/Storage-realistic accounting-toggle idiom for the lens switch; treemap for consumption (VIZ-02), stacked-bar for capacity.

---

## vInfo relink edge case — shared LUN (VMs span multiple clusters)

| Option | Description | Selected |
|--------|-------------|----------|
| Proportional by VM provisioned | Split storage across clusters proportionally; estate total preserved | |
| Factual 'shared across N' line | No split; explicit shared-across-N line excluded from single-cluster rollups | |
| You decide | Claude picks the minimal-inference factual approach, validated on a real file | ✓ |

**User's choice:** You decide
**Notes:** Claude's discretion — pick the minimal-inference, no-double-count approach during planning; document rationale; validate against a real multi-cluster file. No silent allocation guesses.

---

## Claude's Discretion

- Shared-LUN attribution approach (D-10) — minimal-inference factual, decided + documented in PLAN, real-file-validated.
- LU/logical-unit default threshold value (D-03).
- Tile/column ordering, EN/FR factual label strings (no editorial verbs, parity), the three detail-screen layout grids, treemap/stacked-bar option configs.
- Minimal-blast-radius parser-extension shape (new optional sheets + types, no regression of existing consumers).
- Plan/wave breakdown for this large phase (parser extension · storage+vSAN-relink engine · threshold engine + in-memory config slice · two view shells + 3 detail drills).

## Deferred Ideas

- Persisted threshold config (`vatlas-thresholds` localStorage key) — rejected for this milestone; possible future opt-in.
- Conservative/earlier-warning threshold preset — not the chosen default; possible future selectable preset.
- Storage/network analytics beyond inventory + thresholds (IOPS/latency trends, capacity forecasting) — out of scope / potential v2.
