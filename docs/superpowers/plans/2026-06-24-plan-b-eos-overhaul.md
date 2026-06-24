# Plan B — EOS Overhaul (Proxmox VE node EOL + catalogue + normalization) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OS End-of-Support Proxmox-correct: add Proxmox VE (node) EOL via a `classifyPve` replacing the ESXi path, rename the `esxi` host bucket end-to-end to `nodes`, refresh the catalogue (add `proxmox-ve`, bump `lastVerified`), and tune OS normalization for Proxmox/LXC guest strings.

**Architecture:** Pure functions in `src/engines/eos/`. `classifyPve.ts` replaces `classifyEsxi.ts`. The typed slice `EosProjection.esxi` (with `EsxiHostRow`) becomes `.nodes` (`NodeHostRow`) in `src/types/estate.ts`, rippling through `bucketEos.ts`, `EMPTY_EOS` (in `estateView.ts`), `EosView.tsx`, and tests. The catalogue is data-only JSON validated by an unchanged Zod schema.

**Tech Stack:** TypeScript (strict), Zod 4 (catalogue boundary), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-24-pptx-eos-network-design.md` (Plan B section).

## Global Constraints

- Engines pure (no React/DOM/Zustand; Zod only at the catalogue boundary).
- `null` = not-derivable, never 0 (an unmatched version → `null` EOL → `unknown` bucket; ADR-0012).
- **EOL/vendor dates are technical facts: validate against `endoflife.date` at implementation time — never write them from memory.** Use the Perplexity/WebFetch MCP or `https://endoflife.date/api/proxmox-ve.json` etc.
- i18n keys in all four locales (`keyParity`); `terminology` test forbids VMware tokens — the renamed labels must say "Node"/"Proxmox VE", never "ESXi".
- Branded units unaffected (EOS works on strings/dates).
- No NUL bytes in `.ts`. Commit prefix `feat(pB-NN): …` / `refactor(pB-NN): …`. Signed commits.
- Run FULL `npm run typecheck` (the rename touches a shared type — test files will only fail under the full typecheck, not `rtk tsc`).
- Biome: `npx @biomejs/biome check .` (not `npm run lint`).

## Reference facts (from codebase recon — use verbatim)

- Catalogue: `src/engines/eos/catalogue.json`. Root `{ lastVerified: string, products: Record<slug, { name, releases: Release[] }> }`. `Release = { name, label, releaseDate: string|null, isEol: boolean, eolFrom: string|null, isMaintained: boolean }`. Current products: `esxi, rhel, oracle-linux, windows-server, windows, centos, debian, ubuntu, sles, almalinux, rocky-linux`. `lastVerified: "2026-05-17"`.
- Schema: `src/engines/eos/catalogueSchema.ts` — `EosCatalogueSchema`, types `EosCatalogue`/`EosProduct`/`EosRelease`. **Unchanged by this plan.**
- `classifyEsxi.ts`: `classifyEsxi(esxVersion: string, catalogue: EosCatalogue): { major: string|null; majorEol: string|null; patchEol: null }`. Regex `/esxi\s*(\d+\.\d+)/i`. **Removed in this plan.**
- `bucketEos.ts`: `buildEosProjection({ vinfo, vhost, catalogue, today }): EosProjection`. Line ~157 calls `classifyEsxi(h.esxVersion, catalogue)`; builds `esxiCounts: Record<EosBucketKey, number>` and `hosts: EsxiHostRow[]`; returns `esxi: { hosts, partition: esxiCounts }`. `bucketFor(eolFrom, todayMs, m)` does the 3/6/9/12-month bucketing — **unchanged**.
- Types: `src/types/estate.ts` — `EosBucketKey`, `EosRow`, `EsxiHostRow { hostName; esxVersion; major: string|null; majorEol: string|null; patchEol: null; bucket }`, `EosProjection { reference; partition; cumulative; rawUnknown; esxi: { hosts: EsxiHostRow[]; partition: Record<EosBucketKey, number> } }`.
- `EMPTY_EOS`: defined in `src/engines/aggregation/estateView.ts` (frozen), includes the `esxi` sub-object.
- `EosView.tsx`: `src/components/eos/EosView.tsx` lines ~249-278 — the "ESXi" section: `t('esxiHeading')`, columns `t('col.host')`, `t('col.esxVersion')`, `t('col.major')`, `t('col.majorEol')`, `t('col.patchEol')`, maps `eos.esxi.hosts`. i18n namespace `eos` (`src/i18n/locales/{en,fr,de,it}/eos.json`).
- `eosSlide.ts`: reads only `eos.cumulative` — **no ESXi labels, NOT touched by this plan.**
- Proxmox node adapter: `adaptProxmoxNodes` in `src/engines/parser/adapters/proxmox.ts:55` sets `esxVersion: readString(readCol(row, cols.pveVersion))` from the "Pve Version" column. Raw value is bare, e.g. `'8.2'` (not a full build string). The ESXi regex cannot match it — `classifyPve` must parse a leading integer major.
- Tests: `classifyEsxi.test.ts`, `bucketEos.test.ts`, `normalizeOs.test.ts`, `catalogue.test.ts`. Real fixtures: `src/engines/eos/fixtures/real-os-strings.ts` (`REAL_OS_STRINGS`, `REAL_ESX_VERSIONS`).
- `normalizeOs.ts`: `normalizeOs(raw: string): { slug: string; version: string } | null`. Ordered `RULES` array; rejects multi-version ranges; calls `classifyOsFamily` as a coarse gate. Has an `esxi` rule (returns null) that is VMware-specific.

> **Field-name decision (binding for this plan):** keep the `VHostRow.esxVersion` field name as-is (renaming a parser-level row field is out of scope and high-blast-radius). `classifyPve` reads `h.esxVersion` (which holds the PVE version for Proxmox). Only the EOS *projection* slice renames `esxi → nodes`. The `NodeHostRow` field that holds the version string is renamed `esxVersion → pveVersion` for clarity (UI-facing); the parser row stays `esxVersion`.

---

### Task 1: Catalogue — add `proxmox-ve`, refresh dates, bump `lastVerified`

**Files:**
- Modify: `src/engines/eos/catalogue.json`
- Test: `src/engines/eos/catalogue.test.ts`

**Interfaces:**
- Consumes: `EosCatalogueSchema` (unchanged).
- Produces: a `proxmox-ve` product entry with releases keyed by major (`"6"`, `"7"`, `"8"`), each with real `eolFrom` dates.

- [ ] **Step 1: Fetch authoritative EOL dates** — query `endoflife.date` for Proxmox VE (`https://endoflife.date/api/proxmox-ve.json` via WebFetch, or the Perplexity MCP). Record the EOL date for each PVE major (6, 7, 8, and 9 if listed) in the report. ALSO spot-check three existing Linux entries already in the catalogue (e.g. Debian 11, Ubuntu 22.04, RHEL 8) against endoflife.date and correct any drift. Do NOT write any date from memory.

- [ ] **Step 2: Write the failing test** — add to `catalogue.test.ts`:

```typescript
it('contains proxmox-ve with major releases and EOL dates', () => {
  const pve = catalogue.products['proxmox-ve']
  expect(pve).toBeDefined()
  const majors = pve!.releases.map((r) => r.name)
  expect(majors).toEqual(expect.arrayContaining(['7', '8']))
  // every release carries an eolFrom (proxmox-ve has firm EOLs)
  for (const r of pve!.releases) expect(typeof r.eolFrom).toBe('string')
})

it('lastVerified was refreshed for this release', () => {
  expect(catalogue.lastVerified >= '2026-06-24').toBe(true)
})
```

- [ ] **Step 3: Run it, verify it fails** — `npm run test:run -- catalogue.test` → FAIL.

- [ ] **Step 4: Implement** — add the `proxmox-ve` product to `catalogue.json` (releases keyed by major name `"6"/"7"/"8"`, with the real `eolFrom`/`releaseDate`/`isEol`/`isMaintained`/`label` values from Step 1), apply any Linux date corrections, and set `lastVerified` to today (`2026-06-24`). Remove the `esxi` product entry (no consumer remains after Tasks 2-3; it is VMware-specific data).

- [ ] **Step 5: Run tests** — `npm run test:run -- catalogue.test` → PASS (the schema test still validates the whole file).

- [ ] **Step 6: Verify and commit** — `npm run typecheck`. Then:

```bash
git add src/engines/eos/catalogue.json src/engines/eos/catalogue.test.ts
git commit -m "feat(pB-01): add proxmox-ve EOL, refresh catalogue, drop esxi entry"
```

---

### Task 2: `classifyPve` (replace `classifyEsxi`)

**Files:**
- Create: `src/engines/eos/classifyPve.ts`
- Create: `src/engines/eos/classifyPve.test.ts`
- Delete: `src/engines/eos/classifyEsxi.ts`, `src/engines/eos/classifyEsxi.test.ts` (in this task, after the new one is green and `bucketEos` is switched in Task 3 — to avoid a broken build, keep `classifyEsxi.ts` until Task 3 removes its last caller; do the deletes at the END of Task 3. In THIS task only add `classifyPve`.)

**Interfaces:**
- Consumes: `EosCatalogue`.
- Produces: `export function classifyPve(pveVersion: string, catalogue: EosCatalogue): { major: string | null; majorEol: string | null; patchEol: null }`.

**Parsing rule:** accept `'8.2'`, `'8.2.2'`, `'8'`, and `'pve-manager/8.2.2/abc'`. Extract the first integer group as `major`. Look up `catalogue.products['proxmox-ve']` by `release.name === major`. `patchEol` is always the `null` sentinel.

- [ ] **Step 1: Write the failing test** — `classifyPve.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import catalogueJson from './catalogue.json'
import { EosCatalogueSchema } from './catalogueSchema'
import { classifyPve } from './classifyPve'

const catalogue = EosCatalogueSchema.parse(catalogueJson)

describe('classifyPve', () => {
  it('parses a bare PVE version (8.2) to major 8', () => {
    const r = classifyPve('8.2', catalogue)
    expect(r.major).toBe('8')
    expect(typeof r.majorEol).toBe('string') // proxmox-ve 8 has a known EOL
    expect(r.patchEol).toBeNull()
  })

  it('parses a pve-manager build string', () => {
    expect(classifyPve('pve-manager/8.2.2/abc', catalogue).major).toBe('8')
  })

  it('parses 7.x to major 7', () => {
    expect(classifyPve('7.4-3', catalogue).major).toBe('7')
  })

  it('returns null major for an unparseable string', () => {
    const r = classifyPve('not-a-version', catalogue)
    expect(r.major).toBeNull()
    expect(r.majorEol).toBeNull()
  })
})
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:run -- classifyPve` → FAIL (module not found).

- [ ] **Step 3: Implement** `classifyPve.ts`:

```typescript
import type { EosCatalogue } from './catalogueSchema'

/** Map a Proxmox VE version string to its major release and EOL date.
 *  Accepts '8.2', '8.2.2', '8', and 'pve-manager/8.2.2/...'. Patch-level EOL
 *  is the `null` sentinel (proxmox-ve EOL is tracked by major). */
export function classifyPve(
  pveVersion: string,
  catalogue: EosCatalogue,
): { major: string | null; majorEol: string | null; patchEol: null } {
  const m = pveVersion.match(/(\d+)(?:\.\d+)*/)
  const major = m?.[1] ?? null
  if (major === null) {
    return { major: null, majorEol: null, patchEol: null }
  }
  const release = catalogue.products['proxmox-ve']?.releases.find((r) => r.name === major)
  return { major, majorEol: release?.eolFrom ?? null, patchEol: null }
}
```

- [ ] **Step 4: Run tests** — `npm run test:run -- classifyPve` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/eos/classifyPve.ts src/engines/eos/classifyPve.test.ts
git commit -m "feat(pB-02): classifyPve maps PVE version to node EOL"
```

---

### Task 3: Rename `esxi → nodes` end-to-end and switch `bucketEos` to `classifyPve`

**Files:**
- Modify: `src/types/estate.ts` (`EsxiHostRow` → `NodeHostRow`; `EosProjection.esxi` → `.nodes`)
- Modify: `src/engines/eos/bucketEos.ts` (`classifyEsxi`→`classifyPve`, `esxiCounts`→`nodeCounts`, build `nodes` sub-object)
- Modify: `src/engines/aggregation/estateView.ts` (`EMPTY_EOS.esxi` → `.nodes`)
- Modify: `src/engines/eos/bucketEos.test.ts` (update references)
- Delete: `src/engines/eos/classifyEsxi.ts`, `src/engines/eos/classifyEsxi.test.ts`

**Interfaces:**
- Consumes: `classifyPve` (Task 2).
- Produces: `EosProjection.nodes: { hosts: NodeHostRow[]; partition: Record<EosBucketKey, number> }`; `NodeHostRow { hostName; pveVersion: string; major: string|null; majorEol: string|null; patchEol: null; bucket: EosBucketKey }`.

- [ ] **Step 1: Update the failing tests first** — in `bucketEos.test.ts`, rename every `.esxi` access to `.nodes`, `EsxiHostRow` import to `NodeHostRow`, and field `esxVersion` (on the projected node row) to `pveVersion`. Add an assertion that a host whose `esxVersion` (parser field) holds `'8.2'` lands with `major === '8'` and a non-null `majorEol` in `result.nodes`. Run `npm run test:run -- bucketEos` → FAIL to confirm the new expectations are active.

- [ ] **Step 2: Rename the type** — in `src/types/estate.ts`: rename interface `EsxiHostRow` → `NodeHostRow`, rename its `esxVersion: string` field → `pveVersion: string`; in `EosProjection`, rename `esxi:` key → `nodes:` and update its element type to `NodeHostRow[]`.

- [ ] **Step 3: Switch `bucketEos.ts`** — replace `import { classifyEsxi }` with `import { classifyPve } from './classifyPve'`; rename `esxiCounts` → `nodeCounts`; in the host loop call `classifyPve(h.esxVersion, catalogue)` (parser field unchanged); build each row as `NodeHostRow` (`pveVersion: h.esxVersion`, `major`, `majorEol`, `patchEol`, `bucket`); return `nodes: { hosts, partition: nodeCounts }`.

- [ ] **Step 4: Update `EMPTY_EOS`** — in `estateView.ts`, rename the frozen `esxi:` key → `nodes:` (shape identical: `{ hosts: [], partition: { …all bucket keys: 0 } }`).

- [ ] **Step 5: Delete the ESXi classifier** — remove `classifyEsxi.ts` and `classifyEsxi.test.ts`.

- [ ] **Step 6: Run typecheck + tests** — `npm run typecheck` (catches every remaining `.esxi`/`EsxiHostRow`/`esxVersion`-on-node reference, including in `EosView.tsx` which Task 4 fixes — if the typecheck flags `EosView.tsx`, that is expected; Task 4 resolves it, but to keep each task green, do Task 4's `EosView` edit BEFORE running the final typecheck of this task. To keep tasks independent, instead temporarily leave `EosView.tsx` compiling by doing the minimal `.esxi`→`.nodes` rename here too, and let Task 4 handle the i18n/labels). Run `npm run test:run -- bucketEos eos` → PASS.

> Note to implementer: because the type rename makes `EosView.tsx` fail to compile, this task MUST include the mechanical `eos.esxi` → `eos.nodes`, `h.esxVersion` → `h.pveVersion` rename inside `EosView.tsx` so the build is green. Task 4 then handles the user-facing label/i18n changes. Keep this task's `EosView.tsx` edit purely mechanical (no label text changes).

- [ ] **Step 7: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/types/estate.ts src/engines/eos/bucketEos.ts src/engines/eos/bucketEos.test.ts src/engines/aggregation/estateView.ts src/components/eos/EosView.tsx
git rm src/engines/eos/classifyEsxi.ts src/engines/eos/classifyEsxi.test.ts
git commit -m "refactor(pB-03): rename eos.esxi→nodes, bucket nodes via classifyPve"
```

---

### Task 4: Relabel the EOS view node section (i18n)

**Files:**
- Modify: `src/components/eos/EosView.tsx` (the section heading + column labels — user-facing text only)
- Modify: `src/i18n/locales/{en,fr,de,it}/eos.json`
- Test: `src/components/eos/EosView.test.tsx` (assert the node section renders with the new label; if no such test file exists, add a focused one)

**Interfaces:**
- Consumes: `EosProjection.nodes` (Task 3, already wired mechanically).
- Produces: user-facing "Node"/"Proxmox VE" labels (no "ESXi").

- [ ] **Step 1: Write/extend the failing test** — render `EosView` with a snapshot whose node carries `esxVersion: '8.2'` and assert the node section shows the new heading text (e.g. the EN string for `eos:nodesHeading`) and the PVE version column header. Run → FAIL.

- [ ] **Step 2: Rename i18n keys** — in all four `eos.json`: rename `esxiHeading` → `nodesHeading` (value: "Node end-of-support" / locale equivalents), `col.esxVersion` → `col.pveVersion` (value "PVE version" / equivalents). Keep `col.host`/`col.major`/`col.majorEol`/`col.patchEol` (rename `patchEol`'s usage stays the em-dash). Ensure no value contains "ESXi"/"VMware".

- [ ] **Step 3: Update `EosView.tsx`** — change `t('esxiHeading')` → `t('nodesHeading')` and `t('col.esxVersion')` → `t('col.pveVersion')`; bind the version cell to `h.pveVersion`.

- [ ] **Step 4: Run tests** — `npm run test:run -- EosView keyParity terminology` → PASS.

- [ ] **Step 5: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/components/eos/EosView.tsx src/components/eos/EosView.test.tsx src/i18n/locales/*/eos.json
git commit -m "feat(pB-04): relabel EOS node section for Proxmox VE"
```

---

### Task 5: Tune `normalizeOs` for Proxmox / LXC guest strings

**Files:**
- Modify: `src/engines/eos/normalizeOs.ts`
- Modify: `src/engines/eos/normalizeOs.test.ts`
- Modify (if needed): `src/engines/eos/fixtures/real-os-strings.ts` (add real Proxmox guest OS strings if the current fixture is RVTools-only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeOs` matches Proxmox `OS name`/`OS version` forms and LXC template names (e.g. `debian-12-standard`, `ubuntu-22.04-standard`, `rockylinux-9-default`).

- [ ] **Step 1: Gather real fixture strings** — inspect a real Proxmox report's guest OS strings (the parser fixtures used by `proxmox.test.ts` / the real-report acceptance tests). Collect the distinct OS-name forms Proxmox emits for QEMU guests and LXC templates. Add any not already in `real-os-strings.ts` to a new `REAL_PROXMOX_OS_STRINGS` array (with a dated provenance comment).

- [ ] **Step 2: Write the failing table test** — in `normalizeOs.test.ts`, add cases driven by the Proxmox strings, e.g.:

```typescript
it.each([
  ['debian-12-standard', { slug: 'debian', version: '12' }],
  ['ubuntu-22.04-standard', { slug: 'ubuntu', version: '22.04' }],
  ['Debian GNU/Linux 12 (bookworm)', { slug: 'debian', version: '12' }],
])('normalizes %s', (raw, expected) => {
  expect(normalizeOs(raw)).toEqual(expected)
})
```

(Adjust the exact expected `version` shape to what the catalogue keys on — if the catalogue keys Ubuntu by `22.04`, emit `22.04`; if Debian by major `12`, emit `12`. Confirm against `catalogue.json` so the normalized version actually matches a release `name`.)

- [ ] **Step 3: Run it, verify it fails** — `npm run test:run -- normalizeOs` → FAIL.

- [ ] **Step 4: Implement** — extend the `RULES` array in `normalizeOs.ts` to match the LXC template forms and bare Proxmox OS-name forms, returning the version that matches the catalogue release `name`. Update the `ubuntu` rule to extract `\d+\.\d+` when present (currently returns `null`). Remove the VMware-specific `esxi` rule (Proxmox guests are never ESXi; it only ever returned null). Keep the multi-version-range rejection and the `classifyOsFamily` coarse gate.

- [ ] **Step 5: Run tests** — `npm run test:run -- normalizeOs bucketEos` → PASS (bucketEos exercises normalizeOs end-to-end; confirm more guests classify and the reconciliation invariant still holds).

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`, full `npm run test:run`, and the coverage gate `npm run test:coverage -- --testTimeout=60000` (engines ≥75%). Then:

```bash
git add src/engines/eos/normalizeOs.ts src/engines/eos/normalizeOs.test.ts src/engines/eos/fixtures/real-os-strings.ts
git commit -m "feat(pB-05): normalize Proxmox/LXC guest OS strings"
```

---

## Self-Review notes (author)

- Spec coverage: B1 catalogue → Task 1; B2 classifyPve + rename → Tasks 2-4; B3 normalization → Task 5. ✅
- Correction vs spec: the catalogue already carries most Linux families — Task 1 focuses on adding `proxmox-ve`, refreshing dates, and dropping the VMware `esxi` entry, rather than a from-scratch Linux build-out. The pre-compaction "Linux-thin" note was inaccurate; recon corrected it.
- Type-rename hazard: the `esxi→nodes` rename breaks `EosView.tsx` compilation; Task 3 includes the mechanical `EosView` rename so each task stays green, and Task 4 owns the user-facing label change. Reviewer should confirm Task 3's `EosView` edit is mechanical-only.
- `VHostRow.esxVersion` deliberately kept (parser-row field rename is out of scope); only the projection slice/UI renames. Reviewer: confirm `classifyPve(h.esxVersion, …)` reads the right field.
- All EOL dates MUST come from endoflife.date at implementation time (Task 1 Step 1). Reviewer: confirm the report records the source and that no date was written from memory.
