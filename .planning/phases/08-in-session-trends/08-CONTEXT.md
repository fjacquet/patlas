# Phase 8: In-Session Trends - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the multi-snapshot temporal-trends capability: load 2–12 monthly RVTools
snapshots together; aggregate **each snapshot separately** into a time series
keyed on its real `capturedAt` date (a *temporal* X-axis, not categorical);
render line charts of headline metrics, per-cluster sparklines on the dashboard
cards, and a delta panel of what changed between consecutive snapshots; show
per-timeline-point snapshot metadata (vCenter label + RVTools version).
Background-parse non-default snapshots so the dashboard stays interactive while
trends warm up; release older raw rows when N > 4 snapshots are loaded, keeping
only the aggregated series for those.

**Requirements owned:** TRD-01..05.

**Explicitly OUT of P8:**

- Any cross-session persistence of trends — refresh wipes everything; no
  `localStorage` of dataset rows (this *is* TRD-05, not a side constraint).
- HTML/PPTX export of the trends view (→ P10; P8 makes the view, not the export).
- New chart infrastructure — reuse the Phase-2 `<Chart>` (SVG ECharts); no new
  charting component or renderer.
- Live Optics / `.zip` bundles / any non-RVTools input (project-wide v1 scope).
- Re-deciding cross-snapshot VM identity — Phase-4 `(VI SDK UUID,
  vm_bios_uuid)` keys + canonical collision-suffixed cluster names are the
  fixed identity basis (declared `Depends on: Phase 4`).
</domain>

<decisions>
## Implementation Decisions

### Cross-cutting (carried — locked, not re-asked)

- **D-00:** All P4/P7 invariants hold: calc-from-real-data only (P4 D-01 — every
  series value derived solely from parsed RVTools columns, never fabricated);
  the **single `useMemo`** invariant (`useEstateView` → `buildEstateView`) —
  the trends projection composes inside the existing pure aggregation, **NO new
  `useMemo`**, **no second memo site** (grep-gated); store stays **inputs-only**
  (`Map<id,Snapshot>` + selection Sets, REPLACED never mutated — no cached
  aggregates); privacy/in-memory only (no `localStorage`/`sessionStorage`/
  IndexedDB of dataset rows — refresh = data gone); factual labels, **no
  editorial verbs**, EN/FR i18n parity (keys in both `en/` and `fr/`, no
  pre-formatted numbers in strings); branded units (GiB/MiB/GHz/MHz — never a
  raw `* 1.048576`); em-dash sentinel for "not determinable".

### Warm-up & capture-date UX (Area discussed — locked)

- **D-01:** **Active estate = the latest-`capturedAt` snapshot**, parsed first.
  The dashboard renders that single estate and is interactive immediately (the
  "5s interactive" success criterion applies to this active estate); older
  snapshots warm in the background. ("Current state now, history fills in.")
- **D-02:** **Warm-up is non-blocking and progressive.** The dashboard is fully
  usable on the active estate while remaining snapshots parse. A small **factual
  "trends preparing — N/M"** indicator is scoped to the trends/sparkline area
  only (not a global blocking overlay); trend-chart points and per-cluster
  sparklines fill in **progressively** as each snapshot finishes. Indicator text
  is factual, no editorial verb, EN/FR parity. No blocking overlay (would fail
  success criterion 1).
- **D-03:** **User-editable capture date is IN SCOPE for P8.** The
  `SnapshotListSidebar` gets an **inline-editable `capturedAt` per snapshot**,
  reusing the **existing `setCapturedAt` store action** (shipped Phase 6 — no
  new store mutation). Editing recomputes the temporal series (flows through the
  single memo via the inputs-only store). Explicit user input is the
  **highest-priority** capture-date source (Minor-6: explicit user input →
  filename ISO → `vMetaData` timestamp → file mtime → ordinal).
- **D-04:** **Capture-date inference order** is the shipped `inferCaptureDate`
  chain (explicit → filename ISO → `vMetaData` exported/columnar timestamp →
  mtime) **plus a deterministic ordinal fallback** for the tie/missing case
  (D-05). The ROADMAP "vSource sheet" wording maps to the already-shipped
  `vMetaData` timestamp resolution — do **not** add a new sheet probe; confirm
  during research/planning that `vMetaData` is the correct source and only add a
  `vSource` probe if a real fixture proves `vMetaData` is insufficient.
- **D-05:** **Date-tie / missing-date handling = ordinal fallback + factual
  note.** Keep real dates where known. When two snapshots resolve to the same
  date or a date cannot be inferred, assign a **deterministic ordinal position**
  (stable load order) so timeline points do **not** silently collapse, and
  surface a **factual caption** that the ordering is inferred (not from real
  capture dates). Nothing is dropped; nothing is fabricated as a real date.
  Duplicate-date loads are **not** rejected (load-blocking rejected).

### Claude's Discretion (planner/researcher decide within the hard constraints)

The user chose to discuss only Warm-up & capture-date UX. The three areas below
are **Claude's discretion**, each bounded by hard constraints that are NOT
discretionary:

- **DD-A — Timeline-point identity & multi-vCenter composition.** Whether a
  timeline point is one snapshot FILE or one `capturedAt` DATE (same-date
  multi-vCenter files merged spatially via Phase-4 `mergeSnapshotsToEstate`
  first, then a point) is Claude's discretion. **Hard constraints:** each
  timeline point must carry its snapshot metadata (vCenter label + RVTools
  version) per ROADMAP success criterion 6; the temporal axis uses real
  `capturedAt` dates with **non-uniform spacing** (criterion 2 — never
  evenly-spaced categorical labels); must not break the single-memo invariant or
  the Phase-4 merge semantics; counts must reconcile (nothing silently dropped).
- **DD-B — Delta-panel semantics.** Count-deltas only (e.g. "+12 VMs, −3
  powered-on, +480 GiB allocated") vs identity-resolved churn (which VMs
  added/removed/moved via Phase-4 keys), which headline metrics, and
  consecutive-pairs vs also-vs-baseline is Claude's discretion. **Hard
  constraints:** factual phrasing, no editorial verbs; branded units; deltas
  computed only from real parsed columns; consistent with ROADMAP example
  ("what changed between **consecutive** snapshots").
- **DD-C — Memory-release policy (N > 4).** Which snapshots stay fully hydrated
  (the active/latest per D-01 must remain hydrated), the exact release
  trigger/order, and whether the threshold is fixed at 4 or surfaced, is
  Claude's discretion. **Hard constraints:** when raw rows are released only the
  aggregated time-series is retained for that snapshot (ROADMAP Critical-5 +
  Minor part); the **active estate (D-01) must never be released** while active;
  released snapshots lose drill/re-merge for that point — surface this factually
  if it changes available UI; still in-memory only (no spill to storage).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements

- `.planning/ROADMAP.md` ### Phase 8 — goal, 6 success criteria, `Depends on:
  Phase 4`, `Requirements: TRD-01..05`, Pitfalls owned (**Minor-6** timestamp
  drift / capture-date inference order; part of **Critical-5** memory budget /
  release older raw rows when N > 4), vsizer-reuse note (new engine module;
  reuses Phase-2 `<Chart>` + Phase-2 aggregation pipeline).
- `.planning/REQUIREMENTS.md` §In-Session Trends — TRD-01..05 (every ID MUST
  appear in a plan's `requirements`; the coverage-table rows currently mapped to
  "Phase 6" are stale — planner reconciles them to Phase 8, mirroring the P7
  precedent).

### Decision authority / project invariants

- `.planning/PROJECT.md` — privacy/in-memory invariant (the P1 guard **throws**
  on any non-same-origin fetch — adding a network call breaks the app by
  design), single-`useMemo`, branded units, EN/FR parity, no-editorial-verbs
  denylist, "the report is the product".
- `.planning/phases/04-multi-vcenter-stretched-allocation-dr/04-CONTEXT.md` —
  Phase-4 merge spine + `(VI SDK UUID, vm_bios_uuid)` cross-snapshot identity +
  canonical collision-suffixed cluster names (the fixed identity basis for
  cross-snapshot VM/cluster matching in DD-B and per-cluster sparklines).
- `.planning/phases/07-os-end-of-support-forecast/07-CONTEXT.md` §D-00 — factual
  presentation precedent (date facts not advice; no editorial verbs) — applies
  to trend/delta labels too; §deferred — "EOS evolution across snapshots →
  Phase 8" is explicitly NOT pulled in (P8 owns trends of headline metrics, not
  an EOS-over-time view unless a TRD requires it).
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/feedback_no_domain_guesses_in_uat.md`
  — describe behavior; user owns ground truth (don't assert which real clusters
  grew/shrank in UAT).
- `~/.claude/projects/-Users-fjacquet-Projects-vatlas/memory/feedback_inline_execution.md`,
  `feedback_replan_on_spec_drift.md`, `feedback_always_update_documentation.md`
  — process constraints (inline visible execution; replan on spec drift; keep
  STATE/ROADMAP/PROJECT in sync before declaring done).

### External data source

- None. P8 introduces **no** external data source — no runtime network (the
  privacy guard throws); all series values derive from parsed RVTools columns.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/engines/parser/captureDate.ts` — shipped `inferCaptureDate(filename,
  mtime, sheets, explicit?)` already implements the explicit → filename-ISO →
  `vMetaData` timestamp → mtime chain; P8 adds only the ordinal tiebreaker
  (D-05) and wires the explicit override through the UI (D-03). Do not
  duplicate the chain.
- `src/store/snapshotStore.ts` — inputs-only `Map<id,Snapshot>` + `setCapturedAt`
  (shipped Phase 6 — reused by D-03), `selectedSnapshotIds`. Any memory-release
  (DD-C) is a new inputs-only mutation that REPLACES the Map (no cached
  aggregates introduced).
- `src/hooks/useEstateView.ts` — the SINGLE sanctioned `useMemo`. Today it
  **merges** selected snapshots into ONE estate via `mergeSnapshotsToEstate`;
  the per-snapshot temporal series must compose **inside this one memo / the
  pure aggregation** — NOT a second memo (grep-gated invariant) and without
  breaking the multi-vCenter merge path (the central architectural tension —
  DD-A).
- `src/engines/aggregation/**` (Phase-2 pipeline incl. `estateView.ts`,
  `globals.ts`, `perCluster.ts`) — the per-snapshot aggregator the temporal
  series calls once per snapshot/point. New pure module (e.g.
  `src/engines/trends/`) with NO React/DOM/Zustand; Vitest-gated ≥75%.
- `src/components/Chart.tsx` (Phase 2, SVG ECharts) — line series for trend
  charts; sparkline = a minimal line series variant on the same component (no
  new chart component).
- `SnapshotListSidebar` (callsite of `selectSortedSnapshots`-style derivation) —
  host for inline-editable `capturedAt` (D-03) and per-snapshot metadata; per
  store comment, sorted-snapshot derivations live at the callsite behind its
  own `useMemo` — confirm this is the *list* memo, distinct from the
  grep-gated single estate memo (not a violation).
- `src/types/snapshot.ts` — `Snapshot.capturedAt/vCenterLabel/rvtoolsVersion`
  already exist (per-timeline-point metadata, criterion 6, is data already
  present — no parser change for metadata).
- `src/utils/format.ts` — locale-aware date/number formatting (temporal axis
  labels + delta numbers; no pre-formatted numbers in i18n strings).

### Established Patterns

- New pure engine module, Vitest-gated ≥75% (mirrors `engines/eos/` precedent);
  temporal series must use **non-uniform real-date** X positions (criterion 2).
- Factual captions + em-dash sentinel; no verdict/color/editorial verb (G1/P7
  D-00 lesson applies to deltas and the warm-up indicator).
- Background parse is **new behavior**: today `useSnapshotUpload` parses
  **sequentially/blocking** (singleton Worker, STRIDE T-05-07). D-01/D-02
  require parsing the latest-date snapshot first and warming the rest without
  blocking the active dashboard — the planner designs the
  ordering/non-blocking mechanism within the singleton-Worker constraint.

### Integration Points

- `EstateView` (or a sibling projection produced by the same pure assembler)
  gains a temporal `trends` shape (per-point aggregates + metadata +
  consecutive deltas), produced in aggregation, consumed via the single memo.
- Dashboard cluster cards gain a sparkline slot fed from the trends projection
  when ≥2 snapshots are loaded (TRD-03).
- Snapshot list gains inline `capturedAt` edit (D-03) + factual
  inferred-order caption (D-05) + warm-up indicator (D-02).
</code_context>

<specifics>
## Specific Ideas

- Warm-up indicator copy intent: factual "trends preparing — N/M" (exact string
  is planner/UI-spec's call within factual/EN-FR/no-editorial-verb constraint).
- Inferred-order caption intent: a neutral factual line stating ordering is
  inferred (not from real capture dates) when D-05's ordinal fallback fires.
- "Current state now, history fills in" is the mental model for D-01/D-02 — the
  latest month is the dashboard; older months are the trend tail.
- Temporal axis must visibly show non-uniform spacing for real example dates
  (e.g. 2026-01-31, 2026-02-15, 2026-03-30) per success criterion 2.
</specifics>

<deferred>
## Deferred Ideas

- **EOS-over-time / at-risk-count trend** — P7 deferred "EOS evolution across
  snapshots" to P8. Only pull in if a TRD requirement demands it; P8's TRD set
  is headline-metric trends + delta + sparklines, not an EOS-specific timeline.
  Note for a future phase if EOS-trend becomes an explicit requirement.
- **Cross-session / persisted trends history** — explicitly OUT (TRD-05 forbids
  it); never revisit without a privacy-invariant change at the project level.
- **HTML/PPTX export of the trends view** → Phase 10 (P8 makes the view
  export-ready via the shared projection shape; does not generate the artifact).
- **Live Optics / multi-format trend input** — out of v1 project scope.

None of the above are acted on in P8.
</deferred>

---

*Phase: 08-in-session-trends*
*Context gathered: 2026-05-17*
