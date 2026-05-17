# Phase 7: OS End-of-Support Forecast - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 07-os-end-of-support-forecast
**Areas discussed:** Catalogue sync & freshness UX, View placement/buckets/drill, ESXi host EOS scope, Unknown-OS handling & feedback

---

## Catalogue sync & freshness UX

### Q: How is the endoflife.date catalogue bundled?

| Option | Selected |
|--------|----------|
| Committed JSON snapshot + refresh script | |
| CI build-step fetch | |
| You decide | ✓ |
**Choice:** You decide (intent: bundled, Zod-validated, zero runtime fetch).

### Q: If endoflife.date unreachable when refreshed/built?

| Option | Selected |
|--------|----------|
| Use last good snapshot + surface staleness | ✓ |
| Fail the refresh (never the deploy) | |
| You decide | |
**Choice:** Use last good snapshot + surface staleness — third-party outage never blocks deploy; CI warns >90d.

### Q: How is freshness surfaced to the user?

| Option | Selected |
|--------|----------|
| Always-visible date + stale chip when >90d | ✓ |
| Footnote only | |
| You decide | |
**Choice:** Always-visible factual verified-date + neutral stale caption >90d.

### Q: Extended-support tiers or single EOL date?

| Option | Selected |
|--------|----------|
| Single EOL date (standard support end) | ✓ |
| Model extended tier, asterisked | |
| You decide | |
**Choice:** Single standard-EOL date; no ELS/ESU modeling.

---

## View placement, bucket semantics & drill

### Q: Where does the EOS view live?

| Option | Selected |
|--------|----------|
| New ViewToggle segment | |
| Dashboard section | |
| You decide | ✓ |
**Choice:** You decide (reuse segmented idiom if a segment).

### Q: How are time buckets defined?

| Option | Selected |
|--------|----------|
| Discrete windows | |
| Cumulative thresholds | |
| You decide | ✓ |
**Choice:** You decide (must include overdue + first-class unknown-OS; counts reconcile).

### Q: Reference date for 'overdue'/horizon?

| Option | Selected |
|--------|----------|
| Snapshot capture date | |
| Today (load date) | ✓ |
| You decide | |
**Choice:** Today (load date) — user explicitly accepted the non-reproducible/wall-clock tradeoff.

### Q: Bucket → affected-VM drill?

| Option | Selected |
|--------|----------|
| Reuse P3 DataTable/drill idiom | |
| You decide | ✓ |
**Choice:** You decide (one-click, reuse existing table, no new component).

---

## ESXi host EOS scope

### Q: Where does ESXi support-state surface?

| Option | Selected |
|--------|----------|
| EOS view only | |
| EOS view + augment P5 Hosts | |
| You decide | ✓ |
**Choice:** You decide (P7 owns classification; no P5 regression).

### Q: ESX hosts unified with VM-OS timeline or separate?

| Option | Selected |
|--------|----------|
| Separate ESXi section | |
| One unified timeline | |
| You decide | ✓ |
**Choice:** You decide (never conflate host vs VM counts).

### Q: ESXi EOS granularity?

| Option | Selected |
|--------|----------|
| Both major + patch, factual | |
| Major version only | |
| You decide | ✓ |
**Choice:** You decide (EOS-04 wants patch+major; only catalogue fields actually present; researcher confirms).

---

## Unknown-OS handling & feedback

### Q: How prominent is the unknown-OS bucket?

| Option | Selected |
|--------|----------|
| First-class bucket beside time buckets | ✓ |
| Separate diagnostics panel | |
| You decide | |
**Choice:** First-class peer bucket; counts reconcile; nothing silently dropped.

### Q: Maintainer-actionable or end-user only?

| Option | Selected |
|--------|----------|
| Show raw strings + counts (both) | |
| Aggregated count only | |
| You decide | ✓ |
**Choice:** You decide (raw strings must be visible somewhere; aggregated-only not acceptable).

### Q: Case-insensitive match, original preserved (Minor-4)?

| Option | Selected |
|--------|----------|
| Yes — case-insensitive, original preserved | ✓ |
| You decide | |
**Choice:** Yes — locked Minor-4 (case-insensitive + whitespace-normalized; original verbatim for display).

---

## Claude's Discretion

Bundling mechanism; build-failure semantics within outage-never-blocks; view placement; bucket scheme; drill wiring; ESXi placement/unified-vs-separate/granularity; unknown-OS presentation — all within locked factual/privacy/reconcile constraints.

## Deferred Ideas

- Extended/paid support tiers (ELS/ESU) — not modeled in P7 (D-04).
- EOS evolution across snapshots → Phase 8.
- HTML/PPTX export of EOS view → Phase 10.
- Snapshot-capture-date as bucket reference — rejected for P7 (load-date chosen).
