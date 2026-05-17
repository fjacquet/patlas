<!-- generated-by: gsd-doc-writer -->
# ADR-0022: Stretched-Cluster Status Is the User's Declaration, Shown with Factual Per-Site Data

**Status:** Accepted
**Date:** 2026-05-17
**Project:** vatlas
**Phase:** 6 — Allocation & DR (re-derived)

## Context

The original stretched-cluster design (old requirement STR-04) computed an
automatic `stretchedConfidence` high/medium/low verdict over each cluster and
surfaced a low-confidence warning chip. The tool was, in effect, judging
whether the user's stretched-cluster call was trustworthy.

Phase-4 UAT (locked decision G1; process rule: no domain guesses in UAT)
rejected this. Whether a cluster is stretched is a fact about the customer's
infrastructure that only the customer knows — vatlas must not assert it, and
must not grade the user's declaration. The legitimate job is to show, factually,
what per-site data the RVTools export does and does not contain.

A known data limitation reinforces this: RVTools `vDatastore` "Hosts" is a
count, not a host-name list, so a datastore cannot be reliably joined back to a
named cluster/site purely from that column (the former STR-04 join). The honest
posture is to show what is present and assume nothing where data is absent.

## Decision

1. Stretched-cluster status is the **user's declaration**. The user toggles a
   cluster's "Étendu / Stretched" pill (STR-01); the tool never auto-derives
   or grades it.
2. Per-site reservation is applied **factually** from real fault-domain data
   when present (Site A / Site B shown, asymmetric splits honoured, e.g. 6+4
   — STR-02), and labelled as such.
3. When no fault-domain metadata exists, the tool assumes a **symmetric
   50 / 50 split** (`SYMMETRIC_FRACTION = 0.5` in
   `src/engines/aggregation/aggregateClusters.ts`) and labels the per-site
   values as assumed (em-dash sentinel for the unknowable per-site figures) —
   it does not guess a specific asymmetric split.
4. The high/medium/low confidence verdict and the low-confidence warning chip
   are **dropped entirely**. STR-03 states the per-site split's provenance
   factually ("detected" vs "assumed"); there is no judgement of the user's
   call. The former STR-04 low-confidence-chip requirement is retired and
   merged into the factual STR-03.

## Rationale

The customer owns the ground truth of which clusters are stretched and what
their fault domains are; vatlas describes the export, it does not adjudicate
the customer's topology. A "detected vs assumed" provenance label is auditable
and honest; a high/med/low grade is an opinion the tool has no basis to issue.
Assuming a symmetric 50 / 50 split where metadata is absent is the minimal,
defensible default — any specific asymmetric guess would be inventing a number,
which violates the project's calc-from-real-data rule. This also keeps the
stretched-cluster posture consistent with the privacy/honesty stance of
ADR-0001: the tool reports what is in front of it, nothing inferred about the
operator's estate is asserted as fact.

## Alternatives Considered

- **Keep the auto confidence verdict + chip.** Rejected by UAT G1: it grades
  the user's declaration, which the tool must not do.
- **Infer a specific asymmetric split when metadata is absent.** Rejected:
  inventing a per-site ratio with no data violates calc-from-real-data; the
  symmetric 50 / 50 default with an "assumed" label is the honest fallback.
- **Auto-detect stretched clusters from RVTools.** Rejected: `vDatastore`
  "Hosts" is a count not a name list (the STR-04 limitation), so a reliable
  datastore→cluster→site join is not available from the export; and the user
  owns this ground truth regardless.

## Consequences

- No `stretchedConfidence` verdict and no low-confidence chip exist. STR-04 is
  retired/merged into the factual STR-03; STR-01/02/03 remain the
  stretched-cluster surface.
- `aggregateClusters.ts` computes a per-resource reservation fraction with a
  factual provenance label: real per-site data → 'detected'; absent/partial
  fault-domain coverage → 'assumed' (symmetric `f = 0.5`, per-site values
  null/em-dash). No confidence grade is emitted.
- The Site-loss DR mode (ADR-0021) consumes only user-declared stretched
  clusters' fault-domain values; with no metadata it inherits the symmetric
  50 % split decided here.
- The known RVTools `vDatastore` "Hosts"-is-a-count limitation is recorded as
  the reason a datastore→cluster→site auto-join is not attempted; it remains a
  documented descope, not a silent gap.
- Reintroducing an automatic stretched verdict, a confidence grade, or a
  specific asymmetric split for no-metadata clusters is forbidden.
