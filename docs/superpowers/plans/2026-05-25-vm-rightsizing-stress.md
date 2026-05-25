# VM Right-sizing & Stress Extract — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-VM Right-sizing & Stress extract (oversized / undersized / stressed, CPU and/or memory) sourced from RVTools `vMemory`+`vCPU`, surfaced in a dedicated web view and a new PPTX slide, with user-customizable threshold ratios.

**Architecture:** A new parser path reads two optional RVTools sheets into a parallel `VmUsageRow[]` on `Snapshot` (config stays on `VInfoRow`). A pure `sizing.ts` engine computes per-VM utilization and threshold flags, taking the **max across loaded snapshots** (powered-on only), threaded through the single `useEstateView` `useMemo` onto `EstateView.sizing`. A new view and a new PPTX slide consume it; thresholds live in a new in-memory store slice.

**Tech Stack:** React 19 · TypeScript strict · Zustand 5 · Zod 4 (parser boundary only) · pptxgenjs 4 · ECharts (SVG) · Vitest + @testing-library/react · Biome.

**Spec:** `docs/superpowers/specs/2026-05-25-vm-rightsizing-stress-and-de-it-i18n-design.md` (Workstream A). Workstream B (de/it localization) is **Plan 2**, written separately; this plan ships strings in `en`+`fr` only.

**Conventions for every task:**
- Lint with `npx @biomejs/biome check .` (NOT `npm run lint` — RTK intercepts it). Biome: single quotes, no semicolons, 2-space, 100-col.
- Typecheck with `npm run typecheck`. Tests with `npm run test:run`.
- Engines stay pure (no React/Zustand/Zod/DOM). Zod only at the parser boundary.
- Commit prefix `feat(rs-NN): …` (rs = right-sizing; NN = task number). Commits are signed by repo config — **never** pass `--no-gpg-sign`.
- Branded units: import `{ mib, mhz, cores }` and types `{ MiB, MHz, Cores }` from `@/engines/units`. RVTools "MB" is MiB; never multiply by 1.048576.

---

## File map

**Create:**
- `src/engines/aggregation/sizing.ts` — pure engine (thresholds, util math, flags, multi-snapshot max).
- `src/engines/aggregation/sizing.test.ts` — engine tests (≥75% gate).
- `src/engines/export/pptx/slides/rightSizingSlide.ts` — PPTX slide (native shapes/text only).
- `src/components/rightsizing/RightSizingView.tsx` — the web view.
- `src/components/rightsizing/RightSizingView.test.tsx` — view tests.
- `src/i18n/locales/en/rightsizing.json`, `src/i18n/locales/fr/rightsizing.json` — strings.

**Modify:**
- `src/types/vinfo.ts` — add `VmUsageRow` interface (co-located with VM types) **or** `src/types/snapshot.ts`; export via `src/types/index.ts`.
- `src/types/snapshot.ts` — add `vmUsage: VmUsageRow[]` to `Snapshot`.
- `src/types/estate.ts` — add `sizing: EstateSizing` to `EstateView` + the `VmSizing`/`EstateSizing`/`SizingCounts` types.
- `src/engines/parser/schemas.ts` — add `VmUsageRowSchema`.
- `src/engines/parser/adapters/rvtools.ts` — add `vMemory`/`vCPU` column maps, adapters, optional-sheet wiring.
- `src/engines/parser/index.ts` — `SnapshotRows` + `parseSnapshot` carry `vmUsage`.
- `src/engines/parser/parser.worker.ts` + `parseInWorker.ts` — pass `vmUsage` through the worker boundary.
- `src/engines/aggregation/estateView.ts` — compute `sizing` in the single pass; add `EMPTY_SIZING`; `opts.sizingThresholds`.
- `src/engines/aggregation/index.ts` — re-export sizing public surface.
- `src/engines/export/buildExportView.ts` — add `sizing` (computed over **all** snapshots) to `ExportView`.
- `src/engines/export/pptx/builder.ts` — call `addRightSizingSlide` (conditional on `hasUsageData`).
- `src/engines/export/export.worker.ts` — pass the all-snapshots sizing into `buildPptx`.
- `src/engines/export/types.ts` — add right-sizing keys to `ExportStrings`.
- `src/store/snapshotStore.ts` — add `sizingThresholds` slice + selectors + `clearAll`.
- `src/hooks/useEstateView.ts` — read + thread `sizingThresholds`.
- `src/App.tsx` + `src/components/ViewToggle.tsx` — register the `rightsizing` view/tab.
- `src/i18n/index.ts` — register the `rightsizing` namespace (en+fr).
- `src/i18n/locales/{en,fr}/inventory.json` — add `col.*` keys for new table columns.
- `src/i18n/locales/{en,fr}/pptx.json` — slide strings.
- `scripts/generate-inventory-10k.mjs` (and/or `scripts/seed-fixtures.mjs`) — emit `vMemory`/`vCPU` sheets.

---

# Phase A — Data layer

### Task A1: `VmUsageRow` type + `Snapshot.vmUsage`

**Files:**
- Modify: `src/types/vinfo.ts`
- Modify: `src/types/snapshot.ts:49` (the `Snapshot` row fields block)
- Modify: `src/types/index.ts`
- Test: covered indirectly by A2 schema test + A4 parse test (no standalone test for a type).

- [ ] **Step 1: Add the `VmUsageRow` interface** to `src/types/vinfo.ts` (append after `VInfoRow`):

```ts
/**
 * Per-VM RUNTIME/perf metrics from the RVTools `vMemory` + `vCPU` sheets.
 * Kept SEPARATE from `VInfoRow` (config/inventory) — config-vs-perf split.
 * Joined to a VM by identity (`vmInstanceUuid` → `vmBiosUuid` →
 * `vmName+cluster`). Every metric is `null` when the cell is absent/blank
 * ("not derivable") — NEVER coerced to 0 (ADR-0012; same rule as
 * `cpuReadinessPercent`). Point-in-time per snapshot.
 */
export interface VmUsageRow {
  vmName: string
  cluster: string
  vmBiosUuid: string
  vmInstanceUuid: string
  /** vMemory `Active` — guest working set (MiB). null when absent. */
  activeMib: MiB | null
  /** vMemory `Consumed` — host RAM backing the VM (MiB). null when absent. */
  consumedMib: MiB | null
  /** vMemory `Ballooned` (MiB). null when absent. */
  balloonedMib: MiB | null
  /** vMemory `Swapped` (MiB). null when absent. */
  swappedMib: MiB | null
  /** vCPU `Overall CPU usage` (MHz). null when absent. */
  cpuUsageMhz: MHz | null
}
```

Ensure the imports at the top of `vinfo.ts` include `MHz`: change `import type { Cores, MiB } from '@/engines/units'` to `import type { Cores, MHz, MiB } from '@/engines/units'`.

- [ ] **Step 2: Add `vmUsage` to `Snapshot`** in `src/types/snapshot.ts`. After the `vinfo`/`vhost` lines (around line 50), add:

```ts
  /** Per-VM runtime/perf metrics from `vMemory`+`vCPU`. `[]` when both
   *  OPTIONAL sheets are absent (factual-degrade). Never undefined. */
  vmUsage: VmUsageRow[]
```

Add `VInfoRow`'s sibling import: at the top of `snapshot.ts` it imports `VInfoRow` from `./vinfo`; extend it to `import type { VInfoRow, VmUsageRow } from './vinfo'`.

Also add `vmUsage: []` to the `releaseRawRows` reset object in `src/store/snapshotStore.ts:182` (the DD-C row-release path nulls all row arrays) — do this now to keep the type consistent:

```ts
        vmUsage: [],
```

- [ ] **Step 3: Export the type** from `src/types/index.ts` — add `VmUsageRow` to the re-exported names from `./vinfo` (match the existing export style in that file).

- [ ] **Step 4: Typecheck (expected: FAIL)**

Run: `npm run typecheck`
Expected: FAIL — `Snapshot` literals lacking `vmUsage` (parser, worker, fixtures). These are fixed in A3–A5; the failures confirm the field is required everywhere.

- [ ] **Step 5: Commit**

```bash
git add src/types/vinfo.ts src/types/snapshot.ts src/types/index.ts src/store/snapshotStore.ts
git commit -m "feat(rs-01): add VmUsageRow type and Snapshot.vmUsage field"
```

---

### Task A2: `VmUsageRowSchema` (parser boundary)

**Files:**
- Modify: `src/engines/parser/schemas.ts`
- Test: `src/engines/parser/schemas` is exercised via `rvtools.test.ts`; add a focused test file `src/engines/parser/vmUsageSchema.test.ts`.

- [ ] **Step 1: Write the failing test** — create `src/engines/parser/vmUsageSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { VmUsageRowSchema } from './schemas'

describe('VmUsageRowSchema', () => {
  it('accepts a full row and brands the units', () => {
    const r = VmUsageRowSchema.parse({
      vmName: 'web01',
      cluster: 'C1',
      vmBiosUuid: 'b',
      vmInstanceUuid: 'i',
      activeMib: 1024,
      consumedMib: 2048,
      balloonedMib: 0,
      swappedMib: 0,
      cpuUsageMhz: 300,
    })
    expect(r.activeMib).toBe(1024)
    expect(r.cpuUsageMhz).toBe(300)
  })

  it('accepts null metrics (not-derivable) without coercing to 0', () => {
    const r = VmUsageRowSchema.parse({
      vmName: 'web01',
      cluster: 'C1',
      vmBiosUuid: '',
      vmInstanceUuid: '',
      activeMib: null,
      consumedMib: null,
      balloonedMib: null,
      swappedMib: null,
      cpuUsageMhz: null,
    })
    expect(r.activeMib).toBeNull()
    expect(r.cpuUsageMhz).toBeNull()
  })

  it('rejects a negative metric', () => {
    const res = VmUsageRowSchema.safeParse({
      vmName: 'x',
      cluster: 'C1',
      vmBiosUuid: '',
      vmInstanceUuid: '',
      activeMib: -1,
      consumedMib: null,
      balloonedMib: null,
      swappedMib: null,
      cpuUsageMhz: null,
    })
    expect(res.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run it (expected: FAIL — `VmUsageRowSchema` not exported)**

Run: `npm run test:run -- src/engines/parser/vmUsageSchema.test.ts`
Expected: FAIL (import error / undefined).

- [ ] **Step 3: Implement the schema** in `src/engines/parser/schemas.ts`. Add a nullable branded helper and the schema. After the existing `MibSchema` definition add:

```ts
const NullableMibSchema = z
  .number()
  .nonnegative()
  .nullable()
  .transform((n) => (n === null ? null : (n as MiB)))
const NullableMhzSchema = z
  .number()
  .nonnegative()
  .nullable()
  .transform((n) => (n === null ? null : (n as MHz)))
```

Add `MHz` to the units type import at the top of the file (it currently imports `Cores, MHz, MiB, Sockets` per its header — verify; if `MHz` is missing, add it). Add `VmUsageRow` to the `@/types` type import block. Then add:

```ts
export const VmUsageRowSchema: z.ZodType<VmUsageRow> = z.object({
  vmName: z.string().trim().min(1),
  cluster: z.string().trim(),
  vmBiosUuid: z.string().trim(),
  vmInstanceUuid: z.string().trim(),
  activeMib: NullableMibSchema,
  consumedMib: NullableMibSchema,
  balloonedMib: NullableMibSchema,
  swappedMib: NullableMibSchema,
  cpuUsageMhz: NullableMhzSchema,
})
```

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/parser/vmUsageSchema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/schemas.ts src/engines/parser/vmUsageSchema.test.ts
git commit -m "feat(rs-02): add VmUsageRowSchema with nullable branded metrics"
```

---

### Task A3: `vMemory` + `vCPU` adapters

**Files:**
- Modify: `src/engines/parser/adapters/rvtools.ts`
- Test: `src/engines/parser/adapters/rvtools.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — append to `src/engines/parser/adapters/rvtools.test.ts`:

```ts
import { adaptRvtoolsVMemory, adaptRvtoolsVCpu } from './rvtools'

describe('adaptRvtoolsVMemory', () => {
  it('maps Active/Consumed/Ballooned/Swapped and identity; blank → null', () => {
    const sheet = {
      headers: ['VM', 'Cluster', 'VM Instance UUID', 'Active', 'Consumed', 'Ballooned', 'Swapped'],
      rows: [
        { VM: 'web01', Cluster: 'C1', 'VM Instance UUID': 'i1', Active: 512, Consumed: 1024, Ballooned: 0, Swapped: '' },
        { VM: 'Total', Cluster: '', 'VM Instance UUID': '', Active: 1, Consumed: 1, Ballooned: 1, Swapped: 1 },
      ],
    }
    const out = adaptRvtoolsVMemory(sheet as never)
    expect(out).toHaveLength(1)
    expect(out[0]?.activeMib).toBe(512)
    expect(out[0]?.consumedMib).toBe(1024)
    expect(out[0]?.balloonedMib).toBe(0)
    expect(out[0]?.swappedMib).toBeNull()
    expect(out[0]?.cpuUsageMhz).toBeNull()
  })
})

describe('adaptRvtoolsVCpu', () => {
  it('maps Overall CPU usage (MHz) and identity', () => {
    const sheet = {
      headers: ['VM', 'Cluster', 'VM Instance UUID', 'Overall Cpu Usage'],
      rows: [{ VM: 'web01', Cluster: 'C1', 'VM Instance UUID': 'i1', 'Overall Cpu Usage': 300 }],
    }
    const out = adaptRvtoolsVCpu(sheet as never)
    expect(out).toHaveLength(1)
    expect(out[0]?.cpuUsageMhz).toBe(300)
    expect(out[0]?.activeMib).toBeNull()
  })
})
```

- [ ] **Step 2: Run it (expected: FAIL — functions not exported)**

Run: `npm run test:run -- src/engines/parser/adapters/rvtools.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the adapters** in `src/engines/parser/adapters/rvtools.ts`.

Add `VmUsageRow` to the `@/types` type import. Add column maps near `VINFO_COLS` (longest spelling first, MiB-suffix drift):

```ts
const VMEMORY_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  cluster: ['cluster', 'grappe'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  activeMib: ['active mib', 'active mb', 'active'],
  consumedMib: ['consumed mib', 'consumed mb', 'consumed'],
  balloonedMib: ['ballooned mib', 'ballooned mb', 'ballooned', 'balloon'],
  swappedMib: ['swapped mib', 'swapped mb', 'swapped'],
} as const

const VCPU_COLS = {
  vmName: ['vm', 'vm name', 'name'],
  cluster: ['cluster', 'grappe'],
  vmBiosUuid: ['vm uuid', 'bios uuid', 'uuid'],
  vmInstanceUuid: ['vm instance uuid', 'instance uuid'],
  cpuUsageMhz: ['overall cpu usage', 'cpu usage mhz', 'cpu usage', 'usage mhz'],
} as const
```

Add a strict nullable-MiB/MHz cell parser (mirrors `parseReadinessCell`):

```ts
/** Strict nullable numeric cell: blank/sentinel/absent → null (not 0). */
const parseUsageCell = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, v) : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '' || t.startsWith('#')) return null
    const u = t.toUpperCase()
    if (u === '-' || u === '--' || u === 'N/A' || u === 'NA') return null
    const n = Number.parseFloat(t.replace(/[\s']/g, '').replace(/%$/, '').replace(',', '.'))
    return Number.isFinite(n) ? Math.max(0, n) : null
  }
  return null
}
```

Add the two adapters (note `isInternalRow` is already defined in this file; reuse it):

```ts
export const adaptRvtoolsVMemory = (sheet: ParsedSheet): VmUsageRow[] => {
  const cols = mapColumns(sheet.headers, VMEMORY_COLS)
  return sheet.rows
    .map((row): VmUsageRow => {
      const a = parseUsageCell(readCol(row, cols.activeMib))
      const c = parseUsageCell(readCol(row, cols.consumedMib))
      const b = parseUsageCell(readCol(row, cols.balloonedMib))
      const s = parseUsageCell(readCol(row, cols.swappedMib))
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        activeMib: a === null ? null : mib(a),
        consumedMib: c === null ? null : mib(c),
        balloonedMib: b === null ? null : mib(b),
        swappedMib: s === null ? null : mib(s),
        cpuUsageMhz: null,
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
}

export const adaptRvtoolsVCpu = (sheet: ParsedSheet): VmUsageRow[] => {
  const cols = mapColumns(sheet.headers, VCPU_COLS)
  return sheet.rows
    .map((row): VmUsageRow => {
      const u = parseUsageCell(readCol(row, cols.cpuUsageMhz))
      return {
        vmName: readString(readCol(row, cols.vmName)),
        cluster: readString(readCol(row, cols.cluster)),
        vmBiosUuid: readString(readCol(row, cols.vmBiosUuid)),
        vmInstanceUuid: readString(readCol(row, cols.vmInstanceUuid)),
        activeMib: null,
        consumedMib: null,
        balloonedMib: null,
        swappedMib: null,
        cpuUsageMhz: u === null ? null : mhz(u),
      }
    })
    .filter((r) => !isInternalRow(r.vmName))
}
```

Add a merge helper that unions the two sheets by identity into one `VmUsageRow[]`:

```ts
/** Identity key for joining vMemory/vCPU rows to a VM. */
const usageIdentity = (r: { vmInstanceUuid: string; vmBiosUuid: string; vmName: string; cluster: string }): string =>
  r.vmInstanceUuid || r.vmBiosUuid || `${r.vmName}::${r.cluster}`

const mergeUsage = (mem: VmUsageRow[], cpu: VmUsageRow[]): VmUsageRow[] => {
  const byId = new Map<string, VmUsageRow>()
  for (const r of mem) byId.set(usageIdentity(r), r)
  for (const r of cpu) {
    const id = usageIdentity(r)
    const prev = byId.get(id)
    if (prev) prev.cpuUsageMhz = r.cpuUsageMhz
    else byId.set(id, r)
  }
  return [...byId.values()]
}
```

Wire into `adaptRvtools`: extend its return type with `vmUsage: VmUsageRow[]`, find the optional sheets, and add to the returned object. After the `dvportSheet` block add:

```ts
  const vmemSheet = findSheet(workbook, ['vmemory', 'rvtools_tabvmemory'])
  if (!vmemSheet) {
    warnings.push({
      sheet: 'vMemory',
      kind: 'missing-sheet',
      message: 'optional sheet vMemory absent — memory utilization/ballooning unavailable',
    })
  }
  const vcpuSheet = findSheet(workbook, ['vcpu', 'rvtools_tabvcpu'])
  if (!vcpuSheet) {
    warnings.push({
      sheet: 'vCPU',
      kind: 'missing-sheet',
      message: 'optional sheet vCPU absent — CPU utilization unavailable',
    })
  }
```

And in the returned object add:

```ts
    vmUsage: mergeUsage(
      vmemSheet ? adaptRvtoolsVMemory(vmemSheet) : [],
      vcpuSheet ? adaptRvtoolsVCpu(vcpuSheet) : [],
    ),
```

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/parser/adapters/rvtools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/rvtools.ts src/engines/parser/adapters/rvtools.test.ts
git commit -m "feat(rs-03): parse vMemory+vCPU into a unioned VmUsageRow set"
```

---

### Task A4: `parseSnapshot` carries `vmUsage`

**Files:**
- Modify: `src/engines/parser/index.ts`
- Test: `src/engines/parser/parseInWorker.test.ts` or a new assertion in an existing parse test.

- [ ] **Step 1: Write the failing assertion** — add to `src/engines/parser/normalizeColumns.test.ts` (it already drives `parseSnapshot` via `parseXlsx`), or create `src/engines/parser/vmUsageParse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSnapshot } from './normalizeColumns'

const wb = {
  sheets: new Map<string, { headers: string[]; rows: Record<string, unknown>[] }>([
    ['vInfo', { headers: ['VM', 'Cluster', 'Host', 'CPUs', 'Memory', 'Powerstate'], rows: [
      { VM: 'web01', Cluster: 'C1', Host: 'h1', CPUs: 4, Memory: 8192, Powerstate: 'poweredOn' },
    ] }],
    ['vHost', { headers: ['Host', 'Cluster', '# CPU', '# Cores', 'Speed', 'Memory', 'CPU usage %', 'Memory usage %'], rows: [
      { Host: 'h1', Cluster: 'C1', '# CPU': 2, '# Cores': 16, Speed: 2200, Memory: 262144, 'CPU usage %': 10, 'Memory usage %': 10 },
    ] }],
    ['vMemory', { headers: ['VM', 'Cluster', 'VM Instance UUID', 'Active', 'Consumed', 'Ballooned', 'Swapped'], rows: [
      { VM: 'web01', Cluster: 'C1', 'VM Instance UUID': 'i1', Active: 1024, Consumed: 2048, Ballooned: 0, Swapped: 0 },
    ] }],
    ['vCPU', { headers: ['VM', 'Cluster', 'VM Instance UUID', 'Overall Cpu Usage'], rows: [
      { VM: 'web01', Cluster: 'C1', 'VM Instance UUID': 'i1', 'Overall Cpu Usage': 300 },
    ] }],
  ]),
}

describe('parseSnapshot vmUsage', () => {
  it('emits a vmUsage row joining vMemory + vCPU by identity', () => {
    const { snapshot } = parseSnapshot(wb as never)
    expect(snapshot.vmUsage).toHaveLength(1)
    expect(snapshot.vmUsage[0]?.activeMib).toBe(1024)
    expect(snapshot.vmUsage[0]?.cpuUsageMhz).toBe(300)
  })
})
```

> Note: `parseSnapshot` lives in `normalizeColumns.ts` (verify the import path against that file — it is re-exported there). If `parseXlsx`'s `ParsedWorkbook` shape differs, build the workbook via the test helpers already used in `normalizeColumns.test.ts`.

- [ ] **Step 2: Run it (expected: FAIL — `vmUsage` undefined / type error)**

Run: `npm run test:run -- src/engines/parser/vmUsageParse.test.ts`
Expected: FAIL.

- [ ] **Step 3: Wire it in** `src/engines/parser/index.ts`:
  - Add `vmUsage` to the `SnapshotRows` `Pick<>` union (line ~32).
  - In `parseSnapshot`, `adaptRvtools` now returns `vmUsage`; pass it straight through (it is adapter output, already typed — no Zod re-validation needed at the row level, but validate for safety using the generic `validate` helper):

```ts
  const vmUsage = validate<VmUsageRow>(raw.vmUsage, VmUsageRowSchema, 'vMemory/vCPU')
```

  Add `VmUsageRowSchema` to the `./schemas` import and `VmUsageRow` to the `@/types` import. Add `...vmUsage.errors` to `parseErrors`, and `vmUsage: vmUsage.rows` to the returned `snapshot` object.

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/parser/vmUsageParse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/index.ts src/engines/parser/vmUsageParse.test.ts
git commit -m "feat(rs-04): thread vmUsage through parseSnapshot"
```

---

### Task A5: Worker boundary carries `vmUsage`

**Files:**
- Modify: `src/engines/parser/parser.worker.ts`
- Modify: `src/engines/parser/parseInWorker.ts`
- Test: `src/engines/parser/parseInWorker.test.ts` (extend)

- [ ] **Step 1: Read both files** to see how `SnapshotRows` fields are copied onto the posted `Snapshot`. Identify where `vinfo`/`vhost`/etc. are assembled into the `Snapshot` (the worker stamps `id`/`parsedAt`/metadata; the row fields are spread or listed).

- [ ] **Step 2: Write the failing assertion** — in `src/engines/parser/parseInWorker.test.ts`, extend the existing happy-path test to assert the resulting snapshot has `vmUsage` as an array (use the same fixture shape as A4, or the existing test fixture augmented with `vMemory`/`vCPU` sheets):

```ts
expect(Array.isArray(result.snapshot.vmUsage)).toBe(true)
```

- [ ] **Step 3: Run it (expected: FAIL)**

Run: `npm run test:run -- src/engines/parser/parseInWorker.test.ts`
Expected: FAIL (`vmUsage` undefined).

- [ ] **Step 4: Add `vmUsage`** to wherever the worker/`parseInWorker` builds the `Snapshot` from `SnapshotRows` (mirror the existing `vinfo`/`vnetwork` lines exactly — add `vmUsage: snapshot.vmUsage`). If the code spreads `...snapshot`, no change is needed beyond the type; verify by typecheck.

- [ ] **Step 5: Run typecheck + test (expected: PASS)**

Run: `npm run typecheck && npm run test:run -- src/engines/parser/parseInWorker.test.ts`
Expected: PASS. (Typecheck should now be clean for the parser layer.)

- [ ] **Step 6: Commit**

```bash
git add src/engines/parser/parser.worker.ts src/engines/parser/parseInWorker.ts src/engines/parser/parseInWorker.test.ts
git commit -m "feat(rs-05): carry vmUsage across the parser worker boundary"
```

---

# Phase B — Sizing engine

### Task B1: `sizing.ts` pure engine

**Files:**
- Create: `src/engines/aggregation/sizing.ts`
- Create: `src/engines/aggregation/sizing.test.ts`

- [ ] **Step 1: Write the failing tests** — `src/engines/aggregation/sizing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cores, mhz, mib } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow } from '@/types/vinfo'
import {
  DEFAULT_SIZING_THRESHOLDS,
  computeSizing,
  maxVmUsageAcrossSnapshots,
} from './sizing'

const vinfo = (over: Partial<VInfoRow> = {}): VInfoRow => ({
  vmName: 'web01', cluster: 'C1', host: 'h1', vcpu: cores(4), vramMib: mib(8192),
  cpuReadinessPercent: null, powerState: 'poweredOn', template: false, poweredOn: true,
  osConfig: '', osTools: '', vmBiosUuid: 'b1', vmInstanceUuid: 'i1', viSdkUuid: '',
  viSdkServer: '', provisionedMib: mib(0), inUseMib: mib(0), path: '', ...over,
})
const host = (): VHostRow => ({
  hostName: 'h1', cluster: 'C1', sockets: 2 as never, cores: cores(16), speedMhz: mhz(2200),
  memoryMib: mib(262144), cpuRatio: 0.1, ramRatio: 0.1, faultDomain: '', model: '', vendor: '',
  esxVersion: '',
})
const snap = (vmUsage: Snapshot['vmUsage'], vi: VInfoRow[] = [vinfo()]): Snapshot =>
  ({ vinfo: vi, vmUsage } as unknown as Snapshot)

describe('computeSizing oversize', () => {
  it('flags CPU + memory oversized when usage is far below capacity', () => {
    // capacity = 4 * 2200 = 8800 MHz; usage 300 → 3.4% ≤ 10 → cpuOversized
    // active 1024 / 8192 = 12.5% ≤ 20 → memOversized
    const max = maxVmUsageAcrossSnapshots([
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: mib(1024), consumedMib: mib(2048), balloonedMib: mib(0), swappedMib: mib(0),
        cpuUsageMhz: mhz(300) }]),
    ])
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    const row = res.rows[0]
    expect(row?.cpuUtilPct).toBeCloseTo(3.41, 1)
    expect(row?.memActivePct).toBeCloseTo(12.5, 1)
    expect(row?.flags.cpuOversized).toBe(true)
    expect(row?.flags.memOversized).toBe(true)
    expect(res.counts.oversized).toBe(1)
  })
})

describe('computeSizing stress', () => {
  it('flags memStressed on ballooning and cpuStressed on CPU ready > 5%', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: null, consumedMib: null, balloonedMib: mib(64), swappedMib: mib(0),
        cpuUsageMhz: null }], [vinfo({ cpuReadinessPercent: 7 })]),
    ])
    const res = computeSizing([vinfo({ cpuReadinessPercent: 7 })], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    expect(res.rows[0]?.flags.memStressed).toBe(true)
    expect(res.rows[0]?.flags.cpuStressed).toBe(true)
    expect(res.counts.stressed).toBe(1)
  })
})

describe('computeSizing null-discipline + guards', () => {
  it('null usage → util null, no flags, not counted', () => {
    const max = maxVmUsageAcrossSnapshots([snap([])])
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    expect(res.rows[0]?.cpuUtilPct).toBeNull()
    expect(res.rows[0]?.flags.cpuOversized).toBe(false)
    expect(res.counts.oversized).toBe(0)
  })

  it('vramMib 0 → memActivePct null (no divide-by-zero)', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: mib(10), consumedMib: null, balloonedMib: null, swappedMib: null,
        cpuUsageMhz: null }], [vinfo({ vramMib: mib(0) })]),
    ])
    const res = computeSizing([vinfo({ vramMib: mib(0) })], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    expect(res.rows[0]?.memActivePct).toBeNull()
  })

  it('excludes powered-off VMs', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: mib(1), consumedMib: null, balloonedMib: null, swappedMib: null,
        cpuUsageMhz: mhz(1) }], [vinfo({ poweredOn: false, powerState: 'poweredOff' })]),
    ])
    const res = computeSizing([vinfo({ poweredOn: false, powerState: 'poweredOff' })], [host()], max, DEFAULT_SIZING_THRESHOLDS, 1)
    expect(res.rows).toHaveLength(0)
  })
})

describe('maxVmUsageAcrossSnapshots', () => {
  it('takes the per-identity max across snapshots and sets sampleBasis', () => {
    const max = maxVmUsageAcrossSnapshots([
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: mib(1000), consumedMib: null, balloonedMib: null, swappedMib: null, cpuUsageMhz: mhz(100) }]),
      snap([{ vmName: 'web01', cluster: 'C1', vmBiosUuid: 'b1', vmInstanceUuid: 'i1',
        activeMib: mib(3000), consumedMib: null, balloonedMib: null, swappedMib: null, cpuUsageMhz: mhz(50) }]),
    ])
    expect(max.get('i1')?.activeMib).toBe(3000)
    expect(max.get('i1')?.cpuUsageMhz).toBe(100)
    const res = computeSizing([vinfo()], [host()], max, DEFAULT_SIZING_THRESHOLDS, 2)
    expect(res.rows[0]?.sampleBasis).toBe('max-of-N')
  })
})
```

- [ ] **Step 2: Run it (expected: FAIL — module not found)**

Run: `npm run test:run -- src/engines/aggregation/sizing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `src/engines/aggregation/sizing.ts`:

```ts
import type { Snapshot } from '@/types/snapshot'
import type { VHostRow } from '@/types/vhost'
import type { VInfoRow, VmUsageRow } from '@/types/vinfo'
import { CONTENTION_THRESHOLDS } from './contention'

/**
 * Pure right-sizing/stress engine (mirrors thresholdFlags.ts + contention.ts).
 * No React/Zustand/Zod/DOM. Evaluates per-resource (CPU and/or memory), on
 * powered-on VMs only, using the MAX across loaded snapshots. Any null input
 * ⇒ that resource's util is null and its flags false (ADR-0012 — never coerce
 * an absent measurement to 0). Divide-by-zero guarded (the fsOver precedent).
 */

export interface SizingThresholds {
  cpuOversizePct: number
  memOversizePct: number
  cpuUndersizePct: number
  memUndersizePct: number
  balloonMib: number
  swapMib: number
}

/** Single source of truth; the store re-exports this (DEFAULT_THRESHOLDS pattern). */
export const DEFAULT_SIZING_THRESHOLDS: SizingThresholds = {
  cpuOversizePct: 10,
  memOversizePct: 20,
  cpuUndersizePct: 90,
  memUndersizePct: 90,
  balloonMib: 0,
  swapMib: 0,
}

export interface SizingFlags {
  cpuOversized: boolean
  memOversized: boolean
  cpuUndersized: boolean
  memUndersized: boolean
  memStressed: boolean
  cpuStressed: boolean
}

export interface VmSizing {
  vmName: string
  cluster: string
  host: string
  vcpu: number
  vramMib: number
  cpuUtilPct: number | null
  memActivePct: number | null
  memConsumedPct: number | null
  balloonedMib: number | null
  swappedMib: number | null
  cpuReadinessPercent: number | null
  sampleBasis: 'single' | 'max-of-N'
  flags: SizingFlags
}

export interface SizingCounts {
  oversized: number
  undersized: number
  stressed: number
  cpuOversized: number
  memOversized: number
  cpuUndersized: number
  memUndersized: number
  memStressed: number
  cpuStressed: number
}

export interface EstateSizing {
  rows: VmSizing[]
  counts: SizingCounts
  thresholds: SizingThresholds
  snapshotCount: number
  /** true when any usage metric was derivable across the snapshots. */
  hasUsageData: boolean
}

export interface MaxUsage {
  activeMib: number | null
  consumedMib: number | null
  balloonedMib: number | null
  swappedMib: number | null
  cpuUsageMhz: number | null
}

const usageIdentity = (r: {
  vmInstanceUuid: string
  vmBiosUuid: string
  vmName: string
  cluster: string
}): string => r.vmInstanceUuid || r.vmBiosUuid || `${r.vmName}::${r.cluster}`

const maxN = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b)

/** Per-identity max of each usage metric over POWERED-ON samples. */
export const maxVmUsageAcrossSnapshots = (snapshots: Snapshot[]): Map<string, MaxUsage> => {
  const out = new Map<string, MaxUsage>()
  for (const snap of snapshots) {
    const poweredOn = new Set<string>()
    for (const v of snap.vinfo) if (v.poweredOn) poweredOn.add(usageIdentity(v))
    for (const u of snap.vmUsage) {
      const id = usageIdentity(u)
      if (!poweredOn.has(id)) continue
      const prev = out.get(id)
      const num = (x: VmUsageRow[keyof VmUsageRow] | null): number | null =>
        x === null ? null : (x as unknown as number)
      const next: MaxUsage = {
        activeMib: maxN(prev?.activeMib ?? null, num(u.activeMib)),
        consumedMib: maxN(prev?.consumedMib ?? null, num(u.consumedMib)),
        balloonedMib: maxN(prev?.balloonedMib ?? null, num(u.balloonedMib)),
        swappedMib: maxN(prev?.swappedMib ?? null, num(u.swappedMib)),
        cpuUsageMhz: maxN(prev?.cpuUsageMhz ?? null, num(u.cpuUsageMhz)),
      }
      out.set(id, next)
    }
  }
  return out
}

/** CPU utilization % — null when usage/capacity not derivable (guarded). */
export const cpuUtil = (
  usageMhz: number | null,
  vcpu: number,
  coreMhz: number | undefined,
): number | null => {
  if (usageMhz === null || coreMhz === undefined) return null
  const cap = vcpu * coreMhz
  return cap > 0 ? (usageMhz / cap) * 100 : null
}

/** Memory % of configured — null when active null or configured 0. */
export const memPct = (mibUsed: number | null, vramMib: number): number | null =>
  mibUsed === null || vramMib <= 0 ? null : (mibUsed / vramMib) * 100

export const computeSizing = (
  vinfo: VInfoRow[],
  vhost: VHostRow[],
  maxUsage: Map<string, MaxUsage>,
  thresholds: SizingThresholds,
  snapshotCount: number,
): EstateSizing => {
  const speedByHost = new Map<string, number>()
  for (const h of vhost) if (h.hostName !== '') speedByHost.set(h.hostName, h.speedMhz as number)

  const basis: VmSizing['sampleBasis'] = snapshotCount >= 2 ? 'max-of-N' : 'single'
  const rows: VmSizing[] = []
  let hasUsageData = false
  const counts: SizingCounts = {
    oversized: 0, undersized: 0, stressed: 0,
    cpuOversized: 0, memOversized: 0, cpuUndersized: 0, memUndersized: 0,
    memStressed: 0, cpuStressed: 0,
  }

  for (const v of vinfo) {
    if (!v.poweredOn) continue
    const id = usageIdentity(v)
    const u = maxUsage.get(id)
    if (u) hasUsageData = true
    const vcpuN = v.vcpu as number
    const vramN = v.vramMib as number
    const cpuUtilPct = cpuUtil(u?.cpuUsageMhz ?? null, vcpuN, speedByHost.get(v.host))
    const memActivePct = memPct(u?.activeMib ?? null, vramN)
    const memConsumedPct = memPct(u?.consumedMib ?? null, vramN)
    const ballooned = u?.balloonedMib ?? null
    const swapped = u?.swappedMib ?? null
    const ready = v.cpuReadinessPercent

    const flags: SizingFlags = {
      cpuOversized: cpuUtilPct !== null && cpuUtilPct <= thresholds.cpuOversizePct,
      memOversized: memActivePct !== null && memActivePct <= thresholds.memOversizePct,
      cpuUndersized: cpuUtilPct !== null && cpuUtilPct >= thresholds.cpuUndersizePct,
      memUndersized: memActivePct !== null && memActivePct >= thresholds.memUndersizePct,
      memStressed:
        (ballooned !== null && ballooned > thresholds.balloonMib) ||
        (swapped !== null && swapped > thresholds.swapMib),
      cpuStressed: ready !== null && ready > CONTENTION_THRESHOLDS.warning,
    }
    if (flags.cpuOversized) counts.cpuOversized += 1
    if (flags.memOversized) counts.memOversized += 1
    if (flags.cpuUndersized) counts.cpuUndersized += 1
    if (flags.memUndersized) counts.memUndersized += 1
    if (flags.memStressed) counts.memStressed += 1
    if (flags.cpuStressed) counts.cpuStressed += 1
    if (flags.cpuOversized || flags.memOversized) counts.oversized += 1
    if (flags.cpuUndersized || flags.memUndersized) counts.undersized += 1
    if (flags.memStressed || flags.cpuStressed) counts.stressed += 1

    rows.push({
      vmName: v.vmName, cluster: v.cluster, host: v.host, vcpu: vcpuN, vramMib: vramN,
      cpuUtilPct, memActivePct, memConsumedPct, balloonedMib: ballooned, swappedMib: swapped,
      cpuReadinessPercent: ready, sampleBasis: basis, flags,
    })
  }

  return { rows, counts, thresholds, snapshotCount, hasUsageData }
}
```

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/aggregation/sizing.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/engines/aggregation/sizing.ts src/engines/aggregation/sizing.test.ts
git commit -m "feat(rs-06): add pure sizing engine (util, flags, multi-snapshot max)"
```

---

### Task B2: `EstateView.sizing` type + `EMPTY_SIZING`

**Files:**
- Modify: `src/types/estate.ts`
- Modify: `src/engines/aggregation/index.ts`

- [ ] **Step 1:** In `src/types/estate.ts`, import and surface the engine types. Add near the other estate types:

```ts
import type { EstateSizing } from '@/engines/aggregation/sizing'
```
> If `estate.ts` must stay import-free of engines (check the file header), instead re-declare `EstateSizing`/`VmSizing`/`SizingCounts`/`SizingThresholds` here and have `sizing.ts` import them from `@/types/estate` (the `ThresholdInput`-style "engine owns it, types re-export" pattern used by `thresholdFlags.ts`). Pick whichever matches the existing convention — `thresholdFlags.ts` defines `ThresholdInput` in the engine and `estate.ts` does not import it, so prefer: **engine owns the types; `EstateView.sizing` is typed `EstateSizing` via a type-only import**, mirroring how `EstateView` already references `EosProjection` etc.

Add to the `EstateView` interface:

```ts
  /** P-RS right-sizing/stress extract (oversized/undersized/stressed). */
  sizing: EstateSizing
```

- [ ] **Step 2:** Re-export the sizing surface from `src/engines/aggregation/index.ts`:

```ts
export {
  computeSizing,
  DEFAULT_SIZING_THRESHOLDS,
  type EstateSizing,
  maxVmUsageAcrossSnapshots,
  type SizingThresholds,
  type VmSizing,
} from './sizing'
```

- [ ] **Step 3: Typecheck (expected: FAIL — `EMPTY_VIEW` lacks `sizing`)**

Run: `npm run typecheck`
Expected: FAIL in `estateView.ts` (EMPTY_VIEW) and `buildEstateView` return — fixed in B3.

- [ ] **Step 4: Commit** (after B3 makes it pass — or commit type + index together with B3).

---

### Task B3: Compute `sizing` in `buildEstateView`

**Files:**
- Modify: `src/engines/aggregation/estateView.ts`
- Test: `src/engines/aggregation/estateView.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — add to `src/engines/aggregation/estateView.test.ts` a case that builds a merged estate with one powered-on VM + matching host + a `selected` snapshot carrying `vmUsage`, then asserts `view.sizing.rows[0].flags.cpuOversized` etc. Reuse the test factories already in that file; pattern after the existing `buildEstateView` cases. Minimal assertion:

```ts
it('computes sizing.rows from selected snapshots vmUsage', () => {
  // build `merged` + `selected` with one powered-on VM (vcpu 4 on a 2200MHz host),
  // vmUsage cpuUsageMhz 300 (≈3.4%) → cpuOversized true
  // (use the file's existing helpers to assemble merged/selected)
  const view = buildEstateView(merged, selected, 'active', new Date('2026-01-01'))
  expect(view.sizing.rows[0]?.flags.cpuOversized).toBe(true)
  expect(view.sizing.hasUsageData).toBe(true)
})
```

- [ ] **Step 2: Run it (expected: FAIL)**

Run: `npm run test:run -- src/engines/aggregation/estateView.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `estateView.ts`:
  - Add imports: `import { computeSizing, DEFAULT_SIZING_THRESHOLDS, maxVmUsageAcrossSnapshots, type SizingThresholds } from './sizing'`.
  - Add `sizingThresholds?: SizingThresholds` to the `opts` object type.
  - In the single pass (after `trends`), add:

```ts
  const sizingThresholds = opts?.sizingThresholds ?? DEFAULT_SIZING_THRESHOLDS
  const sizing = computeSizing(
    merged.vinfo,
    merged.vhost,
    maxVmUsageAcrossSnapshots(selected),
    sizingThresholds,
    selected.length,
  )
```

  - Add `sizing,` to the returned object.
  - Add `EMPTY_SIZING` and put it in `EMPTY_VIEW`:

```ts
const EMPTY_SIZING = Object.freeze({
  rows: Object.freeze([]) as never[],
  counts: Object.freeze({
    oversized: 0, undersized: 0, stressed: 0, cpuOversized: 0, memOversized: 0,
    cpuUndersized: 0, memUndersized: 0, memStressed: 0, cpuStressed: 0,
  }),
  thresholds: DEFAULT_SIZING_THRESHOLDS,
  snapshotCount: 0,
  hasUsageData: false,
})
```
  Add `sizing: EMPTY_SIZING,` to `EMPTY_VIEW`.

- [ ] **Step 4: Run typecheck + tests (expected: PASS)**

Run: `npm run typecheck && npm run test:run -- src/engines/aggregation/estateView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/estate.ts src/engines/aggregation/index.ts src/engines/aggregation/estateView.ts src/engines/aggregation/estateView.test.ts
git commit -m "feat(rs-07): compute EstateView.sizing in the single estate pass"
```

---

# Phase C — Store + hook

### Task C1: `sizingThresholds` store slice

**Files:**
- Modify: `src/store/snapshotStore.ts`
- Test: `src/store/snapshotStore.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — add to `snapshotStore.test.ts`:

```ts
import { DEFAULT_SIZING_THRESHOLDS } from '@/engines/aggregation/sizing'
import { selectSizingThresholds, selectSetSizingThresholds } from './snapshotStore'

it('sizingThresholds: defaults to DEFAULT_SIZING_THRESHOLDS', () => {
  expect(selectSizingThresholds(useSnapshotStore.getState())).toEqual(DEFAULT_SIZING_THRESHOLDS)
})
it('sizingThresholds: setter replaces with a fresh object', () => {
  selectSetSizingThresholds(useSnapshotStore.getState())({ ...DEFAULT_SIZING_THRESHOLDS, cpuOversizePct: 5 })
  expect(selectSizingThresholds(useSnapshotStore.getState()).cpuOversizePct).toBe(5)
})
it('sizingThresholds: clearAll restores defaults', () => {
  selectSetSizingThresholds(useSnapshotStore.getState())({ ...DEFAULT_SIZING_THRESHOLDS, cpuOversizePct: 5 })
  useSnapshotStore.getState().clearAll()
  expect(selectSizingThresholds(useSnapshotStore.getState())).toEqual(DEFAULT_SIZING_THRESHOLDS)
})
```

- [ ] **Step 2: Run it (expected: FAIL)**

Run: `npm run test:run -- src/store/snapshotStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `snapshotStore.ts`:
  - Import: `import { DEFAULT_SIZING_THRESHOLDS, type SizingThresholds } from '@/engines/aggregation/sizing'` and re-export `export { DEFAULT_SIZING_THRESHOLDS }`.
  - Add to `SnapshotState`: `sizingThresholds: SizingThresholds` and `setSizingThresholds: (t: SizingThresholds) => void`.
  - Initial state: `sizingThresholds: { ...DEFAULT_SIZING_THRESHOLDS },`.
  - Setter (REPLACE never mutate): `setSizingThresholds: (t) => set({ sizingThresholds: { ...t } }),`.
  - `clearAll`: add `sizingThresholds: { ...DEFAULT_SIZING_THRESHOLDS },`.
  - Selectors:

```ts
export const selectSizingThresholds = (s: SnapshotState): SizingThresholds => s.sizingThresholds
export const selectSetSizingThresholds = (s: SnapshotState): ((t: SizingThresholds) => void) =>
  s.setSizingThresholds
```

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/store/snapshotStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/snapshotStore.ts src/store/snapshotStore.test.ts
git commit -m "feat(rs-08): add in-memory sizingThresholds store slice"
```

---

### Task C2: Thread `sizingThresholds` through `useEstateView`

**Files:**
- Modify: `src/hooks/useEstateView.ts`
- Test: `src/hooks/useEstateView.test.ts` (extend if it asserts opts threading; otherwise typecheck-covered)

- [ ] **Step 1:** Add `selectSizingThresholds` to the store import; read it: `const sizingThresholds = useSnapshotStore(selectSizingThresholds)`. Pass `sizingThresholds` into the `buildEstateView(..., { ..., thresholds, sizingThresholds })` opts and add `sizingThresholds` to the `useMemo` dependency array.

- [ ] **Step 2: Run typecheck + hook test (expected: PASS)**

Run: `npm run typecheck && npm run test:run -- src/hooks/useEstateView.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEstateView.ts
git commit -m "feat(rs-09): thread sizingThresholds through the single useMemo"
```

---

# Phase D — Export (PPTX)

### Task D1: `ExportView.sizing` (max across ALL snapshots)

**Files:**
- Modify: `src/engines/export/buildExportView.ts`
- Test: `src/engines/export/buildExportView.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — assert `buildExportView(active, all, ...).sizing` equals the all-snapshots view's sizing. With 2 snapshots, `sizing.snapshotCount === 2` and `sizing.rows[0].sampleBasis === 'max-of-N'`. Reuse the file's existing snapshot factories.

- [ ] **Step 2: Run it (expected: FAIL — `sizing` missing on `ExportView`)**

Run: `npm run test:run -- src/engines/export/buildExportView.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Edit `buildExportView.ts`:

```ts
import type { AccountingMode, EstateSizing, EstateView, TrendSeries } from '@/types/estate'
// ...
export interface ExportView {
  view: EstateView
  trends: TrendSeries | null
  /** Right-sizing computed over ALL loaded snapshots (max-of-N), so the
   *  deck reflects the full set, not just the active body. */
  sizing: EstateSizing
}

export function buildExportView(active, all, mode, today, opts?): ExportView {
  const view = buildEstateView(mergeSnapshotsToEstate([active]), [active], mode, today, opts)
  const allView =
    all.length >= 2 ? buildEstateView(mergeSnapshotsToEstate(all), all, mode, today, opts) : view
  return {
    view,
    trends: all.length >= 2 ? allView.trends : null,
    sizing: allView.sizing,
  }
}
```
> `EstateSizing` is exported from `@/types/estate` (it re-exports the engine type per Task B2). If you kept the type in the engine, import it from `@/engines/aggregation`.

- [ ] **Step 4: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/export/buildExportView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/export/buildExportView.ts src/engines/export/buildExportView.test.ts
git commit -m "feat(rs-10): expose all-snapshots sizing on ExportView"
```

---

### Task D2: `rightSizingSlide` + builder wiring

**Files:**
- Create: `src/engines/export/pptx/slides/rightSizingSlide.ts`
- Modify: `src/engines/export/pptx/builder.ts`
- Modify: `src/engines/export/types.ts` (ExportStrings keys)
- Modify: `src/engines/export/export.worker.ts` (pass all-snapshots sizing into the view)
- Test: `src/engines/export/pptx/builder.test.ts` (extend)

- [ ] **Step 1: Read** `src/engines/export/pptx/slides/eosSlide.ts` (a slide using `kpiCard` + a native table) and `src/engines/export/pptx/slides/contentionAnnex.ts` (a native table of VM rows), plus `src/engines/export/pptx/primitives/kpiCard.ts` and `src/engines/export/types.ts` (the `ExportStrings` shape and how slides read localized strings). Mirror their structure exactly.

- [ ] **Step 2: Add ExportStrings keys** in `src/engines/export/types.ts` — add a `rightSizing` group (match the existing per-slide string-group shape), e.g.:

```ts
  rightSizing: {
    title: string
    oversized: string
    undersized: string
    stressed: string
    basisSingle: string
    basisMaxOfN: string // contains a {count} token if the codebase interpolates; else plain
    poweredOnOnly: string
    thresholdsCaption: string
    colVm: string
    colCluster: string
    colVcpu: string
    colCpuPct: string
    colVram: string
    colActivePct: string
  }
```
> Match how other groups are typed/populated; `ExportStrings` is built from the `pptx` i18n namespace in the export worker — see Task F1 for the JSON keys.

- [ ] **Step 3: Write the failing test** — add to `builder.test.ts`: build a `view` whose `sizing.hasUsageData === true` and assert the produced deck has one more slide than the same view with `hasUsageData === false` (the golden structural test counts slides). Pattern after the existing contention-annex conditional test in that file.

- [ ] **Step 4: Run it (expected: FAIL)**

Run: `npm run test:run -- src/engines/export/pptx/builder.test.ts`
Expected: FAIL.

- [ ] **Step 5: Implement the slide** `src/engines/export/pptx/slides/rightSizingSlide.ts` — native shapes/text only (NO rasterized chart: resvg has no font). Signature mirrors `addEosSlide`:

```ts
import type PptxGenJS from 'pptxgenjs'
import type { EstateSizing } from '@/types/estate'
import type { ExportStrings } from '../types'
import type { ExportLocale } from './format'
import { addKpiCard } from '../primitives/kpiCard' // use the real export name from kpiCard.ts

export const addRightSizingSlide = (
  pptx: PptxGenJS,
  sizing: EstateSizing,
  strings: ExportStrings,
  locale: ExportLocale,
): void => {
  const s = strings.rightSizing
  const slide = pptx.addSlide()
  // title (neutral) — use the deck's title helper/pattern from eosSlide
  slide.addText(s.title, { /* match eosSlide title opts */ })
  // three KPI cards: oversized / undersized / stressed counts
  addKpiCard(slide, { label: s.oversized, value: String(sizing.counts.oversized) /* + card opts */ })
  addKpiCard(slide, { label: s.undersized, value: String(sizing.counts.undersized) })
  addKpiCard(slide, { label: s.stressed, value: String(sizing.counts.stressed) })
  // top-N table of flagged rows (native pptx table)
  const flagged = sizing.rows
    .filter((r) => r.flags.cpuOversized || r.flags.memOversized || r.flags.cpuUndersized ||
      r.flags.memUndersized || r.flags.memStressed || r.flags.cpuStressed)
    .slice(0, 18)
  const header = [s.colVm, s.colCluster, s.colVcpu, s.colCpuPct, s.colVram, s.colActivePct]
  const body = flagged.map((r) => [
    r.vmName, r.cluster, String(r.vcpu),
    r.cpuUtilPct === null ? '—' : `${r.cpuUtilPct.toFixed(1)}%`,
    String(r.vramMib),
    r.memActivePct === null ? '—' : `${r.memActivePct.toFixed(1)}%`,
  ])
  slide.addTable([header, ...body], { /* match contentionAnnex table opts */ })
  // caption: basis + powered-on + thresholds used
  const basis = sizing.snapshotCount >= 2 ? s.basisMaxOfN : s.basisSingle
  slide.addText(`${basis} · ${s.poweredOnOnly} · ${s.thresholdsCaption}`, { /* small caption opts */ })
}
```
> Fill the `{ ... }` option blocks by copying the exact coordinates/fonts/colors from `eosSlide.ts`/`contentionAnnex.ts`. Use `strings`/`locale` exactly as those slides do. Numbers should be locale-formatted via the deck's existing formatter (see `format.ts`) rather than `.toFixed` if that's the established pattern — match the codebase.

- [ ] **Step 6: Wire into `builder.ts`** — import `addRightSizingSlide` and, after the contention annex block (the "utilization/stress" neighborhood), add:

```ts
  if (view.sizing.hasUsageData) addRightSizingSlide(pptx, view.sizing, strings, locale)
```

- [ ] **Step 7: Wire the export worker** — in `src/engines/export/export.worker.ts`, the deck is built from the `ExportView`. Pass the all-snapshots sizing into the slide by calling `buildPptx` with a view whose `sizing` is the export sizing:

```ts
  const exportView = buildExportView(active, all, mode, today, opts)
  await buildPptx({ ...exportView.view, sizing: exportView.sizing }, exportView.trends, strings, locale, pptxOpts)
```
> Read `export.worker.ts` first to match its exact call site and variable names; only change the `view` passed to `buildPptx` so the slide sees max-of-N sizing.

- [ ] **Step 8: Run it (expected: PASS)**

Run: `npm run test:run -- src/engines/export/pptx/builder.test.ts`
Expected: PASS.

- [ ] **Step 9: Visual verification** (per the project's deck-verification rule):

```bash
# Generate a deck from a fixture with vMemory/vCPU (after Task G1), then:
soffice --headless --convert-to pdf --outdir /tmp out.pptx && open /tmp/out.pdf
```
Confirm the Right-sizing slide renders KPI cards + table + caption (no missing/blank text). Compare against the vsizer deck as the quality reference.

- [ ] **Step 10: Commit**

```bash
git add src/engines/export/pptx/slides/rightSizingSlide.ts src/engines/export/pptx/builder.ts src/engines/export/types.ts src/engines/export/export.worker.ts src/engines/export/pptx/builder.test.ts
git commit -m "feat(rs-11): add right-sizing PPTX slide (native shapes, conditional)"
```

---

# Phase E — Web view

### Task E1: `RightSizingView` scaffold + nav registration

**Files:**
- Create: `src/components/rightsizing/RightSizingView.tsx`
- Create: `src/components/rightsizing/RightSizingView.test.tsx`
- Modify: `src/App.tsx`, `src/components/ViewToggle.tsx`

- [ ] **Step 1: Read** `src/components/dashboard/CpuReadyPanel.tsx` (panel + KPI pattern), `src/components/inventory/VmTable.tsx` + `src/components/inventory/DataTable.tsx` (table + CSV export + the `col.<id>` header resolution), `src/components/ViewToggle.tsx` and `src/App.tsx` (how a view id is registered and routed), and `src/components/ThemeToggle.tsx` (the `<fieldset role="group">` + `aria-pressed` toggle idiom).

- [ ] **Step 2: Register the view id.** In `ViewToggle.tsx` add `'rightsizing'` to the view-id union/list and its tab label (via the existing i18n key pattern — `common`/nav namespace). In `App.tsx` add a route/branch rendering `<RightSizingView view={view} ... />` when the active view id is `'rightsizing'`, mirroring how the EOS/Network views are mounted. The view consumes `useEstateView(mode)` output (or receives `view.sizing` as a prop, matching how sibling views get data).

- [ ] **Step 3: Write the failing test** `RightSizingView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import i18n from '@/i18n'
import { RightSizingView } from './RightSizingView'
import type { EstateSizing } from '@/types/estate'

const sizing = (over: Partial<EstateSizing> = {}): EstateSizing => ({
  rows: [], counts: { oversized: 3, undersized: 1, stressed: 2, cpuOversized: 2, memOversized: 1,
    cpuUndersized: 1, memUndersized: 0, memStressed: 1, cpuStressed: 1 },
  thresholds: { cpuOversizePct: 10, memOversizePct: 20, cpuUndersizePct: 90, memUndersizePct: 90, balloonMib: 0, swapMib: 0 },
  snapshotCount: 1, hasUsageData: true, ...over,
})

describe('RightSizingView', () => {
  beforeEach(async () => { await i18n.changeLanguage('en') })
  it('renders the three category counts', () => {
    render(<RightSizingView sizing={sizing()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
  it('shows an empty-state when no usage data', () => {
    render(<RightSizingView sizing={sizing({ hasUsageData: false })} />)
    expect(screen.getByText(/no usage data/i)).toBeInTheDocument()
  })
})
```
> Match the prop shape to how sibling views are invoked (prop vs `useEstateView`). If sibling views read the hook internally, mock the store instead (follow `CpuReadyPanel.test.tsx`).

- [ ] **Step 4: Run it (expected: FAIL)**

Run: `npm run test:run -- src/components/rightsizing/RightSizingView.test.tsx`
Expected: FAIL.

- [ ] **Step 5: Implement the scaffold** — `RightSizingView.tsx`: render the three KPI tiles (reuse `StatTile`/`TileSection` from `src/components/`), the basis/powered-on/n-a caption, and the empty-state (`!sizing.hasUsageData`). Use neutral labels via `useTranslation('rightsizing')` (keys defined in F1). No verdict adjectives.

- [ ] **Step 6: Run it (expected: PASS)**

Run: `npm run test:run -- src/components/rightsizing/RightSizingView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/rightsizing/RightSizingView.tsx src/components/rightsizing/RightSizingView.test.tsx src/App.tsx src/components/ViewToggle.tsx
git commit -m "feat(rs-12): add RightSizingView scaffold + nav tab"
```

---

### Task E2: Threshold controls, filter, VM table, counts chart

**Files:**
- Modify: `src/components/rightsizing/RightSizingView.tsx`
- Modify: `src/components/rightsizing/RightSizingView.test.tsx`
- Modify: `src/components/Chart.tsx` (only if the `bar` series isn't registered — verify first)

- [ ] **Step 1: Verify the `bar` chart type is registered** in `src/components/Chart.tsx` (read it — it lists `echarts.use([...])` registrations). If `BarChart` is absent, add it to the `use([...])` list (tree-shaken; the bundle gate is `npm run check:bundle-size`).

- [ ] **Step 2: Write the failing tests** — extend `RightSizingView.test.tsx`:
  - Editing the "CPU oversize" number input calls `setSizingThresholds` (spy on the store) with the new value.
  - The filter toggles (`All`/`Oversized`/`Undersized`/`Stressed`) use `role="group"` + `aria-pressed`; clicking `Oversized` filters the rendered table rows to flagged-oversized only.
  - CSV export button exists and produces text containing a flagged VM's name (mirror the `inventory-stress.test.tsx` CSV capture approach).

- [ ] **Step 3: Run them (expected: FAIL)**

Run: `npm run test:run -- src/components/rightsizing/RightSizingView.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement.**
  - **Threshold controls:** number inputs bound to `selectSizingThresholds`/`selectSetSizingThresholds`. On change, call the setter with a fresh object; the recompute flows through `useEstateView` automatically. (If the view receives `sizing` as a prop from a parent that calls the hook, the parent re-renders on store change — verify wiring.)
  - **Filter:** `<fieldset role="group">` + buttons with `aria-pressed`, mirroring `ThemeToggle.tsx`. Local `useState` for the active filter; derive the displayed rows with a plain `.filter(...)` (NOT a `useMemo` — the single-memo invariant is for estate aggregation; a trivial row filter in a leaf component is fine, but prefer computing inline).
  - **VM table:** reuse `DataTable`/`VmTable`. Columns: VM, Cluster, Host, vCPU, CPU%, vRAM, Active%, Consumed%, Balloon, Swap, Ready%, flags. Each new column `id` needs an `inventory:col.<id>` key (Task F1). `—` for `null` cells. CSV export reuses the existing export helper from `VmTable`.
  - **Counts chart:** a small `<Chart option={...}>` bar of the six per-resource counts (cpuOversized, memOversized, …). SVG renderer is injected by `<Chart>`.

- [ ] **Step 5: Run them (expected: PASS) + bundle gate**

Run: `npm run test:run -- src/components/rightsizing/RightSizingView.test.tsx && npm run check:bundle-size`
Expected: PASS; bundle within budget.

- [ ] **Step 6: Commit**

```bash
git add src/components/rightsizing/RightSizingView.tsx src/components/rightsizing/RightSizingView.test.tsx src/components/Chart.tsx
git commit -m "feat(rs-13): right-sizing thresholds, filter, VM table, counts chart"
```

---

# Phase F — i18n (en + fr)

### Task F1: `rightsizing` namespace + column/slide keys (en+fr)

**Files:**
- Create: `src/i18n/locales/en/rightsizing.json`, `src/i18n/locales/fr/rightsizing.json`
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/locales/{en,fr}/inventory.json` (add `col.*`)
- Modify: `src/i18n/locales/{en,fr}/pptx.json` (slide strings)

- [ ] **Step 1: Read** `src/i18n/index.ts` fully (imports, `NAMESPACES`, `resources`) and one existing namespace JSON pair (e.g. `en/eos.json`/`fr/eos.json`) to match key style and the no-pre-formatted-numbers rule.

- [ ] **Step 2: Create** `en/rightsizing.json` with neutral, non-verdict labels. Example keys (adjust to the project's nesting style):

```json
{
  "title": "Right-sizing",
  "subtitle": "Configured vs used",
  "category": {
    "oversized": "Allocation ≫ usage",
    "undersized": "Usage near allocation",
    "stressed": "Ballooning / CPU-ready"
  },
  "basis": { "single": "single snapshot", "maxOfN": "max across {{count}} snapshots" },
  "poweredOnOnly": "powered-on VMs only",
  "notDerivable": "— = not derivable",
  "emptyState": "No usage data in this export (vMemory/vCPU sheets absent).",
  "thresholds": {
    "heading": "Thresholds",
    "cpuOversize": "CPU oversize ≤ %",
    "memOversize": "Memory oversize ≤ %",
    "cpuUndersize": "CPU undersize ≥ %",
    "memUndersize": "Memory undersize ≥ %",
    "balloon": "Balloon > MiB",
    "swap": "Swap > MiB",
    "cpuReady": "CPU-ready > %"
  },
  "filter": { "all": "All", "oversized": "Allocation ≫ usage", "undersized": "Usage near allocation", "stressed": "Pressure" }
}
```

- [ ] **Step 3: Create** `fr/rightsizing.json` with the French translations (mirror keys exactly):

```json
{
  "title": "Dimensionnement",
  "subtitle": "Configuré vs utilisé",
  "category": {
    "oversized": "Allocation ≫ utilisation",
    "undersized": "Utilisation proche de l'allocation",
    "stressed": "Ballooning / CPU-ready"
  },
  "basis": { "single": "instantané unique", "maxOfN": "max sur {{count}} instantanés" },
  "poweredOnOnly": "VM allumées uniquement",
  "notDerivable": "— = non calculable",
  "emptyState": "Aucune donnée d'utilisation dans cet export (feuilles vMemory/vCPU absentes).",
  "thresholds": {
    "heading": "Seuils",
    "cpuOversize": "Sur-dimension CPU ≤ %",
    "memOversize": "Sur-dimension mémoire ≤ %",
    "cpuUndersize": "Sous-dimension CPU ≥ %",
    "memUndersize": "Sous-dimension mémoire ≥ %",
    "balloon": "Balloon > Mio",
    "swap": "Swap > Mio",
    "cpuReady": "CPU-ready > %"
  },
  "filter": { "all": "Tous", "oversized": "Allocation ≫ utilisation", "undersized": "Utilisation proche de l'allocation", "stressed": "Pression" }
}
```

- [ ] **Step 4: Register the namespace** in `src/i18n/index.ts`: add `import enRightsizing from './locales/en/rightsizing.json'` + `frRightsizing`, add `'rightsizing'` to `NAMESPACES`, and add `rightsizing: enRightsizing` / `rightsizing: frRightsizing` to the `resources.en` / `resources.fr` maps.

- [ ] **Step 5: Add `inventory:col.*` keys** for every new table column id used in E2 (e.g. `col.cpuUtilPct`, `col.memActivePct`, `col.memConsumedPct`, `col.balloonedMib`, `col.swappedMib`, `col.cpuReadinessPercent`) in BOTH `en/inventory.json` and `fr/inventory.json`. Missing keys render the raw key (the DataTable gotcha).

- [ ] **Step 6: Add slide strings** to `en/pptx.json` + `fr/pptx.json` under the group the export worker reads into `ExportStrings.rightSizing` (Task D2 Step 2).

- [ ] **Step 7: Run the app + tests (expected: PASS)**

Run: `npm run test:run -- src/components/rightsizing src/engines/export` and `npm run dev` (manually switch language to fr, open the Right-sizing tab — labels render in both).
Expected: PASS; no raw i18n keys visible.

- [ ] **Step 8: Commit**

```bash
git add src/i18n/locales/en/rightsizing.json src/i18n/locales/fr/rightsizing.json src/i18n/index.ts src/i18n/locales/en/inventory.json src/i18n/locales/fr/inventory.json src/i18n/locales/en/pptx.json src/i18n/locales/fr/pptx.json
git commit -m "feat(rs-14): add rightsizing i18n (en+fr) + column/slide keys"
```

---

# Phase G — Fixtures + end-to-end

### Task G1: Emit `vMemory`/`vCPU` in the fixture generator

**Files:**
- Modify: `scripts/generate-inventory-10k.mjs` (and/or `scripts/seed-fixtures.mjs`)

- [ ] **Step 1: Read** `scripts/generate-inventory-10k.mjs` to see how it builds the workbook (which library, how sheets/headers/rows are emitted, how `vInfo` rows are keyed).

- [ ] **Step 2: Add a `vMemory` sheet** with headers `['VM','Cluster','VM Instance UUID','Active','Consumed','Ballooned','Swapped']` and a `vCPU` sheet with `['VM','Cluster','VM Instance UUID','Overall Cpu Usage']`, one row per generated VM, reusing the same `VM Instance UUID` the `vInfo` rows use. Make the synthetic values deterministic and varied so the fixture exercises all flags: e.g. ~15% of VMs with `Active` ≤ 20% of configured (oversized-memory), a few with `Ballooned > 0` (stressed), a few with `Overall Cpu Usage` near capacity (undersized-cpu). Document the distribution in a comment.

- [ ] **Step 3: Regenerate + sanity check**

Run: `node scripts/generate-inventory-10k.mjs && npm run test:run -- src/__tests__/inventory-stress.test.tsx`
Expected: PASS (the existing 10k test still parses; the new sheets don't break it). The fixture now has usage data.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-inventory-10k.mjs
git commit -m "feat(rs-15): emit vMemory/vCPU in the synthetic fixture"
```

---

### Task G2: End-to-end integration test

**Files:**
- Create: `src/__tests__/rightsizing-e2e.test.tsx`

- [ ] **Step 1: Write the test** — drive the production pipeline (`parseXlsx → parseSnapshot → mergeSnapshotsToEstate → buildEstateView`) on the regenerated 10k fixture (mirror the setup in `inventory-stress.test.tsx`), then assert:
  - `view.sizing.hasUsageData === true`
  - `view.sizing.counts.oversized > 0` (the generator seeded oversized VMs)
  - every `view.sizing.rows[i]` for a powered-off VM is absent (powered-on only)
  - rendering `<RightSizingView sizing={view.sizing} />` shows the oversized count.

- [ ] **Step 2: Run it (expected: PASS)**

Run: `npm run test:run -- src/__tests__/rightsizing-e2e.test.tsx`
Expected: PASS.

- [ ] **Step 3: Full gate**

Run: `npm run typecheck && npx @biomejs/biome check . && npm run test:run && npm run test:coverage && npm run check:supply-chain && npm run check:bundle-size`
Expected: all PASS; `engines/` coverage ≥ 75% (the new `sizing.ts` is gated).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/rightsizing-e2e.test.tsx
git commit -m "feat(rs-16): end-to-end right-sizing integration test"
```

---

# Phase H — Docs

### Task H1: Update project docs

**Files:**
- Modify: `ROADMAP`/`STATE`/`PROJECT` docs (per the standing "always update documentation" expectation), `CLAUDE.md` if a new gotcha emerged.

- [ ] **Step 1:** Add the Right-sizing view + `vMemory`/`vCPU` parsing to the shipped-feature inventory; note `sizing.ts` is added to the ≥75% gated engines; record the CPU-utilization approximation (`vcpu × per-core MHz`) and the point-in-time/max-of-N caveat. Manually flip any phase checkbox/progress row (the SDK does not match this ROADMAP format).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs(rs-17): record right-sizing feature in project docs"
```

---

## Self-review checklist (done while writing)

- **Spec coverage:** ① oversized (A3/B1 CPU+mem util), ② undersized (B1), ③ stressed (B1 balloon/swap + CPU-ready reuse) ✓; parser vMemory+vCPU (A3) ✓; VmUsage parallel record (A1) ✓; multi-snapshot max (B1) ✓; powered-on only (B1) ✓; null-discipline (A2/B1) ✓; customizable thresholds (C1/E2) ✓; web view (E1/E2) ✓; PPTX slide, native, conditional-omit (D2) ✓; HTML report excluded (no report task — intentional) ✓; en+fr i18n (F1) ✓; privacy/no-network (no fetch added anywhere) ✓; fixtures (G1) + e2e (G2) ✓.
- **Type consistency:** `VmUsageRow`, `EstateSizing`, `SizingThresholds`, `VmSizing`, `MaxUsage`, `computeSizing`, `maxVmUsageAcrossSnapshots`, `DEFAULT_SIZING_THRESHOLDS`, `selectSizingThresholds`/`selectSetSizingThresholds`, `addRightSizingSlide`, `ExportView.sizing`, `EstateView.sizing` — names used identically across tasks. ✓
- **Open verification points flagged inline** (read-first steps): worker assembly (A5), `ExportStrings` shape (D2), sibling slide/view APIs (D2/E1), `bar` registration (E2), generator internals (G1). These are the only places exact existing-API details must be confirmed against the file before coding.

---

## Out of scope (Plan 2)

App-wide `de`+`it` localization of all namespaces + i18n config/switcher wiring + key-parity test. The `rightsizing`/`inventory`/`pptx` keys added here in `en`+`fr` are the source for Plan 2's `de`/`it` translations.
