# Phase 6: Allocation & DR (re-derived) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 06-allocation-dr-re-derived
**Areas discussed:** Measured vs Planned + P5 reuse, Planning-lens placement & inputs, DR mode selection UX, DR trust signals + Custom Failover

---

## Measured vs Planned + P5 reuse

### Q: What does P6's 'realized' deliverable (a) actually do, given P5 already ships realized vCPU:pCPU?

| Option | Description | Selected |
|--------|-------------|----------|
| Reference P5, no new realized UI | P6 adds NO realized-ratio UI; G2 measured satisfied by P5; P6 builds only planning lens + DR rework | ✓ |
| Re-surface realized beside planned | P6 re-displays realized next to the planning lens (presentational mirror, no recompute) | |
| Reference P5 + add vRAM:physRAM | Reuse P5; add only the missing realized RAM ratio if absent | |

**User's choice:** Reference P5, no new realized UI
**Notes:** DRY — realized metric stays in P5 Operational Insights; P6 scope narrows to (b)+(c).

### Q: How are measured vs planned kept separate so they're never conflated/overwritten?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate labelled surfaces | Planning lens own titled area; measured carries 'measured' label; never share a tile; realized read-only & always visible | ✓ |
| Side-by-side measured\|planned | Adjacent columns/cards for direct contrast | |
| You decide | Capture intent, planner picks layout | |

**User's choice:** Separate labelled surfaces

---

## Planning-lens placement & inputs

### Q: Where does the 'Capacity planning — what-if' lens live?

| Option | Description | Selected |
|--------|-------------|----------|
| New ViewToggle segment | 4th top-level segment Dashboard\|Inventory\|Hosts\|Planning; reuse fieldset+aria-pressed idiom | ✓ |
| Dashboard panel/section | Collapsible section on Dashboard below measured insights | |
| You decide | Capture intent, planner picks | |

**User's choice:** New ViewToggle segment

### Q: What input controls for Personal Ratios (CPU/RAM)?

| Option | Description | Selected |
|--------|-------------|----------|
| Presets + sliders | Named presets + sliders (revived ALC style) | |
| Free numeric entry | Plain numeric inputs, no presets | |
| Presets + numeric (no slider) | Preset buttons fill an editable numeric field; no slider widget | ✓ |

**User's choice:** Presets + numeric (no slider)
**Notes:** Presets 1:1/4:1/8:1/VDI 10:1; default CPU 4:1 / RAM 1:1 (echo of old ALC-02).

### Q: Planning what-if state — URL-hash shareable or in-memory only?

| Option | Description | Selected |
|--------|-------------|----------|
| URL-hash shareable | Encode planned ratios + failover in URL hash (no localStorage) | |
| In-memory only | Zustand inputs only, gone on refresh; no hash codec | ✓ |
| You decide | Capture intent, planner picks | |

**User's choice:** In-memory only

---

## DR mode selection UX

### Q: How does the user select what fails in 'Server loss'?

| Option | Description | Selected |
|--------|-------------|----------|
| Pick individual hosts | Multi-select named ESX hosts | |
| Per-cluster host count | Pick cluster + number of hosts to fail | |
| Both: hosts or count | Individual-host selection AND quick per-cluster count | ✓ |

**User's choice:** Both: hosts or count
**Notes:** Planner picks minimal-blast-radius implementation against kept drSim host-loss path.

### Q: How is 'Site loss' chosen and non-stretched workload at the lost site handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Pick Site A / Site B | Pick site from stretched fault-domain values; non-stretched-at-site = factually LOST; symmetric fallback | |
| Pick site, hide if no stretched | Same, but Site-loss disabled when no stretched clusters declared | |
| You decide | Capture intent, planner picks disabled-state vs always-shown | ✓ |

**User's choice:** You decide (intent locked: site = stretched fault-domain; non-stretched-at-site = factually LOST/no-DR-target; symmetric 50% no-metadata fallback per P4 D-03)

### Q: What does the survivor verdict vs physical headroom look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Verdict enum, physical | Reuse absorbs/tight/overflows fed physical capacity; factual, no color | |
| Physical numbers, no enum word | Only before/after physical figures; drop the enum word | |
| You decide | Capture intent, planner decides whether enum word stays | ✓ |

**User's choice:** You decide (intent locked: verdict on physical CPU+RAM, factual, reuse engine where possible; before/after + evacuee total kept)

---

## DR trust signals + Custom Failover

### Q: Does the DR confidence high/med/low indicator (DRS-05) survive G3?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop confidence, keep caveats | Remove confidence indicator (G1 consistency); keep assumptions panel + factual caveats (Moderate-10) | ✓ |
| Keep confidence + caveats | Retain both as shipped | |
| You decide | Capture intent, planner reconciles | |

**User's choice:** Drop confidence, keep caveats

### Q: What is 'Custom Failover' concretely, reconciled with the Server/Site DR model?

| Option | Description | Selected |
|--------|-------------|----------|
| Parameterized Server/Site sim | Same Server/Site sim run with the planning lens's planned ratios applied; not a 3rd mode; measured DR stays separate | ✓ |
| Named saved scenarios | User composes & names a failure set (in-memory) | |
| You decide | Capture intent, planner picks shape | |

**User's choice:** Parameterized Server/Site sim

---

## Claude's Discretion

- Site-loss disabled-state vs always-shown when zero stretched clusters declared (D-08).
- Whether the `Verdict` enum word is shown vs pure-numbers-only for the physical survivor verdict (D-09).
- Exact label strings (factual, EN/FR parity, no editorial verbs), Planning-screen layout grid, minimal-blast-radius wiring of planned ratios into `drSim`, and the precise re-derived requirement IDs/wording (D-12).

## Deferred Ideas

- Named/saved Custom-Failover scenarios — considered, not chosen (D-11 picked parameterized instead); in-memory only if revisited.
- URL-hash-shareable planning links — considered, rejected for P6 (in-memory only, D-06).
- vSAN datastore relink + networks → Phase 9; ESXi/OS EOS → Phase 7; HTML/PPTX export → Phase 10.
