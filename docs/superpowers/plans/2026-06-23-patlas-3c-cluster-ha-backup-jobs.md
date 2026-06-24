# Cluster HA & Backup Jobs (Plan 3C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Proxmox **HA (high-availability) status** — quorum/fencing service state and HA-managed guest resources — and **scheduled backup jobs**, both parsed from the report's stacked composite `Cluster HA` and `Cluster` sheets. This completes the Plan 3 scope (Snapshot sprawl ✓ 3A, Storage content ✓ 3B, HA status + the backup-job schedules deferred from 3B → this plan).

**Architecture:** Same patlas "extra view" mold as 3A/3B, plus one new foundation: a shared **stacked-sub-table extractor**. The Proxmox `Cluster`/`Cluster HA` sheets are NOT flat tables — they stack several titled sub-tables in one sheet (a title row, then a header row, then data rows, then the next title). `parseXlsx`'s header-keyed `rows` is useless for them (row 0 is a 1-cell title, so all other columns are dropped). So Task 1 exposes the raw cell grid on `ParsedSheet` and adds a pure `extractStackedSection(cells, title)` helper. Tasks 2+ parse three new canonical rows (`ProxmoxHaResourceRow`, `ProxmoxHaStatusRow`, `ProxmoxBackupJobRow`) via that extractor, carry them on `Snapshot`, merge them, reduce them with a pure `computeClusterHealth` engine into a `clusterHealth` slice on `EstateView` (single `buildEstateView` pass), and render a read-only `ClusterHealthView`. Neutral measurement only — no verdict (ADR-0012).

**Tech Stack:** React 19 · TypeScript strict · Zustand 5 · react-i18next (en/fr/de/it) · Vitest 4 · Biome · SheetJS (worker-only).

## Global Constraints

- **Engines/parser pure** — no React/DOM/Zustand. The Proxmox adapter does NOT use Zod (trusted typed rows via `readNumber`/`readString`/`readBool`).
- **Single `useMemo`** only in `useEstateView`; the slice composes inside the one `buildEstateView` pass. No second memo site.
- **`null` = not derivable, never coerced to 0** (ADR-0012) — applies to `maxRestart`/`maxRelocate` numeric HA fields (blank → `null`).
- **No NUL-byte corruption** — prefer targeted Edits over whole-file rewrites; after writing any file verify `tr -dc '\000' < <file> | wc -c` is `0` and `git diff --stat` shows text (line counts), not `Bin`.
- **i18n keys in ALL FOUR locales** (`en`/`fr`/`de`/`it`); `keyParity.test.ts` enforces identical trees. No pre-formatted numbers in strings; no editorial verbs.
- **Terminology guard** (`terminology.test.ts`) forbids `RVTools`/`vCenter`/`ESX`/`ESXi`/`datastore` in i18n values. Use Proxmox terms: Guest, Node, Cluster, Quorum, Fencing, Backup.
- **Reused-DataTable header rule (binding — see 3B):** `DataTable` resolves VISIBLE headers via `useTranslation('inventory') → t('col.<id>')`. Any NEW column id MUST have an `inventory:col.<id>` key in all four locales, AND the view's `headerFor` must read the inventory namespace: `headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}`. Do NOT invent a per-view `col` block (3B removed those).
- **Privacy (PAR-05)** — no network egress; no `localStorage` of rows; `xlsx` worker-only.
- **Commit prefix** `<type>(3c-NN): …`. Signed commits — never `--no-gpg-sign`. End every commit body with:

  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01MwiWBcuAc1YW4W1oE9Na2Z
  ```

- **Run the FULL `npm run typecheck`** (app + `tsconfig.test.json`) after adding required `Snapshot` fields. Lint with `npx @biomejs/biome check .` (NOT `npm run lint`).

## Real sheet schemas (from the fixture)

`Cluster HA` (stacked):

```
row 0: ["Index"]
row 1: ["Resources","Status"]                         (TOC — 2 cells)
row 2: ["Resources"]                                  (section title)
row 3: ["Sid","Type","State","Group","Failback","Max Restart","Max Relocate","Comment"]
       (no data rows — row 4 is the next section)
row 4: ["Status"]                                     (section title)
row 5: ["Id","Type","Status","Node","Sid","State","Crm State","Request State","Quorate","Failback","Max Relocate","Max Restart","Timestamp"]
row 6: ["quorum","quorum","OK","promox",null,null,null,null,"X","",0,0]
row 7: ["fencing","fencing","standby (CRM watchdog standby)","promox",null,null,null,null,"","",0,0]
```

`Cluster` → `Backup Jobs` sub-table:

```
row 20: ["Backup Jobs"]                               (section title)
row 21: ["Id","Enabled","All","Vm Id","Mode","Storage","Start Time","Schedule","Day Of Week","Compress","Type","Mailto","Mail Notification","Notes Template","Pool","Node","Quiet","Next Run"]
        (no data rows — row 22 is "Replication")
```

So in this fixture: HA Resources = **empty** (no HA-managed guests), HA Status = **2 service rows** (quorum OK, fencing standby), Backup Jobs = **empty**. The HA-status path is the real-data-demonstrable part; resources/jobs are honestly empty (covered by synthetic tests). Note: section TITLE rows have exactly one non-empty cell; TOC rows (e.g. `["Resources","Status"]`) have several — the extractor distinguishes them on that.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/engines/parser/parseXlsx.ts` | Add `cells: unknown[][]` (raw grid) to `ParsedSheet` | 1 |
| `src/engines/parser/adapters/stackedSection.ts` | Pure `extractStackedSection(cells, title)` | 1 |
| `src/types/snapshot.ts` | 3 new row types + 3 required `Snapshot` fields | 2 |
| `src/types/index.ts` | Barrel re-exports | 2 |
| `src/engines/parser/adapters/proxmoxColumns.ts` | `HA_RESOURCE_COLS` / `HA_STATUS_COLS` / `BACKUP_JOB_COLS` | 2 |
| `src/engines/parser/adapters/proxmox.ts` | 3 adapters + wire into `adaptProxmox` | 2 |
| `src/engines/parser/parser.worker.ts` | Set the 3 fields on the assembled `Snapshot` | 2 |
| (all `Snapshot` literals in tests) | Add the 3 fields | 2 |
| `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts` | Concatenate the 3 arrays into `MergedEstate` | 3 |
| `src/engines/aggregation/clusterHealth.ts` | Pure `computeClusterHealth` | 4 |
| `src/engines/aggregation/index.ts` | Export engine + types | 4 |
| `src/types/estate.ts` | Add `clusterHealth: ClusterHealth` to `EstateView` | 5 |
| `src/engines/aggregation/estateView.ts` | Compose slice + `EMPTY_CLUSTER_HEALTH`/`EMPTY_VIEW` | 5 |
| `src/components/clusterhealth/ClusterHealthView.tsx` | Read-only presenter | 6 |
| `src/components/ViewToggle.tsx` | `'clusterhealth'` in union + `VIEWS` | 6 |
| `src/App.tsx` | Import + dispatch branch | 6 |
| `src/i18n/locales/{en,fr,de,it}/clusterhealth.json` | New namespace | 6 |
| `src/i18n/index.ts` | Register namespace | 6 |
| `src/i18n/locales/{en,fr,de,it}/inventory.json` | `nav.clusterhealth` + new `col.*` header keys | 6 |
| `src/components/ViewToggle.test.tsx` | Update for the 13th nav segment | 6 |
| `src/engines/aggregation/clusterHealth.realfile.test.ts` | Real-report acceptance | 7 |

---

### Task 1: Raw cell grid + `extractStackedSection`

**Files:**

- Modify: `src/engines/parser/parseXlsx.ts`
- Create: `src/engines/parser/adapters/stackedSection.ts`
- Test: `src/engines/parser/adapters/stackedSection.test.ts` (new)

**Interfaces:**

- Produces: `ParsedSheet.cells: unknown[][]` (the full 2-D grid incl. the header row); `extractStackedSection(cells: unknown[][], title: string): { headers: string[]; rows: Record<string, unknown>[] }`.

- [ ] **Step 1: Write the failing extractor test**

Create `src/engines/parser/adapters/stackedSection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extractStackedSection } from './stackedSection'

// Mirrors the real Cluster HA layout: Index/TOC, an empty Resources section,
// then a Status section with two service rows.
const HA_CELLS: unknown[][] = [
  ['Index'],
  ['Resources', 'Status'],
  ['Resources'],
  ['Sid', 'Type', 'State', 'Group', 'Failback', 'Max Restart', 'Max Relocate', 'Comment'],
  ['Status'],
  ['Id', 'Type', 'Status', 'Node', 'Sid', 'State', 'Crm State', 'Request State', 'Quorate'],
  ['quorum', 'quorum', 'OK', 'promox', null, null, null, null, 'X'],
  ['fencing', 'fencing', 'standby (CRM watchdog standby)', 'promox', null, null, null, null, ''],
]

describe('extractStackedSection', () => {
  it('returns empty when the section title is absent', () => {
    expect(extractStackedSection(HA_CELLS, 'Nope')).toEqual({ headers: [], rows: [] })
  })

  it('reads a section header row and stops at the next section', () => {
    // "Resources" has a header row but zero data rows (Status starts next).
    const res = extractStackedSection(HA_CELLS, 'Resources')
    expect(res.headers).toContain('Sid')
    expect(res.rows).toEqual([])
  })

  it('extracts data rows keyed by the sub-table header row', () => {
    const res = extractStackedSection(HA_CELLS, 'Status')
    expect(res.headers[0]).toBe('Id')
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0]?.Type).toBe('quorum')
    expect(res.rows[0]?.Status).toBe('OK')
    expect(res.rows[1]?.Type).toBe('fencing')
    expect(res.rows[1]?.Quorate).toBe('')
  })

  it('matches a single-cell title row, not a multi-cell TOC row', () => {
    // row 1 is ['Resources','Status'] (TOC, 2 cells) — must NOT be matched as
    // the Resources section; row 2 (single cell) is the real section.
    const res = extractStackedSection(HA_CELLS, 'Resources')
    // The header row directly after the real section title is the Sid… row.
    expect(res.headers[0]).toBe('Sid')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/stackedSection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extractor**

Create `src/engines/parser/adapters/stackedSection.ts`:

```ts
/**
 * Pure extractor for Proxmox "stacked" composite sheets (`Cluster`,
 * `Cluster HA`), which pack several titled sub-tables into one sheet:
 *
 *   <Section Title>            (a row with ONE non-empty cell)
 *   <col1> <col2> <col3> …     (the sub-table's header row)
 *   <data> …                   (zero or more data rows)
 *   <Next Section Title>       (one non-empty cell → boundary)
 *
 * `parseXlsx`'s header-keyed `rows` is useless here (row 0 is a 1-cell title),
 * so this works off the raw `cells` grid. Returns the sub-table's header
 * strings and its data rows keyed by those headers. No React/Zustand/Zod/DOM.
 *
 * Boundary rule: a section starts at the first row whose first cell equals
 * `title` AND has exactly one non-empty cell (so multi-cell TOC/index rows are
 * skipped); data ends at the next row with ≤1 non-empty cell (next title or a
 * blank row). Sub-tables in these sheets always have ≥2 populated columns per
 * data row, so this is unambiguous for the Proxmox layout.
 */

const norm = (v: unknown): string => (v == null ? '' : String(v).trim())
const nonEmptyCount = (row: unknown[]): number => row.reduce((n, c) => (norm(c) !== '' ? n + 1 : n), 0)

export const extractStackedSection = (
  cells: unknown[][],
  title: string,
): { headers: string[]; rows: Record<string, unknown>[] } => {
  const want = title.trim().toLowerCase()
  let start = -1
  for (let r = 0; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (norm(row[0]).toLowerCase() === want && nonEmptyCount(row) === 1) {
      start = r
      break
    }
  }
  if (start === -1) return { headers: [], rows: [] }

  const headers = (cells[start + 1] ?? []).map(norm)
  const rows: Record<string, unknown>[] = []
  for (let r = start + 2; r < cells.length; r++) {
    const row = cells[r] ?? []
    if (nonEmptyCount(row) <= 1) break
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (h !== '') obj[h] = row[i] ?? null
    })
    rows.push(obj)
  }
  return { headers, rows }
}
```

- [ ] **Step 4: Expose the raw grid on `ParsedSheet`**

In `src/engines/parser/parseXlsx.ts`:

1. Add to the `ParsedSheet` interface:

```ts
  /** The full raw 2-D cell grid (including the header row). Needed by the
   *  stacked-sub-table extractor for composite sheets (Cluster / Cluster HA)
   *  whose row-0 is a 1-cell title, so the header-keyed `rows` drops columns. */
  cells: unknown[][]
```

1. In the two places a `ParsedSheet` is built, set `cells`:
   - The empty-sheet branch: `sheets.set(name, { name, headers: [], rows: [], cells: [] })`
   - The main branch: add `cells: aoa` to the object (the `aoa` already computed).

- [ ] **Step 5: Run the extractor test + FULL typecheck**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/stackedSection.test.ts && npm run typecheck`
Expected: PASS (4/4); typecheck 0 (adding a required `cells` field — verify no `ParsedSheet` literal elsewhere breaks; if a test builds a `ParsedSheet` literal, add `cells: []`).

- [ ] **Step 6: Lint, NUL check, commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
for f in $(git diff --name-only) src/engines/parser/adapters/stackedSection.ts; do printf "%s: " "$f"; tr -dc '\000' < "$f" | wc -c; done
git add -A
git commit -m "feat(3c-01): raw cell grid on ParsedSheet + extractStackedSection helper"
```

---

### Task 2: Parse HA resources, HA status, and backup jobs

**Files:**

- Modify: `src/types/snapshot.ts`, `src/types/index.ts`, `src/engines/parser/adapters/proxmoxColumns.ts`, `src/engines/parser/adapters/proxmox.ts`, `src/engines/parser/parser.worker.ts`
- Modify: every test file with a `Snapshot` literal (Step 7)
- Test: `src/engines/parser/adapters/proxmox.clusterHa.test.ts` (new), `src/engines/parser/proxmox.realfile.test.ts` (extend)

**Interfaces:**

- Produces three row types + three required `Snapshot` fields + three adapters:
  - `ProxmoxHaResourceRow { sid, type, state, group, failback, maxRestart: number|null, maxRelocate: number|null, comment }`
  - `ProxmoxHaStatusRow { id, type, status, node, sid, state, crmState, requestState, quorate }`
  - `ProxmoxBackupJobRow { id, enabled: boolean, all: boolean, vmId, mode, storage, startTime, schedule, dayOfWeek, compress, type, node }`
  - `Snapshot.proxmoxHaResources / proxmoxHaStatus / proxmoxBackupJobs` (all required arrays)
  - `adaptProxmoxHaResources(sheet?) / adaptProxmoxHaStatus(sheet?) / adaptProxmoxBackupJobs(sheet?)`
- Consumes: `extractStackedSection` (Task 1); `mapColumns`, `readCol`, `readNumber`, `readString`, `findSheet`.

- [ ] **Step 1: Write the failing adapter test**

Create `src/engines/parser/adapters/proxmox.clusterHa.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ParsedSheet } from '../parseXlsx'
import {
  adaptProxmoxBackupJobs,
  adaptProxmoxHaResources,
  adaptProxmoxHaStatus,
} from './proxmox'

const sheet = (cells: unknown[][]): ParsedSheet => ({
  name: 'x',
  headers: cells[0]?.map((c) => (c == null ? '' : String(c))) ?? [],
  rows: [],
  cells,
})

const HA: unknown[][] = [
  ['Index'],
  ['Resources', 'Status'],
  ['Resources'],
  ['Sid', 'Type', 'State', 'Group', 'Failback', 'Max Restart', 'Max Relocate', 'Comment'],
  ['vm:100', 'vm', 'started', 'grp1', '', 1, 1, 'note'],
  ['Status'],
  ['Id', 'Type', 'Status', 'Node', 'Sid', 'State', 'Crm State', 'Request State', 'Quorate'],
  ['quorum', 'quorum', 'OK', 'promox', null, null, null, null, 'X'],
]

describe('adaptProxmox HA + backup-job adapters', () => {
  it('return [] when the sheet is absent', () => {
    expect(adaptProxmoxHaResources(undefined)).toEqual([])
    expect(adaptProxmoxHaStatus(undefined)).toEqual([])
    expect(adaptProxmoxBackupJobs(undefined)).toEqual([])
  })

  it('parses HA resources (Sid-keyed) with null numerics when blank', () => {
    const rows = adaptProxmoxHaResources(sheet(HA))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.sid).toBe('vm:100')
    expect(rows[0]?.state).toBe('started')
    expect(rows[0]?.maxRestart).toBe(1)
    const blank = adaptProxmoxHaResources(
      sheet([['Resources'], ['Sid', 'Type', 'Max Restart'], ['vm:9', 'vm', '']]),
    )
    expect(blank[0]?.maxRestart).toBeNull()
  })

  it('parses HA status rows', () => {
    const rows = adaptProxmoxHaStatus(sheet(HA))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.type).toBe('quorum')
    expect(rows[0]?.status).toBe('OK')
    expect(rows[0]?.quorate).toBe('X')
  })

  it('parses backup jobs with boolean Enabled/All', () => {
    const cells: unknown[][] = [
      ['Backup Jobs'],
      ['Id', 'Enabled', 'All', 'Vm Id', 'Mode', 'Storage', 'Schedule', 'Node'],
      ['job-1', true, false, '100,101', 'snapshot', 'DATA', '02:00', 'promox'],
    ]
    const rows = adaptProxmoxBackupJobs(sheet(cells))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('job-1')
    expect(rows[0]?.enabled).toBe(true)
    expect(rows[0]?.all).toBe(false)
    expect(rows[0]?.vmId).toBe('100,101')
    expect(rows[0]?.storage).toBe('DATA')
  })

  it('drops identity-less rows', () => {
    expect(adaptProxmoxHaStatus(sheet([['Status'], ['Id', 'Type'], ['', '']]))).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.clusterHa.test.ts`
Expected: FAIL — adapters not exported.

- [ ] **Step 3: Add the three row types + `Snapshot` fields**

In `src/types/snapshot.ts`, add (grouped with the other Proxmox row types):

```ts
/** A HA-managed resource row from the `Cluster HA` sheet "Resources" sub-table. */
export interface ProxmoxHaResourceRow {
  /** Service id, e.g. "vm:100" / "ct:104". */
  sid: string
  type: string
  state: string
  group: string
  failback: string
  /** Max restart attempts; `null` when blank. */
  maxRestart: number | null
  /** Max relocate attempts; `null` when blank. */
  maxRelocate: number | null
  comment: string
}

/** A HA service/status row from the `Cluster HA` sheet "Status" sub-table. */
export interface ProxmoxHaStatusRow {
  id: string
  /** "quorum" | "fencing" | "service" | … */
  type: string
  status: string
  node: string
  sid: string
  state: string
  crmState: string
  requestState: string
  /** Raw quorate flag (e.g. "X" / ""); kept as text. */
  quorate: string
}

/** A scheduled backup job from the `Cluster` sheet "Backup Jobs" sub-table. */
export interface ProxmoxBackupJobRow {
  id: string
  enabled: boolean
  /** "All guests" flag. */
  all: boolean
  /** Comma-separated VMIDs targeted (empty when `all`). */
  vmId: string
  mode: string
  storage: string
  startTime: string
  schedule: string
  dayOfWeek: string
  compress: string
  type: string
  node: string
}
```

Add to the `Snapshot` interface, after `proxmoxStorageContent`:

```ts
  /** Proxmox HA-managed resources (`Cluster HA` → Resources). `[]` when absent. */
  proxmoxHaResources: ProxmoxHaResourceRow[]
  /** Proxmox HA service status (`Cluster HA` → Status). `[]` when absent. */
  proxmoxHaStatus: ProxmoxHaStatusRow[]
  /** Proxmox scheduled backup jobs (`Cluster` → Backup Jobs). `[]` when absent. */
  proxmoxBackupJobs: ProxmoxBackupJobRow[]
```

- [ ] **Step 4: Barrel-export the three types**

In `src/types/index.ts`, add `ProxmoxBackupJobRow`, `ProxmoxHaResourceRow`, `ProxmoxHaStatusRow` to the `from './snapshot'` export block (alphabetical).

- [ ] **Step 5: Column maps + adapters**

In `src/engines/parser/adapters/proxmoxColumns.ts`, append:

```ts
export const HA_RESOURCE_COLS = {
  sid: ['sid'],
  type: ['type'],
  state: ['state'],
  group: ['group'],
  failback: ['failback'],
  maxRestart: ['max restart'],
  maxRelocate: ['max relocate'],
  comment: ['comment'],
} as const

export const HA_STATUS_COLS = {
  id: ['id'],
  type: ['type'],
  status: ['status'],
  node: ['node'],
  sid: ['sid'],
  state: ['state'],
  crmState: ['crm state'],
  requestState: ['request state'],
  quorate: ['quorate'],
} as const

export const BACKUP_JOB_COLS = {
  id: ['id'],
  enabled: ['enabled'],
  all: ['all'],
  vmId: ['vm id'],
  mode: ['mode'],
  storage: ['storage'],
  startTime: ['start time'],
  schedule: ['schedule'],
  dayOfWeek: ['day of week'],
  compress: ['compress'],
  type: ['type'],
  node: ['node'],
} as const
```

In `src/engines/parser/adapters/proxmox.ts`:

1. Add the three types to the `@/types` import and the three COLS to the `./proxmoxColumns` import; add `import { extractStackedSection } from './stackedSection'`.
2. Add a boolean reader near `cellOrNull`:

```ts
// Proxmox emits booleans as true/false or as "1"/"0"/"yes"/"true" text.
const readBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v
  const s = readString(v).toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}
```

1. Add the three adapters (after `adaptProxmoxStorageContent`):

```ts
export const adaptProxmoxHaResources = (sheet: ParsedSheet | undefined): ProxmoxHaResourceRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Resources')
  const cols = mapColumns(sec.headers, HA_RESOURCE_COLS)
  return sec.rows
    .map((row): ProxmoxHaResourceRow => ({
      sid: readString(readCol(row, cols.sid)),
      type: readString(readCol(row, cols.type)),
      state: readString(readCol(row, cols.state)),
      group: readString(readCol(row, cols.group)),
      failback: readString(readCol(row, cols.failback)),
      maxRestart: cellOrNull(row, cols.maxRestart),
      maxRelocate: cellOrNull(row, cols.maxRelocate),
      comment: readString(readCol(row, cols.comment)),
    }))
    .filter((r) => r.sid !== '')
}

export const adaptProxmoxHaStatus = (sheet: ParsedSheet | undefined): ProxmoxHaStatusRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Status')
  const cols = mapColumns(sec.headers, HA_STATUS_COLS)
  return sec.rows
    .map((row): ProxmoxHaStatusRow => ({
      id: readString(readCol(row, cols.id)),
      type: readString(readCol(row, cols.type)),
      status: readString(readCol(row, cols.status)),
      node: readString(readCol(row, cols.node)),
      sid: readString(readCol(row, cols.sid)),
      state: readString(readCol(row, cols.state)),
      crmState: readString(readCol(row, cols.crmState)),
      requestState: readString(readCol(row, cols.requestState)),
      quorate: readString(readCol(row, cols.quorate)),
    }))
    .filter((r) => r.id !== '' || r.type !== '')
}

export const adaptProxmoxBackupJobs = (sheet: ParsedSheet | undefined): ProxmoxBackupJobRow[] => {
  if (!sheet) return []
  const sec = extractStackedSection(sheet.cells, 'Backup Jobs')
  const cols = mapColumns(sec.headers, BACKUP_JOB_COLS)
  return sec.rows
    .map((row): ProxmoxBackupJobRow => ({
      id: readString(readCol(row, cols.id)),
      enabled: readBool(readCol(row, cols.enabled)),
      all: readBool(readCol(row, cols.all)),
      vmId: readString(readCol(row, cols.vmId)),
      mode: readString(readCol(row, cols.mode)),
      storage: readString(readCol(row, cols.storage)),
      startTime: readString(readCol(row, cols.startTime)),
      schedule: readString(readCol(row, cols.schedule)),
      dayOfWeek: readString(readCol(row, cols.dayOfWeek)),
      compress: readString(readCol(row, cols.compress)),
      type: readString(readCol(row, cols.type)),
      node: readString(readCol(row, cols.node)),
    }))
    .filter((r) => r.id !== '')
}
```

1. In `adaptProxmox`, locate the `Cluster HA` and `Cluster` sheets and wire the fields. Add after the `storageContentSheet` block:

```ts
  // Composite sheets — the stacked-sub-table extractor reads the raw grid.
  const clusterHaSheet = findSheet(workbook, ['cluster ha'])
  const clusterSheet = findSheet(workbook, ['cluster'])
```

> NOTE: `findSheet` matches a name that equals OR starts with a prefix; iteration is in sheet order. `['cluster']` resolves the `Cluster` sheet (it appears before `Cluster HA`); `['cluster ha']` resolves `Cluster HA`. `extractClusterName` already calls `findSheet(workbook, ['cluster'])` — reuse the same `clusterSheet` value for the name to avoid a second lookup if convenient, but a second call is harmless.

Add to the return type signature and the returned object:

```ts
    proxmoxHaResources: adaptProxmoxHaResources(clusterHaSheet),
    proxmoxHaStatus: adaptProxmoxHaStatus(clusterHaSheet),
    proxmoxBackupJobs: adaptProxmoxBackupJobs(clusterSheet),
```

(These adapters return `[]` when the sheet/section is absent — no warning push is required, matching the optional-sheet handling; you MAY push a `missing-sheet` warning when `clusterHaSheet`/`clusterSheet` is undefined, mirroring the Storages/Snapshots pattern.)

- [ ] **Step 6: Set the fields in the worker**

In `src/engines/parser/parser.worker.ts`, add to the `snapshot` literal (after `proxmoxStorageContent: bundle.proxmoxStorageContent,`):

```ts
      proxmoxHaResources: bundle.proxmoxHaResources,
      proxmoxHaStatus: bundle.proxmoxHaStatus,
      proxmoxBackupJobs: bundle.proxmoxBackupJobs,
```

- [ ] **Step 7: Add the three fields to every `Snapshot` literal in tests**

Run: `cd /Users/fjacquet/Projects/patlas && rtk grep -rn "proxmoxStorageContent:" src --include="*.ts" --include="*.tsx" -l`

For each file with a `Snapshot` literal, add the three fields adjacent to `proxmoxStorageContent:`:

```ts
    proxmoxHaResources: [],
    proxmoxHaStatus: [],
    proxmoxBackupJobs: [],
```

The FULL `npm run typecheck` (Step 8) is the authority on completeness.

- [ ] **Step 8: Adapter test + FULL typecheck**

Run: `cd /Users/fjacquet/Projects/patlas && npx vitest run src/engines/parser/adapters/proxmox.clusterHa.test.ts && npm run typecheck`
Expected: adapter test PASSES (5/5); typecheck 0. Add missing fields to any flagged literal.

- [ ] **Step 9: Extend the parser realfile test**

In `src/engines/parser/proxmox.realfile.test.ts`, after the existing assertions:

```ts
    // Plan 3C: HA status parses (the fixture has quorum + fencing service
    // rows); HA resources and backup jobs are empty in this single-node lab.
    expect(b.proxmoxHaStatus.some((s) => s.type === 'quorum')).toBe(true)
    expect(Array.isArray(b.proxmoxHaResources)).toBe(true)
    expect(Array.isArray(b.proxmoxBackupJobs)).toBe(true)
```

- [ ] **Step 10: Lint, NUL check, commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npx vitest run src/engines/parser
for f in $(git diff --name-only); do printf "%s: " "$f"; tr -dc '\000' < "$f" | wc -c; done
git add -A
git commit -m "feat(3c-02): parse Cluster HA resources/status and backup jobs"
```

---

### Task 3: Concatenate the three arrays through the merge

**Files:**

- Modify: `src/engines/snapshotMerge/mergeSnapshotsToEstate.ts`
- Test: `src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts` (extend)

**Interfaces:**

- Produces: `MergedEstate.proxmoxHaResources / proxmoxHaStatus / proxmoxBackupJobs` (flat concatenation, like `proxmoxStorageContent`).

- [ ] **Step 1: Write the failing test** — REUSE the file's existing `Snapshot` factory; assert the three arrays concatenate across two snapshots. Construct rows with the Task-2 field names. Example assertion:

```ts
it('concatenates HA + backup-job arrays across snapshots', () => {
  // build two snapshots via the existing factory, each carrying one HA-status
  // row and one backup job; then:
  const merged = mergeSnapshotsToEstate([/* snapA */, /* snapB */])
  expect(merged.proxmoxHaStatus).toHaveLength(2)
  expect(merged.proxmoxBackupJobs).toHaveLength(2)
  expect(merged.proxmoxHaResources).toHaveLength(0)
})
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/engines/snapshotMerge/mergeSnapshotsToEstate.test.ts`

- [ ] **Step 3: Wire into `MergedEstate`** — add the three `Proxmox…Row[]` fields to the interface + `EMPTY_MERGED`, add three accumulators, push in the passthrough loop with `?? []`, add to the returned object. Add the three types to the `@/types` import.

- [ ] **Step 4: Run merge tests + NUL check.** `npx vitest run src/engines/snapshotMerge` and confirm the merge file has `0` NUL bytes.

- [ ] **Step 5: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3c-03): concatenate Cluster HA + backup-job rows through the merge"
```

---

### Task 4: `computeClusterHealth` pure engine

**Files:**

- Create: `src/engines/aggregation/clusterHealth.ts`
- Modify: `src/engines/aggregation/index.ts`
- Test: `src/engines/aggregation/clusterHealth.test.ts` (new)

**Interfaces:**

- Consumes: the three row types from `@/types/snapshot`.
- Produces:
  - `interface ClusterHealth { ha: { resources: ProxmoxHaResourceRow[]; managedCount: number; quorumStatus: string|null; fencingStatus: string|null; services: ProxmoxHaStatusRow[] }; backups: { jobs: ProxmoxBackupJobRow[]; jobCount: number; enabledCount: number; guestsCovered: number } }`
  - `computeClusterHealth(haResources, haStatus, backupJobs): ClusterHealth`

- [ ] **Step 1: Write the failing engine test**

Create `src/engines/aggregation/clusterHealth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type {
  ProxmoxBackupJobRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
} from '@/types/snapshot'
import { computeClusterHealth } from './clusterHealth'

const status = (over: Partial<ProxmoxHaStatusRow>): ProxmoxHaStatusRow => ({
  id: '', type: '', status: '', node: '', sid: '', state: '', crmState: '',
  requestState: '', quorate: '', ...over,
})
const job = (over: Partial<ProxmoxBackupJobRow>): ProxmoxBackupJobRow => ({
  id: 'j', enabled: true, all: false, vmId: '', mode: '', storage: '', startTime: '',
  schedule: '', dayOfWeek: '', compress: '', type: '', node: '', ...over,
})

describe('computeClusterHealth', () => {
  it('is empty for no input', () => {
    const h = computeClusterHealth([], [], [])
    expect(h.ha.managedCount).toBe(0)
    expect(h.ha.quorumStatus).toBeNull()
    expect(h.ha.fencingStatus).toBeNull()
    expect(h.backups.jobCount).toBe(0)
    expect(h.backups.guestsCovered).toBe(0)
  })

  it('derives quorum/fencing status from the HA status rows', () => {
    const h = computeClusterHealth(
      [],
      [status({ type: 'quorum', status: 'OK' }), status({ type: 'fencing', status: 'standby' })],
      [],
    )
    expect(h.ha.quorumStatus).toBe('OK')
    expect(h.ha.fencingStatus).toBe('standby')
    expect(h.ha.services).toHaveLength(2)
  })

  it('counts HA resources', () => {
    const res: ProxmoxHaResourceRow[] = [
      { sid: 'vm:100', type: 'vm', state: 'started', group: '', failback: '', maxRestart: 1, maxRelocate: 1, comment: '' },
    ]
    expect(computeClusterHealth(res, [], []).ha.managedCount).toBe(1)
  })

  it('summarizes backup jobs: count, enabled, distinct guests covered', () => {
    const h = computeClusterHealth(
      [],
      [],
      [
        job({ id: 'a', enabled: true, vmId: '100,101' }),
        job({ id: 'b', enabled: false, vmId: '102' }),
      ],
    )
    expect(h.backups.jobCount).toBe(2)
    expect(h.backups.enabledCount).toBe(1)
    // distinct guests across ALL jobs: 100,101,102
    expect(h.backups.guestsCovered).toBe(3)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement the engine**

Create `src/engines/aggregation/clusterHealth.ts`:

```ts
import type {
  ProxmoxBackupJobRow,
  ProxmoxHaResourceRow,
  ProxmoxHaStatusRow,
} from '@/types/snapshot'

/**
 * Pure cluster-health extract — Proxmox HA service status (quorum/fencing),
 * HA-managed resources, and scheduled backup jobs. Neutral measurement only —
 * no verdict (ADR-0012). No React/Zustand/Zod/DOM.
 */

export interface ClusterHealth {
  ha: {
    resources: ProxmoxHaResourceRow[]
    managedCount: number
    /** Status text of the `quorum` service row; `null` when absent. */
    quorumStatus: string | null
    /** Status text of the `fencing` service row; `null` when absent. */
    fencingStatus: string | null
    services: ProxmoxHaStatusRow[]
  }
  backups: {
    jobs: ProxmoxBackupJobRow[]
    jobCount: number
    enabledCount: number
    /** Distinct VMIDs referenced across all jobs' `vmId` lists. */
    guestsCovered: number
  }
}

const statusOfType = (rows: ProxmoxHaStatusRow[], type: string): string | null => {
  const row = rows.find((r) => r.type.trim().toLowerCase() === type)
  return row ? row.status : null
}

export const computeClusterHealth = (
  haResources: ProxmoxHaResourceRow[],
  haStatus: ProxmoxHaStatusRow[],
  backupJobs: ProxmoxBackupJobRow[],
): ClusterHealth => {
  const guests = new Set<string>()
  for (const j of backupJobs) {
    for (const id of j.vmId.split(',')) {
      const v = id.trim()
      if (v !== '') guests.add(v)
    }
  }
  return {
    ha: {
      resources: haResources,
      managedCount: haResources.length,
      quorumStatus: statusOfType(haStatus, 'quorum'),
      fencingStatus: statusOfType(haStatus, 'fencing'),
      services: haStatus,
    },
    backups: {
      jobs: backupJobs,
      jobCount: backupJobs.length,
      enabledCount: backupJobs.filter((j) => j.enabled).length,
      guestsCovered: guests.size,
    },
  }
}
```

- [ ] **Step 4: Export from the barrel** — in `src/engines/aggregation/index.ts` add:

```ts
export { type ClusterHealth, computeClusterHealth } from './clusterHealth'
```

- [ ] **Step 5: Run engine test + NUL check.** `npx vitest run src/engines/aggregation/clusterHealth.test.ts`; both new files `0` NUL.

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3c-04): add pure computeClusterHealth aggregation engine"
```

---

### Task 5: Compose the `clusterHealth` slice on `EstateView`

**Files:**

- Modify: `src/types/estate.ts`, `src/engines/aggregation/estateView.ts`
- Test: `src/engines/aggregation/estateView.clusterHealth.test.ts` (new)

**Interfaces:**

- Consumes: `MergedEstate.proxmoxHaResources/proxmoxHaStatus/proxmoxBackupJobs`; `computeClusterHealth` + `ClusterHealth`.
- Produces: `EstateView.clusterHealth: ClusterHealth`; frozen `EMPTY_CLUSTER_HEALTH` on `EMPTY_VIEW`.

- [ ] **Step 1: Write the failing test**

Create `src/engines/aggregation/estateView.clusterHealth.test.ts` — mirror `estateView.storageContent.test.ts`: a `minimalSnapshot(...)` factory (set ALL required fields incl. the three new `proxmox…` arrays), assert `EMPTY_VIEW.clusterHealth` is zeroed, and that the slice composes (a quorum status row → `view.clusterHealth.ha.quorumStatus === 'OK'`).

```ts
// EMPTY_VIEW expectation:
expect(EMPTY_VIEW.clusterHealth).toEqual({
  ha: { resources: [], managedCount: 0, quorumStatus: null, fencingStatus: null, services: [] },
  backups: { jobs: [], jobCount: 0, enabledCount: 0, guestsCovered: 0 },
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Add the field to `EstateView`** — in `src/types/estate.ts`: `import type { ClusterHealth } from '@/engines/aggregation/clusterHealth'` and add `clusterHealth: ClusterHealth` after `storageContent`.

- [ ] **Step 4: Compose in `buildEstateView`** — in `src/engines/aggregation/estateView.ts`:
  - `import { computeClusterHealth } from './clusterHealth'`
  - after the `storageContent` line: `const clusterHealth = computeClusterHealth(merged.proxmoxHaResources, merged.proxmoxHaStatus, merged.proxmoxBackupJobs)`
  - add `clusterHealth,` to the returned object
  - add a frozen `EMPTY_CLUSTER_HEALTH` (after `EMPTY_STORAGE_CONTENT`) and `clusterHealth: EMPTY_CLUSTER_HEALTH,` to `EMPTY_VIEW`:

```ts
const EMPTY_CLUSTER_HEALTH = Object.freeze({
  ha: Object.freeze({
    resources: Object.freeze([]) as never[],
    managedCount: 0,
    quorumStatus: null,
    fencingStatus: null,
    services: Object.freeze([]) as never[],
  }),
  backups: Object.freeze({
    jobs: Object.freeze([]) as never[],
    jobCount: 0,
    enabledCount: 0,
    guestsCovered: 0,
  }),
})
```

- [ ] **Step 5: Run test + FULL typecheck + NUL check.**

- [ ] **Step 6: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3c-05): compose clusterHealth slice on EstateView"
```

---

### Task 6: `ClusterHealthView` + nav + i18n

**Files:**

- Create: `src/components/clusterhealth/ClusterHealthView.tsx`
- Modify: `src/components/ViewToggle.tsx`, `src/App.tsx`, `src/components/ViewToggle.test.tsx`
- Create: `src/i18n/locales/{en,fr,de,it}/clusterhealth.json`
- Modify: `src/i18n/index.ts`, `src/i18n/locales/{en,fr,de,it}/inventory.json`
- Test: `src/components/clusterhealth/ClusterHealthView.test.tsx` (new)

**Interfaces:**

- Consumes: `useEstateView('active').clusterHealth`; `DataTable`; `useSnapshotStore` + `selectActiveSnapshot`; `fmtInt`.
- Produces: `ClusterHealthView`; `AppView` gains `'clusterhealth'`.

- [ ] **Step 1: Add the `clusterhealth` namespace (all 4 locales)**

Create `src/i18n/locales/en/clusterhealth.json`:

```json
{
  "heading": "Cluster Health",
  "subtitle": "HA status and scheduled backup jobs",
  "empty": {
    "heading": "No report loaded",
    "body": "Load a report to see cluster health."
  },
  "kpi": {
    "quorum": "Quorum",
    "fencing": "Fencing",
    "managed": "HA resources",
    "jobs": "Backup jobs"
  },
  "ha": {
    "heading": "HA resources",
    "none": "No guests are managed by HA."
  },
  "services": { "heading": "HA services" },
  "backups": {
    "heading": "Backup jobs",
    "none": "No backup jobs are scheduled."
  },
  "na": "—"
}
```

Create `src/i18n/locales/fr/clusterhealth.json`:

```json
{
  "heading": "Santé du cluster",
  "subtitle": "État HA et tâches de sauvegarde planifiées",
  "empty": {
    "heading": "Aucun rapport chargé",
    "body": "Chargez un rapport pour voir la santé du cluster."
  },
  "kpi": {
    "quorum": "Quorum",
    "fencing": "Fencing",
    "managed": "Ressources HA",
    "jobs": "Tâches de sauvegarde"
  },
  "ha": {
    "heading": "Ressources HA",
    "none": "Aucun invité n'est géré par la HA."
  },
  "services": { "heading": "Services HA" },
  "backups": {
    "heading": "Tâches de sauvegarde",
    "none": "Aucune tâche de sauvegarde planifiée."
  },
  "na": "—"
}
```

Create `src/i18n/locales/de/clusterhealth.json`:

```json
{
  "heading": "Cluster-Zustand",
  "subtitle": "HA-Status und geplante Sicherungsaufträge",
  "empty": {
    "heading": "Kein Bericht geladen",
    "body": "Laden Sie einen Bericht, um den Cluster-Zustand zu sehen."
  },
  "kpi": {
    "quorum": "Quorum",
    "fencing": "Fencing",
    "managed": "HA-Ressourcen",
    "jobs": "Sicherungsaufträge"
  },
  "ha": {
    "heading": "HA-Ressourcen",
    "none": "Keine Gäste werden von der HA verwaltet."
  },
  "services": { "heading": "HA-Dienste" },
  "backups": {
    "heading": "Sicherungsaufträge",
    "none": "Keine Sicherungsaufträge geplant."
  },
  "na": "—"
}
```

Create `src/i18n/locales/it/clusterhealth.json`:

```json
{
  "heading": "Salute del cluster",
  "subtitle": "Stato HA e processi di backup pianificati",
  "empty": {
    "heading": "Nessun report caricato",
    "body": "Carica un report per vedere la salute del cluster."
  },
  "kpi": {
    "quorum": "Quorum",
    "fencing": "Fencing",
    "managed": "Risorse HA",
    "jobs": "Processi di backup"
  },
  "ha": {
    "heading": "Risorse HA",
    "none": "Nessun ospite è gestito dalla HA."
  },
  "services": { "heading": "Servizi HA" },
  "backups": {
    "heading": "Processi di backup",
    "none": "Nessun processo di backup pianificato."
  },
  "na": "—"
}
```

- [ ] **Step 2: Register namespace + nav label + new inventory column keys**

In `src/i18n/index.ts`: add 4 imports, add `'clusterhealth'` to `NAMESPACES`, add to the 4 `resources` objects (mirror `storagecontent`).

In each `src/i18n/locales/{en,fr,de,it}/inventory.json`:

- Add `nav.clusterhealth`: en `"Cluster Health"`, fr `"Santé cluster"`, de `"Cluster-Zustand"`, it `"Salute cluster"`.
- Add these NEW `col.*` header keys (used by the three tables; some may already exist — add only the missing). Keep `col` keys sorted:
  - `sid`: en "Service ID" / fr "ID service" / de "Dienst-ID" / it "ID servizio"
  - `state`: en "State" / fr "État" / de "Zustand" / it "Stato"
  - `group`: en "Group" / fr "Groupe" / de "Gruppe" / it "Gruppo"
  - `status`: en "Status" / fr "Statut" / de "Status" / it "Stato"
  - `mode`: en "Mode" / fr "Mode" / de "Modus" / it "Modalità"
  - `schedule`: en "Schedule" / fr "Planification" / de "Zeitplan" / it "Pianificazione"
  - `enabled`: en "Enabled" / fr "Activé" / de "Aktiviert" / it "Abilitato"
  - `id`: en "ID" / fr "ID" / de "ID" / it "ID"

(`type`, `node`, `storage` already exist in `inventory:col` from prior plans — reuse; do NOT duplicate.)

- [ ] **Step 3: Write the failing component test**

Create `src/components/clusterhealth/ClusterHealthView.test.tsx` — mirror `StorageContentView.test.tsx`. The `snapshot(...)` factory sets ALL required `Snapshot` fields (incl. the three new arrays). Cases:

1. no snapshot → empty-state heading renders.
2. a snapshot with a `quorum`/`OK` HA-status row → the quorum KPI value `OK` renders; the "No guests are managed by HA." message renders (resources empty); the "No backup jobs are scheduled." message renders.
3. header-resolution guard: with an HA resource present, assert a resolved header (e.g. `screen.getByText('Service ID')`) and `queryByText('col.sid')` is null.

- [ ] **Step 4: Run → fail.**

- [ ] **Step 5: Implement the view**

Create `src/components/clusterhealth/ClusterHealthView.tsx` (modeled on `StorageContentView.tsx`): empty-state guard; `ErrorBoundary`; a KPI panel (quorum status, fencing status, HA resource count, backup-job count — use the `na` string for null statuses); an HA-services table; an HA-resources table (or the `ha.none` message when `managedCount === 0`); a backup-jobs table (or the `backups.none` message when `jobCount === 0`). EVERY `DataTable` uses `headerFor={(id) => t(`col.${id}`, { ns: 'inventory' })}` and `objectKind="vm"`. Column ids must be ones present in `inventory:col` (sid/type/state/group/status/node for HA; id/enabled/vmId→use `vmName`? no — use `vmId`… NOTE: `vmId` is NOT in inventory:col. Use these job columns: `id`, `enabled`, `mode`, `storage`, `schedule`, `node` — all added/existing in Step 2). For the HA resources table use: `sid`, `type`, `state`, `group`. For HA services: `id`, `type`, `status`, `node`.

> Keep KPI rendering null-safe: `quorumStatus`/`fencingStatus` are `string | null` → show `t('na')` when null.

- [ ] **Step 6: Wire nav + dispatch + ViewToggle test**

- `src/components/ViewToggle.tsx`: add `| 'clusterhealth'` to the union and `'clusterhealth',` to `VIEWS` (after `'storagecontent'`).
- `src/App.tsx`: import `ClusterHealthView` + dispatch branch before `<GlobalDashboard />`.
- `src/components/ViewToggle.test.tsx`: it currently asserts **12** segments with `storagecontent` last. Update count `12 → 13`, add the `'Cluster Health'` label, and fix the two keyboard-wraparound tests (last segment is now `clusterhealth`: render `value="clusterhealth"` for the Arrow-Right-wraps test; expect `'clusterhealth'` for the Arrow-Left-from-Dashboard test). Update both test titles.

- [ ] **Step 7: Component + parity + terminology + ViewToggle + typecheck + WHOLE suite + NUL**

Run:

```
cd /Users/fjacquet/Projects/patlas && npx vitest run src/components/clusterhealth src/components/ViewToggle.test.tsx src/i18n/keyParity.test.ts src/i18n/terminology.test.ts && npm run typecheck && npx vitest run
for f in $(git status --porcelain | awk '{print $2}'); do printf "%s: " "$f"; tr -dc '\000' < "$f" 2>/dev/null | wc -c; done
```

Expected: all PASS; typecheck 0; whole suite green; every file `0` NUL.

- [ ] **Step 8: Lint + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check .
git add -A
git commit -m "feat(3c-06): add ClusterHealthView, nav entry and clusterhealth i18n namespace"
```

---

### Task 7: Real-report acceptance test

**Files:**

- Create: `src/engines/aggregation/clusterHealth.realfile.test.ts`

- [ ] **Step 1: Write the realfile test** — mirror `storageContentHealth.realfile.test.ts` (skip-guard + Snapshot assembly with ALL fields incl. the three new `proxmox…` arrays from `bundle`). Assert:

```ts
console.log('[cluster-health] quorum:', view.clusterHealth.ha.quorumStatus)
console.log('[cluster-health] fencing:', view.clusterHealth.ha.fencingStatus)
console.log('[cluster-health] HA resources:', view.clusterHealth.ha.managedCount)
console.log('[cluster-health] backup jobs:', view.clusterHealth.backups.jobCount)

// The fixture is a single-node lab: quorum present, no HA-managed guests,
// no scheduled backup jobs.
expect(view.clusterHealth.ha.quorumStatus).toBe('OK')
expect(view.clusterHealth.ha.managedCount).toBe(0)
expect(view.clusterHealth.backups.jobCount).toBe(0)
```

If `quorumStatus` is not `'OK'` or any count is non-zero, STOP and report — do not silently change assertions (it would mean the extractor mis-parsed the stacked sheet).

- [ ] **Step 2: Run it.** `npx vitest run src/engines/aggregation/clusterHealth.realfile.test.ts` — must PASS (not skip), logging `quorum: OK`, `HA resources: 0`, `backup jobs: 0`.

- [ ] **Step 3: Full gates + commit**

```
cd /Users/fjacquet/Projects/patlas && npx @biomejs/biome check . && npm run typecheck && npx vitest run
tr -dc '\000' < src/engines/aggregation/clusterHealth.realfile.test.ts | wc -c
git add -A
git commit -m "test(3c-07): real-report acceptance for cluster health"
```

---

## Self-Review

**Spec coverage** (Plan 3 final items — HA status + the backup-job schedules deferred from 3B):

- Stacked-sub-table extractor (the shared foundation) → Task 1 ✓
- Parse HA resources / HA status / backup jobs → Task 2 ✓
- Merge → Task 3 ✓; pure reduction (quorum/fencing/managed + job summary) → Task 4 ✓
- EstateView slice (single pass) → Task 5 ✓; nav view + i18n (4 locales) → Task 6 ✓; realfile acceptance → Task 7 ✓.

**Type consistency:** the three row types (Task 2) → `MergedEstate` (Task 3) → `computeClusterHealth` input (Task 4) → `EstateView.clusterHealth: ClusterHealth` (Task 5) → tables (Task 6). `extractStackedSection` (Task 1) is the single composite-parse primitive used by all three adapters.

**Placeholder scan:** Tasks 3, 5, 6 reference "the file's existing factory / mirror `StorageContentView`" for repetitive scaffolding rather than re-pasting 25-field literals (DRY); all novel logic (extractor, adapters, engine) carries complete code.

**Fixture emptiness (surfaced):** HA resources and backup jobs are empty in this single-node fixture; the realfile test asserts that honestly (quorum `OK`, counts `0`), and the populated cases are covered by synthetic unit tests in Tasks 2/4.

**Reused-DataTable header rule:** every new column id gets an `inventory:col.<id>` key in all four locales, and every `headerFor` reads the inventory namespace (the 3B lesson) — guarded by a header-resolution assertion in the Task-6 component test.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-patlas-3c-cluster-ha-backup-jobs.md`.

Execution: Subagent-Driven Development on a branch `feat/patlas-3c-cluster-ha` off `main` (3A+3B merged), fresh implementer per task + task review, whole-branch review, then PR #6 → `main`. This is the final Plan 3 deliverable.
