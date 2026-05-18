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
reported: "Treemap + scope (Cluster/ESX/VM/Datastore) + lens toggle + DataTable (column picker, CSV, branded GiB/TiB units) all render and function. But ECharts logs 3 'illegal color, fallback to #000000' warnings for oklch() tokens — the chart fills are not consuming the navy --color-primary ramp as the UI-SPEC LC-8/Color contract requires (oklch CSS custom properties are not ECharts-parseable)."
severity: minor

### 4. Threshold config + factual flag markers
expected: A "Thresholds" panel with three editable number inputs (filesystem %, datastore %, LU %) and a factual echo line restating the active thresholds. Rows/datastores over threshold get a faint gold tint + gold left rule + a count badge — NO red, NO warning icon, NO verdict words. Editing a threshold updates flags live; refresh restores defaults (no persistence).
result: issue
reported: "Panel, 3 inputs, echo line, and factual count line all present and CORRECT; single-step arrow-key edit updates the echo + count live (85→84 ⇒ 11→21 datastores) with no verdict words. BUT: replacing a threshold value the normal way (select-all then type a new number, then blur/Tab) DELETES THE ENTIRE LOADED ESTATE and resets the app to the upload screen — reproducible and deterministic, no console error. Data loss on a routine field edit; unrecoverable without re-upload (no persistence)."
severity: blocker

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
passed: 7
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Editing a threshold value updates flags live; the loaded estate is preserved (in-memory thresholds slice, REPLACE-never-mutate, no destructive side-effect — UI-SPEC LC-7)"
  status: failed
  reason: "User reported: replacing a threshold value (select-all + type new number + blur/Tab) deletes the entire loaded estate and resets the app to the upload screen. Reproducible TWICE deterministically, no console error. Single-step arrow-key edits work correctly (live echo + count update, no data loss) — the defect is specific to committing a transiently-blanked / full-replace value. Likely the safeNum/on-commit path for an empty or invalid intermediate value triggers a clearAll-style reset that also drops the in-memory snapshot Map (no persistence ⇒ unrecoverable). ADDITIONAL OBSERVATION: one further unattributed full-state reset occurred once during plain view navigation (VM detail → Network) with NO threshold interaction — suggests the destructive state-clear path may be reachable beyond the threshold input alone; diagnosis should investigate the shared store-reset trigger, not only the number-input on-commit handler. UI-SPEC LC-7 requires invalid input to fall back to last-valid with NO destructive side-effect."
  severity: blocker
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Treemap and stacked-bar chart fills derive from the navy --color-primary-* scale (UI-SPEC LC-8 / Color contract); chart colors render as specified, not a fallback"
  status: failed
  reason: "User reported: ECharts logs 3 '[ECharts] oklch(...) is an illegal color, fallback to #000000' warnings on the Storage treemap. The navy/gold design tokens are defined as oklch() CSS custom properties which ECharts cannot parse, so affected series colors fall back to black instead of the mandated navy --color-primary ramp. Chart still renders and is usable; this is a color-fidelity deviation from the spec, not a functional break."
  severity: minor
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
