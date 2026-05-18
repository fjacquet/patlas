---
phase: 09-storage-network-detailed-views-threshold-alerting
plan: 05
subsystem: ui
tags: [react, network, esx-detail, real-file-gate, vsan, str-04]

requires:
  - phase: 09-storage-network-detailed-views-threshold-alerting
    provides: "plan 04 — view.network/view.vsan/datastoreDetail surface + ViewToggle Network segment"
provides:
  - NetworkView (vSwitch/dvSwitch/vNetwork tables + factual optional-sheet degrade)
  - EsxDetail drill augmenting HostsView (lifted state, not the P5 cluster drill)
  - the MANDATORY env-guarded real-file vSAN relink STR-04 regression gate
affects: [10]

tech-stack:
  added: []
  patterns:
    - "Env-guarded real-file test (canary.test.ts pattern) — asserts when present, skips in CI"

key-files:
  created:
    - src/components/network/NetworkView.tsx (+test)
    - src/components/inventory/columns/networkColumns.ts
    - src/components/hosts/EsxDetail.tsx (+test)
    - src/components/hosts/HostsView.test.tsx
    - src/i18n/locales/{en,fr}/network.json
    - src/engines/aggregation/vsanRelink.realfile.test.ts
  modified:
    - src/components/hosts/HostsView.tsx
    - src/i18n/index.ts
    - src/i18n/locales/{en,fr}/inventory.json
    - src/App.tsx

key-decisions:
  - "Per-host datastore NAMES rendered as em-dash + factual note (vDatastore.Hosts is a COUNT — binding memory; never fabricated)"
  - "EsxDetail drill state lifted into HostsView (GlobalDashboard precedent) — augments, does not duplicate the P5 cluster drill (D-06)"

patterns-established:
  - "Network factual-degrade: single caption line when the OPTIONAL network sheets are absent (no crash/icon/verb)"

requirements-completed: [NET-05, DTL-03, VSR-05]

duration: ~75min
completed: 2026-05-18
---

# Phase 9 Plan 05: Network UI + ESX detail + real-file gate Summary

**NetworkView (3 tables + factual degrade), the ESX storage+network drill augmenting Hosts, and the MANDATORY real-file vSAN relink gate that RAN on the present 75-blank-cluster workbook and PASSED — STR-04 closure proven on real data. Full suite 409/409.**

## Performance
- **Completed:** 2026-05-18
- **Tasks:** 3
- **Files:** ~14 created/modified

## Accomplishments
- NetworkView: vSwitch / dvSwitch / vNetwork P3 DataTable sections; single factual `network:empty.unavailable` line when network sheets absent (no crash/icon/verb — D-11)
- networkColumns + 9 new `inventory:col.<id>` keys (EN/FR); network i18n namespace registered (EN/FR parity)
- EsxDetail screen-fit ClusterDetail-idiom drill (per-host vSwitch/dvSwitch) wired into HostsView via lifted state — augments Hosts, not the P5 cluster drill (D-06); per-host datastore names = em-dash + factual note (binding memory)
- **The MANDATORY real-file vSAN relink STR-04 gate** — env-guarded; the named workbook IS present locally so the gate RAN (not skipped) and the `attributed.size > 0` assertion PASSED → the relink resolves a non-zero count of blank-cluster datastores on real data (D-09 closure). Skips gracefully (`describe.skip` + logged reason) when absent (CI).

## Task Commits
1–3. **Network UI + ESX detail + real-file gate** - `894b685` (feat)

## Decisions Made
- "Datastores mounted per host" is **not derivable** from RVTools (`vDatastore.Hosts` is a count, not names — binding `rvtools-vdatastore-hosts-is-count` memory): EsxDetail shows the em-dash sentinel + a factual one-line note, never a fabricated list (calc-from-real-data / no-domain-guesses).
- The real-file test asserts a **non-zero lower bound** (`toBeGreaterThan(0)`), never a brittle exact count (per the plan).

## Deviations from Plan
**1. [Plan-criterion nuance]** `grep -c "useEstateView" NetworkView.tsx` = 3 (import + comment + the ONE call); the real invariant (exactly one `useEstateView` call, zero `useMemo(` in `network/`+`hosts/`) holds — same grep-vs-intent nuance noted in prior plans.
No other deviations — plan executed as written.

## Issues Encountered
- **No live browser verification** (environment constraint, disclosed): NetworkView/EsxDetail verified by component tests + tsc + Biome + bundle ONLY, not visually.
- **Pre-existing, OUT OF SCOPE (carried since 09-01):** `biome check .` reports ONLY the `package.json` formatting nit — untouched, dependency-sensitive, flagged for user decision. Every P9-touched file is biome-clean.

## User Setup Required
None.

## Next Phase Readiness
- Phase 9 fully implemented (5/5 plans). The STR-04 vSAN under-count is closed and **proven on the real workbook**. Storage + Network + detail drills + threshold alerting all consume the single `useEstateView` surface; export-ready (screen-fit) for Phase 10.
- Recommended next: `/gsd-verify-work 9` (UAT) and a human browser pass over the 5 new screens (not possible in this environment); then resolve the pre-existing `package.json` biome nit.

---
*Phase: 09-storage-network-detailed-views-threshold-alerting*
*Completed: 2026-05-18*
