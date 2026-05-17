<!-- generated-by: gsd-doc-writer -->
# ADR-0021: DR Simulation Models Server Loss and Site Loss Only, with Physical Impact

**Status:** Accepted
**Date:** 2026-05-17
**Project:** vatlas
**Phase:** 6 — Allocation & DR (re-derived)

## Context

The shipped Phase-4 DR simulator (`engines/drSim`, old requirements
DRS-01..06) offered four failure modes — host loss, cluster loss, vCenter
loss, and site loss — reported impact partly in vCPU terms, and attached a
high/medium/low `confidence` grade to each scenario.

Phase-4 UAT (locked decision G3 / D-09 / D-10) found the mode set and the
metric wrong:

- Cluster-loss and vCenter-loss are not physical fault domains a customer
  reasons about for DR; they are administrative groupings. The real DR
  questions are "I lose N hosts" and "I lose a site".
- "Site" only has meaning as the fault-domain value of a cluster the **user
  has declared stretched** — vatlas must not assert which clusters are
  stretched (process rule: no domain guesses in UAT).
- DR headroom is a physical-capacity question. Reporting impact in vCPU
  conflates allocation policy with physical loss. The honest unit is physical
  CPU (GHz / cores) and physical RAM (MiB).
- A high/med/low confidence verdict is a judgement of the user's scenario,
  which the tool must not make.

The engine spine itself was real-file-validated and worth keeping; the
decision is to evolve it, not rewrite from zero.

## Decision

1. DR simulation models exactly **two modes**: Server loss and Site loss.
   `DrMode` is the literal union `'server' | 'site'`
   (`src/types/estate.ts`). Cluster-loss and vCenter-loss are dropped
   entirely.
2. **Server loss** (DRX-01) supports both an individual named-host
   multi-select and a per-cluster "N of M hosts in cluster X" stepper. The
   shipped reversible/neutral failed-selection UI is kept (no red, no alarm
   icon, no confirmation dialog).
3. **Site loss** (DRX-02): a "site" is the fault-domain value of a cluster
   the user declared stretched (Site A / Site B). The engine removes that
   site's physical hosts. Non-stretched workload physically at the lost site
   is surfaced as an explicit factual "lost — no DR target" line. When no
   fault-domain metadata exists, a symmetric 50 % split is assumed (see
   ADR-0022).
4. DR impact is reported as **physical CPU removed (GHz / cores) + physical
   RAM removed (MiB)** — never vCPU. The per-survivor verdict is computed
   against physical headroom using the reused `Verdict` enum, rendered as a
   factual word + numbers with no colour / traffic-light (DRX-03).
5. There is **no `confidence` indicator anywhere**. The high/med/low clause is
   removed entirely; the factual `caveats[]` array (i18n key suffixes, no
   editorial verb, no number) and the explicit assumptions panel are kept and
   updated to the two-mode/physical model (DRX-04, DRX-05).
6. A single in-panel "Apply planned ratios to this scenario" affordance
   (Custom Failover — not a 3rd mode) re-runs the same Server/Site sim with
   the planning lens's planned ratios (ADR-0020), never conflated with the
   measured DR result (DRX-06).

## Rationale

Server loss and site loss are the only failure boundaries that map to physical
fault domains a customer can reason about for DR. Physical CPU/RAM is the
honest impact unit — vCPU answers an allocation question, not "did the
survivors have the iron". Removing the confidence grade removes a judgement of
the user's scenario the tool has no basis to make; the factual caveats array
keeps the disclosed assumptions without editorializing. Keeping the validated
`drSim` engine and reworking it in place (rather than rewriting) preserves the
real-file validation already invested.

## Alternatives Considered

- **Keep all four modes.** Rejected by UAT G3: cluster/vCenter loss are
  administrative, not physical, fault domains.
- **Report DR impact in vCPU.** Rejected (D-09): conflates allocation policy
  with physical capacity loss; the survivor question is physical.
- **Keep the confidence grade.** Rejected (D-10): it judges the user's
  scenario; the factual caveats array carries the disclosed assumptions
  instead.
- **Rewrite the DR engine.** Rejected: the shipped engine spine was
  real-file-validated; the analytics-core replan mandate is keep-and-evolve.

## Consequences

- `engines/drSim` is evolved, not rewritten. `runScenario.ts` keys on
  `failedHosts` / `failedSites`; `dominantMode` resolves `'site'` when
  `failedSites.size > 0` else `'server'`. No `confidence` token exists in
  `runScenario.ts`.
- `DrSimResult` reports physical impact via branded `GHz` / `Cores` / `MiB`
  (`src/types/estate.ts`); no vCPU impact field.
- `DrSimPanel` is reworked in place to the two-mode physical-impact model:
  Server multi-select + per-cluster stepper, Site fault-domain picker + the
  factual "lost — no DR target" line, single gold physical CPU/RAM figure, a
  single Custom-Failover checkbox switching `view.drSim` ↔
  `view.plannedDrSim`. No `useMemo` (pure presenter).
- `dr.json` EN/FR are reworked with identical flattened key sets and carry no
  `confidence.*` keys and no `mode.host|cluster|vcenter` keys.
- Reintroducing a cluster-loss / vCenter-loss mode, a vCPU impact metric, or a
  confidence grade is forbidden.
