# Phase 11: Report & Deck Gap Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 11-report-and-deck-gap-closure
**Areas discussed:** F-1 plannedView fate, F-2 PPTX P9 slides, F-2 P9 charts vs tables

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| F-1: plannedView fate | Render vs remove the dead view.plannedView (PLN-03/04) | ✓ |
| F-2: HTML report P9 depth | Dedicated sections vs annex fold; depth vs budget | |
| F-2: PPTX P9 slide(s) | One combined / separate / HTML-only | ✓ |
| F-2: P9 charts vs tables | Treemap / bar / tables-only | ✓ |

**Notes:** HTML report P9 depth deliberately left unselected → proceeds as Claude's discretion within the locked Phase-10 D-02 + <5 MB/<15 MB budget constraints.

---

## F-1: plannedView fate

| Option | Description | Selected |
|--------|-------------|----------|
| Remove from EstateView | Delete the dead projection; retire PLN-03/04 (KISS/DRY, ALC G2 precedent) | |
| Render in PlanningView | Planning lens on screen only | |
| Render + put in exports | PlanningView + HTML report + PPTX | ✓ |

**User's choice:** Render + put in exports — plannedView becomes a live feature; PLN-03/04 stay.

### F-1 presentation follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Estate totals delta | Compact estate measured-vs-planned + per-cluster delta; one panel/section/slide | |
| Per-cluster planned table | Full per-cluster table in PlanningView+HTML; deck = executive summary | |
| You decide | Claude picks faithful minimal, mirroring drSim/plannedDrSim, D-02/budget-aware | ✓ |

**User's choice:** You decide. **Notes:** presentation = Claude's discretion, consistent with the existing planning-surface idiom.

---

## F-2: PPTX P9 slide(s)

| Option | Description | Selected |
|--------|-------------|----------|
| One Storage slide | Single executive Storage slide; Network HTML-only | |
| Storage + Network slides | Two slides | ✓ |
| HTML-only (no P9 slide) | Deck unchanged; P9 in HTML only | |

**User's choice:** Storage + Network slides.

### F-2 placement + flags follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| After per-cluster, flag KPI | Slides after per-cluster; flagged-count KPI | |
| Before inventory, flag KPI | Slides before inventory; flagged-count KPI | |
| You decide placement | Claude places coherently; factual flagged-count KPI, gold marker, no verdict | ✓ |

**User's choice:** You decide placement. **Notes:** placement = Claude's discretion within the fixed PPT-03 order; flagged rows = factual count KPI, gold marker only.

---

## F-2: P9 charts vs tables

| Option | Description | Selected |
|--------|-------------|----------|
| Storage treemap + tables | Treemap (cluster/datastore) on report+deck; Network/flags = tables/counts | ✓ |
| Storage bar + tables | Sorted/stacked bar instead of treemap | |
| Tables only (no new chart) | No chartBundle entry; all P9 as tables/KPIs | |

**User's choice:** Storage treemap + tables — treemap is the single P9 visual; Network = table/count rollup; flags = factual list/count.

---

## Claude's Discretion

- F-1 planned-vs-measured presentation shape (mirror plannedDrSim, D-02/budget-aware).
- PPTX Storage/Network slide placement within the fixed PPT-03 order.
- HTML report P9 section depth & budget trade-off (not selected for discussion).
- Mechanical traceability reconciliation in REQUIREMENTS.md (stale P4/5/9/10 rows + P10-mislabeled-Phase-7).

## Deferred Ideas

None — discussion stayed within the audit-defined gap-closure scope.
