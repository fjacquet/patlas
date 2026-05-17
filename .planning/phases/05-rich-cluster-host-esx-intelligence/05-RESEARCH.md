# Phase 5: Rich Cluster / Host / ESX Intelligence - Research

**Researched:** 2026-05-17 (inline, evidence = the project's own parser + shipped engines; RVTools is a fixed well-known schema)
**Status:** Feasibility resolved — ready for planning

## Scope recap (from 05-CONTEXT.md)

Deep per-cluster/host/ESX intelligence + a new "Hosts" ViewToggle segment + a drill-in per-cluster detail screen, estate Operational-Insights row, full metric set — all calc-from-real-data, globally and per-cluster. Parser extension for exact powered-state + Template.

## Feasibility findings (the CONTEXT flags — resolved)

### F-1 — Powerstate (on/off/suspended): FEASIBLE, low-risk
`src/engines/parser/adapters/rvtools.ts:56` already aliases the RVTools
column: `poweredOn: ['powerstate','power state','état','status']`, read at
`:184` and collapsed `=== 'poweredon'` → boolean `VInfoRow.poweredOn`.
The source column is already located. The extension is a single-site
mapping change: parse the raw cell to a `'poweredOn' | 'poweredOff' |
'suspended'` enum (RVTools emits exactly these), keep a derived
`poweredOn` boolean for existing consumers (no blast radius). Schema
(`schemas.ts:52 poweredOn: z.boolean()`) gains a `powerState` enum field.
**Decision: extend, keep `poweredOn` as a derived accessor.**

### F-2 — Template flag: FEASIBLE, additive
Not currently aliased. RVTools vInfo carries a fixed `Template`
(TRUE/FALSE) column. Add `template: ['template']` alias + `VInfoRow.template:
boolean` + schema. The parser already returns `''` for absent columns and
the empty-cell→default preprocessor is established (Minor-3) → graceful if
a legacy export lacks it (factual: counts 0 templates).

### F-3 — Guest data via vPartition: FEASIBLE, already wired
`adaptRvtoolsVPartition` (`rvtools.ts:236`) + `VPartitionRowSchema`
(`schemas.ts:90`) already parse the sheet; it is OPTIONAL with a collected
warning when absent (`:344 "guest-disk views will be empty"`). Guest-data
aggregation is a new pure engine reduction over `snapshot.vpartition`.
**Calc-from-real-data honored:** when vPartition is absent the metric
renders the factual em-dash/"not available", never invented.

### F-4 — ESX model/vendor + ESXi version: present on vHost path
`VHostRow` carries host capacity fields; RVTools vHost has `Model`,
`Vendor`, `ESX Version` columns (fixed schema). Add aliases + `VHostRow`
fields (additive, same pattern). Shown as PLAIN TEXT only — NO lifecycle
verdict (vendor EOS not in RVTools; ESXi support-state is Phase 7).

### F-5 — Datastore footprint incl .vswp+snapshots / provisioned-vs-in-use
Derivable now: `VInfoRow.provisionedMib` / `inUseMib` already parsed
(RVTools "In Use" already includes vswp+snapshots — matches the
RVTools-Analyser framing). No parser change; pure aggregation.

### F-6 — Realized overcommit / avg CPU%·mem% weighted / totals
All derivable from shipped `aggregateClusters`/`perEsx`/`vHost`/`vInfo`
(physical cores, speed, memory, cpuRatio, ramRatio, vCPU). `vcpuPerPcpu`
already computed (G2). New metrics are pure additions to the aggregation
engines, surfaced via the single `useEstateView` memo (NO new memo).

## Patterns / pitfalls to follow

- Parser change (F-1/F-2/F-4) MUST keep the MiB canary + all existing
  parser fixtures green (regression gate) — the validated parser is touched.
- Branded units; em-dash sentinel for "not derivable"; factual labels,
  no editorial verbs (G1 lesson); EN/FR parity.
- Single `useMemo` invariant: every new metric flows through
  `buildEstateView`/`EstateView` (estate + per-cluster shapes already
  exist — extend, don't add a memo). Drill nav = in-app view state (lifted
  component state like `mode`), no router, no 2nd memo.
- Reuse P3 `DataTable`/`ColumnPicker`/`ViewToggle`; reuse P2
  `GlobalSummaryCard`/`ClusterColumn` (cards = drill entry point).
- Cluster-detail screen MUST be one-screen-fit (hard layout constraint so
  Phase 10 = 1 PPTX slide/cluster). P5 does NOT build the export.

## Net

No blockers. All CONTEXT feasibility flags resolve to FEASIBLE. The only
parser risk (F-1/F-2/F-4) is contained to additive column aliases + one
mapping site, gated by the existing parser regression suite. Proceed to
planning.
