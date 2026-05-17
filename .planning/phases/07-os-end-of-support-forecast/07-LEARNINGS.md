---
phase: 07
phase_name: "os-end-of-support-forecast"
project: "vatlas"
generated: "2026-05-17"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "07-VERIFICATION.md"
  - "07-UAT.md"
---

# Phase 07 Learnings: os-end-of-support-forecast

## Decisions

### Catalogue bundling: committed JSON snapshot via `sync:eos`, not a CI fetch
A maintainer-run `npm run sync:eos` regenerates a committed `catalogue.json`; CI only Zod-validates it and emits a warn-only freshness annotation. The deploy path never fetches.

**Rationale:** Makes "third-party outage never blocks deploy" (D-02) a *structural* guarantee rather than error-handling — the deploy can't fetch, so it can't fail on a fetch. Decided on the determinism-vs-freshness tradeoff (D-01 was Claude's discretion).
**Source:** 07-01-PLAN.md, 07-01-SUMMARY.md, 07-RESEARCH.md

### Single standard-support EOL model (no paid-tier fields)
The Zod schema, snapshot, and sync projection model only `eolFrom`; no paid extended-support (ESU/ELS) fields. An OS past standard EOL but under paid support still buckets overdue.

**Rationale:** D-04 — simpler and deterministic; "standard support ended" is factually true regardless of paid extensions.
**Source:** 07-01-SUMMARY.md, 07-CONTEXT.md

### EOS projection types live in `@/types/estate`, not in the engine
`EosProjection`/`EosRow`/`EsxiHostRow`/`EosBucketKey` are defined in `@/types/estate`; `bucketEos.ts` imports them type-only and re-exports.

**Rationale:** Preserves the established types→engines import direction. Defining them in the engine and importing into `estate.ts` would form a types↔engines cycle (the plan anticipated this and made it Claude's call).
**Source:** 07-03-SUMMARY.md, 07-03-PLAN.md

### EOS drill reuses the generic DataTable via an inline `ColumnDef<EosRow>` config
The five entity buckets drill into the shipped generic `DataTable` with an inline EOS column config — not the literal `vmColumns`/`esxColumns` the plan text named.

**Rationale:** D-08 ("reuse the shipped DataTable, no new table component"). `vmColumns`/`esxColumns` are typed to different row shapes (`VmDisplayRow`/`EsxAggregate`); `EosRow` is a distinct projection. A per-object column config feeding the one DataTable primitive is exactly how vm/esx/datastore already work — column config is config, not a component.
**Source:** 07-03-SUMMARY.md

### "<5% unknown-OS" metric = occurrence-weighted, not per-distinct
The EOS-05 / criterion-5 threshold is measured on a realistic occurrence-weighted distribution; a separate per-distinct assertion proves the expected-unknown set is exactly the honest long tail.

**Rationale:** RESEARCH open question A4 framed the 5% as occurrence-weighted; the harvested fixture deliberately over-represents unknowns to exercise the D-10/D-11 bucket, so a literal per-distinct <5% on it is unsatisfiable. Escalated to the user, who chose occurrence-weighted.
**Source:** 07-02-SUMMARY.md, 07-RESEARCH.md

### Bucket scheme: disjoint partition is the reconciliation source; cumulative tiles are a derived display overlay
The engine produces a disjoint 7-bucket partition that sums exactly to the VM total; the UI shows cumulative `≤+N` tiles derived from it; reconciliation is computed from the partition, never the cumulative sum.

**Rationale:** D-06 + UI-SPEC Open Item 2 — cumulative answers the user's real question and scans monotonically, while the disjoint partition keeps counts reconcilable with nothing double-counted or dropped.
**Source:** 07-02-SUMMARY.md, 07-UI-SPEC.md

---

## Lessons

### `grep -c "<token>" == 0` acceptance gates trip on doc-comments that name the forbidden token
Multiple plans gated on a literal token count being 0 (paid-tier field names, `new Date(`, the catalogue domain, VM-OS field names, the React raw-HTML prop). Doc-comments documenting a token's *deliberate absence* contain the token and fail the gate.

**Context:** Recurred in 07-01, 07-02, 07-03 and again in the SUMMARY/LEARNINGS docs (a security hook blocks the raw-HTML token in prose too). Each fix reworded the comment to preserve the rationale without the literal token — pure documentation change, no behavior impact. Future plans: write grep-gated absence comments without the literal token, or gate on source AST not raw grep.
**Source:** 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md

### `DataTable` resolves visible headers via `useTranslation('inventory')` → `t('col.<id>')`; `headerFor` is CSV-only
A new column whose `id` has no `inventory:col.<id>` key renders the raw key string in the header. The `headerFor` prop only feeds the CSV export.

**Context:** The EOS drill's `eolFrom` column printed `col.eolFrom` because the EOS-only id had no key in `inventory.json`. Any future DataTable consumer must add its column-header keys under `inventory.json` `col.*` regardless of namespace used elsewhere in the view.
**Source:** 07-03-SUMMARY.md

### A plan that names a concrete symbol can be type-incompatible with the actual data
07-03 literally said `columns={vmColumns|esxColumns}`, but those are typed to `VmDisplayRow`/`EsxAggregate`; the EOS drill row is a distinct `EosRow`. Following the plan text verbatim would not compile.

**Context:** Plans specify intent; when a named symbol doesn't fit the real types, the in-spirit, type-safe reading wins (here: the DRY-consistent per-object column config). Worth a planner check that named reuse targets are type-compatible with the new data shape.
**Source:** 07-03-SUMMARY.md

### Self-contradictory acceptance criteria should be escalated, not silently reinterpreted
The "<5% unknown per-distinct" criterion contradicted its own fixture (deliberately unknown-salted). Rather than pick a definition, execution paused and asked the user.

**Context:** Aligns with the standing "replan/escalate on spec drift" guidance. The cheap moment to resolve a metric ambiguity is before writing the assertion, not after fabricating a passing test.
**Source:** 07-02-SUMMARY.md

### Checkpoint UAT catches whole-component bugs unit tests can't
337 green unit tests did not catch the `DataTable` header/body misalignment (a CSS layout desync) or the raw-key header — both surfaced only at the human-verify checkpoint with a real workbook.

**Context:** Virtualized-table layout and i18n-key resolution are integration/visual concerns. The blocking human-verify checkpoint earned its keep here; consider a lightweight rendered-DOM assertion for table header/body column parity.
**Source:** 07-03-SUMMARY.md

---

## Patterns

### Zod-only-at-boundary applied to bundled third-party data
`catalogueSchema.ts` is the sole `zod` importer under `src/engines/eos/`; `catalogue.ts` parses the committed JSON once at module scope; engines receive the typed value as a parameter.

**When to use:** Any bundled/static third-party data file consumed by pure engines — mirror the parser-schema boundary exactly (one validating module, engines stay Zod-free).
**Source:** 07-01-SUMMARY.md, 07-RESEARCH.md

### Pure engines take the catalogue and the reference clock as injected parameters
`buildEosProjection({ vinfo, vhost, catalogue, today })` never reads a global clock or imports the JSON; `today` and the typed catalogue are passed in from the boundary.

**When to use:** Any wall-clock-coupled or external-data-coupled pure engine — inject the dependency so tests are deterministic and the engine stays pure (no self-constructed clock inside; use `Date.UTC`/`Date.parse`).
**Source:** 07-02-SUMMARY.md, 07-02-PLAN.md

### Disjoint partition for reconciliation + cumulative overlay for display
Compute one disjoint partition that sums to the entity total (the reconcilable truth); derive any cumulative/overlapping presentation counts from it; never reconcile off the overlay.

**When to use:** Any bucketed view where the UI wants cumulative "within N" tiles but the data integrity contract requires "nothing dropped / nothing double-counted".
**Source:** 07-02-SUMMARY.md, 07-UI-SPEC.md

### Virtualized table header must mirror the body's flex column sizing
A `@tanstack/react-virtual` body uses `flex w-full` rows with `flex-1` cells; the `<thead>` must use the *same* flex layout (`flex w-full` row, `flex flex-1 … px-3` cells), not default table-cell sizing, or header and body columns desync.

**When to use:** Any virtualized table where header and body are separate DOM subtrees — share the exact column-sizing mechanism between them.
**Source:** 07-03-SUMMARY.md

### Forward-compat projection field: type in `@/types`, frozen empty in `EMPTY_VIEW`, composed in the single pass
`EstateView.eos` follows the shipped `plannedView`/`trends`/`EMPTY_INSIGHTS` idiom — typed in `@/types/estate`, a frozen `EMPTY_EOS` for the empty view, computed inside the one `buildEstateView` pass (no second memo).

**When to use:** Adding any new derived projection to `EstateView` — reuse this idiom verbatim to preserve the single-memo invariant and the types→engines direction.
**Source:** 07-03-SUMMARY.md, 07-01-SUMMARY.md

---

## Surprises

### A pre-existing CI lint failure, unrelated to the phase, was blocking all runs
`.planning/tmp/docs-work-manifest.json` failed the Biome lint step (1 error) on the branch before Phase 7 work began, failing every CI run.

**Impact:** Discovered mid-Task-1 only because the user asked to check GH Actions. Fixed (Biome autofix, separate `chore:` commit) with user approval — unblocked CI for all subsequent Phase 7 pushes. A stray modified tmp file silently red-lit CI.
**Source:** 07-01-SUMMARY.md

### The DataTable header/body misalignment was pre-existing in every shipped table consumer
The flex/table-cell header desync affected the shipped VM/ESX/datastore tables (P3) too — it had simply never been reported until the EOS drill put it in front of the user.

**Impact:** A Phase-7 checkpoint surfaced and fixed a latent P3 bug; the fix improves four consumers at once. Earlier phases' UAT did not catch it.
**Source:** 07-03-SUMMARY.md

### endoflife.date exposes ESXi EOL at MAJOR version only — no patch-level date exists
Live verification confirmed ESXi releases are `9.0/8.0/7.0/…` with one `eolFrom` per major; there is no patch/build EOL field anywhere.

**Impact:** D-09c's "patch level = em-dash sentinel" is a confirmed catalogue *fact*, not an implementation gap — it removed an entire risky lookup path (EOS-04 could not have done per-build EOL even if asked).
**Source:** 07-02-SUMMARY.md, 07-RESEARCH.md

### `npm run sync:eos` reached endoflife.date live during execution
The privacy guard is a runtime *app* guard; Node scripts are not subject to it, so the sync script fetched the real 11-product catalogue rather than falling back to the hand-authored minimal snapshot.

**Impact:** The committed `catalogue.json` is the real live snapshot (lastVerified 2026-05-17, ESXi 8.0→2027-10-11 / 7.0→2025-10-02, RHEL 10–4) — higher fidelity than the plan's fallback path assumed.
**Source:** 07-01-SUMMARY.md
