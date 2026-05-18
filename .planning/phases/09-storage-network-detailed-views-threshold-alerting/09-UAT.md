---
status: complete
phase: 09-storage-network-detailed-views-threshold-alerting
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md]
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T07:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Load the app fresh in a browser with no prior state. Drop a RVTools .xlsx workbook. The app boots without console errors, the worker parses the file, and the global dashboard renders live estate numbers (no white-screen, no crash).
result: pass

### 2. Storage View — ViewToggle segment
expected: A "Storage" segment appears in the top ViewToggle (after Trends). Clicking it switches the active view to StorageView; the segment shows the gold active treatment. Keyboard arrow keys move between segments with wraparound.
result: pass

### 3. Storage View — lens / scope / charts
expected: StorageView shows a scope control (Cluster · ESX · VM · Datastore) and a Consumption/Capacity lens toggle. Consumption lens renders an ECharts treemap (navy shade ramp, drill breadcrumb); Capacity lens renders a stacked bar (used/free). A DataTable with column picker + CSV export sits below. Switching scope/lens updates the chart and table.
result: issue
reported: "Treemap + Capacity stacked-bar + scope (Cluster/ESX/VM/Datastore) + lens toggle + DataTable (column picker, CSV, branded GiB/TiB units) all render and function correctly. Genuine MINOR defect: ECharts logs 3 '[ECharts] oklch(...) is an illegal color, fallback to #000000' warnings. Root cause = src/theme/echartsTheme.ts hardcodes the palette as oklch() strings on a false documented assumption ('the ECharts SVG renderer accepts any CSS color string'); the bundled zrender color parser does NOT support oklch() and substitutes #000000 for the global series palette (PRIMARY_500/PRIMARY_300/SURFACE_200). Pre-existing PHASE-2 defect (echartsTheme.ts introduced in feat(02-01)); app-wide (all charts), not Phase-9-specific — P9's treemap/bar merely also consume the broken palette. Charts still render/usable; color-fidelity deviation from UI-SPEC LC-8/Color."
severity: minor

### 4. Threshold config + factual flag markers
expected: A "Thresholds" panel with three editable number inputs (filesystem %, datastore %, LU %) and a factual echo line restating the active thresholds. Rows/datastores over threshold get a faint gold tint + gold left rule + a count badge — NO red, NO warning icon, NO verdict words. Editing a threshold updates flags live; refresh restores defaults (no persistence).
result: pass
note: "Panel, 3 inputs, echo line, factual count line all correct. Both single-step arrow-key AND full select-all-replace edits update echo + count live with no verdict words and NO data loss. The apparent 'data wipe on threshold replace' reported during first-pass testing was a UAT-HARNESS ARTIFACT, not a product defect: the test harness wrote files (screenshots → project root, .gitignore, .planning/09-UAT.md) into the Vite-watched root, triggering a debounced Vite dev-server FULL PAGE RELOAD that landed on the next interaction. A reload re-runs the module-scoped `new Map()` store and remounts App (App-local useState('dashboard') reset) — the app's intended privacy-by-construction 'refresh = data gone'. Proven three ways: (1) logical — App-local state cannot reset via any Zustand action, only remount/reload; (2) code — clearAll has zero callers, setThresholds is a safe shallow merge, safeNum guards correctly (Number('')===0 is in-range); (3) empirical — identical full-replace+Tab with ZERO root-dir file writes preserved the dataset and applied the threshold correctly (echo 'Datastore > 50 %', count recomputed to 92)."

### 5. Datastore detail drill
expected: Clicking a datastore row opens a screen-fit detail screen: title + back affordance (← Back), metric rows for capacity / provisioned / in-use / free, the VMs on that datastore, host count, and a threshold flag marker if over. No internal scroll (fits one screen). Back returns to StorageView.
result: pass

### 6. VM detail drill
expected: Clicking a VM opens a screen-fit VM detail: vCPU/vRAM, disks, partition rows (each carrying the gold flag marker when over the filesystem threshold), portgroups/switches, datastores. Back returns to the prior view.
result: pass

### 7. Network View — tables / factual degrade
expected: A "Network" ViewToggle segment opens NetworkView with vSwitch, dvSwitch+dvPort, and vNetwork DataTable sections. If the loaded workbook lacks the network sheets, a single factual caption line ("Network inventory not available in this export.") appears instead — no error styling, no icon, no crash.
result: pass

### 8. ESX detail drill (Hosts view)
expected: Within the Hosts view, clicking a host opens an ESX storage+network detail (augmenting Hosts, not the P5 cluster drill): per-host vSwitch/dvSwitch/uplinks. Per-host datastore names show an em-dash sentinel + a factual one-line note (RVTools vDatastore.Hosts is a count, not names — never fabricated). Back returns to Hosts.
result: pass

### 9. STR-04 vSAN relink closure on real data
expected: On the real multi-vCenter workbook with blank-Cluster-name vSAN datastores, the relink attributes a non-zero count of those datastores back to clusters (the STR-04 under-count is closed). Storage-by-cluster totals reconcile to the estate; shared LUNs show "Shared across N clusters" rather than being double-counted.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

# NOTE: The test-4 "blocker" recorded in first-pass testing was DISPROVEN on
# diagnosis — it was a UAT-harness Vite-full-reload artifact, not a product
# defect. Test 4 is a PASS (see its note). No blocker gap remains.

- truth: "Treemap and stacked-bar chart fills derive from the navy --color-primary-* scale (UI-SPEC LC-8 / Color contract); chart colors render as specified, not a #000000 fallback"
  status: failed
  reason: "ECharts logs 3 '[ECharts] oklch(...) is an illegal color, fallback to #000000' warnings on every chart. The Midnight Executive palette is emitted to ECharts as oklch() strings; the bundled zrender color parser does not support oklch() and substitutes black for the global series palette. Charts still render and are usable — color-fidelity deviation from UI-SPEC LC-8/Color, not a functional break."
  severity: minor
  test: 3
  root_cause: "src/theme/echartsTheme.ts lines 9-29: palette constants (PRIMARY_500/300/200, SURFACE_200/700/800, UTIL_LOW/MID/HIGH) are hardcoded oklch() strings on the explicit but FALSE documented assumption 'the ECharts SVG renderer accepts any CSS color string, so we emit the same oklch values verbatim'. zrender's CSS color parser (bundled echarts) supports hex/rgb(a)/hsl(a)/named only — oklch() → #000000 fallback. Pre-existing Phase-2 defect (file introduced in commit feat(02-01)); affects ALL app charts, surfaced now because P9 added the treemap/stacked-bar. Never caught because P2-P8 chart tests run in jsdom (no real SVG paint) and there was no prior live-browser verification."
  artifacts:
    - path: "src/theme/echartsTheme.ts"
      issue: "Palette constants are oklch() strings; doc-comment falsely claims ECharts accepts any CSS color string. zrender cannot parse oklch → #000000."
  missing:
    - "Convert the 9 oklch palette constants in echartsTheme.ts to their accurate sRGB hex/rgb equivalents (zrender-parseable), preserving the Midnight Executive values. Fix the doc-comment's false claim."
    - "Add a guard that fails the build/test if a chart theme color is not zrender-parseable (regression gate; jsdom tests miss this)."
  debug_session: "inline (this UAT session) — see test-4 note + test-3 reported"
  cross_phase: "echartsTheme.ts is a Phase-2 (VIZ-03) foundational file; fix changes chart colors app-wide, not just Phase 9. Scope decision is the user's."
