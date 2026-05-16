---
phase: 01-foundation-invariants
plan: 04
subsystem: parser
tags: [parser, web-worker, sheetjs, xlsx, zod, branded-types, rvtools, tdd, vitest, privacy]

requires:
  - phase: 01-foundation-invariants
    plan: 02
    provides: "src/privacy/fetchGuard.ts side-effect guard; parser.worker.ts FIRST-import contract; check-supply-chain SheetJS pin"
  - phase: 01-foundation-invariants
    plan: 03
    provides: "@engines/units branded MiB/MHz/Cores/Sockets + converters; src/__fixtures__/rvtools-mib-canary.xlsx; xlsx 0.20.3 pin"
provides:
  - "src/engines/parser/parseInWorker.ts — main-thread `parseInWorker(file)` → { snapshot: Omit<Snapshot,'id'|'parsedAt'>, warnings }"
  - "src/engines/parser/parser.worker.ts — Web Worker boundary; privacy guard FIRST import; WorkBook never posted back"
  - "src/engines/parser/{parseXlsx,normalizeColumns,synthesizeOrphanClusters,schemas,captureDate}.ts + adapters/{columnMap,rvtools}.ts"
  - "src/types/{snapshot,vinfo,vhost,index}.ts — Snapshot/ParseError/VDatastoreRow/VPartitionRow/VMetaDataRow + extended VInfoRow/VHostRow"
  - "scripts/seed-fixtures.mjs + tests/fixtures/ (gitignored real-workbook harvest)"
  - "tsconfig.test.json — test-file typecheck project (node + vitest globals)"
affects: [01-05-snapshot-store]

tech-stack:
  added: []
  patterns:
    - "Web Worker I/O boundary: discriminated postMessage union; transferable ArrayBuffer in; canonical typed rows out (SheetJS WorkBook GC'd inside the handler — Critical-5 / STRIDE T-04-07)"
    - "SheetJS imported ONLY in parser.worker.ts/parseXlsx.ts — Vite emits a separate worker chunk; main bundle stays SheetJS-free (STRIDE T-04-08, verified by build probe)"
    - "Hand-rolled Zod brand transforms `.transform((n) => n as MiB)` at the parser boundary (engines stay Zod-free — 01-RESEARCH A8); dedicated Positive* schemas, never `.pipe()` over a branded schema"
    - "Structured fatal ParseError (name='ParseError' + sheet/column/kind own props, NO cause — STRIDE T-04-04); recoverable problems collected as ParseError[]"
    - "RVTools-only: no source-detection / alternate-vendor branch (vsizer's Live Optics path dropped); lexical drop-gate kept clean by rephrasing documentary mentions"
    - "Test files excluded from the app tsc -b build; typechecked via standalone tsconfig.test.json"

key-files:
  created:
    - "src/types/snapshot.ts"
    - "src/types/vinfo.ts"
    - "src/types/vhost.ts"
    - "src/types/index.ts"
    - "src/engines/parser/parseXlsx.ts"
    - "src/engines/parser/adapters/columnMap.ts"
    - "src/engines/parser/adapters/rvtools.ts"
    - "src/engines/parser/synthesizeOrphanClusters.ts"
    - "src/engines/parser/schemas.ts"
    - "src/engines/parser/normalizeColumns.ts"
    - "src/engines/parser/captureDate.ts"
    - "src/engines/parser/parser.worker.ts"
    - "src/engines/parser/parseInWorker.ts"
    - "src/engines/parser/index.ts"
    - "src/engines/parser/adapters/rvtools.test.ts"
    - "src/engines/parser/normalizeColumns.test.ts"
    - "src/engines/parser/captureDate.test.ts"
    - "src/engines/parser/canary.test.ts"
    - "src/engines/parser/parseInWorker.test.ts"
    - "src/engines/parser/parserEdges.test.ts"
    - "scripts/seed-fixtures.mjs"
    - "tests/fixtures/.gitignore"
    - "tests/fixtures/.gitkeep"
    - "tests/fixtures/README.md"
    - "tsconfig.test.json"
  modified:
    - "package.json (typecheck now also runs tsconfig.test.json)"
    - "tsconfig.app.json (exclude *.test.ts/*.spec.ts/src/test from app build)"

decisions:
  - "VHostRow keeps `hostName` (not renamed to `host`) so the verbatim synthesizeOrphanClusters port matches on it unchanged — KISS over the plan's interface sketch which said `host` but also `...other fields verbatim`."
  - "Adapters construct branded values via the units constructors (mib/cores/...) so adapter output is genuinely VInfoRow[]/VHostRow[]; the Zod schema re-validates + re-brands. Avoids a parallel bare-number adapter type (DRY)."
  - "canary.test.ts bypasses the Worker boundary (parseSnapshot(parseXlsx(buf)) directly) — jsdom cannot drive a real module Worker; per the plan."
  - "Test files excluded from app tsc -b (they import node:fs/__dirname); a dedicated tsconfig.test.json keeps test type-safety, wired into `npm run typecheck`. Standalone (not a project reference) to avoid forcing `composite:true` across Plans 01-03's tsconfigs (lower blast radius)."

metrics:
  duration: 35min
  tasks: 3
  files_created: 25
  files_modified: 2
  completed: 2026-05-15
---

# Phase 01 Plan 04: RVTools Parser Engine in a Web Worker Summary

**Ported + extended vsizer's RVTools parser into a privacy-guarded Web Worker behind a typed `postMessage` boundary that returns a fully-validated `Snapshot` — branded-MiB storage (no `*1.048576`), structured missing-sheet/column errors, RVTools 3.10/3.11/4.0/4.4 alias drift, locked `capturedAt`/`vCenterLabel`/`rvtoolsVersion` inference, `viSdkUuid` carried for Phase 4 — with SheetJS isolated to its own bundle and the live MiB canary proving PAR-04.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (each with RED → GREEN TDD commits for the `tdd="true"` tasks)
- **Files created:** 25 · **Files modified:** 2

## Task Commits

1. **Task 1 RED** — `8d78c22` `test(01-04)` — canonical types + failing adapter/normalizeColumns tests (modules absent).
2. **Task 1 GREEN** — `3620290` `feat(01-04)` — parser primitives + adapter ported & extended; 16/16 GREEN.
3. **Task 2 RED** — `ffdd017` `test(01-04)` — failing captureDate + MiB-canary tests (captureDate absent).
4. **Task 2 GREEN** — `2d1cac5` `feat(01-04)` — captureDate + worker boundary + parseInWorker; 33/33 GREEN incl. canary.
5. **Task 3** — `b856cb2` `feat(01-04)` — fixture harvester, coverage tests, worker-chunk build, build-config fixes.
6. **Plan metadata** — _(final commit)_ `docs(01-04)`.

## Verification (plan acceptance block — all 14)

1. All parser files exist — OK
2. Live Optics / detectSource / extractWorkbook fully removed (lexical gate clean) — OK
3. Branded types imported + used (`as MiB`/`as Cores`) in schemas — OK
4. `parser.worker.ts` first executable line `import '../../privacy/fetchGuard'` (after the `/// <reference lib="webworker" />` pragma) — OK
5. `parseInWorker.ts` does NOT import `xlsx` — OK
6. Worker URL pattern + `{ type: 'module' }` — OK
7. Capture-date inference order (`ISO_DATE_RE` → vMetaData → `mtime`) — OK
8. Coverage `src/engines/parser/**`: **stmts 93.53% / branch 85.27% / func 98.33% / lines 94.46%** — all ≥75 % gate cleared
9. Canary regression GREEN: `provisionedMib === 102_400`, `mibToGib === 100`, host `cores 12`/`speedMhz 2600`/`sockets 2`, RVTools `4.4.0` — OK
10. `npm run build` succeeds; worker chunk emitted with SheetJS isolated (probe-verified) — OK
11. `npm run typecheck && npm run lint && npm run test:run` — all exit 0 (89 tests, 11 files)
12. `npm run check:supply-chain` — `check-supply-chain: OK`
13. `node scripts/seed-fixtures.mjs` idempotent (4/4 harvested) — OK
14. RVTools-version coverage check — see A7 below

## A7 verification report (RVTools-version coverage)

`node scripts/seed-fixtures.mjs` harvested **4/4** sources. Each parsed cleanly through `parseSnapshot(parseXlsx(buf))`:

| Fixture | Size | RVTools detected | vinfo / vhost / vdatastore / vpartition |
|---|---|---|---|
| `RVTools_export_all_2026-01-07_10.23.35.xlsx` | 915 KB | **3.11+** (marker-sniffed) | 576 / 20 / 21 / 1457 |
| `RVTools_export_all_2026-01-14_17.23.32.xlsx` | 584 KB | **3.11+** (marker-sniffed) | 273 / 7 / 39 / 573 |
| `RVTools_export_all_2026-04-17_..._MOM-vCenter.xlsx` | 944 KB | **3.11+** (marker-sniffed) | 249 / 84 / 102 / 1152 |
| `vsizer/public/samples/rvtools-sample.xlsx` (synthetic) | 26 KB | **unknown** (no vMetaData) | 40 / 9 / 0 / 0 |

```
Generations covered by real files (real-file-validated): { 3.11+ }
Generations missing real-file validation:               { 3.10, 4.0, 4.4 }
```

**Gap (carry-forward, NOT fabricated):** None of the three real workbooks exposes an explicit `vMetaData.RVTools Version` cell, so the version sniffer correctly resolved them to `3.11+` via the `Creation date` marker column. The alias dictionary _supports_ the full 3.10/3.11/4.0/4.4 drift (per RESEARCH.md Pattern 3 — exercised by the 5 alias-spelling unit tests), but only the `3.11+` generation is validated against a real file. 3.10 / 4.0 / 4.4 real-file validation cannot proceed without samples from those generations. **TODO for Plan 05 UAT: ask the user for a 3.10 and a 4.4 workbook.** CI environments will not have the user's OneDrive anyway; the committed canary fixture is what CI uses, so this gap is non-blocking for the pipeline.

## A9 verification report (parse wall-clock)

Measured in node/Vitest (not in-browser — Plan 05's smoke test validates in-browser):

| Fixture | Size | Parse wall-clock |
|---|---|---|
| `..._2026-04-17_..._MOM-vCenter.xlsx` (largest, 84 hosts / 1152 partitions) | 944 KB | **312 ms** |
| `..._2026-01-07_10.23.35.xlsx` | 915 KB | 212 ms |
| `..._2026-01-14_17.23.32.xlsx` | 584 KB | 204 ms |
| `rvtools-sample.xlsx` | 26 KB | 3 ms |

No ≥30 MB workbook is available on disk (largest is 944 KB). Extrapolating ~0.33 ms/KB, a 30 MB workbook projects to **~10 s** — at the RESEARCH.md A9 threshold. **Not a Phase 6 backlog trigger yet** (no measured >10s), but flagged: the Worker boundary already keeps any such parse off the main thread (UI never freezes), so even a threshold-grazing 30 MB file degrades gracefully. Plan 05's in-browser smoke test should re-measure with a real large workbook if one becomes available.

## Column alias dictionary (for Phase 4)

**VINFO_COLS** — vmName, cluster, host, vcpu(`cpus`/`# cpus`/`cpu`/`vcpu`/`vcpus`), vramMib(`memory`/`memory (mb)`/`mem`/`mémoire`), cpuReadinessPercent, poweredOn, osConfig(`os according to the configuration file`/`os`/`guest os`), osTools(`os according to the vmware tools`/`guest os full name`/`vmtools os`), vmBiosUuid(`vm uuid`/`bios uuid`/`uuid`), vmInstanceUuid(`vm instance uuid`/`instance uuid`), viSdkUuid(`vi sdk uuid`/`vcenter uuid`), viSdkServer(`vi sdk server`/`vcenter server`/`vcenter`), provisionedMib(`provisioned mb`/`provisioned (mb)`/`provisioned`), inUseMib(`in use mb`/`in use (mb)`/`consumed`).

**VHOST_COLS** — hostName, cluster, sockets(`# cpu`/`cpus`/`# cpus`/`sockets`/`# sockets`), cores(`# cores`/`cores`/`core count`/`cœurs`), speedMhz(`speed`/`speed (mhz)`/`cpu speed`/`vitesse`), memoryMib(`# memory`/`memory`/`mémoire`/`mémoire (mo)`/`mem`), cpuRatio, ramRatio.

**VDATASTORE_COLS** — name(`name`/`datastore`/`ds name`), capacityMib, freeMib(`free mb`/`free (mb)`/`free space mb`/`free`), provisionedMib, naa(`address`/`naa`/`url`/`uuid`), type.

**VPARTITION_COLS** — vmName, disk(`disk`/`partition`/`mount`/`disk path`), capacityMib, consumedMib(`consumed mb`/`consumed (mb)`/`consumed`/`used mb`), freeMib.

**VMETADATA_COLS** — property(`property`/`name`/`key`), value(`value`/`val`).

## Worker chunk size (RESEARCH.md Open Q3 budget)

Build probe (temporary `parseInWorker` import in `main.tsx`, built, inspected, then fully reverted — `main.tsx` is byte-identical to its Plan 02 HEAD):

- `dist/assets/parser.worker-*.js` — **440.93 KB raw / 138 KB gzipped**. **Under the 700 KB raw budget** (does not need flagging).
- Main chunk (`dist/assets/index-*.js`, 45.9 KB) contains **no** `XLSX.read`/`sheet_to_json` — SheetJS is isolated to the worker chunk (STRIDE T-04-08 satisfied).
- Until Plan 05 imports `parseInWorker`, the production build tree-shakes the worker + SheetJS out entirely (correct: zero SheetJS leak in the app bundle).

## Public surface for Plan 05

```typescript
import { parseInWorker } from '@/engines/parser'
// or '@engines/parser'

const { snapshot, warnings } = await parseInWorker(file)
// snapshot: Omit<Snapshot, 'id' | 'parsedAt'>
// rejects with Error{ name:'ParseError', message, sheet?, column?, kind? }
```

Type exports from `src/engines/parser/index.ts`: `Snapshot`, `ParseError`, `VDatastoreRow`, `VPartitionRow`, `VInfoRow`, `VHostRow`.

**Reminder to Plan 05:** assemble the final `Snapshot` by stamping the two worker-omitted fields on the main thread:

```typescript
const snapshot: Snapshot = { id: crypto.randomUUID(), parsedAt: new Date(), ...payload.snapshot }
```

`parseInWorker` is a module-scope singleton worker (multiple drops reuse it). `viSdkUuid`, `capturedAt`, `vCenterLabel`, `rvtoolsVersion`, `fileSize` are already populated by the worker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lexical drop-gate false-positive on documentary comment**

- **Found during:** Task 1 verify (`! grep -rE 'liveoptics|...|detectSource' src/`).
- **Issue:** A `normalizeColumns.ts` docstring said "no Live Optics / detectSource branch" — matched the plan's own CI drop-gate regex (same class as Plan 03 deviation #4).
- **Fix:** Rephrased the comment to describe the dropped behavior without containing the gate tokens. Intent preserved; gate now CLEAN across all of `src/`.
- **Files modified:** `src/engines/parser/normalizeColumns.ts`. **Commit:** `3620290`.

**2. [Rule 1 - Bug] schemas.ts ZodPipe re-declares input as the brand type**

- **Found during:** Task 3 (`npm run build` — `tsc -b` stricter than `tsc --noEmit`).
- **Issue:** `CoresSchema.pipe(z.number().positive()...)` — the pipe's downstream `z.number()` received `Cores` (CoresSchema's output) as input, breaking the `z.ZodType<VHostRow>` annotation under the app build's stricter check.
- **Fix:** Replaced the `.pipe()` chains with dedicated `PositiveCoresSchema` / `PositiveMhzSchema` base schemas; removed the now-unused `MhzSchema` (noUnusedLocals).
- **Files modified:** `src/engines/parser/schemas.ts`. **Commit:** `b856cb2`. Verified: all 89 tests still GREEN, canary unaffected.

**3. [Rule 3 - Blocking] App `tsc -b` typechecks test files (node imports)**

- **Found during:** Task 3 (`npm run build`).
- **Issue:** `tsconfig.app.json` (`include:["src"]`, `types:["vite/client"]`) typechecked `canary.test.ts` under `tsc -b` and failed on `node:fs`/`node:path`/`__dirname` (`tsc --noEmit` root config is effectively a no-op — the real type gate is the build). Test files are never bundled — Vitest runs them with its own pipeline.
- **Fix:** Excluded `*.test.ts`/`*.spec.ts`/`src/test/**` from `tsconfig.app.json`; added a standalone `tsconfig.test.json` (node + vitest globals) and wired it into `npm run typecheck` so test type-safety is preserved. Standalone (not a project reference) to avoid forcing `composite:true` retroactively across Plans 01-03's configs (lower blast radius — a project-reference restructure would border Rule 4).
- **Files modified:** `tsconfig.app.json`, `package.json`, +`tsconfig.test.json`. **Commit:** `b856cb2`.

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3 blocking). No Rule 4 architectural changes. The only files touched beyond the plan's `files_modified` list are `tsconfig.app.json`/`package.json`/`tsconfig.test.json` — all required to make the plan's own `npm run build`/`typecheck` acceptance gates pass; no feature scope creep.

## Threat-model adherence

All STRIDE `mitigate` dispositions for this plan's files implemented: T-04-03 (privacy guard FIRST in worker), T-04-04 (explicit error field list, no `cause`), T-04-05 (branded types + live canary), T-04-07 (Worker boundary + `{dense:true}` + WorkBook GC'd in handler), T-04-08 (SheetJS isolated to worker chunk — build-verified), T-04-09 (Total/Summary internal-row filter + test), T-04-10 (no empty→0 coercion for readiness; storage uses `Math.max(0, readNumber)` on RVTools-numeric MB cells), T-04-11 (`z.string().trim().min(1)` on identifiers). No new threat surface beyond the plan's `<threat_model>`.

## Security Scan

`semgrep` MCP tool not in the available tool set. The semgrep CLI was not invoked this run (rtk-wrapped shell; no MCP). New parser files are pure transforms with no `eval`/`Function`/dynamic-import/network; the privacy guard + supply-chain pin + CSP (Plans 01-02) are the active controls and all re-verified green (`check-supply-chain: OK`). Recommend a semgrep pass in Plan 05 review when the MCP tool is available.

## Known Stubs

None. `parser.worker.ts` shows 0% line coverage because jsdom cannot execute a real module Worker's `self.onmessage` handler — this is an environment limit, not a stub: every line of parser _logic_ it calls (`parseXlsx`, `parseSnapshot`, `inferCaptureDate`/`inferVCenterLabel`/`inferRvtoolsVersion`) is directly unit-tested, the canary proves the end-to-end transform, and `parseInWorker.test.ts` covers the main-thread half via a mocked Worker. The full `src/engines/parser/**` tree clears the 75% gate on all four metrics with margin.

## Self-Check

**Files claimed (spot sample):**

- `src/engines/parser/parser.worker.ts`: FOUND
- `src/engines/parser/parseInWorker.ts`: FOUND
- `src/engines/parser/captureDate.ts`: FOUND
- `src/engines/parser/canary.test.ts`: FOUND
- `src/types/snapshot.ts`: FOUND
- `scripts/seed-fixtures.mjs`: FOUND
- `tsconfig.test.json`: FOUND

**Commits claimed:**

- `8d78c22` (Task 1 RED): FOUND
- `3620290` (Task 1 GREEN): FOUND
- `ffdd017` (Task 2 RED): FOUND
- `2d1cac5` (Task 2 GREEN): FOUND
- `b856cb2` (Task 3): FOUND

**Gates re-run at SUMMARY time:** typecheck (app + test) exit 0; biome clean; test:run 89 passed (11 files); build green + `check-supply-chain: OK`; parser coverage 93.5/85.3/98.3/94.5; lexical drop-gate CLEAN; canary GREEN.

## TDD Gate Compliance

Tasks 1 & 2 are `tdd="true"`. Gate sequence verified in git log: Task 1 `test(01-04)` RED (`8d78c22`, modules genuinely absent — Vite could not resolve the imports, confirmed FAIL before any source) → `feat(01-04)` GREEN (`3620290`). Task 2 `test(01-04)` RED (`ffdd017`, captureDate absent — confirmed FAIL) → `feat(01-04)` GREEN (`2d1cac5`). No premature-pass: both RED states failed because the implementation modules did not exist. Compliant. (Plan frontmatter `type: execute`, not `type: tdd`, and global `tdd_mode:false` — per-task RED/GREEN honored as tagged.)

## Self-Check: PASSED

---
_Phase: 01-foundation-invariants_
_Completed: 2026-05-15_
