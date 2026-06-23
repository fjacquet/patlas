# Storage Content Health (Plan 3B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Proxmox storage-content health — what occupies each storage, broken down by content type (images / rootdir / iso / vztmpl / backup …) and by storage, plus a backup-file inventory with per-guest recency — parsed from the report's `Storage Content` sheet.

**Architecture:** The established patlas "extra view" mold (proven in Plan 3A): a new canonical row (`ProxmoxStorageContentRow`) parsed by a new `adaptProxmoxStorageContent` adapter, carried on `Snapshot`, concatenated through `mergeSnapshotsToEstate`, reduced by a pure `computeStorageContentHealth` engine into a `storageContent` slice on `EstateView` (composed inside the single `buildEstateView` pass — no second `useMemo`), and rendered by a read-only `StorageContentView` wired into the nav. Backup-file recency reuses `excelSerialToUnixMs` shipped in Plan 3A. Neutral measurement only — no verdict (ADR-0012).

**Scope note (read before starting):** This plan covers the **flat `Storage Content` sheet only** (storage health + backup-FILE inventory). Backup-**JOB** schedules live in the stacked composite `Cluster` sheet (a "Backup Jobs" sub-table) and are deliberately deferred to Plan 3C, which builds the shared stacked-sub-table extractor it also needs for `Cluster HA`. Do not parse the `Cluster` sheet here.

**Tech Stack:** React 19 · TypeScript strict · Zustand 5 · react-i18next (en/fr/de/it) · Vitest 4 · Biome · SheetJS (worker-only).

## Global Constraints

- **Engines/parser are pure** — no React/DOM/Zustand. The Proxmox adapter does NOT use Zod (it builds trusted typed rows via `readNumber`/`readString`, matching `adaptProxmoxGuests`/`adaptProxmoxSnapshots`).
- **The single `useMemo`** lives only in `useEstateView`; every derived slice composes inside the one `buildEstateView` pass. Never add a second memo site.
- **Branded units** — `Size GB` reinterpreted as GiB → MiB via `gibToMib(gib(n))`; never a raw `* 1.048576`/`* 1024`. Display-time `/1024` for GiB rendering is fine.
- **`null` = not derivable, never coerced to 0** (ADR-0012) — applies to `usagePercent`, `creationSerial`, and all `ageDays`/`*AgeDays` outputs.
- **No NUL-byte corruption** — a recurring hazard turns `.ts` into binary files when a whole-file write mangles template-literal spaces into NUL bytes. Prefer targeted Edits on existing files; after writing any file verify `tr -dc '\000' < <file> | wc -c` is `0` and `git diff --stat` shows text (line counts, not `Bin`).
- **i18n keys land in ALL FOUR locales** (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces identical key trees (auto-discovered from `locales/en/`). No pre-formatted numbers in strings; no editorial verbs ("recommend/should/poor/good").
- **Terminology guard** — `src/i18n/terminology.test.ts` forbids VMware tokens (`RVTools`/`vCenter`/`ESX`/`ESXi`/`datastore`) in i18n values. Use Proxmox terms: Guest, Node, Storage, Content, Backup.
- **Privacy invariant (PAR-05)** — no network egress of dataset bytes; no `localStorage` of rows. `xlsx` import stays worker-only.
- **Commit prefix** `<type>(3b-NN): …`. Signed commits required — never `--no-gpg-sign` / `-c commit.gpgsign=false`. End every commit body with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MwiWBcuAc1YW4W1oE9Na2Z
  ```
- **Run the FULL `npm run typecheck`** (app + `tsconfig.test.json`) after adding a required field to a shared type. `rtk tsc` skips the test project.
- **Lint with `npx @biomejs/biome check .`** (NOT `npm run lint`). Run before every commit; `--write` to fix.

## Real sheet schema (from the fixture, for reference)

`Storage Content` headers (row 0):
`Node | Storage | Content | File Name | Format | Size GB | Storage Usage % | Vm Id | Guest Name | Creation Date | Notes | Parent`

22 data rows. Content types observed: `images`, `rootdir`, `iso`, `vztmpl` (NO `backup` rows in this fixture — plan for `backup` defensively; it is real-data-ready and exercised by synthetic tests). `Size GB` can be fractional (e.g. `0.0005`). `Storage Usage %` is a percentage value (e.g. `0.0356` = 0.0356 %). `Creation Date` is an Excel serial (e.g. `46190.36`). `Vm Id`/`Guest Name` are blank for iso/vztmpl. Storages observed: `DATA`, `local`, `local-lvm`.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/types/snapshot.ts` | `ProxmoxStorageContentRow` + required `proxmoxStorageContent` field on `Snapshot` | 1 |
| `src/types/index.ts` | Barrel re-export `ProxmoxStorageContentRow` | 1 |
| `src/engines/parser/adapters/proxmoxColumns.ts` | `STORAGE_CONTENT_COLS` alias map | 1 |
| `src/engines/parser/adapters/proxmox.ts` | `adaptProxmoxStorageContent` + wire into `adaptProxmox` | 1 |
| `src/engines/parser/parser.worker.ts` | Set `proxmoxStorageContent` on the assembled `Snapshot` | 1 |
| (all `Snapshot` literals in tests) | Add `proxmoxStorageContent: []` so typecheck stays green | 1 |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` | Concatenate `proxmoxStorageContent` into `MergedEstate` | 2 |
| `src/engines/aggregation/storageContentHealth.ts` | Pure `computeStorageContentHealth` | 3 |
| `src/engines/aggregation/index.ts` | Export the new engine + types | 3 |
| `src/types/estate.ts` | Add `storageContent: StorageContentHealth` to `EstateView` | 4 |
| `src/engines/aggregation/estateView.ts` | Compose the slice + `EMPTY_STORAGE_CONTENT`/`EMPTY_VIEW` | 4 |
| `src/components/storagecontent/StorageContentView.tsx` | Read-only presenter | 5 |
| `src/components/ViewToggle.tsx` | `'storagecontent'` in `AppView` union + `VIEWS` | 5 |
| `src/App.tsx` | Import + dispatch branch | 5 |
| `src/i18n/locales/{en,fr,de,it}/storagecontent.json` | New namespace | 5 |
| `src/i18n/index.ts` | Register `storagecontent` namespace | 5 |
| `src/i18n/locales/{en,fr,de,it}/inventory.json` | `nav.storagecontent` label | 5 |
| `src/components/ViewToggle.test.tsx` | Update for the new (12th) nav segment | 5 |
| `src/engines/aggregation/storageContentHealth.realfile.test.ts` | Real-report acceptance | 6 |

---

### Task 1: Parse the `Storage Content` sheet → `ProxmoxStorageContentRow[]`

**Files:**
- Modify: `src/types/snapshot.ts`, `src/types/index.ts`, `src/engines/parser/adapters/proxmoxColumns.ts`, `src/engines/parser/adapters/proxmox.ts`, `src/engines/parser/parser.worker.ts`
- Modify: every test file constructing a `Snapshot` literal (Step 6)
- Test: `src/engines/parser/adapters/proxmox.storageContent.test.ts` (new), `src/engines/parser/proxmox.realfile.test.ts` (extend)

**Interfaces:**
- Produces: `interface ProxmoxStorageContentRow { node, storage, content, fileName, format, sizeMib: MiB, usagePercent: number|null, guestId, guestName, creationSerial: number|null }`; `Snapshot.proxmoxStorageContent: ProxmoxStorageContentRow[]` (required); `adaptProxmoxStorageContent(sheet: ParsedSheet | undefined): ProxmoxStorageContentRow[]`; `adaptProxmox(...)` return gains `proxmoxStorageContent: ProxmoxStorageContentRow[]`.
- Consumes: `mapColumns`, `readCol`, `readNumber`, `readString`, `findSheet`; `gib`, `gibToMib`.

- [ ] **Step 1: Write the failing adapter test**

Create `src/engines/parser/adapters/proxmox.storageContent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import { adaptProxmoxStorageContent } from './proxmox'

const sheet = (rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Storage Content',
  headers: [
    'Node',
    'Storage',
    'Content',
    'File Name',
    'Format',
    'Size GB',
    'Storage Usage %',
    'Vm Id',
    'Guest Name',
    'Creation Date',
    'Notes',
    'Parent',
  ],
  rows,
})

describe('adaptProxmoxStorageContent', () => {
  it('returns [] when the sheet is absent', () => {
    expect(adaptProxmoxStorageContent(undefined)).toEqual([])
  })

  it('parses an image row with branded MiB size and a serial creation date', () => {
    const rows = adaptProxmoxStorageContent(
      sheet([
        {
          Node: 'promox',
          Storage: 'DATA',
          Content: 'images',
          'File Name': '100/vm-100-disk-0.qcow2',
          Format: 'qcow2',
          'Size GB': 32,
          'Storage Usage %': 0.0356,
          'Vm Id': '100',
          'Guest Name': 'Debian',
          'Creation Date': 46190.36,
          Notes: null,
          Parent: null,
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r?.storage).toBe('DATA')
    expect(r?.content).toBe('images')
    expect(r?.format).toBe('qcow2')
    expect(r?.sizeMib as number).toBe(32 * 1024)
    expect(r?.usagePercent).toBeCloseTo(0.0356)
    expect(r?.guestName).toBe('Debian')
    expect(r?.creationSerial).toBe(46190.36)
  })

  it('treats a blank usage/creation cell as null (not 0), and blank guest as empty', () => {
    const rows = adaptProxmoxStorageContent(
      sheet([
        {
          Node: 'promox',
          Storage: 'DATA',
          Content: 'iso',
          'File Name': 'iso/debian.iso',
          Format: 'iso',
          'Size GB': 0.737,
          'Storage Usage %': null,
          'Vm Id': '',
          'Guest Name': '',
          'Creation Date': null,
        },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.usagePercent).toBeNull()
    expect(rows[0]?.creationSerial).toBeNull()
    expect(rows[0]?.guestName).toBe('')
  })

  it('drops rows with a blank File Name', () => {
    expect(adaptProxmoxStorageContent(sheet([{ Node: 'promox', 'File Name': '' }]))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.storageContent.test.ts`
Expected: FAIL — `adaptProxmoxStorageContent` not exported.

- [ ] **Step 3: Add the type and the `Snapshot` field**

In `src/types/snapshot.ts` (the `MiB` import already exists), add this interface just above the `ProxmoxSnapshotRow` interface (keep the Proxmox row types grouped):

```ts
/**
 * A storage-content row from the Proxmox report `Storage Content` sheet — one
 * file/volume on a storage (a VM disk image, container rootdir, ISO, template,
 * or backup archive). `usagePercent`/`creationSerial` are `null` when the cell
 * is blank ("not derivable"; never 0). `guestId`/`guestName` are empty for
 * non-guest content (iso, vztmpl).
 */
export interface ProxmoxStorageContentRow {
  node: string
  storage: string
  /** Proxmox content class: 'images' | 'rootdir' | 'iso' | 'vztmpl' | 'backup' | 'snippets' | 'import' | … */
  content: string
  fileName: string
  /** Disk/file format: 'qcow2' | 'raw' | 'iso' | 'tzst' | … */
  format: string
  /** `Size GB` reinterpreted as GiB → MiB. */
  sizeMib: MiB
  /** `Storage Usage %` (already a percentage); `null` when blank. */
  usagePercent: number | null
  /** Proxmox VMID (Vm Id); empty for non-guest content. */
  guestId: string
  guestName: string
  /** `Creation Date` Excel serial; `null` when blank. */
  creationSerial: number | null
}
```

Add the field to the `Snapshot` interface, immediately after the `proxmoxSnapshots` field:

```ts
  /** Proxmox storage content from the report `Storage Content` sheet. `[]`
   *  when the sheet is absent — never undefined (factual-degrade). */
  proxmoxStorageContent: ProxmoxStorageContentRow[]
```

- [ ] **Step 4: Barrel-export the type**

In `src/types/index.ts`, add `ProxmoxStorageContentRow` to the `from './snapshot'` export block (alphabetical — it sorts before `ProxmoxSnapshotRow`? No: `ProxmoxSnapshotRow` < `ProxmoxStorageContentRow` since `Sn` < `St`. Place `ProxmoxStorageContentRow` immediately after `ProxmoxSnapshotRow`):

```ts
  ProxmoxSnapshotRow,
  ProxmoxStorageContentRow,
  Snapshot,
```

- [ ] **Step 5: Add `STORAGE_CONTENT_COLS` + `adaptProxmoxStorageContent`, wire into `adaptProxmox`**

In `src/engines/parser/adapters/proxmoxColumns.ts`, append:

```ts
export const STORAGE_CONTENT_COLS = {
  node: ['node'],
  storage: ['storage'],
  content: ['content'],
  fileName: ['file name'],
  format: ['format'],
  sizeGib: ['size gb'],
  usagePercent: ['storage usage %'],
  guestId: ['vm id'],
  guestName: ['guest name'],
  creationDate: ['creation date'],
} as const
```

In `src/engines/parser/adapters/proxmox.ts`:
1. Add `ProxmoxStorageContentRow` to the `@/types` type import.
2. Add `STORAGE_CONTENT_COLS` to the `./proxmoxColumns` import.
3. Add the adapter (place after `adaptProxmoxSnapshots`):

```ts
export const adaptProxmoxStorageContent = (
  sheet: ParsedSheet | undefined,
): ProxmoxStorageContentRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, STORAGE_CONTENT_COLS)
  return sheet.rows
    .map((row): ProxmoxStorageContentRow => {
      const usageRaw = readCol(row, cols.usagePercent)
      const createRaw = readCol(row, cols.creationDate)
      return {
        node: readString(readCol(row, cols.node)),
        storage: readString(readCol(row, cols.storage)),
        content: readString(readCol(row, cols.content)),
        fileName: readString(readCol(row, cols.fileName)),
        format: readString(readCol(row, cols.format)),
        sizeMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.sizeGib))))),
        usagePercent:
          usageRaw === null || usageRaw === undefined || readString(usageRaw) === ''
            ? null
            : Math.max(0, readNumber(usageRaw)),
        guestId: readString(readCol(row, cols.guestId)),
        guestName: readString(readCol(row, cols.guestName)),
        creationSerial:
          typeof createRaw === 'number' && Number.isFinite(createRaw) ? createRaw : null,
      }
    })
    .filter((r) => r.fileName !== '')
}
```

4. In `adaptProxmox`, after the `snapshotsSheet` block, add the optional `Storage Content` lookup + warning, and add the field to the return type + object:

```ts
  const storageContentSheet = findSheet(workbook, ['storage content'])
  if (!storageContentSheet) {
    warnings.push({
      sheet: 'Storage Content',
      kind: 'missing-sheet',
      message: 'optional sheet Storage Content absent — storage-content views will be empty',
    })
  }
```

Add `proxmoxStorageContent: ProxmoxStorageContentRow[]` to the return signature and
`proxmoxStorageContent: adaptProxmoxStorageContent(storageContentSheet),` to the returned object.

> NOTE: `findSheet` matches a sheet whose lower-cased name equals OR starts with the prefix. `'storage content'` will NOT collide with the existing `'storages'` lookup (different prefixes). Verify the existing `findSheet(workbook, ['storages'])` for the Storages sheet still resolves the `Storages` sheet (it does — `'storages'` ≠ `'storage content'`).

- [ ] **Step 6: Set the field in the worker and every `Snapshot` literal**

In `src/engines/parser/parser.worker.ts`, add to the `snapshot` object literal (after `proxmoxSnapshots: bundle.proxmoxSnapshots,`):

```ts
      proxmoxStorageContent: bundle.proxmoxStorageContent,
```

Then add `proxmoxStorageContent: []` to every other `Snapshot` literal in the test suite. Find them:

Run: `cd /Users/fjacquet/Projects/patlas && rtk grep -rn "proxmoxSnapshots:" src --include="*.ts" --include="*.tsx" -l`

Every file that sets `proxmoxSnapshots:` on a `Snapshot` literal needs `proxmoxStorageContent: []` adjacent. The authority on completeness is the FULL `npm run typecheck` in Step 7 — fix whatever it flags.

- [ ] **Step 7: Run the adapter test + FULL typecheck**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.storageContent.test.ts && npm run typecheck
```
Expected: adapter test PASSES (4/4); typecheck 0 errors. Add `proxmoxStorageContent: []` to any literal typecheck flags.

- [ ] **Step 8: Extend the parser realfile test**

In `src/engines/parser/proxmox.realfile.test.ts`, inside the existing `maybe(...)` block, after the existing assertions:

```ts
    // Plan 3B: the Storage Content sheet parses into rich rows (the fixture
    // has 22 image/iso/vztmpl/rootdir entries; no 'backup' content).
    expect(b.proxmoxStorageContent.length).toBeGreaterThan(0)
    expect(b.proxmoxStorageContent.some((r) => r.content === 'images')).toBe(true)
    expect(b.proxmoxStorageContent.every((r) => r.sizeMib >= 0)).toBe(true)
```

- [ ] **Step 9: Lint, run parser tests, verify NUL-clean, commit**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npx vitest run src/engines/parser
for f in $(git diff --name-only); do printf "%s: " "$f"; tr -dc '\000' < "$f" | wc -c; done
```
Expected: Biome clean; parser tests PASS; every changed file shows `0` NUL bytes.

```
git add -A
git commit -m "feat(3b-01): parse Proxmox Storage Content sheet into ProxmoxStorageContentRow"
```

---

### Task 2: Concatenate `proxmoxStorageContent` through the merge

**Files:**
- Modify: `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`
- Test: `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts` (extend)

**Interfaces:**
- Consumes: `Snapshot.proxmoxStorageContent` (Task 1).
- Produces: `MergedEstate.proxmoxStorageContent: ProxmoxStorageContentRow[]` (flat concatenation, like `proxmoxSnapshots`).

- [ ] **Step 1: Write the failing merge test**

In `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`, REUSE the file's existing `Snapshot` factory (the one that already sets `proxmoxSnapshots`) and add:

```ts
import type { ProxmoxStorageContentRow } from '@/types'

it('concatenates proxmoxStorageContent across selected snapshots', () => {
  const a: ProxmoxStorageContentRow = {
    node: 'n1', storage: 'DATA', content: 'images', fileName: '100/d.qcow2', format: 'qcow2',
    sizeMib: mib(32768), usagePercent: 0.03, guestId: '100', guestName: 'A', creationSerial: 46100,
  }
  const b: ProxmoxStorageContentRow = { ...a, fileName: '200/e.raw', guestId: '200', guestName: 'B' }
  // <use the file's Snapshot factory; pass proxmoxStorageContent: [a] and [b]>
  const merged = mergeSnapshotsToEstate([/* snap with [a] */, /* snap with [b] */])
  expect(merged.proxmoxStorageContent).toHaveLength(2)
  expect(merged.proxmoxStorageContent.map((r) => r.guestName)).toEqual(['A', 'B'])
})
```

> Adapt the two `mergeSnapshotsToEstate([...])` arguments to the file's existing snapshot builder — do NOT hand-write a full `Snapshot` literal. Import `mib` from `@/engines/units` if not already present. If the existing builder doesn't accept `proxmoxStorageContent`, extend it minimally to thread the field through (it will already need `proxmoxSnapshots`).

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`
Expected: FAIL — `merged.proxmoxStorageContent` is `undefined`.

- [ ] **Step 3: Wire the field into `MergedEstate`**

In `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`:
1. Add `ProxmoxStorageContentRow` to the `@/types` import.
2. Add to the `MergedEstate` interface (after `proxmoxSnapshots`):

```ts
  /** Concatenated Proxmox storage content (Plan 3B). Empty when the Storage
   *  Content sheet was absent — factual-degrade, never undefined. */
  proxmoxStorageContent: ProxmoxStorageContentRow[]
```

3. Add `proxmoxStorageContent: [],` to `EMPTY_MERGED`.
4. Add an accumulator `const outProxmoxStorageContent: ProxmoxStorageContentRow[] = []` and, in the existing passthrough loop, `for (const r of snap.proxmoxStorageContent ?? []) outProxmoxStorageContent.push(r)`.
5. Add `proxmoxStorageContent: outProxmoxStorageContent,` to the returned object.

- [ ] **Step 4: Run merge tests + verify NUL-clean**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/snapshotMerge
tr -dc '\000' < src/engines/snapshotMerge/mergeSnapshotsToEstate.ts | wc -c
```
Expected: PASS; NUL count `0`.

- [ ] **Step 5: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3b-02): concatenate proxmoxStorageContent through the estate merge"
```

---

### Task 3: `computeStorageContentHealth` pure engine

**Files:**
- Create: `src/engines/aggregation/storageContentHealth.ts`
- Modify: `src/engines/aggregation/index.ts`
- Test: `src/engines/aggregation/storageContentHealth.test.ts` (new)

**Interfaces:**
- Consumes: `ProxmoxStorageContentRow` from `@/types/snapshot`; `excelSerialToUnixMs` from `./snapshotSprawl` (shipped in Plan 3A); a `today: Date`.
- Produces:
  - `interface StorageContentTypeGroup { content: string; count: number; totalSizeMib: number }`
  - `interface StorageGroup { storage: string; count: number; totalSizeMib: number }`
  - `interface BackupFileRow { guestName: string; guestId: string; storage: string; fileName: string; ageDays: number|null; sizeMib: number }`
  - `interface StorageContentHealth { byContent: StorageContentTypeGroup[]; byStorage: StorageGroup[]; backups: { rows: BackupFileRow[]; count: number; guestsCovered: number; totalSizeMib: number; newestAgeDays: number|null; oldestAgeDays: number|null }; totalSizeMib: number; fileCount: number }`
  - `computeStorageContentHealth(rows: ProxmoxStorageContentRow[], today: Date): StorageContentHealth`

- [ ] **Step 1: Write the failing engine test**

Create `src/engines/aggregation/storageContentHealth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mib } from '@/engines/units'
import type { ProxmoxStorageContentRow } from '@/types/snapshot'
import { computeStorageContentHealth } from './storageContentHealth'

const row = (over: Partial<ProxmoxStorageContentRow>): ProxmoxStorageContentRow => ({
  node: 'n1',
  storage: 'DATA',
  content: 'images',
  fileName: 'f',
  format: 'qcow2',
  sizeMib: mib(1024),
  usagePercent: null,
  guestId: '100',
  guestName: 'A',
  creationSerial: null,
  ...over,
})

const TODAY = new Date('2026-06-23T00:00:00Z') // Excel serial 46196

describe('computeStorageContentHealth', () => {
  it('is empty for no rows', () => {
    const h = computeStorageContentHealth([], TODAY)
    expect(h.byContent).toEqual([])
    expect(h.byStorage).toEqual([])
    expect(h.fileCount).toBe(0)
    expect(h.totalSizeMib).toBe(0)
    expect(h.backups.count).toBe(0)
    expect(h.backups.oldestAgeDays).toBeNull()
  })

  it('groups by content type and by storage, sorted by size desc', () => {
    const h = computeStorageContentHealth(
      [
        row({ content: 'images', storage: 'DATA', fileName: 'a', sizeMib: mib(2048) }),
        row({ content: 'iso', storage: 'DATA', fileName: 'b', sizeMib: mib(512) }),
        row({ content: 'images', storage: 'local-lvm', fileName: 'c', sizeMib: mib(1024) }),
      ],
      TODAY,
    )
    expect(h.fileCount).toBe(3)
    expect(h.totalSizeMib).toBe(3584)
    // byContent: images 3072, iso 512
    expect(h.byContent.map((g) => [g.content, g.count, g.totalSizeMib])).toEqual([
      ['images', 2, 3072],
      ['iso', 1, 512],
    ])
    // byStorage: DATA 2560, local-lvm 1024
    expect(h.byStorage.map((g) => [g.storage, g.count, g.totalSizeMib])).toEqual([
      ['DATA', 2, 2560],
      ['local-lvm', 1, 1024],
    ])
  })

  it('builds the backup-file inventory (content === backup) newest first with age', () => {
    const h = computeStorageContentHealth(
      [
        row({ content: 'images', fileName: 'img', guestId: '100' }),
        row({
          content: 'backup', fileName: 'b-old', guestId: '100', guestName: 'A',
          sizeMib: mib(4096), creationSerial: 46100, // ~96d
        }),
        row({
          content: 'backup', fileName: 'b-new', guestId: '200', guestName: 'B',
          sizeMib: mib(2048), creationSerial: 46190, // ~6d
        }),
      ],
      TODAY,
    )
    expect(h.backups.count).toBe(2)
    expect(h.backups.guestsCovered).toBe(2)
    expect(h.backups.totalSizeMib).toBe(6144)
    expect(h.backups.newestAgeDays).toBe(6)
    expect(h.backups.oldestAgeDays).toBe(96)
    // newest first
    expect(h.backups.rows.map((r) => r.fileName)).toEqual(['b-new', 'b-old'])
    expect(h.backups.rows[0]?.ageDays).toBe(6)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/storageContentHealth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the engine**

Create `src/engines/aggregation/storageContentHealth.ts`:

```ts
import type { ProxmoxStorageContentRow } from '@/types/snapshot'
import { excelSerialToUnixMs } from './snapshotSprawl'

/**
 * Pure storage-content health extract — what occupies each Proxmox storage,
 * by content type and by storage, plus a backup-file inventory (content
 * 'backup') with per-guest recency. Neutral measurement only — no verdict
 * (ADR-0012). No React/Zustand/Zod/DOM. `today` is the injected reference
 * clock (same discipline as the EOS forecast / snapshot sprawl).
 */

const MS_PER_DAY = 86_400_000

export interface StorageContentTypeGroup {
  content: string
  count: number
  totalSizeMib: number
}

export interface StorageGroup {
  storage: string
  count: number
  totalSizeMib: number
}

export interface BackupFileRow {
  guestName: string
  guestId: string
  storage: string
  fileName: string
  /** Whole days since creation; `null` when the source date was blank. */
  ageDays: number | null
  sizeMib: number
}

export interface StorageContentHealth {
  /** Per content type, sorted by total size desc. */
  byContent: StorageContentTypeGroup[]
  /** Per storage, sorted by total size desc. */
  byStorage: StorageGroup[]
  backups: {
    /** content === 'backup' files, newest first. */
    rows: BackupFileRow[]
    count: number
    guestsCovered: number
    totalSizeMib: number
    /** Smallest age among dated backups; `null` when none dated. */
    newestAgeDays: number | null
    /** Largest age among dated backups; `null` when none dated. */
    oldestAgeDays: number | null
  }
  totalSizeMib: number
  fileCount: number
}

const ageDaysOf = (serial: number | null, today: Date): number | null =>
  serial === null
    ? null
    : Math.max(0, Math.floor((today.getTime() - excelSerialToUnixMs(serial)) / MS_PER_DAY))

const groupBy = <K extends string>(
  rows: ProxmoxStorageContentRow[],
  keyOf: (r: ProxmoxStorageContentRow) => K,
): Map<K, { count: number; totalSizeMib: number }> => {
  const out = new Map<K, { count: number; totalSizeMib: number }>()
  for (const r of rows) {
    const k = keyOf(r)
    const acc = out.get(k) ?? { count: 0, totalSizeMib: 0 }
    acc.count += 1
    acc.totalSizeMib += r.sizeMib as number
    out.set(k, acc)
  }
  return out
}

export const computeStorageContentHealth = (
  rows: ProxmoxStorageContentRow[],
  today: Date,
): StorageContentHealth => {
  const byContent: StorageContentTypeGroup[] = [...groupBy(rows, (r) => r.content)]
    .map(([content, v]) => ({ content, count: v.count, totalSizeMib: v.totalSizeMib }))
    .sort((a, b) => b.totalSizeMib - a.totalSizeMib)

  const byStorage: StorageGroup[] = [...groupBy(rows, (r) => r.storage)]
    .map(([storage, v]) => ({ storage, count: v.count, totalSizeMib: v.totalSizeMib }))
    .sort((a, b) => b.totalSizeMib - a.totalSizeMib)

  const backupRows: BackupFileRow[] = rows
    .filter((r) => r.content.trim().toLowerCase() === 'backup')
    .map((r) => ({
      guestName: r.guestName,
      guestId: r.guestId,
      storage: r.storage,
      fileName: r.fileName,
      ageDays: ageDaysOf(r.creationSerial, today),
      sizeMib: r.sizeMib as number,
    }))
  // Newest first; undated (null age) last.
  backupRows.sort((a, b) => (a.ageDays ?? Number.POSITIVE_INFINITY) - (b.ageDays ?? Number.POSITIVE_INFINITY))

  const dated = backupRows.map((r) => r.ageDays).filter((a): a is number => a !== null)
  const guests = new Set(backupRows.map((r) => r.guestId).filter((g) => g !== ''))

  return {
    byContent,
    byStorage,
    backups: {
      rows: backupRows,
      count: backupRows.length,
      guestsCovered: guests.size,
      totalSizeMib: backupRows.reduce((acc, r) => acc + r.sizeMib, 0),
      newestAgeDays: dated.length === 0 ? null : Math.min(...dated),
      oldestAgeDays: dated.length === 0 ? null : Math.max(...dated),
    },
    totalSizeMib: rows.reduce((acc, r) => acc + (r.sizeMib as number), 0),
    fileCount: rows.length,
  }
}
```

- [ ] **Step 4: Export from the aggregation barrel**

In `src/engines/aggregation/index.ts`, add (alphabetical — `storageByX` then `storageContentHealth`):

```ts
export {
  type BackupFileRow,
  computeStorageContentHealth,
  type StorageContentHealth,
  type StorageContentTypeGroup,
  type StorageGroup,
} from './storageContentHealth'
```

- [ ] **Step 5: Run the engine test + verify NUL-clean**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/storageContentHealth.test.ts
for f in src/engines/aggregation/storageContentHealth.ts src/engines/aggregation/index.ts; do printf "%s: " "$f"; tr -dc '\000' < "$f" | wc -c; done
```
Expected: PASS (3/3); both NUL counts `0`.

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3b-03): add pure computeStorageContentHealth aggregation engine"
```

---

### Task 4: Compose the `storageContent` slice on `EstateView`

**Files:**
- Modify: `src/types/estate.ts`, `src/engines/aggregation/estateView.ts`
- Test: `src/engines/aggregation/estateView.storageContent.test.ts` (new)

**Interfaces:**
- Consumes: `MergedEstate.proxmoxStorageContent` (Task 2); `computeStorageContentHealth` + `StorageContentHealth` (Task 3); the `today: Date` already in `buildEstateView`.
- Produces: `EstateView.storageContent: StorageContentHealth`; frozen `EMPTY_STORAGE_CONTENT` on `EMPTY_VIEW`.

- [ ] **Step 1: Write the failing EstateView test**

Create `src/engines/aggregation/estateView.storageContent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeSnapshotsToEstate } from '@/engines/snapshotMerge'
import { bytes, mib } from '@/engines/units'
import type { ProxmoxStorageContentRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { buildEstateView, EMPTY_VIEW } from './estateView'

const TODAY = new Date('2026-06-23T00:00:00Z')

const minimalSnapshot = (content: ProxmoxStorageContentRow[]): Snapshot => ({
  id: 's1',
  filename: 'r.xlsx',
  fileSize: bytes(0),
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
  proxmoxSnapshots: [],
  proxmoxStorageContent: content,
  parseErrors: [],
})

describe('buildEstateView — storageContent slice', () => {
  it('EMPTY_VIEW carries a zeroed storageContent', () => {
    expect(EMPTY_VIEW.storageContent).toEqual({
      byContent: [],
      byStorage: [],
      backups: {
        rows: [],
        count: 0,
        guestsCovered: 0,
        totalSizeMib: 0,
        newestAgeDays: null,
        oldestAgeDays: null,
      },
      totalSizeMib: 0,
      fileCount: 0,
    })
  })

  it('composes storage-content health from merged rows', () => {
    const content: ProxmoxStorageContentRow[] = [
      {
        node: 'n1', storage: 'DATA', content: 'images', fileName: 'a.qcow2', format: 'qcow2',
        sizeMib: mib(2048), usagePercent: 0.1, guestId: '100', guestName: 'A', creationSerial: null,
      },
    ]
    const snap = minimalSnapshot(content)
    const view = buildEstateView(mergeSnapshotsToEstate([snap]), [snap], 'active', TODAY)
    expect(view.storageContent.fileCount).toBe(1)
    expect(view.storageContent.totalSizeMib).toBe(2048)
    expect(view.storageContent.byContent[0]?.content).toBe('images')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/estateView.storageContent.test.ts`
Expected: FAIL — `storageContent` missing on the view / `EMPTY_VIEW`.

- [ ] **Step 3: Add the field to `EstateView`**

In `src/types/estate.ts`:
1. Add the type-only import alongside the others at the top:

```ts
import type { StorageContentHealth } from '@/engines/aggregation/storageContentHealth'
```

2. Add the field to the `EstateView` interface, immediately after `snapshotSprawl`:

```ts
  /**
   * Plan 3B storage-content health — Proxmox storage usage by content type
   * and by storage, plus a backup-file inventory. Neutral measurement; same
   * single-pass origin; `EMPTY_STORAGE_CONTENT` in `EMPTY_VIEW`. */
  storageContent: StorageContentHealth
```

- [ ] **Step 4: Compose the slice in `buildEstateView`**

In `src/engines/aggregation/estateView.ts`:
1. Add the import (near the `snapshotSprawl` import):

```ts
import { computeStorageContentHealth } from './storageContentHealth'
```

2. After the `const snapshotSprawl = computeSnapshotSprawl(...)` line, add:

```ts
  // Plan 3B storage-content health — same single pass; `today` reused for
  // backup-file recency.
  const storageContent = computeStorageContentHealth(merged.proxmoxStorageContent, today)
```

3. Add `storageContent,` to the returned object (after `snapshotSprawl,`).

4. Add the frozen empty just after `EMPTY_SPRAWL`:

```ts
const EMPTY_STORAGE_CONTENT = Object.freeze({
  byContent: Object.freeze([]) as never[],
  byStorage: Object.freeze([]) as never[],
  backups: Object.freeze({
    rows: Object.freeze([]) as never[],
    count: 0,
    guestsCovered: 0,
    totalSizeMib: 0,
    newestAgeDays: null,
    oldestAgeDays: null,
  }),
  totalSizeMib: 0,
  fileCount: 0,
})
```

5. Add `storageContent: EMPTY_STORAGE_CONTENT,` to the `EMPTY_VIEW` literal (after `snapshotSprawl: EMPTY_SPRAWL,`).

- [ ] **Step 5: Run the test + FULL typecheck + NUL check**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/estateView.storageContent.test.ts && npm run typecheck
for f in src/types/estate.ts src/engines/aggregation/estateView.ts; do printf "%s: " "$f"; tr -dc '\000' < "$f" | wc -c; done
```
Expected: test PASSES; typecheck 0 errors; both NUL counts `0`.

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3b-04): compose storageContent slice on EstateView"
```

---

### Task 5: `StorageContentView` + nav + i18n

**Files:**
- Create: `src/components/storagecontent/StorageContentView.tsx`
- Modify: `src/components/ViewToggle.tsx`, `src/App.tsx`, `src/components/ViewToggle.test.tsx`
- Create: `src/i18n/locales/{en,fr,de,it}/storagecontent.json`
- Modify: `src/i18n/index.ts`, `src/i18n/locales/{en,fr,de,it}/inventory.json`
- Test: `src/components/storagecontent/StorageContentView.test.tsx` (new)

**Interfaces:**
- Consumes: `useEstateView('active').storageContent` (Task 4); `DataTable`; `useSnapshotStore` + `selectActiveSnapshot`; `fmtInt` from `@/utils/format`.
- Produces: `StorageContentView`; `AppView` union gains `'storagecontent'`.

- [ ] **Step 1: Add the `storagecontent` i18n namespace (all 4 locales)**

Create `src/i18n/locales/en/storagecontent.json`:

```json
{
  "heading": "Storage Content",
  "subtitle": "What occupies each storage, by content type",
  "empty": {
    "heading": "No report loaded",
    "body": "Load a report to see storage content."
  },
  "kpi": {
    "totalSize": "Total size (GiB)",
    "files": "Files",
    "contentTypes": "Content types",
    "backups": "Backups"
  },
  "byContent": "By content type",
  "byStorage": "By storage",
  "backups": {
    "heading": "Backup files",
    "none": "No backup files found on this estate."
  },
  "col": {
    "content": "Content type",
    "storage": "Storage",
    "count": "Files",
    "sizeGib": "Size (GiB)",
    "guestName": "Guest",
    "fileName": "File",
    "ageDays": "Age (days)"
  }
}
```

Create `src/i18n/locales/fr/storagecontent.json`:

```json
{
  "heading": "Contenu du stockage",
  "subtitle": "Ce qui occupe chaque stockage, par type de contenu",
  "empty": {
    "heading": "Aucun rapport chargé",
    "body": "Chargez un rapport pour voir le contenu du stockage."
  },
  "kpi": {
    "totalSize": "Taille totale (Gio)",
    "files": "Fichiers",
    "contentTypes": "Types de contenu",
    "backups": "Sauvegardes"
  },
  "byContent": "Par type de contenu",
  "byStorage": "Par stockage",
  "backups": {
    "heading": "Fichiers de sauvegarde",
    "none": "Aucun fichier de sauvegarde trouvé sur ce parc."
  },
  "col": {
    "content": "Type de contenu",
    "storage": "Stockage",
    "count": "Fichiers",
    "sizeGib": "Taille (Gio)",
    "guestName": "Invité",
    "fileName": "Fichier",
    "ageDays": "Âge (jours)"
  }
}
```

Create `src/i18n/locales/de/storagecontent.json`:

```json
{
  "heading": "Speicherinhalt",
  "subtitle": "Was jeden Speicher belegt, nach Inhaltstyp",
  "empty": {
    "heading": "Kein Bericht geladen",
    "body": "Laden Sie einen Bericht, um den Speicherinhalt zu sehen."
  },
  "kpi": {
    "totalSize": "Gesamtgröße (GiB)",
    "files": "Dateien",
    "contentTypes": "Inhaltstypen",
    "backups": "Sicherungen"
  },
  "byContent": "Nach Inhaltstyp",
  "byStorage": "Nach Speicher",
  "backups": {
    "heading": "Sicherungsdateien",
    "none": "Keine Sicherungsdateien in diesem Bestand gefunden."
  },
  "col": {
    "content": "Inhaltstyp",
    "storage": "Speicher",
    "count": "Dateien",
    "sizeGib": "Größe (GiB)",
    "guestName": "Gast",
    "fileName": "Datei",
    "ageDays": "Alter (Tage)"
  }
}
```

Create `src/i18n/locales/it/storagecontent.json`:

```json
{
  "heading": "Contenuto dello storage",
  "subtitle": "Cosa occupa ogni storage, per tipo di contenuto",
  "empty": {
    "heading": "Nessun report caricato",
    "body": "Carica un report per vedere il contenuto dello storage."
  },
  "kpi": {
    "totalSize": "Dimensione totale (GiB)",
    "files": "File",
    "contentTypes": "Tipi di contenuto",
    "backups": "Backup"
  },
  "byContent": "Per tipo di contenuto",
  "byStorage": "Per storage",
  "backups": {
    "heading": "File di backup",
    "none": "Nessun file di backup trovato in questo parco."
  },
  "col": {
    "content": "Tipo di contenuto",
    "storage": "Storage",
    "count": "File",
    "sizeGib": "Dimensione (GiB)",
    "guestName": "Ospite",
    "fileName": "File",
    "ageDays": "Età (giorni)"
  }
}
```

- [ ] **Step 2: Register the namespace and add the nav label**

In `src/i18n/index.ts`:
1. Add 4 imports (mirror the `snapshots` lines added in Plan 3A):

```ts
import deStorageContent from './locales/de/storagecontent.json'
import enStorageContent from './locales/en/storagecontent.json'
import frStorageContent from './locales/fr/storagecontent.json'
import itStorageContent from './locales/it/storagecontent.json'
```

2. Add `'storagecontent'` to the `NAMESPACES` array (after `'snapshots'`).
3. Add `storagecontent: enStorageContent,` / `fr…` / `de…` / `it…` to the four `resources` locale objects.

In each of `src/i18n/locales/{en,fr,de,it}/inventory.json`, add a `nav.storagecontent` key inside the existing `nav` object:
- en: `"storagecontent": "Storage Content"`
- fr: `"storagecontent": "Contenu stockage"`
- de: `"storagecontent": "Speicherinhalt"`
- it: `"storagecontent": "Contenuto storage"`

- [ ] **Step 3: Write the failing component test**

Create `src/components/storagecontent/StorageContentView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { bytes, mib } from '@/engines/units'
import i18n from '@/i18n'
import { useSnapshotStore } from '@/store/snapshotStore'
import type { ProxmoxStorageContentRow } from '@/types'
import type { Snapshot } from '@/types/snapshot'
import { StorageContentView } from './StorageContentView'

const snapshot = (content: ProxmoxStorageContentRow[]): Snapshot =>
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
    vinfo: [],
    vhost: [],
    vmUsage: [],
    vdatastore: [],
    vpartition: [],
    vnetwork: [],
    vswitch: [],
    dvswitch: [],
    dvport: [],
    proxmoxSnapshots: [],
    proxmoxStorageContent: content,
    parseErrors: [],
  }) satisfies Snapshot

const imageRow: ProxmoxStorageContentRow = {
  node: 'n1', storage: 'DATA', content: 'images', fileName: '100/d.qcow2', format: 'qcow2',
  sizeMib: mib(2048), usagePercent: 0.1, guestId: '100', guestName: 'Debian', creationSerial: null,
}

describe('StorageContentView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSnapshotStore.getState().clearAll()
  })

  it('shows the empty state when no snapshot is loaded', () => {
    render(<StorageContentView />)
    expect(screen.getByText('No report loaded')).not.toBeNull()
  })

  it('renders the content-type breakdown row', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([imageRow]))
    render(<StorageContentView />)
    expect(screen.getByText('By content type')).not.toBeNull()
    expect(screen.getAllByText('images').length).toBeGreaterThan(0)
  })

  it('shows the no-backups message when no backup files exist', () => {
    useSnapshotStore.getState().addSnapshot(snapshot([imageRow]))
    render(<StorageContentView />)
    expect(screen.getByText('No backup files found on this estate.')).not.toBeNull()
  })
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/components/storagecontent/StorageContentView.test.tsx`
Expected: FAIL — component module not found.

- [ ] **Step 5: Implement the view**

Create `src/components/storagecontent/StorageContentView.tsx` (modeled on `src/components/snapshots/SnapshotSprawlView.tsx` shipped in Plan 3A — same empty-state guard, `ErrorBoundary`, KPI panel, `DataTable`):

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/inventory/DataTable'
import type {
  BackupFileRow,
  StorageContentTypeGroup,
  StorageGroup,
} from '@/engines/aggregation'
import { useEstateView } from '@/hooks/useEstateView'
import { selectActiveSnapshot, useSnapshotStore } from '@/store/snapshotStore'
import { fmtInt } from '@/utils/format'

/**
 * Plan 3B — Storage Content: read-only presenter of `view.storageContent`
 * (produced in the single `buildEstateView` pass). Neutral measurement — no
 * verdict (ADR-0012).
 */

const MIB_PER_GIB = 1024

function ViewError({ error }: FallbackProps) {
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

export function StorageContentView() {
  const { t, i18n } = useTranslation('storagecontent')
  const loc = i18n.language
  const snapshot = useSnapshotStore(selectActiveSnapshot)
  const view = useEstateView('active')
  const sc = view.storageContent

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

  const gib = (m: number) => fmtInt(Math.round(m / MIB_PER_GIB), loc)

  const contentColumns: ColumnDef<StorageContentTypeGroup>[] = [
    { accessorKey: 'content', id: 'content', header: 'col.content', enableHiding: false },
    { accessorKey: 'count', id: 'count', header: 'col.count', cell: (c) => fmtInt(c.getValue() as number, loc) },
    { id: 'sizeGib', accessorFn: (r) => r.totalSizeMib, header: 'col.sizeGib', cell: (c) => gib(c.getValue() as number) },
  ]

  const storageColumns: ColumnDef<StorageGroup>[] = [
    { accessorKey: 'storage', id: 'storage', header: 'col.storage', enableHiding: false },
    { accessorKey: 'count', id: 'count', header: 'col.count', cell: (c) => fmtInt(c.getValue() as number, loc) },
    { id: 'sizeGib', accessorFn: (r) => r.totalSizeMib, header: 'col.sizeGib', cell: (c) => gib(c.getValue() as number) },
  ]

  const backupColumns: ColumnDef<BackupFileRow>[] = [
    { accessorKey: 'guestName', id: 'guestName', header: 'col.guestName', enableHiding: false },
    { accessorKey: 'storage', id: 'storage', header: 'col.storage' },
    { accessorKey: 'fileName', id: 'fileName', header: 'col.fileName' },
    {
      accessorKey: 'ageDays',
      id: 'ageDays',
      header: 'col.ageDays',
      cell: (c) => {
        const v = c.getValue<number | null>()
        return v === null ? '—' : fmtInt(v, loc)
      },
    },
    { id: 'sizeGib', accessorFn: (r) => r.sizeMib, header: 'col.sizeGib', cell: (c) => gib(c.getValue() as number) },
  ]

  const kpis: { key: string; value: string }[] = [
    { key: 'totalSize', value: gib(sc.totalSizeMib) },
    { key: 'files', value: fmtInt(sc.fileCount, loc) },
    { key: 'contentTypes', value: fmtInt(sc.byContent.length, loc) },
    { key: 'backups', value: fmtInt(sc.backups.count, loc) },
  ]

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <ErrorBoundary FallbackComponent={ViewError}>
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
                  <span className="text-sm text-slate-500 dark:text-slate-400">{t(`kpi.${k.key}`)}</span>
                  <span className="font-mono text-2xl tabular-nums text-slate-900 dark:text-slate-100">
                    {k.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('byContent')}
            </h3>
            <DataTable
              data={sc.byContent}
              columns={contentColumns}
              headerFor={(id) => t(`col.${id}`)}
              objectKind="vm"
            />
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('byStorage')}
            </h3>
            <DataTable
              data={sc.byStorage}
              columns={storageColumns}
              headerFor={(id) => t(`col.${id}`)}
              objectKind="vm"
            />
          </section>

          <section className="panel">
            <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('backups.heading')}
            </h3>
            {sc.backups.count === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('backups.none')}</p>
            ) : (
              <DataTable
                data={sc.backups.rows}
                columns={backupColumns}
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

> The `headerFor={(id) => t(`col.${id}`)}` reads the active `storagecontent` namespace — NOT `inventory` — so the new columns resolve their own keys.

- [ ] **Step 6: Wire the view into the nav + dispatch + update the ViewToggle test**

In `src/components/ViewToggle.tsx`: add `| 'storagecontent'` to the `AppView` union (after `'monstervm'`... note Plan 3A already added `'snapshots'` last; add `'storagecontent'` after `'snapshots'`) and `'storagecontent',` to the `VIEWS` array (after `'snapshots'`).

In `src/App.tsx`: add the import

```tsx
import { StorageContentView } from './components/storagecontent/StorageContentView'
```

and a dispatch branch before the final `<GlobalDashboard />`:

```tsx
            ) : activeView === 'storagecontent' ? (
              <StorageContentView />
```

In `src/components/ViewToggle.test.tsx` (Plan 3A left this asserting 11 segments with `snapshots` last): this task makes `storagecontent` the new last segment. Update:
- the describe title and the "renders all N segments" count: `11` → `12`;
- add `'Storage Content'` to the label list (after `'Snapshot Sprawl'`);
- both `toHaveLength(11)` → `toHaveLength(12)`;
- the two keyboard-wraparound tests: the last segment is now `storagecontent`, not `snapshots`. Change the "Arrow Right wraps from the last segment" test to `render(<ViewToggle value="storagecontent" …/>)` (still expects `'dashboard'`), and the "Arrow Left from Dashboard wraps to the last segment" test to expect `'storagecontent'`. Update the two test titles to name "Storage Content" as the last segment.

- [ ] **Step 7: Run component test + parity + terminology + ViewToggle + typecheck + NUL**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/components/storagecontent src/components/ViewToggle.test.tsx src/i18n/keyParity.test.ts src/i18n/terminology.test.ts && npm run typecheck
for f in $(git status --porcelain | awk '{print $2}'); do printf "%s: " "$f"; tr -dc '\000' < "$f" 2>/dev/null | wc -c; done
```
Expected: all PASS; typecheck 0 errors; every changed/created file `0` NUL bytes.

- [ ] **Step 8: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3b-05): add StorageContentView, nav entry and storagecontent i18n namespace"
```

---

### Task 6: Real-report acceptance test

**Files:**
- Create: `src/engines/aggregation/storageContentHealth.realfile.test.ts`

**Interfaces:**
- Consumes: the full parse→merge→view pipeline (Tasks 1–4) and the git-ignored fixture `src/engines/parser/__fixtures__/proxmox-report.xlsx`.

- [ ] **Step 1: Write the realfile acceptance test**

Create `src/engines/aggregation/storageContentHealth.realfile.test.ts` (mirror `snapshotSprawl.realfile.test.ts`'s skip-guard + Snapshot assembly):

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

describe('storage content health acceptance (real report)', () => {
  maybe('aggregates real Storage Content; backups empty in this fixture', () => {
    const wb = parseXlsx(readFileSync(fixture))
    const bundle = adaptProxmox(wb)

    const snapshot: Snapshot = {
      id: 'proxmox-sc-realfile',
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
      proxmoxStorageContent: bundle.proxmoxStorageContent,
      parseErrors: bundle.warnings,
    }

    const merged = mergeSnapshotsToEstate([snapshot])
    const view = buildEstateView(merged, [snapshot], 'active', new Date('2026-06-23T00:00:00Z'))
    const { storageContent } = view

    console.log('[storage-content] files:', storageContent.fileCount)
    console.log('[storage-content] content types:', storageContent.byContent.map((g) => g.content).join(', '))
    console.log('[storage-content] backups:', storageContent.backups.count)

    // Rich storage content in the fixture (22 rows across DATA/local/local-lvm).
    expect(storageContent.fileCount).toBeGreaterThan(0)
    expect(storageContent.totalSizeMib).toBeGreaterThan(0)
    expect(storageContent.byContent.some((g) => g.content === 'images')).toBe(true)
    expect(storageContent.byStorage.some((g) => g.storage === 'DATA')).toBe(true)
    // No 'backup' content rows in this fixture → backups honestly empty.
    expect(storageContent.backups.count).toBe(0)
    expect(storageContent.backups.oldestAgeDays).toBeNull()
  })
})
```

- [ ] **Step 2: Run it**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/aggregation/storageContentHealth.realfile.test.ts`
Expected: PASS (logs `files: 22`, content types incl. `images`, `backups: 0`). If `fileCount` is 0 or backups non-zero, STOP and report — it contradicts the fixture premise; do not silently change assertions.

- [ ] **Step 3: Full suite + gates, then commit**

Run:
```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npm run typecheck && npx vitest run
tr -dc '\000' < src/engines/aggregation/storageContentHealth.realfile.test.ts | wc -c
```
Expected: Biome clean; typecheck 0; whole suite green; NUL `0`.

```
git add -A
git commit -m "test(3b-06): real-report acceptance for storage content health"
```

---

## Self-Review

**Spec coverage** (Plan 3 scope item "Storage & backups health", flat-sheet portion):
- Parse `Storage Content` sheet → Task 1 ✓
- Carry through Snapshot + merge → Tasks 1, 2 ✓
- Pure reduction (by content type, by storage, backup-file inventory with recency) → Task 3 ✓
- Surface on `EstateView` (single pass) → Task 4 ✓
- Nav view + i18n (4 locales) → Task 5 ✓
- Real-report acceptance → Task 6 ✓
- Backup-JOB schedules (composite `Cluster` sheet) → deferred to Plan 3C (documented in Scope note).

**Type consistency:** `ProxmoxStorageContentRow` (Task 1) → `MergedEstate.proxmoxStorageContent` (Task 2) → `computeStorageContentHealth` input (Task 3) → `EstateView.storageContent: StorageContentHealth` (Task 4) → table columns (Task 5). `excelSerialToUnixMs` is imported from the Plan-3A `snapshotSprawl` engine (DRY — not re-defined). `today` is the existing `buildEstateView` param.

**Placeholder scan:** none — every step carries complete code or an exact command. (Task 2 Step 1 intentionally references "the file's existing Snapshot factory" rather than duplicating a 20-field literal — the DRY rule.)

**Backup data is empty in this fixture (surfaced, not hidden):** no `content === 'backup'` rows exist, so `backups.count === 0`. Task 6 asserts this explicitly; the backup-inventory logic is fully covered by the synthetic-row unit tests in Task 3.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-patlas-3b-storage-content.md`.

Execution: Subagent-Driven Development on a branch `feat/patlas-3b-storage-content` off `main` (3A already merged), fresh implementer per task + task review, then a whole-branch review, then PR #5 → `main` following the established merge-then-stack pattern.
