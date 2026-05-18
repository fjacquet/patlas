---
status: complete
phase: 09-storage-network-detailed-views-threshold-alerting
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md]
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T08:15:00Z
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
result: pass
note: "Treemap + Capacity stacked-bar + scope (Cluster/ESX/VM/Datastore) + lens toggle + DataTable (column picker, CSV, branded GiB/TiB units) all render and function correctly. The oklch→#000000 minor defect found in first-pass (pre-existing Phase-2: src/theme/echartsTheme.ts emitted oklch() palette strings zrender cannot parse) was FIXED INLINE this session: the 9 palette constants converted to accurate sRGB hex (exact OKLCH→sRGB of the index.css values), false doc-comment corrected, existing echartsTheme.test.ts updated to assert the parseable hex. Verified: typecheck clean, full suite 409/409, and in-browser 0 ECharts color warnings on the dashboard AND the Storage treemap (heaviest palette consumer) — treemap now renders the navy --color-primary ramp per UI-SPEC LC-8."

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
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

# Both first-pass issues resolved this session:
#  - Test-4 "blocker" DISPROVEN — UAT-harness Vite-full-reload artifact, not a
#    product defect. Test 4 = PASS (see its note).
#  - Test-3 oklch minor (pre-existing Phase-2) FIXED INLINE + verified. RESOLVED.
# No open gaps. Phase 9 UAT clean: 9/9 pass.

- truth: "Treemap/stacked-bar chart fills derive from the navy --color-primary-* scale (UI-SPEC LC-8 / Color); chart colors render as specified, not a #000000 fallback"
  status: resolved
  reason: "Pre-existing Phase-2 defect: src/theme/echartsTheme.ts emitted the Midnight Executive palette as oklch() strings; the bundled zrender color parser supports hex/rgb(a)/hsl(a)/named only, so oklch() fell back to #000000 app-wide (P9's treemap/bar surfaced it). Never caught because P2–P8 chart tests run in jsdom (no real SVG paint) + no prior live-browser pass."
  severity: minor
  test: 3
  root_cause: "echartsTheme.ts palette constants hardcoded as oklch() on a false doc-comment claim that the ECharts SVG renderer accepts any CSS color string. Introduced in commit feat(02-01) (Phase 2)."
  resolution: "Fixed inline (user-approved 'fix colors only'): converted the 9 palette constants to accurate sRGB hex via standard OKLCH→OKLab→linear-sRGB→gamma math (PRIMARY_500 #3245b7 / 300 #819ae9 / 200 #b0c2f9, SURFACE_200 #d4d8de / 700 #232933 / 800 #11161f, UTIL_LOW #4aa342 / MID #ef8700 / HIGH #df202e), corrected the doc-comment, updated echartsTheme.test.ts to assert the parseable hex. Verified: typecheck clean, vitest 409/409, in-browser 0 ECharts color warnings on dashboard + Storage treemap, treemap renders the navy ramp."
  artifacts:
    - path: "src/theme/echartsTheme.ts"
      issue: "FIXED — oklch() constants → accurate sRGB hex; doc-comment corrected."
    - path: "src/theme/echartsTheme.test.ts"
      issue: "FIXED — assertions updated from the buggy oklch strings to the corrected hex."
  missing: []
  debug_session: "inline (this UAT session)"
