# patlas Foundation & First Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork vatlas into patlas and build the Proxmox parser/adapter so a real Proxmox report bundle (`report.xlsx` from the `.zip`) is ingested into a validated canonical `Snapshot`, proven end-to-end by a real-file test and the existing Global Dashboard rendering it.

**Architecture:** patlas is a fork of vatlas (decision D1/D2). The canonical model (`VInfoRow`/`VHostRow`/`Snapshot`) is kept structurally (D3) so the pure engines and the dashboard are reused unchanged. A new `adapters/proxmox.ts` maps Proxmox sheets (Nodes→host, VMs+Containers→guests, Storages→storage) into canonical rows; the parser worker calls it instead of the RVTools adapter. Units convert Proxmox "GB" (treated as GiB) to the branded MiB the engines expect.

**Tech Stack:** React 19 · TypeScript (strict) · Vite 8 · Zustand 5 · Zod 4 (parser boundary only) · SheetJS (CDN tarball) · fflate (zip extraction) · Vitest 4 · Biome.

## Global Constraints

- **Privacy invariant (absolute):** no fetch of workbook bytes, no telemetry of parsed contents, no `localStorage`/`sessionStorage`/IndexedDB of dataset rows. Only `patlas-theme` + `patlas-lang` keys allowed. Refresh = data gone.
- **Engines stay pure:** no React/DOM/Zustand/Zod inside `src/engines/**`. Zod runs only at the parser boundary.
- **Units:** Proxmox "GB" is treated as **GiB (binary)** → MiB via `× MIB_PER_GIB` (1024). Never apply the SI `1.048576` factor (vatlas ADR-0010).
- **`null` means "not derivable":** absent/blank usage cells become `null`, never coerced to `0` (ADR-0012).
- **`xlsx` import confined to `parser.worker.ts`** (never the main thread). `fflate` extraction also runs in the worker.
- **Branded units only** via the `src/engines/units` constructors (`mib`, `cores`, `mhz`, `sockets`) — no raw `as MiB`.
- **TDD:** every code task is failing-test-first. Commit after each green task.
- **Commit prefix:** `<type>(patlas-NN): …` where NN is the task number.
- **Signed commits** are required — never pass `--no-gpg-sign`.

## File Structure (Plan 1)

- `src/types/vinfo.ts` — **modify**: add `guestType: 'qemu' | 'lxc'` to `VInfoRow`.
- `src/types/snapshot.ts` — **modify**: change `source` literal `'rvtools'` → `'proxmox'`.
- `src/engines/units/converters.ts` — **modify**: add `gibToMib`.
- `src/engines/parser/adapters/proxmoxColumns.ts` — **create**: Proxmox column-alias maps.
- `src/engines/parser/adapters/proxmox.ts` — **create**: the Proxmox adapter (nodes/guests/storages/usage/cluster-name + `adaptProxmox` entry).
- `src/engines/parser/extractZip.ts` — **create**: fflate `.zip` → `{ xlsx, networkSvg }`.
- `src/engines/parser/parser.worker.ts` — **modify**: extract zip if needed, call `adaptProxmox`, assemble `Snapshot`.
- `src/engines/parser/schemas.ts` — **modify**: add `guestType` to the VInfo Zod schema.
- Test files alongside each (`*.test.ts`), plus `proxmox.realfile.test.ts`.

---

### Task 1: Fork & rebrand patlas baseline

Create the patlas repo as a fork of vatlas, rebrand identifiers, and confirm the **unchanged** (still-VMware) app builds and tests pass. This is the safe baseline before any Proxmox change.

**Files:**
- Modify: `package.json` (name `vatlas`→`patlas`), `vite.config.ts` (base `/vatlas/`→`/patlas/`), `index.html` title, `src/store/*` + theme/lang hooks (`vatlas-theme`→`patlas-theme`, `vatlas-lang`→`patlas-lang`), `README.md`, `CLAUDE.md` project name.
- The supply-chain/bundle-size check scripts referencing the name.

- [ ] **Step 1: Create the fork**

```bash
# from a directory above the vatlas checkout
git clone /Users/fjacquet/Projects/vatlas patlas
cd patlas
git remote remove origin   # new repo gets its own origin later
git checkout -b main
```

- [ ] **Step 2: Rebrand identifiers**

Replace every `vatlas` token with `patlas` in the files listed above (storage keys, Vite `base`, package name, page title, docs headers). Leave engine internals (`cluster`/`host`/`vinfo`) untouched.

- [ ] **Step 3: Verify the baseline builds and tests pass (still VMware)**

Run:
```bash
npm install
npm run typecheck
npx @biomejs/biome check .
npm run test:run
```
Expected: typecheck clean, lint clean, all existing tests PASS. (We have changed nothing functional yet.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(patlas-01): fork vatlas, rebrand identifiers and storage keys"
```

---

### Task 2: Add `guestType` to VInfoRow + `gibToMib` converter

**Files:**
- Modify: `src/types/vinfo.ts`
- Modify: `src/engines/units/converters.ts`
- Test: `src/engines/units/converters.test.ts`

**Interfaces:**
- Produces: `VInfoRow.guestType: 'qemu' | 'lxc'`; `gibToMib(n: GiB): MiB`.

- [ ] **Step 1: Write the failing test for the converter**

Add to `src/engines/units/converters.test.ts`:
```ts
import { gib, mib } from './types'
import { gibToMib } from './converters'

it('gibToMib multiplies by 1024 (binary GiB→MiB)', () => {
  expect(gibToMib(gib(2))).toBe(mib(2048))
  expect(gibToMib(gib(0))).toBe(mib(0))
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/units/converters.test.ts`
Expected: FAIL — `gibToMib is not a function`.

- [ ] **Step 3: Implement the converter**

Add to `src/engines/units/converters.ts` (it already imports `MIB_PER_GIB`, `mib`, `GiB`, `MiB`):
```ts
export const gibToMib = (n: GiB): MiB => mib(n * MIB_PER_GIB)
```
(If `gib`/`GiB` aren't imported there yet, add them to the existing import from `./types` and `./constants`.)

- [ ] **Step 4: Add `guestType` to `VInfoRow`**

In `src/types/vinfo.ts`, add to the `VInfoRow` interface:
```ts
  /** Proxmox guest kind: 'qemu' (KVM VM) or 'lxc' (container). patlas-only
   *  extension — the shared engines ignore it; views segment by it. */
  guestType: 'qemu' | 'lxc'
```

- [ ] **Step 5: Run converter test to verify it passes**

Run: `npx vitest run src/engines/units/converters.test.ts`
Expected: PASS. (Type change has no runtime test yet; the adapter tasks exercise it.)

- [ ] **Step 6: Commit**

```bash
git add src/types/vinfo.ts src/engines/units/converters.ts src/engines/units/converters.test.ts
git commit -m "feat(patlas-02): add guestType to VInfoRow and gibToMib converter"
```

---

### Task 3: Proxmox column-alias maps

**Files:**
- Create: `src/engines/parser/adapters/proxmoxColumns.ts`
- Test: `src/engines/parser/adapters/proxmoxColumns.test.ts`

**Interfaces:**
- Produces: `NODE_COLS`, `GUEST_COLS`, `STORAGE_COLS`, `CLUSTER_COLS` — each a `Record<string, readonly string[]>` consumable by `mapColumns`.

- [ ] **Step 1: Write the failing test**

`src/engines/parser/adapters/proxmoxColumns.test.ts`:
```ts
import { mapColumns } from './columnMap'
import { GUEST_COLS, NODE_COLS, STORAGE_COLS } from './proxmoxColumns'

it('maps Proxmox Node headers', () => {
  const cols = mapColumns(['Node', 'Cpu Sockets', 'Cpu Cores', 'Cpu Mhz', 'Memory Size GB'], NODE_COLS)
  expect(cols.node).toBe('Node')
  expect(cols.sockets).toBe('Cpu Sockets')
  expect(cols.memoryGib).toBe('Memory Size GB')
})

it('maps Proxmox guest headers including usage %', () => {
  const cols = mapColumns(['Name', 'Node', 'Cores', 'Sockets', 'Memory Size GB', 'Status', 'Cpu Usage %'], GUEST_COLS)
  expect(cols.vmName).toBe('Name')
  expect(cols.status).toBe('Status')
  expect(cols.cpuUsagePct).toBe('Cpu Usage %')
})

it('maps Proxmox storage headers', () => {
  const cols = mapColumns(['Storage', 'Plugin Type', 'Disk Size GB', 'Disk Usage GB', 'Shared'], STORAGE_COLS)
  expect(cols.name).toBe('Storage')
  expect(cols.capacityGib).toBe('Disk Size GB')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmoxColumns.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the column maps**

`src/engines/parser/adapters/proxmoxColumns.ts`:
```ts
/** Proxmox report column aliases. Headers are normalised (lower-cased,
 *  trimmed) by `mapColumns` before comparison; first match wins. */
export const NODE_COLS = {
  node: ['node'],
  sockets: ['cpu sockets'],
  cores: ['cpu cores'],
  speedMhz: ['cpu mhz'],
  memoryGib: ['memory size gb'],
  memUsagePct: ['memory usage %'],
  model: ['cpu model'],
  pveVersion: ['pve version'],
} as const

export const GUEST_COLS = {
  vmName: ['name'],
  node: ['node'],
  vmId: ['vm id'],
  pool: ['pool'],
  cores: ['cores'],
  sockets: ['sockets'],
  vramGib: ['memory size gb'],
  status: ['status'],
  template: ['is template'],
  osName: ['os name'],
  osVersion: ['os version'],
  diskSizeGib: ['disk size gb'],
  diskUsageGib: ['disk usage gb'],
  cpuUsagePct: ['cpu usage %'],
  hostCpuPct: ['host cpu usage %'],
  memUsageGib: ['memory usage gb'],
  memUsagePct: ['memory usage %'],
  hostMemPct: ['host memory usage %'],
} as const

export const STORAGE_COLS = {
  node: ['node'],
  name: ['storage'],
  pluginType: ['plugin type'],
  content: ['content'],
  shared: ['shared'],
  capacityGib: ['disk size gb'],
  usageGib: ['disk usage gb'],
} as const

export const CLUSTER_COLS = {
  name: ['name'],
} as const
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmoxColumns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmoxColumns.ts src/engines/parser/adapters/proxmoxColumns.test.ts
git commit -m "feat(patlas-03): add Proxmox column-alias maps"
```

---

### Task 4: Cluster-name extraction

The Cluster sheet is composite (stacked sub-tables). For Plan 1 we extract only the cluster **name** (row 0, first `Name` column). Full HA/backup parsing is Plan 4.

**Files:**
- Modify: `src/engines/parser/adapters/proxmox.ts` (create with this function)
- Test: `src/engines/parser/adapters/proxmox.test.ts`

**Interfaces:**
- Produces: `extractClusterName(sheet: ParsedSheet | undefined): string` — `''` when sheet/column/value absent.

- [ ] **Step 1: Write the failing test**

`src/engines/parser/adapters/proxmox.test.ts`:
```ts
import type { ParsedSheet } from '../parseXlsx'
import { extractClusterName } from './proxmox'

const sheet = (headers: string[], rows: Record<string, unknown>[]): ParsedSheet => ({
  name: 'Cluster', headers, rows,
})

it('extracts the cluster name from row 0', () => {
  expect(extractClusterName(sheet(['Id', 'Name', 'Type'], [{ Name: 'pve-prod' }]))).toBe('pve-prod')
})

it('returns empty string when absent', () => {
  expect(extractClusterName(undefined)).toBe('')
  expect(extractClusterName(sheet(['Id'], [{}]))).toBe('')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/engines/parser/adapters/proxmox.ts`:
```ts
import { mib, mhz, cores, sockets } from '@/engines/units'
import { gibToMib } from '@/engines/units/converters'
import { gib } from '@/engines/units/types'
import type { ParseError, VDatastoreRow, VHostRow, VInfoRow, VmUsageRow } from '@/types'
import type { ParsedSheet, ParsedWorkbook } from '../parseXlsx'
import { findSheet, mapColumns, readCol, readNumber, readString } from './columnMap'
import { CLUSTER_COLS, GUEST_COLS, NODE_COLS, STORAGE_COLS } from './proxmoxColumns'

export const extractClusterName = (sheet: ParsedSheet | undefined): string => {
  if (!sheet || sheet.rows.length === 0) return ''
  const cols = mapColumns(sheet.headers, CLUSTER_COLS)
  return readString(readCol(sheet.rows[0], cols.name))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmox.ts src/engines/parser/adapters/proxmox.test.ts
git commit -m "feat(patlas-04): extract Proxmox cluster name from composite sheet"
```

---

### Task 5: Nodes → `VHostRow`

**Files:**
- Modify: `src/engines/parser/adapters/proxmox.ts`
- Test: `src/engines/parser/adapters/proxmox.test.ts`

**Interfaces:**
- Produces: `adaptProxmoxNodes(sheet: ParsedSheet, clusterName: string): VHostRow[]`.

- [ ] **Step 1: Write the failing test**

Add to `proxmox.test.ts`:
```ts
import { adaptProxmoxNodes } from './proxmox'
import { mib, mhz, cores, sockets } from '@/engines/units'

it('maps a Node row to VHostRow with GiB→MiB memory', () => {
  const s: ParsedSheet = {
    name: 'Nodes',
    headers: ['Node', 'Cpu Sockets', 'Cpu Cores', 'Cpu Mhz', 'Memory Size GB', 'Memory Usage %', 'Cpu Model', 'Pve Version'],
    rows: [{ Node: 'pve1', 'Cpu Sockets': 1, 'Cpu Cores': 4, 'Cpu Mhz': 2400, 'Memory Size GB': 24, 'Memory Usage %': 50, 'Cpu Model': 'EPYC', 'Pve Version': '8.2' }],
  }
  const [h] = adaptProxmoxNodes(s, 'pve-prod')
  expect(h.hostName).toBe('pve1')
  expect(h.cluster).toBe('pve-prod')
  expect(h.cores).toBe(cores(4))
  expect(h.sockets).toBe(sockets(1))
  expect(h.speedMhz).toBe(mhz(2400))
  expect(h.memoryMib).toBe(mib(24576))
  expect(h.ramRatio).toBeCloseTo(0.5)
  expect(h.cpuRatio).toBe(0)
  expect(h.esxVersion).toBe('8.2')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: FAIL — `adaptProxmoxNodes is not a function`.

- [ ] **Step 3: Implement**

Add to `proxmox.ts`:
```ts
export const adaptProxmoxNodes = (sheet: ParsedSheet, clusterName: string): VHostRow[] => {
  const cols = mapColumns(sheet.headers, NODE_COLS)
  return sheet.rows
    .map((row): VHostRow => ({
      hostName: readString(readCol(row, cols.node)),
      cluster: clusterName,
      sockets: sockets(Math.max(0, Math.trunc(readNumber(readCol(row, cols.sockets))))),
      cores: cores(Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))),
      speedMhz: mhz(Math.max(0, readNumber(readCol(row, cols.speedMhz)))),
      memoryMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.memoryGib))))),
      cpuRatio: 0, // Proxmox Nodes sheet has no host-level CPU usage %
      ramRatio: Math.max(0, readNumber(readCol(row, cols.memUsagePct))) / 100,
      faultDomain: '',
      model: readString(readCol(row, cols.model)),
      vendor: '',
      serialNumber: '',
      esxVersion: readString(readCol(row, cols.pveVersion)),
    }))
    .filter((h) => h.hostName !== '')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmox.ts src/engines/parser/adapters/proxmox.test.ts
git commit -m "feat(patlas-05): adapt Proxmox Nodes to VHostRow"
```

---

### Task 6: VMs + Containers → unified `VInfoRow[]`

**Files:**
- Modify: `src/engines/parser/adapters/proxmox.ts`
- Test: `src/engines/parser/adapters/proxmox.test.ts`

**Interfaces:**
- Produces: `adaptProxmoxGuests(vmsSheet: ParsedSheet | undefined, ctSheet: ParsedSheet | undefined, clusterName: string): VInfoRow[]`.

- [ ] **Step 1: Write the failing test**

Add to `proxmox.test.ts`:
```ts
import { adaptProxmoxGuests } from './proxmox'
import { cores as coresOf, mib as mibOf } from '@/engines/units'

const vms: ParsedSheet = {
  name: 'VMs',
  headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Memory Size GB', 'Status', 'Is Template', 'Os Name', 'Os Version', 'Disk Size GB', 'Disk Usage GB'],
  rows: [{ Name: 'web01', Node: 'pve1', 'Vm Id': 100, Cores: 2, Sockets: 2, 'Memory Size GB': 8, Status: 'running', 'Is Template': 'false', 'Os Name': 'Debian', 'Os Version': '12', 'Disk Size GB': 50, 'Disk Usage GB': 20 }],
}
const cts: ParsedSheet = {
  name: 'Containers',
  headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Memory Size GB', 'Status', 'Os Version', 'Disk Size GB', 'Disk Usage GB'],
  rows: [{ Name: 'dns01', Node: 'pve1', 'Vm Id': 104, Cores: 1, 'Memory Size GB': 1, Status: 'stopped', 'Os Version': 'alpine 3.19', 'Disk Size GB': 8, 'Disk Usage GB': 2 }],
}

it('maps VMs as qemu with vcpu = cores × sockets', () => {
  const g = adaptProxmoxGuests(vms, undefined, 'pve-prod')
  expect(g).toHaveLength(1)
  expect(g[0].guestType).toBe('qemu')
  expect(g[0].vcpu).toBe(coresOf(4))
  expect(g[0].vramMib).toBe(mibOf(8192))
  expect(g[0].poweredOn).toBe(true)
  expect(g[0].host).toBe('pve1')
})

it('maps Containers as lxc with sockets defaulting to 1', () => {
  const g = adaptProxmoxGuests(undefined, cts, 'pve-prod')
  expect(g[0].guestType).toBe('lxc')
  expect(g[0].vcpu).toBe(coresOf(1))
  expect(g[0].powerState).toBe('poweredOff')
  expect(g[0].osTools).toBe('alpine 3.19')
})

it('concatenates both sheets', () => {
  expect(adaptProxmoxGuests(vms, cts, 'pve-prod')).toHaveLength(2)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: FAIL — `adaptProxmoxGuests is not a function`.

- [ ] **Step 3: Implement**

Add to `proxmox.ts`:
```ts
const mapGuestRow = (
  row: Record<string, unknown>,
  cols: ReturnType<typeof mapColumns>,
  clusterName: string,
  guestType: 'qemu' | 'lxc',
): VInfoRow => {
  const sock = Math.max(1, Math.trunc(readNumber(readCol(row, cols.sockets))))
  const core = Math.max(0, Math.trunc(readNumber(readCol(row, cols.cores))))
  const status = readString(readCol(row, cols.status)).toLowerCase()
  const powerState = status === 'running' ? 'poweredOn' : status === 'suspended' ? 'suspended' : 'poweredOff'
  const osName = readString(readCol(row, cols.osName))
  const osVersion = readString(readCol(row, cols.osVersion))
  const os = [osName, osVersion].filter((s) => s !== '').join(' ')
  return {
    vmName: readString(readCol(row, cols.vmName)),
    cluster: clusterName,
    host: readString(readCol(row, cols.node)),
    vcpu: cores(core * sock),
    vramMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.vramGib))))),
    cpuReadinessPercent: null,
    powerState,
    template: readString(readCol(row, cols.template)).toLowerCase() === 'true',
    poweredOn: powerState === 'poweredOn',
    osConfig: os,
    osTools: os,
    vmBiosUuid: '',
    vmInstanceUuid: readString(readCol(row, cols.vmId)),
    viSdkUuid: '',
    viSdkServer: '',
    provisionedMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.diskSizeGib))))),
    inUseMib: gibToMib(gib(Math.max(0, readNumber(readCol(row, cols.diskUsageGib))))),
    path: '',
    guestType,
  }
}

export const adaptProxmoxGuests = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  clusterName: string,
): VInfoRow[] => {
  const out: VInfoRow[] = []
  if (vmsSheet) {
    const cols = mapColumns(vmsSheet.headers, GUEST_COLS)
    for (const row of vmsSheet.rows) out.push(mapGuestRow(row, cols, clusterName, 'qemu'))
  }
  if (ctSheet) {
    const cols = mapColumns(ctSheet.headers, GUEST_COLS)
    for (const row of ctSheet.rows) out.push(mapGuestRow(row, cols, clusterName, 'lxc'))
  }
  return out.filter((g) => g.vmName !== '')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmox.ts src/engines/parser/adapters/proxmox.test.ts
git commit -m "feat(patlas-06): adapt Proxmox VMs+Containers to unified VInfoRow"
```

---

### Task 7: Storages → `VDatastoreRow` + native usage → `vmUsage`

**Files:**
- Modify: `src/engines/parser/adapters/proxmox.ts`
- Test: `src/engines/parser/adapters/proxmox.test.ts`

**Interfaces:**
- Produces: `adaptProxmoxStorages(sheet: ParsedSheet | undefined): VDatastoreRow[]`; `adaptProxmoxUsage(vmsSheet, ctSheet, clusterName): VmUsageRow[]`.

- [ ] **Step 1: Write the failing test**

Add to `proxmox.test.ts`:
```ts
import { adaptProxmoxStorages, adaptProxmoxUsage } from './proxmox'

it('maps Storage row with free = size − usage', () => {
  const s: ParsedSheet = {
    name: 'Storages',
    headers: ['Node', 'Storage', 'Plugin Type', 'Disk Size GB', 'Disk Usage GB', 'Shared'],
    rows: [{ Node: 'pve1', Storage: 'local-lvm', 'Plugin Type': 'lvmthin', 'Disk Size GB': 100, 'Disk Usage GB': 40, Shared: 'false' }],
  }
  const [d] = adaptProxmoxStorages(s)
  expect(d.name).toBe('local-lvm')
  expect(d.type).toBe('lvmthin')
  expect(d.capacityMib).toBe(102400)
  expect(d.freeMib).toBe(61440)
})

it('maps native usage % to vmUsage (null when absent)', () => {
  const vms: ParsedSheet = {
    name: 'VMs',
    headers: ['Name', 'Vm Id', 'Memory Usage GB', 'Cpu Usage %'],
    rows: [{ Name: 'web01', 'Vm Id': 100, 'Memory Usage GB': 4, 'Cpu Usage %': '' }],
  }
  const [u] = adaptProxmoxUsage(vms, undefined, 'pve-prod')
  expect(u.vmName).toBe('web01')
  expect(u.consumedMib).toBe(4096)
  expect(u.cpuUsageMhz).toBeNull()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement**

Add to `proxmox.ts` (import `VmUsageRow`, `mhz` already imported):
```ts
export const adaptProxmoxStorages = (sheet: ParsedSheet | undefined): VDatastoreRow[] => {
  if (!sheet) return []
  const cols = mapColumns(sheet.headers, STORAGE_COLS)
  return sheet.rows
    .map((row): VDatastoreRow => {
      const cap = Math.max(0, readNumber(readCol(row, cols.capacityGib)))
      const used = Math.max(0, readNumber(readCol(row, cols.usageGib)))
      return {
        name: readString(readCol(row, cols.name)),
        capacityMib: gibToMib(gib(cap)),
        freeMib: gibToMib(gib(Math.max(0, cap - used))),
        provisionedMib: gibToMib(gib(used)),
        naa: null,
        type: readString(readCol(row, cols.pluginType)),
        hosts: readString(readCol(row, cols.node)),
        clusterName: '',
      }
    })
    .filter((d) => d.name !== '')
}

// `null` when the source cell is blank/absent ("not derivable"; ADR-0012).
const cellOrNull = (row: Record<string, unknown>, col: string | undefined): number | null => {
  const raw = readCol(row, col)
  if (raw === undefined || raw === null || readString(raw) === '') return null
  return Math.max(0, readNumber(raw))
}

const mapUsageRow = (
  row: Record<string, unknown>,
  cols: ReturnType<typeof mapColumns>,
  clusterName: string,
): VmUsageRow => {
  const memGib = cellOrNull(row, cols.memUsageGib)
  return {
    vmName: readString(readCol(row, cols.vmName)),
    cluster: clusterName,
    vmBiosUuid: '',
    vmInstanceUuid: readString(readCol(row, cols.vmId)),
    activeMib: null,
    consumedMib: memGib === null ? null : gibToMib(gib(memGib)),
    balloonedMib: null,
    swappedMib: null,
    cpuUsageMhz: null, // Proxmox reports CPU as %, not MHz; derived later if needed
  }
}

export const adaptProxmoxUsage = (
  vmsSheet: ParsedSheet | undefined,
  ctSheet: ParsedSheet | undefined,
  clusterName: string,
): VmUsageRow[] => {
  const out: VmUsageRow[] = []
  for (const sheet of [vmsSheet, ctSheet]) {
    if (!sheet) continue
    const cols = mapColumns(sheet.headers, GUEST_COLS)
    for (const row of sheet.rows) out.push(mapUsageRow(row, cols, clusterName))
  }
  return out.filter((u) => u.vmName !== '')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmox.ts src/engines/parser/adapters/proxmox.test.ts
git commit -m "feat(patlas-07): adapt Proxmox storages and native usage metrics"
```

---

### Task 8: `adaptProxmox` entry — assemble the canonical bundle

**Files:**
- Modify: `src/engines/parser/adapters/proxmox.ts`
- Test: `src/engines/parser/adapters/proxmox.test.ts`

**Interfaces:**
- Consumes: `adaptProxmoxNodes`, `adaptProxmoxGuests`, `adaptProxmoxStorages`, `adaptProxmoxUsage`, `extractClusterName`.
- Produces: `adaptProxmox(workbook: ParsedWorkbook): { vinfo, vhost, vdatastore, vmUsage, clusterName, warnings }`.

- [ ] **Step 1: Write the failing test**

Add to `proxmox.test.ts`:
```ts
import { adaptProxmox } from './proxmox'

it('assembles a bundle from a workbook (Nodes + VMs required)', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('Cluster', { name: 'Cluster', headers: ['Name'], rows: [{ Name: 'pve-prod' }] })
  wb.sheets.set('Nodes', { name: 'Nodes', headers: ['Node', 'Cpu Cores', 'Memory Size GB'], rows: [{ Node: 'pve1', 'Cpu Cores': 4, 'Memory Size GB': 24 }] })
  wb.sheets.set('VMs', { name: 'VMs', headers: ['Name', 'Node', 'Vm Id', 'Cores', 'Sockets', 'Memory Size GB', 'Status'], rows: [{ Name: 'web01', Node: 'pve1', 'Vm Id': 100, Cores: 2, Sockets: 1, 'Memory Size GB': 8, Status: 'running' }] })
  const b = adaptProxmox(wb)
  expect(b.clusterName).toBe('pve-prod')
  expect(b.vhost).toHaveLength(1)
  expect(b.vinfo).toHaveLength(1)
  expect(b.vinfo[0].cluster).toBe('pve-prod')
})

it('throws a ParseError when the Nodes sheet is missing', () => {
  const wb = { sheets: new Map<string, ParsedSheet>() }
  wb.sheets.set('VMs', { name: 'VMs', headers: ['Name'], rows: [] })
  expect(() => adaptProxmox(wb)).toThrow(/Nodes/)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: FAIL — `adaptProxmox is not a function`.

- [ ] **Step 3: Implement**

Add to `proxmox.ts` (mirror `rvtools.ts`'s `parseError` helper — copy it in, or import if exported):
```ts
const parseError = (message: string, meta: { sheet?: string; kind: ParseError['kind'] }): never => {
  const e = new Error(message) as Error & { sheet?: string; kind?: ParseError['kind'] }
  e.name = 'ParseError'
  e.sheet = meta.sheet
  e.kind = meta.kind
  throw e
}

export const adaptProxmox = (workbook: ParsedWorkbook): {
  vinfo: VInfoRow[]
  vhost: VHostRow[]
  vdatastore: VDatastoreRow[]
  vmUsage: VmUsageRow[]
  clusterName: string
  warnings: ParseError[]
} => {
  const warnings: ParseError[] = []
  const clusterName = extractClusterName(findSheet(workbook, ['cluster']))

  const nodesSheet = findSheet(workbook, ['nodes'])
  if (!nodesSheet) {
    const present = [...workbook.sheets.keys()].sort().join(', ')
    parseError(`missing sheet: Nodes (workbook contained: ${present})`, { sheet: 'Nodes', kind: 'missing-sheet' })
  }
  const vmsSheet = findSheet(workbook, ['vms'])
  const ctSheet = findSheet(workbook, ['containers'])
  if (!vmsSheet && !ctSheet) {
    parseError('missing both VMs and Containers sheets — nothing to inventory', { sheet: 'VMs', kind: 'missing-sheet' })
  }
  const storageSheet = findSheet(workbook, ['storages'])
  if (!storageSheet) {
    warnings.push({ sheet: 'Storages', kind: 'missing-sheet', message: 'optional sheet Storages absent — storage views will be empty' })
  }

  return {
    // biome-ignore lint/style/noNonNullAssertion: parseError above throws when nodesSheet is undefined
    vhost: adaptProxmoxNodes(nodesSheet!, clusterName),
    vinfo: adaptProxmoxGuests(vmsSheet, ctSheet, clusterName),
    vdatastore: adaptProxmoxStorages(storageSheet),
    vmUsage: adaptProxmoxUsage(vmsSheet, ctSheet, clusterName),
    clusterName,
    warnings,
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/adapters/proxmox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/parser/adapters/proxmox.ts src/engines/parser/adapters/proxmox.test.ts
git commit -m "feat(patlas-08): assemble canonical bundle in adaptProxmox entry"
```

---

### Task 9: `.zip` extraction with fflate

**Files:**
- Create: `src/engines/parser/extractZip.ts`
- Test: `src/engines/parser/extractZip.test.ts`
- Modify: `package.json` (ensure `fflate` dependency present — vatlas lineage carries `fflate@^0.8.2`)

**Interfaces:**
- Produces: `extractProxmoxBundle(buffer: Uint8Array): { xlsx: Uint8Array; networkSvg: string | null }`.

- [ ] **Step 1: Ensure fflate is installed**

Run: `npm ls fflate || npm install fflate@^0.8.2`
Expected: `fflate@0.8.x` resolved.

- [ ] **Step 2: Write the failing test**

`src/engines/parser/extractZip.test.ts` (build a zip in-memory with fflate's `zipSync`):
```ts
import { strToU8, zipSync } from 'fflate'
import { extractProxmoxBundle } from './extractZip'

it('extracts report.xlsx and network-diagram.svg from a zip', () => {
  const zip = zipSync({
    'report.xlsx': strToU8('FAKEXLSX'),
    'network-diagram.svg': strToU8('<svg/>'),
  })
  const out = extractProxmoxBundle(zip)
  expect(new TextDecoder().decode(out.xlsx)).toBe('FAKEXLSX')
  expect(out.networkSvg).toBe('<svg/>')
})

it('throws when no xlsx is inside the zip', () => {
  const zip = zipSync({ 'readme.txt': strToU8('hi') })
  expect(() => extractProxmoxBundle(zip)).toThrow(/xlsx/)
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/engines/parser/extractZip.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/engines/parser/extractZip.ts`:
```ts
import { unzipSync } from 'fflate'

/** Extract the Proxmox report bundle. The `.zip` contains `report.xlsx` and
 *  (optionally) `network-diagram.svg`. Runs in the worker only. */
export const extractProxmoxBundle = (buffer: Uint8Array): { xlsx: Uint8Array; networkSvg: string | null } => {
  const files = unzipSync(buffer)
  const xlsxName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.xlsx'))
  if (!xlsxName) {
    const e = new Error('zip bundle contains no .xlsx report') as Error & { name: string }
    e.name = 'ParseError'
    throw e
  }
  const svgName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.svg'))
  return {
    xlsx: files[xlsxName],
    networkSvg: svgName ? new TextDecoder().decode(files[svgName]) : null,
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/engines/parser/extractZip.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engines/parser/extractZip.ts src/engines/parser/extractZip.test.ts package.json package-lock.json
git commit -m "feat(patlas-09): extract Proxmox .zip bundle with fflate"
```

---

### Task 10: Wire the worker — zip-or-xlsx → `adaptProxmox` → `Snapshot`

**Files:**
- Modify: `src/engines/parser/parser.worker.ts`
- Modify: `src/types/snapshot.ts` (`source: 'proxmox'`)
- Modify: `src/engines/parser/schemas.ts` (add `guestType` to VInfo schema)
- Test: `src/engines/parser/proxmox.realfile.test.ts`

**Interfaces:**
- Consumes: `extractProxmoxBundle`, `parseXlsx`, `adaptProxmox`.
- Produces: a `Snapshot` with `source: 'proxmox'`, populated `vinfo`/`vhost`/`vdatastore`/`vmUsage`, VMware-only arrays `[]`, `viSdkUuid: null`, `vMetaData: []`.

- [ ] **Step 1: Add `guestType` to the VInfo Zod schema**

In `src/engines/parser/schemas.ts`, add to the VInfo row schema object:
```ts
  guestType: z.enum(['qemu', 'lxc']),
```

- [ ] **Step 2: Detect zip magic and branch in the worker**

In `parser.worker.ts`, before `parseXlsx`, detect the PKZip signature (`0x50 0x4B`) and extract:
```ts
import { extractProxmoxBundle } from './extractZip'
import { adaptProxmox } from './adapters/proxmox'
// ...
const u8 = new Uint8Array(buffer)
const isZip = u8[0] === 0x50 && u8[1] === 0x4b
const { xlsx, networkSvg } = isZip
  ? extractProxmoxBundle(u8)
  : { xlsx: u8, networkSvg: null }
const workbook = parseXlsx(xlsx)
const bundle = adaptProxmox(workbook)
```
Then assemble the `Snapshot` shape (replace the RVTools assembly) with `source: 'proxmox'`, `bundle.vinfo/vhost/vdatastore/vmUsage`, empty `vpartition/vnetwork/vswitch/dvswitch/dvport`, `vMetaData: []`, `viSdkUuid: null`, `parseErrors: bundle.warnings`. (Keep `networkSvg` in a local for Plan 4; not yet on the type.)

- [ ] **Step 3: Write the real-file test**

Copy the real `report.xlsx` into `src/engines/parser/__fixtures__/proxmox-report.xlsx` (git-ignore it like vatlas's real workbook, or commit a sanitized copy). `src/engines/parser/proxmox.realfile.test.ts`:
```ts
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseXlsx } from './parseXlsx'
import { adaptProxmox } from './adapters/proxmox'

const fixture = join(__dirname, '__fixtures__/proxmox-report.xlsx')
const maybe = existsSync(fixture) ? it : it.skip

maybe('parses the real Proxmox report into a non-empty estate', () => {
  const wb = parseXlsx(readFileSync(fixture))
  const b = adaptProxmox(wb)
  expect(b.vhost.length).toBeGreaterThan(0)
  expect(b.vinfo.length).toBeGreaterThan(0)
  expect(b.vinfo.some((g) => g.guestType === 'qemu')).toBe(true)
  expect(b.vinfo.some((g) => g.guestType === 'lxc')).toBe(true)
  expect(b.vinfo.every((g) => g.vramMib >= 0)).toBe(true)
})
```

- [ ] **Step 4: Run the parser tests**

Run: `npx vitest run src/engines/parser/`
Expected: PASS (real-file test runs if the fixture exists, else skipped).

- [ ] **Step 5: Typecheck the whole project**

Run: `npm run typecheck`
Expected: clean. (Catches any RVTools consumer still referencing removed fields — fix by feeding the new bundle shape.)

- [ ] **Step 6: Commit**

```bash
git add src/engines/parser/parser.worker.ts src/types/snapshot.ts src/engines/parser/schemas.ts src/engines/parser/proxmox.realfile.test.ts
git commit -m "feat(patlas-10): wire worker to Proxmox adapter, source=proxmox"
```

---

### Task 11: Verify the dashboard renders the real estate (slice acceptance)

**Files:**
- Modify (only if compile/runtime errors surface): RVTools-specific UI imports.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build succeeds. Fix any remaining references to deleted RVTools-only modules by removing the dead import (DR view, vSAN relink) — these are Plan 2 cleanups; here just unblock the build.

- [ ] **Step 2: Run the dev server and load the real report**

Run: `npm run dev`, open `http://localhost:5173/patlas/`, drop the real `Report_*.zip`.
Expected: Global Dashboard shows non-zero node count, guest count (VMs + containers), total vCPU, total RAM, total storage. No console errors; no network requests for workbook bytes (privacy guard silent).

- [ ] **Step 3: Run the full test + lint gate**

Run:
```bash
npm run test:run
npx @biomejs/biome check .
```
Expected: all PASS, lint clean.

- [ ] **Step 4: Commit any unblocking fixes**

```bash
git add -A
git commit -m "chore(patlas-11): unblock build/dashboard on Proxmox snapshot"
```

---

## Self-Review

**Spec coverage (Plan 1 scope):** §3 fork (Task 1) ✓ · §4 input handling zip+xlsx+worker (Tasks 9–10) ✓ · §5.1 Nodes→VHostRow (Task 5) ✓ · §5.2 unified guests + guestType (Tasks 2,6) ✓ · §5.3 native usage→vmUsage (Task 7) ✓ · §5.4 Storages (Task 7) ✓ · §5.5 GiB→MiB (Task 2) ✓ · §5.6 Zod boundary guestType (Task 10) ✓ · §6.1 dashboard slice (Task 11) ✓ · §8 ≥75% gate + realfile fixture (Task 10) ✓ · privacy (Task 11 step 2) ✓. Deferred to later plans (below): inventory terminology remap, allocation/EOS/right-sizing/trends, Proxmox extras, exports, full i18n, DR removal cleanup.

**Placeholder scan:** no TBD/TODO; every code step shows code; commands have expected output. ✓

**Type consistency:** `adaptProxmoxNodes(sheet, clusterName)`, `adaptProxmoxGuests(vms?, ct?, clusterName)`, `adaptProxmoxStorages(sheet?)`, `adaptProxmoxUsage(vms?, ct?, clusterName)`, `adaptProxmox(workbook)`, `extractClusterName(sheet?)`, `extractProxmoxBundle(u8)`, `gibToMib(GiB)` — names used consistently across tasks. `guestType: 'qemu'|'lxc'` identical in type (Task 2), adapter (Task 6), schema (Task 10). ✓

---

## Roadmap — remaining plans (each produces working, testable software)

- **Plan 2 — Inventory & terminology + DR removal.** Remap UI/i18n (Host→Node, VM→Guest, Datastore→Storage, vCenter→Cluster) across all four locales; render the inventory tree with QEMU/LXC segmentation; delete the DR engine/views and vSAN-relink/orphan-cluster/multi-vCenter code cleanly.
- **Plan 3 — Allocation + OS EOS forecast.** vCPU:pCPU & RAM ratios per node/cluster; OS EOS forecast from guest OS with honest coverage %.
- **Plan 4 — Right-sizing + Monster guests + trends + network SVG.** Native-usage-fed right-sizing & Monster guests; multi-report trends; `networkSvg` field on `Snapshot` + Network view.
- **Plan 5 — Proxmox extras + exports + gates.** Storage/backups health, HA status, snapshot sprawl (composite Cluster-sheet sub-table parsing, risk R2); HTML + PPTX export; supply-chain/bundle-size/keyParity CI gates green.
