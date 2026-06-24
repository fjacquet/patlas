# Snapshot Sprawl (Plan 3A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Proxmox guest snapshot sprawl — how many checkpoints each guest still holds, how old, how big — as a first-class patlas view, parsed from the report's `Snapshots` sheet.

**Architecture:** Follow the established patlas "extra view" mold end-to-end: a new canonical row (`ProxmoxSnapshotRow`) parsed by a new `adaptProxmoxSnapshots` adapter, carried on `Snapshot`, concatenated through `mergeSnapshotsToEstate`, reduced by a pure `computeSnapshotSprawl` engine into a `SnapshotSprawl` slice on `EstateView` (composed inside the single `buildEstateView` pass — no second `useMemo`), and rendered by a read-only `SnapshotSprawlView` wired into the nav. Neutral measurement only — no verdict, no severity (ADR-0012).

**Tech Stack:** React 19 · TypeScript strict · Zustand 5 · ECharts (not needed here — table only) · react-i18next (en/fr/de/it) · Vitest 4 · Biome · SheetJS (worker-only).

## Global Constraints

- **Engines are pure functions** — no React/DOM/Zustand/Zod in `src/engines/**`. Zod lives only at the parser boundary (and the Proxmox adapter does NOT use Zod — it builds trusted typed rows via `readNumber`/`readString`, matching `adaptProxmoxGuests`).
- **The single `useMemo`** lives only in `useEstateView`. Every derived slice is composed inside the one `buildEstateView` pass. Never add a second memo site.
- **Branded units** — never a raw `* 1.048576`. RVTools/Proxmox "GB" is reinterpreted as GiB; convert with `gibToMib(gib(n))` (ADR-0010).
- **`null` = not derivable, never coerced to 0** (ADR-0012) — applies to `dateSerial`/`ageDays`/`oldestAgeDays`.
- **i18n keys land in ALL FOUR locales** (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces identical key trees (namespaces auto-derived from `locales/en/`). No pre-formatted numbers in strings; no editorial verbs ("recommend/should/poor/good").
- **Terminology guard** — `src/i18n/terminology.test.ts` forbids VMware tokens (`RVTools`/`vCenter`/`ESX`/`ESXi`/`datastore`) in i18n values. Use Proxmox terms: Guest, Container, Node, Snapshot.
- **Privacy invariant (PAR-05)** — no network egress of dataset bytes; no `localStorage` of rows (only `patlas-theme`/`patlas-lang`). `xlsx` import stays worker-only.
- **Commit prefix** `<type>(3a-NN): …` per task. Signed commits required — never pass `--no-gpg-sign` or `-c commit.gpgsign=false`.
- **Run the FULL `npm run typecheck`** (app + `tsconfig.test.json`) after adding a required field to a shared type — `rtk tsc` only checks the app project and will miss broken test builders.
- **Lint with `npx @biomejs/biome check .`** (NOT `npm run lint`, which RTK intercepts). Run it before every commit.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/types/snapshot.ts` | Add `ProxmoxSnapshotRow` + required `proxmoxSnapshots` field on `Snapshot` | 1 |
| `src/types/index.ts` | Barrel re-export `ProxmoxSnapshotRow` | 1 |
| `src/engines/parser/adapters/proxmoxColumns.ts` | `SNAPSHOT_COLS` alias map | 1 |
| `src/engines/parser/adapters/proxmox.ts` | `adaptProxmoxSnapshots` + wire into `adaptProxmox` | 1 |
| `src/engines/parser/parser.worker.ts` | Set `proxmoxSnapshots` on the assembled `Snapshot` | 1 |
| (all `Snapshot` literals in tests) | Add `proxmoxSnapshots: []` so typecheck stays green | 1 |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` | Concatenate `proxmoxSnapshots` into `MergedEstate` | 2 |
| `src/engines/aggregation/snapshotSprawl.ts` | Pure `computeSnapshotSprawl` + `excelSerialToUnixMs` | 3 |
| `src/engines/aggregation/index.ts` | Export the new engine + types | 3 |
| `src/types/estate.ts` | Add `snapshotSprawl: SnapshotSprawl` to `EstateView` | 4 |
| `src/engines/aggregation/estateView.ts` | Compose the slice + `EMPTY_SPRAWL`/`EMPTY_VIEW` | 4 |
| `src/components/snapshots/SnapshotSprawlView.tsx` | Read-only presenter | 5 |
| `src/components/ViewToggle.tsx` | `'snapshots'` in `AppView` union + `VIEWS` | 5 |
| `src/App.tsx` | Import + dispatch branch | 5 |
| `src/i18n/locales/{en,fr,de,it}/snapshots.json` | New namespace | 5 |
| `src/i18n/index.ts` | Register `snapshots` namespace | 5 |
| `src/i18n/locales/{en,fr,de,it}/inventory.json` | `nav.snapshots` label | 5 |
| `src/engines/aggregation/snapshotSprawl.realfile.test.ts` | Real-report acceptance | 6 |

---

### Task 1: Parse the `Snapshots` sheet → `ProxmoxSnapshotRow[]`

**Files:**

- Modify: `src/types/snapshot.ts`
- Modify: `src/types/index.ts`
- Modify: `src/engines/parser/adapters/proxmoxColumns.ts`
- Modify: `src/engines/parser/adapters/proxmox.ts`
- Modify: `src/engines/parser/parser.worker.ts`
- Modify: every test file constructing a `Snapshot` literal (see Step 6)
- Test: `src/engines/parser/adapters/proxmox.snapshots.test.ts` (new), `src/engines/parser/proxmox.realfile.test.ts` (extend)

**Interfaces:**

- Produces: `interface ProxmoxSnapshotRow { node, guestId, guestName, guestType: 'qemu'|'lxc', name, parent, dateSerial: number|null, includeRam: boolean, sizeMib: MiB }`; `Snapshot.proxmoxSnapshots: ProxmoxSnapshotRow[]` (required); `adaptProxmoxSnapshots(sheet: ParsedSheet | undefined): ProxmoxSnapshotRow[]`; `adaptProxmox(...)` return gains `proxmoxSnapshots: ProxmoxSnapshotRow[]`.
- Consumes: `mapColumns`, `readCol`, `readNumber`, `readString`, `findSheet` from `./columnMap`; `gib`, `gibToMib` from `@/engines/units`.

**Real sheet schema (from the fixture):** `Snapshots` columns are
`Node | Vm Id | Vm Name | Vm Type | Snapshot | Parent | Date | Include Ram | Size GB | Description`.
All 7 rows in the real report are the per-guest live-state marker (`Snapshot = "current"`, `Parent = "no-parent"`, `Description = "You are here!"`) — there are **zero** real checkpoints. The adapter parses every non-blank row faithfully; the engine (Task 3) excludes the `current` marker from sprawl. `Date` arrives as an **Excel serial number** (e.g. `46196.31`) because `parseXlsx` does not enable `cellDates`.

- [ ] **Step 1: Write the failing adapter test**

Create `src/engines/parser/adapters/proxmox.snapshots.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxSnapshots } from './proxmox'

const sheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Snapshots',
  headers: [
    'Node',
    'Vm Id',
    'Vm Name',
    'Vm Type',
    'Snapshot',
    'Parent',
    'Date',
    'Include Ram',
    'Size GB',
    'Description',
  ],
  rows,
})

describe('adaptProxmoxSnapshots', () => {
  it('returns [] when the sheet is absent', () => {
    expect(adaptProxmoxSnapshots(undefined)).toEqual([])
  })

  it('parses a real checkpoint row with branded MiB size and serial date', () => {
    const rows = adaptProxmoxSnapshots(
      sheet([
        {
          Node: 'promox',
          'Vm Id': 100,
          'Vm Name': 'Debian',
          'Vm Type': 'Qemu',
          Snapshot: 'before-upgrade',
          Parent: 'no-parent',
          Date: 46196.31,
          'Include Ram': 'true',
          'Size GB': 4,
          Description: '',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r?.guestType).toBe('qemu')
    expect(r?.name).toBe('before-upgrade')
    expect(r?.dateSerial).toBe(46196.31)
    expect(r?.includeRam).toBe(true)
    expect(r?.sizeMib as number).toBe(4096) // 4 GiB → MiB, no raw 1.048576
  })

  it('maps Vm Type "Lxc" to guestType lxc and keeps the current marker row', () => {
    const rows = adaptProxmoxSnapshots(
      sheet([
        {
          Node: 'promox',
          'Vm Id': 104,
          'Vm Name': 'ct-a',
          'Vm Type': 'Lxc',
          Snapshot: 'current',
          Parent: 'no-parent',
          Date: null,
          'Include Ram': '',
          'Size GB': null,
          Description: 'You are here!',
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.guestType).toBe('lxc')
    expect(rows[0]?.name).toBe('current')
    expect(rows[0]?.dateSerial).toBeNull()
    expect(rows[0]?.sizeMib as number).toBe(0)
  })

  it('drops rows with a blank Snapshot label', () => {
    const rows = adaptProxmoxSnapshots(sheet([{ Node: 'promox', Snapshot: '' }]))
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.snapshots.test.ts`
Expected: FAIL — `adaptProxmoxSnapshots` is not exported.

- [ ] **Step 3: Add the `ProxmoxSnapshotRow` type and the `Snapshot` field**

In `src/types/snapshot.ts`, add the import of `MiB` is already present (`import type { Bytes, MiB } from '@/engines/units'`). Add this interface just above `interface Snapshot`:

```ts
/**
 * A guest snapshot row from the Proxmox report `Snapshots` sheet. The report
 * always emits a per-guest live-state marker (`name === 'current'`,
 * `parent === 'no-parent'`) which is NOT a checkpoint — the snapshot-sprawl
 * engine excludes it. `dateSerial` is the raw Excel serial (parseXlsx does
 * not convert dates); `null` when the cell is blank ("not derivable").
 */
export interface ProxmoxSnapshotRow {
  node: string
  /** Proxmox VMID (Vm Id). */
  guestId: string
  guestName: string
  /** 'qemu' (KVM VM) or 'lxc' (container), from the report `Vm Type` column. */
  guestType: 'qemu' | 'lxc'
  /** The snapshot label; `'current'` for the live-state marker row. */
  name: string
  /** Parent snapshot label; `'no-parent'` for a root/marker row. */
  parent: string
  /** Excel serial date of creation; `null` when the cell is blank. */
  dateSerial: number | null
  /** Whether the snapshot captured guest RAM (Include Ram). */
  includeRam: boolean
  /** Snapshot size. `Size GB` reinterpreted as GiB → MiB; 0 when blank. */
  sizeMib: MiB
}
```

Then add the field to the `Snapshot` interface, immediately after the `vmUsage` field (keep it grouped with the other row arrays):

```ts
  /** Proxmox guest snapshots from the report `Snapshots` sheet. `[]` when the
   *  sheet is absent — never undefined (factual-degrade). */
  proxmoxSnapshots: ProxmoxSnapshotRow[]
```

- [ ] **Step 4: Barrel-export the type**

In `src/types/index.ts`, add `ProxmoxSnapshotRow` to the `from './snapshot'` export block (alphabetical, before `Snapshot`):

```ts
export type {
  ParseError,
  ProxmoxSnapshotRow,
  Snapshot,
  VDatastoreRow,
  VDvPortRow,
  VDvSwitchRow,
  VMetaDataEntry,
  VMetaDataRow,
  VNetworkRow,
  VPartitionRow,
  VSwitchRow,
} from './snapshot'
```

- [ ] **Step 5: Add `SNAPSHOT_COLS` and `adaptProxmoxSnapshots`, wire into `adaptProxmox`**

In `src/engines/parser/adapters/proxmoxColumns.ts`, append:

```ts
export const SNAPSHOT_COLS = {
  node: ['node'],
  guestId: ['vm id'],
  guestName: ['vm name'],
  guestType: ['vm type'],
  name: ['snapshot'],
  parent: ['parent'],
  date: ['date'],
  includeRam: ['include ram'],
  sizeGib: ['size gb'],
} as const
```

In `src/engines/parser/adapters/proxmox.ts`:

1. Extend the type import to include `ProxmoxSnapshotRow`:

```ts
import type {
  ParseError,
  ProxmoxSnapshotRow,
  VDatastoreRow,
  VHostRow,
  VInfoRow,
  VmUsageRow,
} from '@/types'
```

1. Extend the columns import:

```ts
import { CLUSTER_COLS, GUEST_COLS, NODE_COLS, SNAPSHOT_COLS, STORAGE_COLS } from './proxmoxColumns'
```

1. Add the adapter function (place it just after `adaptProxmoxStorages`):

```ts
export const adaptProxmoxSnapshots = (sheet: ParsedSheet | undefined): ProxmoxSnapshotRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, SNAPSHOT_COLS)
  return sheet.rows
    .map((row): ProxmoxSnapshotRow => {
      const dateRaw = readCol(row, cols.date)
      const dateSerial =
        typeof dateRaw === 'number' && Number.isFinite(dateRaw) ? dateRaw : null
      const ram = readString(readCol(row, cols.includeRam)).toLowerCase()
      return {
        node: readString(readCol(row, cols.node)),
        guestId: readString(readCol(row, cols.guestId)),
        guestName: readString(readCol(row, cols.guestName)),
        guestType: readString(readCol(row, cols.guestType)).toLowerCase() === 'lxc' ? 'lxc' : 'qemu',
        name: readString(readCol(row, cols.name)),
        parent: readString(readCol(row, cols.parent)),
        dateSerial,
        includeRam: ram === 'true' || ram === 'yes' || ram === '1',
        sizeMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.sizeGib))))),
      }
    })
    .filter((s) => s.name !== '')
}
```

1. In `adaptProxmox`, after the `storageSheet` block, add the optional `Snapshots` sheet lookup + warning, then add the field to the return object:

```ts
  const snapshotsSheet = findSheet(workbook, ['snapshots'])
  if (!snapshotsSheet) {
    warnings.push({
      sheet: 'Snapshots',
      kind: 'missing-sheet',
      message: 'optional sheet Snapshots absent — snapshot sprawl will be empty',
    })
  }
```

Extend the return type signature with `proxmoxSnapshots: ProxmoxSnapshotRow[]` and the returned object with:

```ts
    proxmoxSnapshots: adaptProxmoxSnapshots(snapshotsSheet),
```

- [ ] **Step 6: Set the field in the worker and in every `Snapshot` literal**

In `src/engines/parser/parser.worker.ts`, add to the `snapshot` object literal (after `vmUsage: bundle.vmUsage,`):

```ts
      proxmoxSnapshots: bundle.proxmoxSnapshots,
```

Then add `proxmoxSnapshots: []` to every other `Snapshot` literal in the test suite so the codebase compiles. Find them all:

Run: `cd /Users/fjacquet/Projects/patlas && rtk grep -rn "vmUsage:" src --include="*.ts" --include="*.tsx" -l`

For EACH file listed (test fixtures and helpers that build a `Snapshot`), add a `proxmoxSnapshots: []` line adjacent to the existing `vmUsage:` line in every `Snapshot` literal. Known sites include at least:

- `src/engines/parser/proxmox.realfile.test.ts` (no `Snapshot` literal — skip)
- `src/engines/aggregation/proxmox-estate.realfile.test.ts`
- `src/components/storage/StorageView.test.tsx`
- `src/components/inventory/columns/columns.test.ts` (two literals: `sharedLunSnapshot` and any `snapshot()` helper)
- any `src/**/__tests__/**` or `*.test.ts(x)` building a full `Snapshot`

Do NOT guess — the typecheck in Step 7 is the authority on completeness.

- [ ] **Step 7: Run the adapter test + FULL typecheck**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.snapshots.test.ts && npm run typecheck
```

Expected: adapter test PASSES (4/4); typecheck reports 0 errors. If typecheck flags a `Snapshot` literal missing `proxmoxSnapshots`, add the field there and re-run.

- [ ] **Step 8: Extend the parser realfile test**

In `src/engines/parser/proxmox.realfile.test.ts`, add inside the existing `maybe(...)` block, after the existing assertions:

```ts
    // Plan 3A: the Snapshots sheet parses; the real report holds only the
    // per-guest 'current' live-state markers (no real checkpoints).
    expect(b.proxmoxSnapshots.length).toBeGreaterThan(0)
    expect(b.proxmoxSnapshots.every((s) => ['qemu', 'lxc'].includes(s.guestType))).toBe(true)
    expect(b.proxmoxSnapshots.every((s) => s.name.toLowerCase() === 'current')).toBe(true)
```

- [ ] **Step 9: Lint, run the parser tests, commit**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npx vitest run src/engines/parser
```

Expected: Biome clean; parser tests PASS (realfile skips if the fixture is absent).

```
git add -A
git commit -m "feat(3a-01): parse Proxmox Snapshots sheet into ProxmoxSnapshotRow"
```

---

### Task 2: Concatenate `proxmoxSnapshots` through the merge

**Files:**

- Modify: `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`
- Test: `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts` (extend)

**Interfaces:**

- Consumes: `Snapshot.proxmoxSnapshots` (Task 1).
- Produces: `MergedEstate.proxmoxSnapshots: ProxmoxSnapshotRow[]` (flat concatenation across selected snapshots, like `vdatastore`/`vpartition`).

- [ ] **Step 1: Write the failing merge test**

In `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`, add a test. Reuse the file's existing `Snapshot` builder if one exists; otherwise add a minimal local builder. Example (adapt to the file's existing helpers — they must already set every required field; add `proxmoxSnapshots` to any local builder too):

```ts
import type { ProxmoxSnapshotRow } from '@/types'

const snap = (id: string, snaps: ProxmoxSnapshotRow[]): Snapshot => ({
  /* ...spread the file's existing minimal-snapshot helper if present... */
  id,
  proxmoxSnapshots: snaps,
  /* ...all other required fields... */
} as Snapshot)

it('concatenates proxmoxSnapshots across selected snapshots', () => {
  const a: ProxmoxSnapshotRow = {
    node: 'n1', guestId: '100', guestName: 'A', guestType: 'qemu',
    name: 's1', parent: 'no-parent', dateSerial: 46000, includeRam: false,
    sizeMib: mib(1024),
  }
  const b: ProxmoxSnapshotRow = { ...a, guestId: '200', guestName: 'B', name: 's2' }
  const merged = mergeSnapshotsToEstate([snap('x', [a]), snap('y', [b])])
  expect(merged.proxmoxSnapshots).toHaveLength(2)
  expect(merged.proxmoxSnapshots.map((s) => s.guestName)).toEqual(['A', 'B'])
})
```

> If the test file already has a full `Snapshot` factory, USE IT and just pass `proxmoxSnapshots`. Do not duplicate a 20-field literal. Import `mib` from `@/engines/units` if not already imported.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`
Expected: FAIL — `merged.proxmoxSnapshots` is `undefined`.

- [ ] **Step 3: Wire the field into `MergedEstate`**

In `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`:

1. Add `ProxmoxSnapshotRow` to the `@/types` import block.
2. Add to the `MergedEstate` interface (after `dvport`):

```ts
  /** Concatenated Proxmox guest snapshots (Plan 3A). Empty when the
   *  Snapshots sheet was absent — factual-degrade, never undefined. */
  proxmoxSnapshots: ProxmoxSnapshotRow[]
```

1. Add `proxmoxSnapshots: [],` to `EMPTY_MERGED`.
2. Add an accumulator + loop alongside the other passthrough arrays:

```ts
  const outProxmoxSnapshots: ProxmoxSnapshotRow[] = []
```

and inside the existing `for (const snap of selected) { ... }` passthrough loop (the one populating `outVdatastore`/`outVpartition`/network arrays), add:

```ts
    for (const s of snap.proxmoxSnapshots ?? []) outProxmoxSnapshots.push(s)
```

1. Add to the returned object: `proxmoxSnapshots: outProxmoxSnapshots,`.

- [ ] **Step 4: Run the merge tests to confirm green**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/snapshotMerge`
Expected: PASS (including the new test).

- [ ] **Step 5: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3a-02): concatenate proxmoxSnapshots through the estate merge"
```

---

### Task 3: `computeSnapshotSprawl` pure engine

**Files:**

- Create: `src/engines/aggregation/snapshotSprawl.ts`
- Modify: `src/engines/aggregation/index.ts`
- Test: `src/engines/aggregation/snapshotSprawl.test.ts` (new)

**Interfaces:**

- Consumes: `ProxmoxSnapshotRow` from `@/types/snapshot` (Task 1); a `today: Date` reference clock.
- Produces:
  - `excelSerialToUnixMs(serial: number): number`
  - `interface SnapshotSprawlRow { guestName, guestId, guestType, node, name, ageDays: number|null, sizeMib: number, includeRam: boolean }`
  - `interface SnapshotSprawl { rows: SnapshotSprawlRow[]; count: number; guestsWithSnapshots: number; totalSizeMib: number; oldestAgeDays: number|null }`
  - `computeSnapshotSprawl(snapshots: ProxmoxSnapshotRow[], today: Date): SnapshotSprawl`

- [ ] **Step 1: Write the failing engine test**

Create `src/engines/aggregation/snapshotSprawl.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { ProxmoxSnapshotRow } from '@/types/snapshot'
import { computeSnapshotSprawl, excelSerialToUnixMs } from './snapshotSprawl'

const row = (over: Partial<ProxmoxSnapshotRow>): ProxmoxSnapshotRow => ({
  node: 'n1',
  guestId: '100',
  guestName: 'Debian',
  guestType: 'qemu',
  name: 'snap',
  parent: 'no-parent',
  dateSerial: null,
  includeRam: false,
  sizeMib: mib(0),
  ...over,
})

// 2026-06-23 is Excel serial 46196 (days since 1899-12-30).
const TODAY = new Date('2026-06-23T00:00:00Z')

describe('excelSerialToUnixMs', () => {
  it('maps the Excel epoch offset (25569 = 1970-01-01)', () => {
    expect(excelSerialToUnixMs(25569)).toBe(0)
  })
})

describe('computeSnapshotSprawl', () => {
  it('is empty for no rows', () => {
    const s = computeSnapshotSprawl([], TODAY)
    expect(s).toEqual({
      rows: [],
      count: 0,
      guestsWithSnapshots: 0,
      totalSizeMib: 0,
      oldestAgeDays: null,
    })
  })

  it('excludes the current live-state marker from sprawl', () => {
    const s = computeSnapshotSprawl(
      [row({ name: 'current' }), row({ name: 'real', guestId: '100' })],
      TODAY,
    )
    expect(s.count).toBe(1)
    expect(s.rows[0]?.name).toBe('real')
  })

  it('counts distinct guests, sums size, and reports oldest age (oldest first)', () => {
    const s = computeSnapshotSprawl(
      [
        row({ guestId: '100', name: 'old', dateSerial: 46100, sizeMib: mib(1024) }), // ~96d
        row({ guestId: '100', name: 'new', dateSerial: 46190, sizeMib: mib(512) }), //  ~6d
        row({ guestId: '200', name: 'x', dateSerial: null, sizeMib: mib(256) }),
      ],
      TODAY,
    )
    expect(s.count).toBe(3)
    expect(s.guestsWithSnapshots).toBe(2)
    expect(s.totalSizeMib).toBe(1792)
    expect(s.oldestAgeDays).toBe(96)
    // oldest first; null age sorts last.
    expect(s.rows.map((r) => r.name)).toEqual(['old', 'new', 'x'])
    expect(s.rows[2]?.ageDays).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/snapshotSprawl.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the engine**

Create `src/engines/aggregation/snapshotSprawl.ts`:

```ts
import type { ProxmoxSnapshotRow } from '@/types/snapshot'

/**
 * Pure snapshot-sprawl extract — how many guest snapshots ("checkpoints") the
 * estate still holds, how old, how big. Neutral measurement only — no verdict,
 * no severity (ADR-0012). No React/Zustand/Zod/DOM.
 *
 * The Proxmox report emits a per-guest live-state marker row (`name ===
 * 'current'`, `parent === 'no-parent'`) that is NOT a checkpoint — it is
 * excluded from sprawl. `today` is the injected reference clock (same
 * discipline as the EOS forecast) so this stays a pure function.
 */

const MS_PER_DAY = 86_400_000
// Days between the Excel epoch (1899-12-30) and the Unix epoch (1970-01-01).
const EXCEL_UNIX_OFFSET_DAYS = 25_569

/** Convert an Excel serial date to Unix epoch milliseconds. */
export const excelSerialToUnixMs = (serial: number): number =>
  Math.round((serial - EXCEL_UNIX_OFFSET_DAYS) * MS_PER_DAY)

export interface SnapshotSprawlRow {
  guestName: string
  guestId: string
  guestType: 'qemu' | 'lxc'
  node: string
  name: string
  /** Whole days since creation; `null` when the source date was blank. */
  ageDays: number | null
  sizeMib: number
  includeRam: boolean
}

export interface SnapshotSprawl {
  /** Real checkpoints only (the `current` marker excluded), oldest first. */
  rows: SnapshotSprawlRow[]
  count: number
  guestsWithSnapshots: number
  totalSizeMib: number
  /** Oldest checkpoint age in days; `null` when no dated checkpoint exists. */
  oldestAgeDays: number | null
}

const isCurrentMarker = (name: string): boolean => name.trim().toLowerCase() === 'current'

export const computeSnapshotSprawl = (
  snapshots: ProxmoxSnapshotRow[],
  today: Date,
): SnapshotSprawl => {
  const real = snapshots.filter((s) => !isCurrentMarker(s.name))
  const rows: SnapshotSprawlRow[] = real.map((s) => ({
    guestName: s.guestName,
    guestId: s.guestId,
    guestType: s.guestType,
    node: s.node,
    name: s.name,
    ageDays:
      s.dateSerial === null
        ? null
        : Math.max(
            0,
            Math.floor((today.getTime() - excelSerialToUnixMs(s.dateSerial)) / MS_PER_DAY),
          ),
    sizeMib: s.sizeMib as number,
    includeRam: s.includeRam,
  }))
  // Oldest first; rows with no date (null age) sort last.
  rows.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1))

  const guests = new Set(real.map((s) => s.guestId))
  const totalSizeMib = real.reduce((acc, s) => acc + (s.sizeMib as number), 0)
  const ages = rows.map((r) => r.ageDays).filter((a): a is number => a !== null)
  const oldestAgeDays = ages.length === 0 ? null : Math.max(...ages)

  return {
    rows,
    count: real.length,
    guestsWithSnapshots: guests.size,
    totalSizeMib,
    oldestAgeDays,
  }
}
```

- [ ] **Step 4: Export from the aggregation barrel**

In `src/engines/aggregation/index.ts`, add (alphabetical, after the `sizing` export block):

```ts
export {
  computeSnapshotSprawl,
  excelSerialToUnixMs,
  type SnapshotSprawl,
  type SnapshotSprawlRow,
} from './snapshotSprawl'
```

- [ ] **Step 5: Run the engine test to confirm green**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/snapshotSprawl.test.ts`
Expected: PASS (5/5).

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3a-03): add pure computeSnapshotSprawl aggregation engine"
```

---

### Task 4: Compose the `snapshotSprawl` slice on `EstateView`

**Files:**

- Modify: `src/types/estate.ts`
- Modify: `src/engines/aggregation/estateView.ts`
- Test: `src/engines/aggregation/estateView.snapshotSprawl.test.ts` (new)

**Interfaces:**

- Consumes: `MergedEstate.proxmoxSnapshots` (Task 2); `computeSnapshotSprawl` + `SnapshotSprawl` (Task 3); the `today: Date` already threaded into `buildEstateView`.
- Produces: `EstateView.snapshotSprawl: SnapshotSprawl`; frozen `EMPTY_SPRAWL` on `EMPTY_VIEW`.

- [ ] **Step 1: Write the failing EstateView test**

Create `src/engines/aggregation/estateView.snapshotSprawl.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { mib } from '@/engines/units'
import type { ProxmoxSnapshotRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView, EMPTY_VIEW } from './estateView'

const TODAY = new Date('2026-06-23T00:00:00Z')

const minimalSnapshot = (snaps: ProxmoxSnapshotRow[]): Snapshot => ({
  id: 's1',
  filename: 'r.xlsx',
  fileSize: mib(0) as unknown as Snapshot['fileSize'],
  capturedAt: TODAY,
  vCenterLabel: 'proxmox',
  rvtoolsVersion: '',
  parsedAt: TODAY,
  source: 'proxmox',
  viSdkUuid: null,
  vMetaData: [],
  vinfo: [],
  vhost: [],
  vmUsage: [],
  vdatastore: [],
  vpartition: [],
  vnetwork: [],
  vswitch: [],
  dvswitch: [],
  dvport: [],
  proxmoxSnapshots: snaps,
  parseErrors: [],
})

describe('buildEstateView — snapshotSprawl slice', () => {
  it('EMPTY_VIEW carries a zeroed snapshotSprawl', () => {
    expect(EMPTY_VIEW.snapshotSprawl).toEqual({
      rows: [],
      count: 0,
      guestsWithSnapshots: 0,
      totalSizeMib: 0,
      oldestAgeDays: null,
    })
  })

  it('composes sprawl from merged.proxmoxSnapshots, excluding the current marker', () => {
    const snaps: ProxmoxSnapshotRow[] = [
      {
        node: 'n1', guestId: '100', guestName: 'A', guestType: 'qemu',
        name: 'current', parent: 'no-parent', dateSerial: null, includeRam: false, sizeMib: mib(0),
      },
      {
        node: 'n1', guestId: '100', guestName: 'A', guestType: 'qemu',
        name: 'real', parent: 'no-parent', dateSerial: 46100, includeRam: true, sizeMib: mib(2048),
      },
    ]
    const snap = minimalSnapshot(snaps)
    const view = buildEstateView(mergeSnapshotsToEstate([snap]), [snap], 'active', TODAY)
    expect(view.snapshotSprawl.count).toBe(1)
    expect(view.snapshotSprawl.totalSizeMib).toBe(2048)
    expect(view.snapshotSprawl.rows[0]?.name).toBe('real')
  })
})
```

> If `fileSize` typing via the cast above trips Biome/TS, import `bytes` from `@/engines/units` and use `bytes(0)` instead — match what the sibling realfile test does.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/estateView.snapshotSprawl.test.ts`
Expected: FAIL — `snapshotSprawl` is missing on the view / `EMPTY_VIEW`.

- [ ] **Step 3: Add the field to the `EstateView` type**

In `src/types/estate.ts`:

1. Add the type-only import alongside the others at the top:

```ts
import type { SnapshotSprawl } from '@/engines/aggregation/snapshotSprawl'
```

1. Add the field to the `EstateView` interface, immediately after `monsters: MonsterEstate`:

```ts
  /**
   * Plan 3A snapshot-sprawl extract — guest checkpoints still held on the
   * estate (the Proxmox live-state `current` marker excluded). Neutral
   * measurement; same single-pass origin; `EMPTY_SPRAWL` in `EMPTY_VIEW`. */
  snapshotSprawl: SnapshotSprawl
```

- [ ] **Step 4: Compose the slice in `buildEstateView`**

In `src/engines/aggregation/estateView.ts`:

1. Add to the imports from `./monsterVm` line area — add a new import:

```ts
import { computeSnapshotSprawl } from './snapshotSprawl'
```

1. After the `const monsters = computeMonsters(...)` block, add:

```ts
  // Plan 3A snapshot sprawl — same single pass. `today` is the injected
  // reference clock (no in-engine clock); the engine excludes the Proxmox
  // 'current' live-state marker.
  const snapshotSprawl = computeSnapshotSprawl(merged.proxmoxSnapshots, today)
```

1. Add `snapshotSprawl,` to the returned object (after `monsters,`).

2. Add the frozen empty just after `EMPTY_MONSTERS`:

```ts
const EMPTY_SPRAWL = Object.freeze({
  rows: Object.freeze([]) as never[],
  count: 0,
  guestsWithSnapshots: 0,
  totalSizeMib: 0,
  oldestAgeDays: null,
})
```

1. Add `snapshotSprawl: EMPTY_SPRAWL,` to the `EMPTY_VIEW` literal (after `monsters: EMPTY_MONSTERS,`).

- [ ] **Step 5: Run the test + FULL typecheck**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/estateView.snapshotSprawl.test.ts && npm run typecheck
```

Expected: test PASSES; typecheck 0 errors.

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3a-04): compose snapshotSprawl slice on EstateView"
```

---

### Task 5: `SnapshotSprawlView` + nav + i18n

**Files:**

- Create: `src/components/snapshots/SnapshotSprawlView.tsx`
- Modify: `src/components/ViewToggle.tsx`
- Modify: `src/App.tsx`
- Create: `src/i18n/locales/{en,fr,de,it}/snapshots.json`
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/inventory.json`
- Test: `src/components/snapshots/SnapshotSprawlView.test.tsx` (new)

**Interfaces:**

- Consumes: `useEstateView('active').snapshotSprawl` (Task 4); `DataTable` from `@/components/inventory/DataTable`; `useSnapshotStore` + `selectActiveSnapshot`.
- Produces: `SnapshotSprawlView` React component; `AppView` union gains `'snapshots'`.

- [ ] **Step 1: Add the `snapshots` i18n namespace (all 4 locales)**

Create `src/i18n/locales/en/snapshots.json`:

```json
{
  "heading": "Snapshot Sprawl",
  "subtitle": "Guest snapshots still held on this estate",
  "empty": {
    "heading": "No report loaded",
    "body": "Load a report to see guest snapshot sprawl."
  },
  "none": "No guest snapshots are held on this estate.",
  "kpi": {
    "count": "Snapshots",
    "guests": "Guests with snapshots",
    "totalSize": "Total size (GiB)",
    "oldest": "Oldest (days)"
  },
  "col": {
    "guestName": "Guest",
    "node": "Node",
    "name": "Snapshot",
    "ageDays": "Age (days)",
    "sizeGib": "Size (GiB)",
    "includeRam": "Includes RAM"
  }
}
```

Create `src/i18n/locales/fr/snapshots.json`:

```json
{
  "heading": "Prolifération des snapshots",
  "subtitle": "Snapshots d'invités encore conservés sur ce parc",
  "empty": {
    "heading": "Aucun rapport chargé",
    "body": "Chargez un rapport pour voir la prolifération des snapshots d'invités."
  },
  "none": "Aucun snapshot d'invité n'est conservé sur ce parc.",
  "kpi": {
    "count": "Snapshots",
    "guests": "Invités avec snapshots",
    "totalSize": "Taille totale (Gio)",
    "oldest": "Plus ancien (jours)"
  },
  "col": {
    "guestName": "Invité",
    "node": "Nœud",
    "name": "Snapshot",
    "ageDays": "Âge (jours)",
    "sizeGib": "Taille (Gio)",
    "includeRam": "Inclut la RAM"
  }
}
```

Create `src/i18n/locales/de/snapshots.json`:

```json
{
  "heading": "Snapshot-Wildwuchs",
  "subtitle": "Gast-Snapshots, die noch in diesem Bestand gehalten werden",
  "empty": {
    "heading": "Kein Bericht geladen",
    "body": "Laden Sie einen Bericht, um den Gast-Snapshot-Wildwuchs zu sehen."
  },
  "none": "In diesem Bestand werden keine Gast-Snapshots gehalten.",
  "kpi": {
    "count": "Snapshots",
    "guests": "Gäste mit Snapshots",
    "totalSize": "Gesamtgröße (GiB)",
    "oldest": "Ältester (Tage)"
  },
  "col": {
    "guestName": "Gast",
    "node": "Knoten",
    "name": "Snapshot",
    "ageDays": "Alter (Tage)",
    "sizeGib": "Größe (GiB)",
    "includeRam": "Enthält RAM"
  }
}
```

Create `src/i18n/locales/it/snapshots.json`:

```json
{
  "heading": "Proliferazione degli snapshot",
  "subtitle": "Snapshot degli ospiti ancora conservati in questo parco",
  "empty": {
    "heading": "Nessun report caricato",
    "body": "Carica un report per vedere la proliferazione degli snapshot degli ospiti."
  },
  "none": "Nessuno snapshot degli ospiti è conservato in questo parco.",
  "kpi": {
    "count": "Snapshot",
    "guests": "Ospiti con snapshot",
    "totalSize": "Dimensione totale (GiB)",
    "oldest": "Più vecchio (giorni)"
  },
  "col": {
    "guestName": "Ospite",
    "node": "Nodo",
    "name": "Snapshot",
    "ageDays": "Età (giorni)",
    "sizeGib": "Dimensione (GiB)",
    "includeRam": "Include la RAM"
  }
}
```

- [ ] **Step 2: Register the namespace and add the nav label**

In `src/i18n/index.ts`:

1. Add 4 imports (mirror the `monstervm` lines):

```ts
import deSnapshots from './locales/de/snapshots.json'
import enSnapshots from './locales/en/snapshots.json'
import frSnapshots from './locales/fr/snapshots.json'
import itSnapshots from './locales/it/snapshots.json'
```

1. Add `'snapshots'` to the `NAMESPACES` array (after `'monstervm'`).
2. Add `snapshots: enSnapshots,` / `frSnapshots` / `deSnapshots` / `itSnapshots` to the four `resources` locale objects (after the `monstervm:` line in each).

In each of `src/i18n/locales/{en,fr,de,it}/inventory.json`, add a `nav.snapshots` key inside the existing `nav` object:

- en: `"snapshots": "Snapshots"`
- fr: `"snapshots": "Snapshots"`
- de: `"snapshots": "Snapshots"`
- it: `"snapshots": "Snapshot"`

- [ ] **Step 3: Write the failing component test**

Create `src/components/snapshots/SnapshotSprawlView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes, cores, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProxmoxSnapshotRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { SnapshotSprawlView } from './SnapshotSprawlView'

const snapshot = (snaps: ProxmoxSnapshotRow[]): Snapshot =>
  ({
    id: 's1',
    filename: 's1.xlsx',
    fileSize: bytes(0),
    capturedAt: new Date('2026-06-23'),
    vCenterLabel: 'proxmox',
    rvtoolsVersion: '',
    parsedAt: new Date('2026-06-23'),
    source: 'proxmox',
    viSdkUuid: null,
    vMetaData: [],
    vinfo: [
      {
        vmName: 'Debian', cluster: 'proxmox', host: 'n1', vcpu: cores(2), vramMib: mib(2048),
        cpuReadinessPercent: null, poweredOn: true, powerState: 'poweredOn', template: false,
        osConfig: '', osTools: '', vmBiosUuid: '', vmInstanceUuid: '100', viSdkUuid: '',
        viSdkServer: '', provisionedMib: mib(0), inUseMib: mib(0), path: '', guestType: 'qemu',
      },
    ],
    vhost: [],
    vmUsage: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    proxmoxSnapshots: snaps,
    parseErrors: [],
  }) satisfies Snapshot

describe('SnapshotSprawlView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty state when no snapshot is loaded', () => {
    render(<SnapshotSprawlView />)
    expect(screen.getByText('No report loaded')).not.toBeNull()
  })

  it('renders the none-message when only the current marker is present', () => {
    useSnapshotStore.getState().addSnapshot(
      snapshot([
        {
          node: 'n1', guestId: '100', guestName: 'Debian', guestType: 'qemu',
          name: 'current', parent: 'no-parent', dateSerial: null, includeRam: false, sizeMib: mib(0),
        },
      ]),
    )
    render(<SnapshotSprawlView />)
    expect(screen.getByText('No guest snapshots are held on this estate.')).not.toBeNull()
  })

  it('renders a real checkpoint row in the table', () => {
    useSnapshotStore.getState().addSnapshot(
      snapshot([
        {
          node: 'n1', guestId: '100', guestName: 'Debian', guestType: 'qemu',
          name: 'before-upgrade', parent: 'no-parent', dateSerial: 46100, includeRam: true,
          sizeMib: mib(2048),
        },
      ]),
    )
    render(<SnapshotSprawlView />)
    expect(screen.getByText('before-upgrade')).not.toBeNull()
  })
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/components/snapshots/SnapshotSprawlView.test.tsx`
Expected: FAIL — component module not found.

- [ ] **Step 5: Implement the view**

Create `src/components/snapshots/SnapshotSprawlView.tsx` (modeled on `MonsterVmView.tsx` — same empty-state guard, `ErrorBoundary`, KPI panel, `DataTable`; NO thresholds):

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import type { SnapshotSprawlRow } from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * Plan 3A — Snapshot Sprawl: read-only presenter of the guest checkpoints the
 * estate still holds (`view.snapshotSprawl`, produced in the single
 * `buildEstateView` pass). Neutral measurement — no verdict (ADR-0012). The
 * Proxmox 'current' live-state marker is excluded by the engine.
 */

const MIB_PER_GIB = 1024

function SprawlError({ error }: FallbackProps) {
  const { t } = useTranslation('dashboard')
  const message = error instanceof Error ? error.message : 'unknown error'
  return (
    <div
      role="alert"
      className="rounded-lg border border-util-high/40 bg-white p-6 dark:bg-surface-800"
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">{t('states.error', { message })}</p>
    </div>
  )
}

export function SnapshotSprawlView() {
  const { t, i18n } = useTranslation('snapshots')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const sprawl = view.snapshotSprawl

  if (!snapshot) {
    return (
      <main className="flex-1 p-8">
        <section className="panel">
          <h2 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
            {t('heading')}
          </h2>
          <strong className="block text-slate-700 dark:text-slate-200">{t('empty.heading')}</strong>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('empty.body')}</p>
        </section>
      </main>
    )
  }

  const columns: ColumnDef<SnapshotSprawlRow>[] = [
    { accessorKey: 'guestName', id: 'guestName', header: 'col.guestName', enableHiding: false },
    { accessorKey: 'node', id: 'node', header: 'col.node' },
    { accessorKey: 'name', id: 'name', header: 'col.name' },
    {
      accessorKey: 'ageDays',
      id: 'ageDays',
      header: 'col.ageDays',
      cell: (c) => {
        const v = c.getValue<number | null>()
        return v === null ? '—' : fmtInt(v, loc)
      },
    },
    {
      id: 'sizeGib',
      accessorFn: (r) => Math.round(r.sizeMib / MIB_PER_GIB),
      header: 'col.sizeGib',
      cell: (c) => fmtInt(c.getValue() as number, loc),
    },
    {
      accessorKey: 'includeRam',
      id: 'includeRam',
      header: 'col.includeRam',
      cell: (c) => (c.getValue() ? '✓' : '—'),
    },
  ]

  const kpis: { key: string; value: string }[] = [
    { key: 'count', value: fmtInt(sprawl.count, loc) },
    { key: 'guests', value: fmtInt(sprawl.guestsWithSnapshots, loc) },
    { key: 'totalSize', value: fmtInt(Math.round(sprawl.totalSizeMib / MIB_PER_GIB), loc) },
    {
      key: 'oldest',
      value: sprawl.oldestAgeDays === null ? '—' : fmtInt(sprawl.oldestAgeDays, loc),
    },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={SprawlError}>
        <div className="flex flex-col gap-6">
          <section className="panel">
            <h2 className="mb-1 text-xl font-semibold text-slate-700 dark:text-slate-200">
              {t('heading')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </section>

          <section className="panel">
            <div className="flex flex-wrap items-end gap-8">
              {kpis.map((k) => (
                <div key={k.key} className="flex flex-col">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t(`kpi.${k.key}`)}
                  </span>
                  <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                    {k.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            {sprawl.count === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('none')}</p>
            ) : (
              <DataTable
                data={sprawl.rows}
                columns={columns}
                headerFor={(id) => t(`col.${id}`)}
                objectKind="vm"
              />
            )}
          </section>
        </div>
      </ErrorBoundary>
    </main>
  )
}
```

> Note the `headerFor={(id) => t(`col.${id}`)}` reads the `snapshots` namespace (the active `useTranslation` ns) — NOT `inventory` — because these columns (`ageDays`, `sizeGib`, `includeRam`) have no `inventory:col.*` keys. This avoids the `DataTable` raw-key gotcha.

- [ ] **Step 6: Wire the view into the nav + dispatch**

In `src/components/ViewToggle.tsx`:

1. Add `| 'snapshots'` to the `AppView` union (after `'monstervm'`).
2. Add `'snapshots',` to the `VIEWS` array (after `'monstervm'`).

In `src/App.tsx`:

1. Add the import:

```tsx
import { SnapshotSprawlView } from './components/snapshots/SnapshotSprawlView'
```

1. Add a dispatch branch before the final `: (` / `<GlobalDashboard />`:

```tsx
            ) : activeView === 'snapshots' ? (
              <SnapshotSprawlView />
```

- [ ] **Step 7: Run the component test + key-parity + terminology + typecheck**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/components/snapshots src/i18n/keyParity.test.ts src/i18n/terminology.test.ts && npm run typecheck
```

Expected: all PASS; typecheck 0 errors. If keyParity fails, a locale file is missing a key — reconcile the four `snapshots.json` files.

- [ ] **Step 8: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3a-05): add SnapshotSprawlView, nav entry and snapshots i18n namespace"
```

---

### Task 6: Real-report acceptance test

**Files:**

- Create: `src/engines/aggregation/snapshotSprawl.realfile.test.ts`

**Interfaces:**

- Consumes: the full parse→merge→view pipeline (Tasks 1–4) and the git-ignored fixture `src/engines/parser/__fixtures__/proxmox-report.xlsx`.

- [ ] **Step 1: Write the realfile acceptance test**

Create `src/engines/aggregation/snapshotSprawl.realfile.test.ts` (mirror `proxmox-estate.realfile.test.ts`'s skip-guard + Snapshot assembly):

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adaptProxmox } from '@/engines/parser/adapters/proxmox'
import { parseXlsx } from '@/engines/parser/parseXlsx'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView } from './estateView'

const fixture = join(__dirname, '../parser/__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

describe('snapshot sprawl acceptance (real report)', () => {
  maybe('parses the Snapshots sheet; the real report holds only current markers', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const bundle = adaptProxmox(wb)

    const snapshot: Snapshot = {
      id: 'proxmox-sprawl-realfile',
      filename: 'proxmox-report.xlsx',
      fileSize: bytes(0),
      capturedAt: new Date('2026-06-23T00:00:00Z'),
      vCenterLabel: bundle.clusterName,
      rvtoolsVersion: 'proxmox',
      parsedAt: new Date('2026-06-23T00:00:00Z'),
      source: 'proxmox',
      viSdkUuid: null,
      vMetaData: [],
      vinfo: bundle.vinfo,
      vhost: bundle.vhost,
      vmUsage: bundle.vmUsage,
      vdatastore: bundle.vdatastore,
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      proxmoxSnapshots: bundle.proxmoxSnapshots,
      parseErrors: bundle.warnings,
    }

    const merged = mergeSnapshotsToEstate([snapshot])
    const view = buildEstateView(merged, [snapshot], 'active', new Date('2026-06-23T00:00:00Z'))
    const { snapshotSprawl } = view

    console.log('[sprawl] raw Snapshots rows:', bundle.proxmoxSnapshots.length)
    console.log('[sprawl] real checkpoints (count):', snapshotSprawl.count)

    // The sheet IS parsed (markers present)…
    expect(bundle.proxmoxSnapshots.length).toBeGreaterThan(0)
    // …but the real report has zero real checkpoints (all 'current' markers),
    // so sprawl is honestly empty. This documents the fixture's nature.
    expect(snapshotSprawl.count).toBe(0)
    expect(snapshotSprawl.oldestAgeDays).toBeNull()
    expect(snapshotSprawl.rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run it**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/snapshotSprawl.realfile.test.ts`
Expected: PASS if the fixture is present (logs `raw Snapshots rows: 7`, `real checkpoints (count): 0`); SKIPS cleanly on CI where the fixture is absent.

- [ ] **Step 3: Full suite + lint, then commit**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npm run typecheck && npx vitest run
```

Expected: Biome clean; typecheck 0 errors; all tests pass (realfile tests skip without the fixture).

```
git add -A
git commit -m "test(3a-06): real-report acceptance for snapshot sprawl"
```

---

## Self-Review

**Spec coverage** (Plan 3 scope item "Snapshot sprawl"):

- Parse `Snapshots` sheet → Task 1 ✓
- Carry through Snapshot + merge → Tasks 1, 2 ✓
- Pure reduction (count/guests/size/age, exclude `current`) → Task 3 ✓
- Surface on `EstateView` (single pass) → Task 4 ✓
- Nav view + i18n (4 locales) → Task 5 ✓
- Real-report acceptance → Task 6 ✓

**Type consistency:** `ProxmoxSnapshotRow` (Task 1) → `MergedEstate.proxmoxSnapshots` (Task 2) → `computeSnapshotSprawl` input (Task 3) → `EstateView.snapshotSprawl: SnapshotSprawl` (Task 4) → `SnapshotSprawlRow` columns (Task 5). `excelSerialToUnixMs` defined once (Task 3), reused in the engine. `today` is the existing `buildEstateView` param — no new clock.

**Placeholder scan:** none — every step carries complete code or an exact command.

**Known fixture limitation (surfaced, not hidden):** the real report's `Snapshots` sheet contains only per-guest `current` live-state markers, so real-data sprawl is `0`. Task 6 asserts this explicitly so the empty result is documented as correct, not a silent miss. All non-trivial engine logic (age, size sum, distinct-guest count, marker exclusion, sort order) is covered by the synthetic-row unit tests in Task 3.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-patlas-3a-snapshot-sprawl.md`.

Execution: Subagent-Driven Development on a branch `feat/patlas-3a-snapshot-sprawl` off `main` (`bba90c6`), fresh implementer per task + task review, then a whole-branch review, then PR #4 → `main` following the established merge-then-stack pattern.
