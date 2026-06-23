# patlas Plan 2B — Speak Proxmox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make patlas speak Proxmox in the UI — remap all user-facing terminology (Host→Node, VM→Guest, Datastore→Storage, vCenter→Cluster, RVTools→Proxmox, ESX/ESXi→Node/PVE) across all four locales, segment the inventory by QEMU-VM vs LXC-container (explicit tree level **and** a Type column), and replace the remaining VMware-named export labels with the Proxmox cluster name.

**Architecture:** Engines/types stay VMware-named internally (zero churn — decision D3); only user-facing strings and the inventory presentation change. `guestType` (already on `VInfoRow`) is surfaced onto the lean `VmDisplayRow` projection so the inventory column and tree level can read it. Terminology lives entirely in `src/i18n/locales/**`; keys are unchanged (only values), so `keyParity` is unaffected.

**Tech Stack:** React 19 · TypeScript (strict) · react-i18next · ECharts · Vitest 4 · Biome.

## Global Constraints

- **i18n key parity:** every key path exists in all four locales (`en`/`fr`/`de`/`it`); `src/i18n/keyParity.test.ts` enforces it. This plan changes VALUES (and adds one new key, `inventory:col.guestType`, in ALL four locales) — never leave a key in some locales only.
- **No pre-formatted numbers in i18n strings; no editorial verbs** ("recommend/should/poor/good") — factual labels only (inherited convention).
- **DE/IT technical terms** remain "pending native review" — use the standard translations in this plan's mapping table and keep the existing risk note; do not block on perfect localization.
- **Engines stay pure** (no React/DOM/Zustand/Zod in `src/engines/**`); Zod only at the parser boundary. This plan touches types/projection but adds no Zod.
- **DataTable header gotcha:** visible column headers resolve via `useTranslation('inventory')` → `t('col.<id>')`. A new column id `guestType` REQUIRES an `inventory:col.guestType` key in all four `inventory.json` or the header renders the raw key.
- **Each task ends GREEN:** `npm run typecheck` (app+test), `npx @biomejs/biome check .`, `npm run test:run` all clean before commit. Use `npx @biomejs/biome check .`, never `npm run lint`.
- **Signed commits**; commit prefix `<type>(patlas-2b-NN): …`.
- **Terminology mapping table (authoritative — use these exact translations):**

| English term | en | fr | de | it |
|---|---|---|---|---|
| Host / ESX / ESXi host | Node | Nœud | Knoten | Nodo |
| VM / virtual machine (umbrella) | Guest | Invité | Gast | Ospite |
| QEMU VM (subtype) | VM | VM | VM | VM |
| LXC container (subtype) | Container | Conteneur | Container | Container |
| Datastore | Storage | Stockage | Speicher | Archiviazione |
| vCenter | Cluster | Cluster | Cluster | Cluster |
| RVTools | Proxmox | Proxmox | Proxmox | Proxmox |
| ESXi version / ESX version | PVE version | version PVE | PVE-Version | versione PVE |
| VMware estate | Proxmox estate | parc Proxmox | Proxmox-Bestand | infrastruttura Proxmox |

## File Structure

- `src/types/estate.ts` — add `guestType` to `VmDisplayRow`.
- `src/engines/aggregation/estateView.ts` — set `guestType` in the `vmRows.push` projection (line ~151).
- `src/components/inventory/columns/vmColumns.ts` — add the `guestType` column.
- `src/components/inventory/InventoryTree.tsx` — add the guest-type grouping level.
- `src/engines/export/pptx/slides/titleSlide.ts`, `src/engines/export/html/renderReport.tsx`, `src/engines/export/export.worker.ts`, `src/engines/export/pptx/builder.ts` — Proxmox cover/title label from the cluster name.
- `src/i18n/locales/{en,fr,de,it}/*.json` — terminology values across 16 namespaces + new `inventory:col.guestType`.
- Tests alongside each.

---

### Task 1: Proxmox cover/title export labels

Replace the VMware-named cover/title strings and the blank `vcenters` slot with the Proxmox cluster label (the merged estate's cluster identity). Source the label from the existing data: `MergedEstate`/`EstateView` carries the cluster name; the export worker/builder currently hardcode `vcenters: ''`.

**Files:**
- Modify: `src/engines/export/export.worker.ts` (~54), `src/engines/export/pptx/builder.ts` (~61), `src/engines/export/html/renderReport.tsx` (84, 114), `src/engines/export/pptx/slides/titleSlide.ts` (55)
- Modify: `src/i18n/locales/{en,fr,de,it}/pptx.json` (the title `fallback` value), and the cover title default in `renderReport.tsx`.
- Test: `src/engines/export/pptx/builder.test.ts` and/or `renderReport.test.tsx`.

**Interfaces:**
- Consumes: the cluster label already available on the export view (the same value the worker puts in `Snapshot.vCenterLabel` = the Proxmox cluster name; confirm where the export pipeline can read it — likely the merged estate's single cluster name or `clusters[0].name`).

- [ ] **Step 1: Find the cluster label available to the export builder**

```bash
cd /Users/fjacquet/Projects/patlas
grep -rn "vcenters\|vCenterLabel\|clusters\[0\]\|MergedEstate\|estateLabel" src/engines/export/ src/types/estate.ts | head
```
Identify the field carrying the Proxmox cluster name reachable from `export.worker.ts`/`builder.ts` (the merged estate cluster name, or thread `snapshot.vCenterLabel`). Use that instead of `''`.

- [ ] **Step 2: Write the failing test**

In `src/engines/export/pptx/builder.test.ts`, assert the title slide shows the cluster label (not the `VMware estate` fallback) when a cluster name is present:
```ts
it('title slide uses the Proxmox cluster label, not a VMware fallback', () => {
  const view = makeView({ /* cluster named 'pve-prod' */ })
  const deck = buildDeck(view, t)   // use the existing builder entry + i18n stub
  const titleText = /* extract the title slide subtitle text */
  expect(titleText).toContain('pve-prod')
  expect(titleText).not.toMatch(/VMware/i)
})
```
(Match the test's existing helpers/▒entry — read the current builder.test.ts to mirror its setup.)

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/engines/export/pptx/builder.test.ts`
Expected: FAIL (title shows blank/`VMware estate`).

- [ ] **Step 4: Wire the cluster label through**

- In `export.worker.ts` and `builder.ts`, replace `vcenters: ''` with the cluster label found in step 1 (e.g. `vcenters: view.clusters[0]?.name ?? ''`, or the merged estate cluster name).
- In `titleSlide.ts:55`, change the fallback key default from `'VMware estate'` to use the i18n value (see step 5); the `d.vcenters || t('fallback', …)` stays, but the fallback now reads "Proxmox estate".
- In `renderReport.tsx`, set `const vcenters = <cluster label>` instead of `''`, and change the cover `title` default `'VMware Estate Report'` → `'Proxmox Estate Report'` (or pull from i18n `report` namespace if a key exists).

- [ ] **Step 5: Update the i18n fallback values (all 4 locales)**

In each `src/i18n/locales/{en,fr,de,it}/pptx.json`, set the title-slide `fallback` value to the "VMware estate"→Proxmox-estate row of the mapping table (en: "Proxmox estate", fr: "parc Proxmox", de: "Proxmox-Bestand", it: "infrastruttura Proxmox").

- [ ] **Step 6: Verify green**

Run:
```bash
cd /Users/fjacquet/Projects/patlas
npx vitest run src/engines/export/pptx/builder.test.ts && npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```
Expected: PASS; keyParity passes (fallback value changed in all 4 locales).

- [ ] **Step 7: Commit**

```bash
cd /Users/fjacquet/Projects/patlas
git add -A
git commit -m "feat(patlas-2b-01): use Proxmox cluster label on export cover/title (drop VMware fallbacks)"
```

---

### Task 2: Surface `guestType` on `VmDisplayRow`

**Files:**
- Modify: `src/types/estate.ts` (`VmDisplayRow`, ~289)
- Modify: `src/engines/aggregation/estateView.ts` (`vmRows.push`, ~151)
- Test: `src/engines/aggregation/estateView.test.ts`

**Interfaces:**
- Produces: `VmDisplayRow.guestType: 'qemu' | 'lxc'`.

- [ ] **Step 1: Write the failing test**

In `estateView.test.ts`, assert a projected `vmRow` carries `guestType` from its source `VInfoRow`:
```ts
it('vmRows projection carries guestType', () => {
  const view = buildEstateView(/* snapshot with one qemu + one lxc guest */)
  const types = view.vmRows.map((r) => r.guestType).sort()
  expect(types).toEqual(['lxc', 'qemu'])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engines/aggregation/estateView.test.ts`
Expected: FAIL — `guestType` missing on `VmDisplayRow` (typecheck error or undefined).

- [ ] **Step 3: Add the field and projection**

In `src/types/estate.ts`, add to `VmDisplayRow`:
```ts
  /** Proxmox guest kind, surfaced for inventory segmentation. */
  guestType: 'qemu' | 'lxc'
```
In `src/engines/aggregation/estateView.ts` `vmRows.push({...})` (~151), add `guestType: vm.guestType,` (where `vm` is the source `VInfoRow` in that loop — confirm the loop variable name).

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/engines/aggregation/estateView.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify green + commit**

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Tests "
git add -A
git commit -m "feat(patlas-2b-02): surface guestType on VmDisplayRow projection"
```

---

### Task 3: Guest-type Type column

**Files:**
- Modify: `src/components/inventory/columns/vmColumns.ts`
- Modify: `src/i18n/locales/{en,fr,de,it}/inventory.json` (add `col.guestType` + the VM/Container value labels)
- Test: `src/components/inventory/columns/columns.test.ts`

**Interfaces:**
- Consumes: `VmDisplayRow.guestType` (Task 2).
- Produces: a `guestType` column def rendering "VM"/"Container".

- [ ] **Step 1: Write the failing test**

In `columns.test.ts`, assert a `guestType` column exists and maps qemu→VM label key, lxc→Container label key:
```ts
it('vmColumns has a guestType column rendering VM/Container', () => {
  const col = vmColumns.find((c) => c.id === 'guestType')
  expect(col).toBeDefined()
  // the cell/accessor turns 'qemu' -> 'inventory:guestType.qemu', 'lxc' -> 'inventory:guestType.lxc'
  expect(col?.accessor?.({ ...baseRow, guestType: 'lxc' })).toBe('lxc')
})
```
(Mirror the existing column test's shape — read `columns.test.ts` first.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/inventory/columns/columns.test.ts`
Expected: FAIL — no `guestType` column.

- [ ] **Step 3: Add the column + i18n keys**

In `vmColumns.ts`, add a column def `{ id: 'guestType', … }` following the existing pattern (header via `inventory:col.guestType`; cell renders the localized `guestType.qemu`/`guestType.lxc` label).
In each `inventory.json` add:
```json
"col": { ... , "guestType": "<Type|Type|Typ|Tipo>" },
"guestType": { "qemu": "<VM>", "lxc": "<Container|Conteneur|Container|Container>" }
```
(en: Type/VM/Container; fr: Type/VM/Conteneur; de: Typ/VM/Container; it: Tipo/VM/Container.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/inventory/columns/columns.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify green + commit**

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Tests "
git add -A
git commit -m "feat(patlas-2b-03): add guest Type column (VM/Container) to inventory"
```

---

### Task 4: Guest-type tree level

Insert a grouping level between Host and Guest: root → Cluster → Node(host) → [VMs]/[Containers] → Guest.

**Files:**
- Modify: `src/components/inventory/InventoryTree.tsx` (`NodeKind`, `FlatNode`, id helpers, `buildVisibleRows`)
- Test: `src/components/inventory/InventoryTree.test.tsx` (create if absent, or extend)

**Interfaces:**
- Consumes: `VmDisplayRow.guestType`; the existing `vmsByHost` map.
- Produces: a tree with a `gtype` node kind grouping guests by `guestType` under each host.

- [ ] **Step 1: Write the failing test**

Assert that under a host with both a qemu and an lxc guest, expanding shows two group nodes ("VM", "Container") each containing the right guest:
```tsx
it('groups guests by type under each node', () => {
  // build rows with one qemu + one lxc under host 'pve1', expand cluster+host+groups
  // expect two gtype group rows and the guests nested under the matching group
})
```
(Read the current `InventoryTree.tsx` `buildVisibleRows`/`FlatNode` to mirror the existing test idiom and the `expanded` set mechanics.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/inventory/InventoryTree.test.tsx`
Expected: FAIL — guests are flat under host, no group level.

- [ ] **Step 3: Add the `gtype` level**

- Extend `NodeKind` to `'root' | 'cluster' | 'host' | 'gtype' | 'vm'`.
- Add an id helper `const gtypeId = (h: string, g: 'qemu' | 'lxc') => \`gt:${h}:${g}\``.
- In `buildVisibleRows`, when a host is expanded, emit a `gtype` node per present guest kind (VM first, then Container) at the new depth; when a `gtype` node is expanded, emit its guests. Localize the group label via `inventory:guestType.qemu`/`.lxc` (reuse Task 3 keys). Keep the virtualization window logic intact (the new nodes participate in the same flat list).

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/inventory/InventoryTree.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify green + commit**

```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Tests "
git add -A
git commit -m "feat(patlas-2b-04): group inventory guests by type (VM/Container) tree level"
```

---

### Task 5: Terminology remap across all locales

Replace VMware terms with Proxmox terms in the VALUES of all 16 i18n namespaces × 4 locales, per the mapping table. Keys are NOT changed (keyParity unaffected). This is the headline "speak Proxmox" change.

**Files:**
- Modify: `src/i18n/locales/{en,fr,de,it}/{common,dashboard,inventory,mvc,upload,pptx,rci,eos,trends,alloc,storage,network,report,alerts,monstervm,rightsizing}.json`
- Test: `src/i18n/keyParity.test.ts` (must still pass) + a new `src/i18n/terminology.test.ts` (guards against regressions).

**Interfaces:**
- Consumes: nothing.
- Produces: VMware-free user-facing strings.

- [ ] **Step 1: Inventory the VMware terms**

```bash
cd /Users/fjacquet/Projects/patlas
grep -rniE "rvtools|vcenter|datastore|esxi?|\bhost\b|\bhosts\b|\bvm\b|\bvms\b|VMware" src/i18n/locales/en/ | sort
```
This is the EN work list. Each FR/DE/IT file has the same keys with translated values needing the same conceptual remap.

- [ ] **Step 2: Write the regression-guard test**

`src/i18n/terminology.test.ts`:
```ts
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = ['en', 'fr', 'de', 'it']
const FORBIDDEN = /\b(RVTools|vCenter|ESXi?|datastore)\b/i  // VMware terms that must not survive in values
const root = join(__dirname, 'locales')

describe('no VMware terminology in user-facing strings', () => {
  for (const loc of LOCALES) {
    it(`${loc} has no VMware terms`, () => {
      const hits: string[] = []
      for (const f of readdirSync(join(root, loc))) {
        const json = readFileSync(join(root, loc, f), 'utf8')
        for (const line of json.split('\n')) {
          // check values only (lines are "key": "value"); skip the key side
          const val = line.split(':').slice(1).join(':')
          if (FORBIDDEN.test(val)) hits.push(`${loc}/${f}: ${line.trim()}`)
        }
      }
      expect(hits).toEqual([])
    })
  }
})
```
(Note: "Host"/"VM" are too generic to forbid outright — the guard targets the unambiguous VMware tokens RVTools/vCenter/ESX/ESXi/datastore. Host→Node and VM→Guest are handled by the manual remap in step 3, reviewed by eye.)

- [ ] **Step 3: Run the guard to verify it fails**

Run: `npx vitest run src/i18n/terminology.test.ts`
Expected: FAIL — current values contain RVTools/vCenter/ESX/datastore.

- [ ] **Step 4: Apply the remap (per locale, per the mapping table)**

For each namespace value containing a VMware term, replace using the mapping table — for ALL four locales in lockstep (same key, translated term):
- `RVTools` → Proxmox (all locales: Proxmox)
- `vCenter`/`vCenters` → Cluster/Clusters (fr: Cluster; de: Cluster; it: Cluster)
- `Datastore`/`Datastores` → Storage/Storages (fr: Stockage; de: Speicher; it: Archiviazione)
- `ESX`/`ESXi host(s)` → Node(s) (fr: Nœud; de: Knoten; it: Nodo)
- `ESXi version`/`ESX version` → PVE version (fr: version PVE; de: PVE-Version; it: versione PVE)
- `Host`/`Hosts` (when meaning the hypervisor box) → Node/Nodes (fr: Nœud; de: Knoten; it: Nodo)
- `VM`/`VMs`/`virtual machine` (umbrella) → Guest/Guests (fr: Invité; de: Gast; it: Ospite)
- `VMware estate`/`VMware Estate` → Proxmox estate (per table)
- The `.xlsx`/upload copy: "Drop your RVTools export" → "Drop your Proxmox report (.zip or .xlsx)" (translate naturally per locale).
Do NOT change keys. Do NOT change non-terminology copy. Keep number placeholders (`{{count}}`) intact. Where a `mvc.json`/`trends.json` value references an RVTools VERSION string (e.g. "RVTools {{version}}"), change to "Proxmox {{version}}" or drop the version token if it's meaningless for Proxmox — match the value to what `rvtoolsVersion` now holds (`''`).

- [ ] **Step 5: Run the guard + keyParity to verify green**

Run:
```bash
cd /Users/fjacquet/Projects/patlas
npx vitest run src/i18n/terminology.test.ts src/i18n/keyParity.test.ts
```
Expected: both PASS (no forbidden VMware tokens; key trees still identical across locales).

- [ ] **Step 6: Full verify + commit**

Run:
```bash
cd /Users/fjacquet/Projects/patlas
npm run typecheck && npx @biomejs/biome check . && npm run test:run 2>&1 | grep -E "Test Files|Tests "
```
Expected: all pass (component tests asserting on label text may need their expected strings updated to the new terms — fix those in the same task; only the user-facing expected strings change, not the assertions' intent).
```bash
git add -A
git commit -m "feat(patlas-2b-05): remap UI terminology to Proxmox across all four locales"
```

---

## Self-Review

**Spec coverage (spec §7 terminology + §6.1 inventory QEMU/LXC + the 2A-surfaced label leftovers):**
- vCenter→Cluster, Host→Node, Datastore→Storage, RVTools→Proxmox, ESX→Node/PVE (spec §7) → Task 5 ✓
- All four locales, keyParity preserved (spec §7) → Task 5 step 5 + new key in Task 3 across 4 locales ✓
- Inventory QEMU/LXC segmentation (spec §6.1) — "Both" (tree level + column) → Tasks 2,3,4 ✓
- Export "VMware estate"/blank vcenters leftover (2A final-review follow-up) → Task 1 ✓
- DataTable `col.<id>` gotcha for the new column → Task 3 step 3 ✓
- Engines stay VMware-named internally (spec §7) → only types/projection/UI touched ✓

**Placeholder scan:** the test bodies in Tasks 1/3/4 say "mirror the existing test idiom" and "read X first" because the exact helper names live in files the implementer will open — the WHAT to assert is concrete; the harness is matched to existing patterns. Task 5's transformation is fully specified by the mapping table (the actual content). No TBD/TODO.

**Type/name consistency:** `VmDisplayRow.guestType: 'qemu' | 'lxc'` (Task 2) is consumed by the column (Task 3) and tree (Task 4); the i18n keys `inventory:col.guestType` + `inventory:guestType.{qemu,lxc}` are added in Task 3 and reused by Task 4's group labels — consistent.

**Ordering:** Task 1 (export) is independent. Tasks 2→3→4 are sequential (column & tree consume the Task 2 field; all touch inventory files). Task 5 (i18n values) is independent of 2–4 except it must not collide with Task 3's new `inventory.json` key — run Task 5 AFTER Task 3 (or have Task 5 leave `col.guestType`/`guestType.*` untouched). Recommended order: 1, 2, 3, 4, 5.
