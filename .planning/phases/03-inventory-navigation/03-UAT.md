---
status: complete
phase: 03-inventory-navigation
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-05-16T00:00:00Z
updated: 2026-05-16T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Dashboard ↔ Inventory toggle
expected: |
  With a snapshot loaded, a segmented Dashboard / Inventory toggle is visible
  in the toolbar (default = Dashboard). Clicking "Inventory" switches the main
  area to the inventory view; clicking "Dashboard" switches back. Keyboard-
  operable (Tab to it, arrows/Enter to switch). Phase-1 sidebar still works.
awaiting: user response

## Tests

### 1. Dashboard ↔ Inventory toggle

expected: Segmented Dashboard/Inventory toggle in the toolbar, default Dashboard, switches the main area both ways, keyboard-operable, sidebar unaffected.
result: pass

### 2. Inventory tree (vCenter → Cluster → ESX → VM)

expected: Left pane shows a tree: vCenter root → Cluster → ESX host → VM. Chevrons expand/collapse; each node has a count badge; lazy children. Selecting a node scopes the right-pane table to that subtree; root = all. Stays smooth (no freeze) on the loaded estate.
result: pass

### 3. VM table — sort, filter, localized headers

expected: VM tab shows a table with localized headers (e.g. "vCPU", "vRAM (MiB)", "Cluster", "OS" — NOT raw `inventory.col.*`). Column sort cycles asc/desc; the toolbar filter narrows rows live. Values are plausible vs RVTools. (Re-verifies fix d16ad6b.)
result: pass

### 4. ESX table

expected: ESX tab: per-host rows with sockets/cores/speed/memory/usage — real values, localized headers, sortable/filterable.
result: pass

### 5. Datastore table — real sizes (re-verifies e2f7956)

expected: Datastore tab: NAA/name/type + Capacity/Free/Used/Provisioned in real GiB/MiB (NOT all 0). A shared LUN appears once (NAA-deduped), not double-counted. Localized headers.
result: pass
note: "Datastore table + sizes correct globally (re-verifies e2f7956). ACCEPTED LIMITATION: vSAN/host-local datastores have blank vDatastore.Cluster name in RVTools, so they are global-only, not per-cluster — user accepted; proper Hosts->vHost.cluster fix deferred to Phase 4 (see memory project-datastore-cluster-attribution)."

### 6. Column show/hide (INV-06)

expected: A "Columns" button opens a picker; toggling a column hides/shows it in the table immediately; "Reset" restores defaults. The identity column (e.g. VM name) cannot be hidden.
result: pass

### 7. CSV export of current filter (INV-05)

expected: "Export CSV" downloads `vatlas-{object}-YYYYMMDD.csv` containing exactly the currently filtered rows × currently visible columns. Values are RAW (no locale formatting, no unit suffixes); multi-line cells keep their newlines (RFC-4180 quoted).
result: pass

### 8. Large-estate responsiveness

expected: On the largest real workbook you have, expanding/collapsing the tree and sorting/filtering a multi-thousand-row table stays responsive (no multi-second freeze; window scrolls smoothly). Skip if you only have small exports.
result: skipped
reason: "No large workbook on hand; covered by the synthetic 10k-VM stress test in CI."

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1

## Gaps

No defects. One accepted limitation (not a failed gap):

- truth: "Per-cluster datastore attribution includes vSAN / host-local datastores"
  status: accepted-limitation
  reason: "RVTools leaves vDatastore Cluster name blank for vSAN/host-local datastores; correct in the GLOBAL datastore table + total storage, but not attributed to any cluster. User accepted as-is. Deterministic fix (vDatastore.Hosts -> vHost.cluster join) deferred to Phase 4."
  severity: minor
  test: 5
  resolved_by: "deferred to Phase 4 (accepted)"
