---
status: complete
phase: 02-aggregation-global-dashboard
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-05-16T00:00:00Z
updated: 2026-05-16T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 3
name: Per-cluster metrics
expected: |
  Each cluster column shows ESX count, VM count split Windows/Linux/Other,
  datastore count, physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU
  allocation, and CPU Ready %. Numbers look plausible vs. RVTools.
awaiting: user response

## Tests

### 1. Cold start smoke test

expected: Fresh `npm run dev` → app loads at <http://localhost:5173/vatlas/> with the empty drop zone, sidebar, theme + language toggles; zero console errors on load.
result: pass

### 2. Dashboard renders on workbook drop (chart fix 4c139ed)

expected: Drop a real RVTools `.xlsx` in the sidebar. Within ~3s a global summary card + one column per cluster appears. Crucially, NO "Cet instantané n'a pas pu être agrégé : Element type is invalid…" error — the ECharts charts render. (This is the in-browser confirmation of commit 4c139ed.)
result: pass

### 3. Per-cluster metrics

expected: Each cluster column shows ESX count, VM count split Windows/Linux/Other, datastore count, physical GHz, consumed GHz, mean CPU %, mean RAM %, vCPU allocation, and CPU Ready %. Numbers look plausible vs. what RVTools shows for that estate.
result: pass
note: "Was a BLOCKER (every numeric size/derived metric read 0; storage all 0). Root cause: RVTools >=4.x renamed size headers MB->MiB; alias dictionaries in rvtools.ts had no '... mib' spelling so numeric columns missed and defaulted to 0 (PITFALLS Moderate-1 / A7 gap). Fixed in commit e2f7956 (+3 regression tests). Re-verified by user in-browser on RVTools_export_all_2026-01-07_10.23.35.xlsx: Gold-Cluster CPU 49,2% / RAM 62,3% / vCPU 3,3:1 / consumed 1188 of 2413 GHz — realistic."

### 4. OS-family donut renders as crisp SVG

expected: An OS-family donut (Windows / Linux / Other) renders at global and per-cluster level. It is sharp at any zoom. Right-click → Inspect shows an inline `<svg>` element (NOT `<canvas>`).
result: pass

### 5. Three accounting modes toggle

expected: A Configured / Active / Storage-realistic segmented toggle. Switching modes visibly changes the displayed totals (powered-off-VM accounting differs). The toggle is keyboard-operable (Tab to it, arrows/Enter to switch).
result: pass

### 6. CPU Ready panel is factual

expected: CPU Ready shows mean / max / count of VMs above the 5% threshold. If the workbook has no "Overall Cpu Readiness" column, it shows "not reported" / "non communiqué" — NOT a fabricated 0%, no good/bad color verdict.
result: pass
note: "0,0% / 0,0% / 0 is the FAITHFUL source value, not fabricated. Verified on RVTools_export_all_2026-01-07_10.23.35.xlsx: of 581 VMs, Overall Cpu Readiness = 0 for 551, blank for 24, 0.01 for 6 → mean/max round to 0,0%, count>5% = 0. Tool correctly reports what RVTools captured (no fabrication, no verdict color)."

### 7. Theme + i18n + locale numbers

expected: Light/dark toggle recolors the whole dashboard incl. charts. FR/EN toggle relabels every visible string (incl. dashboard). Numbers format per locale (FR uses comma decimal + non-breaking-space thousands).
result: pass

### 8. Refresh wipes data (privacy invariant)

expected: After loading a snapshot, reload the page (F5). The app returns to the empty drop-zone state — no persisted snapshot, no dataset rows survived. (Theme/language preference may persist; dataset must not.)
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

All UAT-discovered issues diagnosed and fixed via authorized direct fixes; awaiting user in-browser re-verification.

- truth: "Numeric size/derived metrics correct on real RVTools exports"
  status: resolved
  reason: "RVTools >=4.x renamed size headers MB->MiB; rvtools.ts alias dictionaries had no '... mib' spelling so every numeric column missed and defaulted to 0 (PITFALLS Moderate-1 / A7 gap). Fixed: commit e2f7956 (+ regression tests). Re-verified by user in-browser on RVTools_export_all_2026-01-07_10.23.35.xlsx — Gold-Cluster CPU 49,2% / RAM 62,3% / vCPU 3,3:1, datastore table real sizes."
  severity: blocker
  test: 3
  resolved_by: e2f7956
- truth: "CPU Ready 0,0% is faithful source data, not fabricated"
  status: resolved
  reason: "Not a bug. Verified: vInfo Overall Cpu Readiness genuinely 0 for 551/581 VMs in the test export. Tool faithfully reports RVTools-captured value; the not-reported sentinel only applies when the column is absent (it is present here)."
  severity: major
  test: 6
  resolved_by: "n/a — not a defect"
- truth: "Per-cluster datastore count rendered (not em-dash) when vDatastore has cluster data"
  status: resolved
  reason: "A1's premise (no Cluster name column) was false. clusterName threaded through VDatastoreRow/schema/adapter + per-cluster NAA-deduped attribution + ClusterColumn renders the count. Commit 58b4361."
  severity: minor
  test: 3
  resolved_by: 58b4361
- truth: "Inventory table column headers render localized text, not raw i18n keys"
  status: resolved
  reason: "DataTable <thead> rendered the raw column key string instead of t()-resolving it. Unified visible+CSV header on a single t('col.<id>') path; labels improved (unit-bearing, EN/FR parity). Commit d16ad6b."
  severity: major
  test: 3
  resolved_by: d16ad6b
