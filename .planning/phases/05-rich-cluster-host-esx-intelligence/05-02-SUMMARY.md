---
phase: 05-rich-cluster-host-esx-intelligence
plan: 02
subsystem: ui
tags: [view-toggle, hosts-view, operational-insights, cluster-detail, drill, i18n]

requires:
  - phase: 05-01
    provides: EstateView.operationalInsights/clusterInsights/clusterDetail + EsxAggregate fields
provides:
  - "ViewToggle 'Hosts' segment (3-way) + App wiring"
  - "HostsView — estate host-rollup + expandable per-cluster host tables (factual model/vendor/ESXi)"
  - "OperationalInsights estate tile row (alongside kept GlobalSummaryCard)"
  - "Cluster-card drill → one-screen-fit ClusterDetail (export-ready for P10) + back"
  - "rci i18n namespace (EN/FR parity); REQUIREMENTS RCI-01..05"
affects: [07, 10]

tech-stack:
  added: []
  patterns:
    - "Drill = lifted in-app view state (like `mode`) — no router, no 2nd useMemo"
    - "ViewToggle/idiom reuse for the 3rd segment (no new nav component)"

key-files:
  created:
    - src/components/hosts/HostsView.tsx
    - src/components/dashboard/OperationalInsights.tsx
    - src/components/cluster/ClusterDetail.tsx
    - src/i18n/locales/en/rci.json
    - src/i18n/locales/fr/rci.json
  modified:
    - src/components/ViewToggle.tsx (+ 'hosts')
    - src/App.tsx (hosts branch)
    - src/components/dashboard/ClusterColumn.tsx + PerClusterColumns.tsx (onSelectCluster drill)
    - src/components/dashboard/GlobalDashboard.tsx (insights row + drill state)
    - src/engines/aggregation/perEsx.ts + src/types/estate.ts (EsxAggregate factual host fields)
    - src/i18n/index.ts + locales/{en,fr}/inventory.json (nav.hosts) + rci registration
    - .planning/REQUIREMENTS.md (RCI-01..05)

key-decisions:
  - "EsxAggregate extended (faultDomain/model/vendor/esxVersion/poweredOnVms) — additive, pure, needed by the Hosts view"
  - "Drill replaces the dashboard body in-place (lifted state); ClusterDetail is overflow-hidden one-screen-fit for P10 snapshot"

patterns-established:
  - "One-screen-fit detail view = the Phase-10 PPTX slide unit"

requirements-completed: [RCI-01, RCI-02, RCI-03, RCI-04, RCI-05]

duration: ~1 session (inline)
completed: 2026-05-17
---

# Phase 5 Plan 02: UI — Summary

**A new "Hosts" view (estate rollup + per-cluster drill), an estate Operational-Insights tile row beside the kept GlobalSummaryCard, and a cluster-card → one-screen-fit ClusterDetail drill — all pure consumers of the single useEstateView, every value calculated from real RVTools data, validated on the real allvCenters estate.**

## Performance

- **Completed:** 2026-05-17 (inline)
- **Tasks:** 2 of 2
- **Files:** 5 created, 12 modified

## Accomplishments

- ViewToggle → 3 segments (idiom reused verbatim; CI `role="group"` grep gate intact). `App` routes the `hosts` branch.
- `HostsView`: estate host-rollup + expandable per-cluster host tables; model/vendor/ESXi/fault-domain plain factual text, em-dash when absent (no lifecycle verdict — Phase 7 owns ESXi support-state). `perEsx`/`EsxAggregate` extended (additive, pure).
- `OperationalInsights` estate tile row mounted alongside the **kept** `GlobalSummaryCard`.
- Cluster card = drill entry → `ClusterDetail` (one-screen-fit, `overflow-hidden`, sized so Phase 10 = 1 PPTX slide/cluster) + back; drill is lifted `useState` (no router, **single-`useMemo`=2 intact**).
- `rci` i18n EN/FR parity (37 keys); `REQUIREMENTS.md` RCI-01..05 + tracking rows.
- Full suite **311/311**, tsc/biome/supply-chain/bundle green.

## Task Commits

1. `feat(05-02)` ViewToggle + App + HostsView + rci/nav i18n
2. `feat(05-02)` OperationalInsights row + ClusterColumn drill + ClusterDetail + REQUIREMENTS

(committed as one `feat(05-02)` — both tasks verified together; plan-checker disabled.)

## Real-File UAT (mandatory — feedback_real_file_uat)

Throwaway harness vs real `allvCenters.xlsx` (deleted; never committed):

- Estate: overcommit **1.58**, avg CPU **27.8 %**, avg mem **39.9 %**, power **1373 on / 43 off / 0 susp / 30 templates** (exact Powerstate enum + Template working), guest data **400 921 803 MiB** (real vPartition — present, not an invented 0).
- **19 clusterInsights == 19 clusterDetail** (every cluster covered, estate + per-cluster principle).
- Host sample: model `UCSB-B200-M6`, vendor `Cisco Systems Inc`, ESXi `VMware ESXi 8.0.3 build-25067014`, faultDomain `""`, poweredOnVms `20` — factual text, no verdict.

## Deviations from Plan

- `EsxAggregate` (+ perEsx) extended with the factual host fields + `poweredOnVms` — required by the Hosts view; additive/pure, adjacent to 05-01's data work. No scope creep.
- Standing single-`useMemo` grep note (2 real call sites; drill is `useState`, not a memo). Browser drag/visual UAT (does the screen truly fit one slide visually) is the user's `gsd-verify-work` step — engine outputs the UI binds are real-file-proven.

**No scope creep.** Networks/vSAN deferred to P9 as planned.

## Issues Encountered

A few generic test builders (EsxAggregate/VHostRow literals) needed the new required fields — conformed (full-line-anchored bulk + one hand fix). No functional impact.

## User Setup Required

None.
