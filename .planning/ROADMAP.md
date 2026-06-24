# Roadmap: patlas

## Milestones

- ✅ **v1.0 Proxmox Atlas (MVP)** — Phases 1–11 (shipped 2026-05-19) — full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Offline-Capable, Redesigned, Better Deck** — Phases 12–18 (shipped 2026-05-20) — full detail: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1.0 Proxmox-Native Views** — Snapshot Sprawl, Storage Content, Cluster Health + `.zip` upload fix (shipped 2026-06-24)

## Phases

<details>
<summary>✅ v1.0 Proxmox Atlas (MVP) — Phases 1–11 — SHIPPED 2026-05-19</summary>

- [x] Phase 1: Foundation & Invariants (5/5) — 2026-05-15
- [x] Phase 2: Aggregation & Global Dashboard (3/3) — 2026-05-16
- [x] Phase 3: Inventory Navigation (3/3) — 2026-05-16
- [x] Phase 4: Cluster Merge & Factual Labels (2/2) — 2026-05-17
- [x] Phase 5: Rich Cluster / Node Intelligence (2/2) — 2026-05-17
- [x] Phase 6: Allocation & Capacity (re-derived) (3/3) — 2026-05-17
- [x] Phase 7: OS End-of-Support Forecast (3/3) — 2026-05-17
- [x] Phase 8: In-Session Trends (3/3) — 2026-05-17
- [x] Phase 9: Storage / Network / Detailed Views + Threshold Alerting (5/5) — 2026-05-18
- [x] Phase 10: HTML + PPTX Exports & Deploy (5/5) — 2026-05-18
- [x] Phase 11: Report & deck gap closure — v1.0 audit F-2/F-1 (6/6) — 2026-05-19

</details>

<details>
<summary>✅ v2.0 Offline-Capable, Redesigned, Better Deck — Phases 12–18 — SHIPPED 2026-05-20</summary>

- [x] Phase 12: Privacy governance — ADR-0001 SW exception + supply-chain gate (GOV) — 2026-05-19
- [x] Phase 13: Installable, fully-offline PWA (PWA) — 2026-05-19
- [x] Phase 14: Navigation IA — vertical nav (NAV) — 2026-05-19
- [x] Phase 15: Visual redesign — KPI tile system (UIX) — 2026-05-19
- [x] Phase 16: Capacity Planning visual return (PLN) — 2026-05-19
- [x] Phase 17: PPTX quality overhaul (PPT) — 2026-05-19
- [x] Phase 18: PPTX rebuild + web layout + Proxmox UX — 2026-05-20

Executed inline (atomic commits, gate-verified). Full detail + per-phase success criteria archived in [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md).

</details>

<details>
<summary>✅ v2.1.0 Proxmox-Native Views — SHIPPED 2026-06-24</summary>

- [x] Snapshot Sprawl view (guest snapshots: count, guests-with-snapshots, total size, oldest age; excludes Proxmox `current` marker)
- [x] Storage Content view (per-storage content-type breakdown: images/rootdir/iso/vztmpl/backup; backup-file inventory with per-guest recency)
- [x] Cluster Health view (HA quorum/fencing service state, HA-managed guest resources, scheduled backup jobs; `extractStackedSection` helper for composite Cluster sheets)
- [x] Fix `.zip` upload bug — upload zone now accepts Proxmox `.zip` report bundles in addition to bare `.xlsx`
- [x] Inherited analytics relabeled to Proxmox; DR analysis removed

All three views are web-only (excluded from HTML report + PPTX deck by design).

</details>

## Progress

| Milestone | Phases | Status | Shipped |
|-----------|--------|--------|---------|
| v1.0 Proxmox Atlas (MVP) | 1–11 | ✅ Complete — released & deployed | 2026-05-19 |
| v2.0 Offline-Capable, Redesigned, Better Deck | 12–18 | ✅ Complete — installable PWA, redesigned UI, vatlas-grade deck | 2026-05-20 |
| v2.1.0 Proxmox-Native Views | — | ✅ Complete — Snapshot Sprawl, Storage Content, Cluster Health; `.zip` fix | 2026-06-24 |

Full v1.0 detail archived in [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · v2.0 in [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md). Audits: [v1.0](milestones/v1.0-MILESTONE-AUDIT.md) · [v2.0](milestones/v2.0-MILESTONE-AUDIT.md).

---
*v2.1.0 shipped 2026-06-24 — three Proxmox-native views (Snapshot Sprawl, Storage Content, Cluster Health) + `.zip` upload fix. Prior: v2.0 (2026-05-20) — installable offline PWA, KPI-tile redesign, Capacity Planning visual return, vatlas-grade brand-free PPTX deck. Carry-forward: consolidated Playwright UAT (offline cold-boot, web-layout) + UIX icon exact-set + DE/IT native terminology review. Next milestone: `/gsd-new-milestone`.*
