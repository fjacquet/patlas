# Phase 8: In-Session Trends - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 08-in-session-trends
**Areas discussed:** Warm-up & capture-date UX

---

## Gray-area selection

Four phase-specific gray areas were presented (multiSelect):

| Area | Description | Selected |
|------|-------------|----------|
| Timeline point + selection model | One point = file vs capturedAt date; trends selection vs dashboard merge selection; Phase-4 multi-vCenter composition | |
| Delta panel semantics | Count-deltas vs identity-resolved churn; which metrics; consecutive vs baseline | |
| Memory-release policy (N>4) | Which snapshot stays hydrated; what's lost on release; threshold fixed vs visible | |
| Warm-up & capture-date UX | Active estate while warming; N/M indicator; editable capture date; date-tie handling | ✓ |

The three unselected areas were recorded as **Claude's Discretion** with hard
constraints (see CONTEXT.md DD-A/DD-B/DD-C).

---

## Warm-up & capture-date UX

### Active estate while warming

| Option | Description | Selected |
|--------|-------------|----------|
| Latest capturedAt | Parse most-recent-date snapshot first; dashboard shows it immediately; older warm in background | ✓ |
| First file dropped | First-dropped file is active; simpler but arbitrary w.r.t. time | |
| User-selectable, default latest | Default latest; list lets user switch active | |

**User's choice:** Latest capturedAt (recommended).
**Notes:** Mental model "current state now, history fills in". The 5s-interactive criterion applies to this active estate.

### Warm-up indicator behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking, progressive | Dashboard usable immediately; factual "trends preparing — N/M" badge scoped to trends area; points fill progressively | ✓ |
| Non-blocking + skeleton | Same non-blocking, but skeleton until ALL parsed then render at once | |
| Blocking overlay | Block view until all parsed — fails success criterion 1 | |

**User's choice:** Non-blocking, progressive (recommended).
**Notes:** Indicator factual, no editorial verb, EN/FR parity; scoped to trends/sparkline area, not a global overlay.

### User-editable capture date in P8?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — inline editable | Reuse existing setCapturedAt; inline-editable capturedAt in SnapshotListSidebar; edit recomputes series | ✓ |
| No — inferred-only in P8 | Inference-only; manual override UI deferred | |

**User's choice:** Yes — inline editable (recommended).
**Notes:** `setCapturedAt` already shipped (Phase 6). Explicit input is the highest-priority inference source (Minor-6).

### Date ties / missing dates on the temporal X-axis

| Option | Description | Selected |
|--------|-------------|----------|
| Ordinal fallback + factual note | Real dates where known; deterministic ordinal for missing/identical + factual "ordering inferred" caption; nothing dropped/fabricated | ✓ |
| Same X, ordered, noted | Plot ties at same real X, order by load order, factual note | |
| Reject duplicate-date load | Refuse colliding-date snapshot, ask user to set distinct date | |

**User's choice:** Ordinal fallback + factual note (recommended).
**Notes:** Points must not silently collapse; no fabricated real dates; load is not blocked.

---

## Claude's Discretion

- **DD-A** — Timeline-point identity & multi-vCenter composition (hard constraints: per-point metadata, non-uniform real-date axis, single-memo, Phase-4 merge semantics, counts reconcile).
- **DD-B** — Delta-panel semantics (hard constraints: factual, branded units, real-column-derived, consecutive snapshots).
- **DD-C** — Memory-release policy N>4 (hard constraints: active/latest stays hydrated, only aggregated series retained on release, in-memory only).

## Deferred Ideas

- EOS-over-time / at-risk-count trend — only if a TRD requires it (P7 forward-note).
- Cross-session / persisted trends — OUT (TRD-05 forbids).
- HTML/PPTX export of trends view → Phase 10.
- Live Optics / multi-format trend input — out of v1 scope.
