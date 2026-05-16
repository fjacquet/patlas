---
status: complete
phase: 04-multi-vcenter-stretched-allocation-dr
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
started: 2026-05-16T00:00:00Z
updated: 2026-05-16T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test

expected: Fresh `npm run dev` → drop the real allvCenters.xlsx → dashboard renders (clusters, summary, charts), no console errors, no blank screen.
result: pass

### 2. Multi-vCenter merge from one workbook (MVC-01/02)

expected: The single allvCenters.xlsx (1 file, 3 vCenters) yields ONE merged estate. The snapshot card reads "3 vCenters" (not "1 vCenter"); the dashboard shows clusters from all three vCenters.
result: pass

### 3. Correct RVTools version + per-vCenter labels (MVC-04)

expected: The snapshot card shows the parsed RVTools 4.x version (e.g. "RVTools 4.7.x") — NOT "3.11+" — and the per-vCenter Server labels stacked below the vCenter count.
result: pass

### 4. Cluster-name collision suffix (MVC-02)

expected: Where a cluster name repeats across distinct vCenters, both render with a vCenter-label suffix like "CL_X (vc-a.local)" / "CL_X (vc-b.local)" — never silently combined into one.
result: skipped
reason: No colliding cluster name across vCenters in allvCenters.xlsx; collision behavior covered by Test 5 (two separate files).

### 5. Multi-FILE merge, no double-count (MVC-01/03)

expected: Drop a SECOND separate RVTools .xlsx alongside the first. One merged estate; the global VM total equals the sum of the per-vCenter totals (a vMotion'd/duplicate VM is counted once, not twice).
result: pass

### 6. Stretched pill — per-site reservation + confidence (STR-01/02/03)

expected: On the CL_VXB1K_CORE cluster card, clicking the "Étendu / Stretched" pill turns it active (filled) and reveals Site A / Site B GHz rows, a Reservation % row (~50%), and a "Confidence: high" row.
result: pass

### 7. Low-confidence neutral chip (STR-04 — display)

expected: Toggle Stretched on a cluster with NO fault-domain tags. A neutral GREY "site data inferred" chip appears (never red, no alarm icon); reservation shows ~50%, confidence "low".
result: issue
reported: "the spec is wrong, I decide if the cluster is stretch so you can adapt the performance metrics. this is my spec"
severity: major
decision: "Keep value, drop the judgement (factual site-data present/inferred, NO high/med/low verdict, NO chip); no fault-domain metadata ⇒ assume symmetric 50%. Stretched flag = user's sole decision."

### 8. Allocation slider → URL hash, no localStorage (ALC-01/03)

expected: Move the CPU slider from 4:1 to 8:1. Cluster headroom/verdict figures recompute; the URL hash becomes `#alloc=cpu:8,ram:1`. DevTools → Application → Local Storage shows NO new key (only vatlas-theme / vatlas-lang may exist).
result: issue
reported: "I should get calculation not invent/select them"
severity: major
decision: "Allocation ratio = CALCULATED vCPU allocated ÷ physical cores (realized vcpuPerPcpu), displayed as a measured output. Remove the ALC slider+preset toolbar, useAllocationHash URL-hash codec, and allocRatios threading entirely. ALC-01..04 as built is rejected."

### 9. Allocation reload survival (ALC-01)

expected: With the URL at `#alloc=cpu:8,ram:1`, reload the page (re-drop the workbook if needed). The CPU slider restores to 8:1, not the 4:1 default.
result: skipped
reason: Obsoleted by Test 8 decision — the allocation slider + URL-hash are being removed (ratio is calculated, not selected/persisted).

### 10. Allocation presets (ALC-02)

expected: Clicking the "VDI 10:1" preset sets both sliders (CPU 10). Then nudging a slider by hand leaves NO preset highlighted (the active preset clears — factual, no error).
result: skipped
reason: Obsoleted by Test 8 decision — presets are being removed (ratio is calculated, not selected).

### 11. Malformed hash fallback (ALC-04 / security)

expected: Manually set the URL hash to `#alloc=zzz` (or `#alloc=<script>`) and reload. Sliders safely fall back to the 4:1 / 1:1 defaults — no crash, no error.
result: skipped
reason: Obsoleted by Test 8 decision — the URL-hash codec is being removed (no user-selected ratio to persist/parse).

### 12. DR vCenter-loss simulation (DRS-01/03/06)

expected: In the DR panel, select "vCenter loss" mode and check one vCenter. Before/After stat blocks render, a gold "Evacuee total" vCPU/vRAM figure appears, and a per-survivor verdict list (absorbs/tight/overflows) shows. The Assumptions panel ("Models… / Does not model…") and a Confidence row are visible.
result: pass

### 13. DR is reversible & neutral (DRS-04 — no red, no confirm)

expected: The checked component renders struck-through + dimmed grey with a "simulated failed" chip (NOT red, no alarm icon). Unchecking it restores immediately with NO confirmation dialog.
result: pass
note: "Reversible/neutral behavior is correct. SEPARATE spec gap raised here against the DR modes + impact metric — see Gaps (DR modes)."

## Summary

total: 13
passed: 7
issues: 3
pending: 0
skipped: 4

## Gaps

- truth: "Stretched is the user's declaration; the engine adapts metrics and reports site data factually (no auto high/med/low confidence verdict on the user's call)."
  status: failed
  reason: "User reported: the spec is wrong, I decide if the cluster is stretch so you can adapt the performance metrics. this is my spec"
  severity: major
  test: 7
  decision: "Keep value, drop the judgement: replace stretchedConfidence enum + LowConfidenceChip with a factual site-data-present/inferred indicator; no fault-domain metadata ⇒ symmetric 50% reservation; reservation math unchanged when data present. DR-panel survivor confidence (result quality) left as-is."
  artifacts:
  - src/types/estate.ts (drop StretchedConfidence enum + stretchedConfidence; add factual siteData indicator)
  - src/engines/aggregation/aggregateClusters.ts (reservationFor → factual tagged/inferred, same fraction math)
  - src/components/stretched/StretchedPill.tsx (remove LowConfidenceChip)
  - src/components/dashboard/ClusterColumn.tsx (Confidence row + chip → neutral site-data caption)
  - src/i18n/locales/en/str.json + fr/str.json (confidence.*/ lowConfidence.chip → siteData.* factual keys, EN/FR parity)
  - src/engines/aggregation/aggregateClusters.test.ts (rework matrix: factual indicator + reservation, not high/med/low)
  - src/engines/aggregation/globals.test.ts (ClusterAggregate fixture field rename)
  missing:
  - factual site-data indicator (tagged vs inferred) replacing the confidence verdict

- truth: "The allocation/consolidation ratio is CALCULATED from the data (vCPU allocated ÷ physical cores) and displayed — never invented/selected by the user."
  status: failed
  reason: "User reported: I should get calculation not invent/select them"
  severity: major
  test: 8
  decision: "Remove the ALC slider+preset toolbar, useAllocationHash URL-hash codec/hook+tests, and allocRatios threading. Show the realized vCPU:pCPU (existing vcpuPerPcpu) + vRAM÷physRAM as measured output. ALC-01..04 (04-03) rejected. OPEN: drSim survivor-verdict capacity baseline (was usablePhysicalCores×cpuRatio) must be redefined — confirm with user in fix planning, do not guess."
  artifacts:
  - src/components/allocation/AllocationSliders.tsx (delete)
  - src/hooks/useAllocationHash.ts + useAllocationHash.test.ts (delete)
  - src/hooks/useEstateView.ts (drop ratios param + threading)
  - src/engines/aggregation/estateView.ts (drop allocRatios opt)
  - src/engines/aggregation/aggregateClusters.ts (drop allocRatios; capacityVcpu/RamMib rethink)
  - src/types/estate.ts (drop capacityVcpu/capacityRamMib or redefine)
  - src/components/dashboard/GlobalDashboard.tsx (unmount AllocationSliders, drop useAllocationHash)
  - src/i18n/{en,fr}/alloc.json + i18n/index.ts (remove alloc namespace)
  - src/engines/drSim/allocate.ts + runScenario.ts (verdict capacity baseline redefinition — OPEN)
  - aggregateClusters.test.ts / drSim tests (rework)
  missing:
  - displayed calculated consolidation ratio (vCPU÷pCPU, vRAM÷physRAM) as a measured output
  - redefined DR survivor-verdict capacity baseline (RESOLVED by DR-modes gap below → physical headroom)

- truth: "DR sim models real failure units: Server loss + Site loss only. Site = fault domain of declared stretched clusters; non-stretched workload at a lost site is LOST (no DR). Impact = physical CPU+RAM removed, not vCPU."
  status: failed
  reason: "User reported: we can loose server or site, does not make sense to loose cluster or vcenter : vcenter is a management unit only and cluster can be or not stretch, if not stretch, loosing cluster means loosing ALL vm. Last we loose ram and CPU, not vCPU (vm dependant"
  severity: major
  test: 13
  decision: "Modes → exactly {server, site} (drop cluster + vCenter). Site = fault-domain value of clusters the user declared stretched; surviving site absorbs; non-stretched workload at the lost site = lost bucket (no evacuation). Impact/headline = PHYSICAL CPU (GHz/cores) + physical RAM removed; survivor verdict vs physical headroom; drop vCPU evacuee. Reversible/neutral failed-selection UI is correct — keep."
  artifacts:
  - src/engines/drSim/runScenario.ts (modes server|site; site=fault-domain grouping; non-stretched-at-site=lost; impact=physical CPU+RAM)
  - src/engines/drSim/allocate.ts (verdict vs physical headroom; drop ratio-capacity)
  - src/types/estate.ts (DrMode → 'server'|'site'; DrScenario shape; DrSimResult evacuee → physical fields)
  - src/components/dr/DrSimPanel.tsx (2 modes; fail-select by host/by site; physical-impact display; keep reversible/neutral UI)
  - src/i18n/locales/{en,fr}/dr.json + i18n/index.ts (mode keys server/site; relabel evacuee → physical lost; EN/FR parity)
  - src/engines/drSim/*.test.ts + estateView.test.ts (rework for server/site + physical metric)
  missing:
  - server-loss + site-loss modes with fault-domain site grouping
  - non-stretched-at-lost-site "lost" accounting (no DR target)
  - physical CPU+RAM impact metric replacing vCPU evacuee
