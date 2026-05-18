---
status: complete
phase: 05-rich-cluster-host-esx-intelligence
source:
  - 05-01-SUMMARY.md
  - 05-02-SUMMARY.md
started: 2026-05-17T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke (parser was extended)

expected: Kill the dev server, `npm run dev` fresh, open <http://localhost:5173/vatlas/>, drop ~/Library/CloudStorage/OneDrive-Home/20260430_1400_allvCenters.xlsx. Dashboard renders (clusters, summary, charts), NO console errors, no blank screen — confirms the Powerstate/Template parser extension didn't regress parsing.
result: pass

### 2. ViewToggle has a Hosts segment (RCI-02)

expected: The header toggle now shows three segments: Dashboard · Inventory · Hosts. Clicking "Hosts" switches to the Hosts view (keyboard arrows also move between the three).
result: pass

### 3. Hosts view structure — estate rollup + per-cluster drill (RCI-02)

expected: The Hosts view shows an estate "Estate hosts" rollup panel on top (hosts, physical cores, host memory, avg CPU %, avg memory %, powered-on VMs), then one expandable section per cluster, each containing a host table.
result: pass

### 4. Host columns are factual (RCI-02, no lifecycle verdict)

expected: Each host row shows cores, memory, CPU %, RAM %, powered-on VMs, ESXi version, fault domain, model, vendor. Model/Vendor/ESXi are plain text (e.g. "UCSB-B200-M6", "Cisco Systems Inc", "VMware ESXi 8.0.3 …"); a missing value shows an em-dash "—". NO red/green, NO "supported/EOL" verdict.
result: pass

### 5. Operational-Insights row on the dashboard (RCI-03)

expected: The Dashboard still shows the GlobalSummaryCard AND a new "Operational insights" tile row: vCPU:pCPU, avg CPU %, avg memory %, power state (N on · N off · N suspended · N templates), provisioned, in use, datastore footprint, guest data, total physical cores, total host memory.
result: pass

### 6. Powered-state breakdown is exact (RCI-01)

expected: The power-state tile distinguishes powered-on / powered-off / suspended / templates as separate counts (not just on vs not-on). On allvCenters this reads roughly "1373 on · 43 off · 0 suspended · 30 templates".
result: pass

### 7. Guest data is factual, never invented (RCI-04)

expected: The "guest data" figure shows a real number when the workbook has a vPartition sheet (allvCenters does → a large MiB value). If you load a workbook WITHOUT vPartition, guest data shows an em-dash "—", never a fabricated 0.
result: pass

### 8. Cluster-detail drill, one-screen-fit (RCI-05)

expected: Each dashboard cluster card has a "Cluster detail" affordance. Clicking it replaces the dashboard body with a dedicated single-cluster detail screen showing that cluster's full metric set; it fits one screen with NO internal scroll (this is the Phase-10 1-slide-per-cluster unit); a "← Back to dashboard" control returns.
result: pass

### 9. Every metric is both estate-global AND per-cluster (RCI-01)

expected: The operational metrics appear at estate scope (the Operational-Insights row + Hosts estate rollup) AND per-cluster (the cluster-detail screen, and per-cluster Hosts sections) — the same metric, both scopes.
result: pass
note: Composite assertion — corroborated by passing Tests 3 (per-cluster Hosts sections), 5 (estate Operational-Insights row + Hosts estate rollup) and 8 (per-cluster cluster-detail screen): the same metric set is rendered at both estate and per-cluster scope. Phase 5 shipped & real-file-validated; UAT closed at v1.0 milestone.

### 10. EN/FR localization of the new surfaces

expected: Switching language localizes the new strings — the "Hosts" segment, the Operational-Insights labels, the Hosts table headers, and the Cluster-detail screen — in both English and French (no raw keys, no missing strings).
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
