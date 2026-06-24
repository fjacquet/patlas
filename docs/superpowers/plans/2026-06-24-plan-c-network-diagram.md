# Plan C — Network Diagram (carry the bundled SVG to the Network view + HTML report) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop discarding the `network-diagram.svg` that the Proxmox `.zip` bundle ships: carry it onto the active `Snapshot`, render it as the Network view (which is empty for Proxmox today), and embed it in the HTML report.

**Architecture:** `extractProxmoxBundle` already returns `networkSvg`. The parser worker assigns it to `Snapshot.networkSvg` (new OPTIONAL field). `NetworkView` reads the active snapshot's `networkSvg` and renders it via a sandboxed `<img>` data-URI (never `dangerouslySetInnerHTML`), falling back to the existing empty state. The HTML report gets `networkSvg` threaded through `RenderReportInput` (since `renderReport` consumes only `EstateView`, and the SVG is a per-active-snapshot asset that deliberately does not live on `EstateView`).

**Tech Stack:** TypeScript (strict), React 19, fflate (already in worker), Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-24-pptx-eos-network-design.md` (Plan C section).

## Global Constraints

- Privacy (PAR-05): the SVG is dataset-derived → in-memory only, never egressed. `data:`/blob URLs are same-origin (privacy guard intact). `xlsx`/`fflate` stay worker-only.
- **Security:** render the SVG ONLY via an `<img src="data:image/svg+xml;…">`. NEVER `dangerouslySetInnerHTML` (the repo has zero uses — keep it that way). An SVG in `<img>` cannot execute scripts.
- `null` = not-derivable (bare `.xlsx` with no bundle ⇒ `networkSvg = null`).
- `networkSvg` is OPTIONAL on `Snapshot` (`networkSvg?: string | null`) — matches the `rawReleased?`/`releasedAggregate?` convention so existing `Snapshot` test builders need not change.
- PPTX deliberately EXCLUDED (resvg rasterizes SVG text away — keep the diagram to web + HTML report only).
- No NUL bytes in `.ts`/`.tsx`. Commit prefix `feat(pC-NN): …`. Signed commits.
- Run FULL `npm run typecheck` after the `Snapshot` type change.
- Biome: `npx @biomejs/biome check .` (not `npm run lint`).

## Reference facts (from codebase recon — use verbatim)

- `extractProxmoxBundle(buffer: Uint8Array): { xlsx: Uint8Array | null; networkSvg: string | null }` (`src/engines/parser/extractZip.ts`) — `networkSvg` already decoded to a string.
- Worker: `src/engines/parser/parser.worker.ts`. `ParseRequest { kind: 'parse'; buf: ArrayBuffer; filename: string; mtime: number }`. It calls `extractProxmoxBundle(u8)` (variable `bundle`), uses `bundle.xlsx`, but **never assigns `bundle.networkSvg`** to the posted snapshot. The snapshot is typed `Omit<Snapshot, 'id' | 'parsedAt'>` and posted as `{ kind: 'ok', snapshot, warnings }`. **Naming collision:** the worker reuses the name `bundle` for BOTH the zip-extract result AND `adaptProxmox(workbook)`. Capture the SVG into a distinct variable (e.g. `let networkSvg: string | null = null`) at the zip branch before `bundle` is reassigned.
- `Snapshot` type: `src/types/snapshot.ts`. Optional-field convention: `rawReleased?: boolean`, `releasedAggregate?: ReleasedTrendAggregate | null`. Add `networkSvg?: string | null` near them.
- `selectActiveSnapshot(s): Snapshot | null` in `src/store/snapshotStore.ts`. Components call `useSnapshotStore(selectActiveSnapshot)`.
- `NetworkView.tsx` (`src/components/network/NetworkView.tsx`): gets `snapshot` via `useSnapshotStore(selectActiveSnapshot)` and `view` via `useEstateView('active')`. Guards `if (!snapshot)`; computes `empty` from `n.vswitches/dvswitches/portgroups/vmPortgroupCount`; renders empty-state `<p>{t('empty.unavailable')}</p>` or three `DataTable` sections. i18n namespace `network`.
- `renderReport.tsx` (`src/engines/export/html/renderReport.tsx`): `RenderReportInput { view: EstateView; trends: TrendSeries | null; strings: ExportStrings; locale: Locale }`. Uses `<Section id title>` + `<Metric label value>`; conditional sections via `{cond ? <Section/> : null}`. Existing `<Section id="network" …>` at ~line 243. No `dangerouslySetInnerHTML`. Reads `view` only — does NOT receive snapshots.
- `useEstateView` returns `EstateView` only (no snapshot). The report's caller has the active snapshot available separately (find the export caller in Task 4).
- Existing image data-URI pattern (PPTX): `` `image/png;base64,${bytesToBase64(png)}` ``. For SVG use `` `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}` `` (utf-8 safe) or `` `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` ``.
- `NetworkView.test.tsx` exists: populates the store via `useSnapshotStore.getState().addSnapshot(snapshot(...))`, `clearAll()` in `beforeEach`, asserts via `screen.getByText`/`queryByText`.

---

### Task 1: Carry `networkSvg` onto the `Snapshot` (type + worker)

**Files:**

- Modify: `src/types/snapshot.ts` (add `networkSvg?: string | null`)
- Modify: `src/engines/parser/parser.worker.ts` (capture the SVG, assign to the snapshot)
- Test: `src/engines/parser/parser.worker.test.ts` if it exists, else a focused test on the extract→assign path. If the worker is not directly unit-testable (Web Worker global scope), add the assertion to the real-report acceptance test that already drives a `.zip` (grep for the zip-upload acceptance test added in PR #6 / `extractZip.test.ts`).

**Interfaces:**

- Produces: `Snapshot.networkSvg?: string | null` — set to the bundle's SVG for a `.zip`, `null` for a bare `.xlsx`.

- [ ] **Step 1: Write the failing test** — assert that parsing a `.zip` bundle containing a `network-diagram.svg` yields a snapshot with `networkSvg` containing `'<svg'`, and that a bare `.xlsx` yields `networkSvg == null`. Reuse the existing zip fixture from the PR #6 acceptance test (grep `extractProxmoxBundle`/`.zip` in `src/engines/parser/*.test.ts` to find it). If the worker itself is hard to invoke, test at the boundary the worker uses: assert `extractProxmoxBundle(zipBytes).networkSvg` is a string (this already passes) AND add a worker-level assertion if a worker harness exists. Prefer extending the highest-level existing zip acceptance test so the end-to-end assignment is covered.

- [ ] **Step 2: Run it, verify it fails** — `npm run test:run -- <the test>` → FAIL (`networkSvg` undefined on the snapshot).

- [ ] **Step 3: Add the type field** — in `src/types/snapshot.ts`, add near `rawReleased?`:

```typescript
  /**
   * The `network-diagram.svg` from a Proxmox `.zip` bundle, as a raw SVG
   * string. `null` for a bare `.xlsx` (no bundle). Per-active-snapshot asset;
   * NOT merged into `EstateView`. Rendered only via a sandboxed `<img>`
   * data-URI (never raw-injected). In-memory only (PAR-05).
   */
  networkSvg?: string | null
```

- [ ] **Step 4: Assign it in the worker** — in `parser.worker.ts`, capture the SVG before the `bundle` name is reused:

```typescript
    let networkSvg: string | null = null
    let xlsxBytes: Uint8Array = u8
    if (isZip) {
      const zip = extractProxmoxBundle(u8)
      if (zip.xlsx) xlsxBytes = zip.xlsx // Proxmox .zip bundle
      networkSvg = zip.networkSvg
      // else: a bare .xlsx (itself a zip with no inner .xlsx) → parse u8 directly
    }
```

Then add `networkSvg,` to the `snapshot` object literal (the `Omit<Snapshot, 'id' | 'parsedAt'>` shape). Note: this renames the existing inner `extractProxmoxBundle` result variable from `bundle` to `zip` to avoid colliding with the later `const bundle = adaptProxmox(workbook)`.

- [ ] **Step 5: Run tests** — `npm run test:run -- <the test>` → PASS. Then `npm run typecheck` (the worker's `Omit<Snapshot,…>` now requires/permits `networkSvg`; since it's optional, confirm no breakage).

- [ ] **Step 6: Commit**

```bash
git add src/types/snapshot.ts src/engines/parser/parser.worker.ts <test file>
git commit -m "feat(pC-01): carry network-diagram.svg onto the snapshot"
```

---

### Task 2: SVG → data-URI helper (pure, shared)

**Files:**

- Create: `src/engines/export/svgDataUri.ts`
- Create: `src/engines/export/svgDataUri.test.ts`

**Interfaces:**

- Produces: `export function svgToDataUri(svg: string): string` — returns `data:image/svg+xml;base64,<b64>` (utf-8 safe). Used by both NetworkView (Task 3) and the HTML report (Task 4) — DRY.

- [ ] **Step 1: Write the failing test** — `svgDataUri.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { svgToDataUri } from './svgDataUri'

describe('svgToDataUri', () => {
  it('produces a base64 svg data URI', () => {
    const uri = svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
    const b64 = uri.slice('data:image/svg+xml;base64,'.length)
    expect(atob(b64)).toContain('<svg')
  })

  it('round-trips non-ASCII content (utf-8 safe)', () => {
    const uri = svgToDataUri('<svg><text>nœud — réseau</text></svg>')
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it, verify it fails** — `npm run test:run -- svgDataUri` → FAIL.

- [ ] **Step 3: Implement** `svgDataUri.ts`:

```typescript
/** Encode a raw SVG string as a base64 `data:` URI for use as an `<img>`
 *  src. utf-8 safe. Same-origin (no egress); the only safe way to render a
 *  semi-trusted report-bundle SVG (an `<img>` cannot execute scripts). */
export function svgToDataUri(svg: string): string {
  const b64 = btoa(unescape(encodeURIComponent(svg)))
  return `data:image/svg+xml;base64,${b64}`
}
```

- [ ] **Step 4: Run tests** — `npm run test:run -- svgDataUri` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engines/export/svgDataUri.ts src/engines/export/svgDataUri.test.ts
git commit -m "feat(pC-02): svgToDataUri helper for safe <img> embedding"
```

---

### Task 3: Render the diagram in `NetworkView`

**Files:**

- Modify: `src/components/network/NetworkView.tsx`
- Modify: `src/i18n/locales/{en,fr,de,it}/network.json` (add a `diagram` heading + `img.alt`)
- Test: `src/components/network/NetworkView.test.tsx`

**Interfaces:**

- Consumes: `snapshot.networkSvg` (Task 1), `svgToDataUri` (Task 2).
- Produces: NetworkView renders an `<img>` with an svg data-URI when `networkSvg` is present.

**Behavior:** When `snapshot.networkSvg` is a non-empty string, render a "Network topology" section containing `<img src={svgToDataUri(snapshot.networkSvg)} alt={t('img.alt')} />` (above or instead of the empty state). When `networkSvg` is null AND the vSwitch/dvSwitch arrays are empty, keep the existing empty-state line. When the DataTable sections have data, render them as today (the diagram section can render in addition, before the tables).

- [ ] **Step 1: Write the failing tests** — in `NetworkView.test.tsx`, add:
  - a snapshot with `networkSvg: '<svg xmlns="http://www.w3.org/2000/svg"><text>topo</text></svg>'` and otherwise-empty network arrays → assert an `<img>` is rendered whose `src` starts with `data:image/svg+xml;base64,` (use `screen.getByRole('img')` and read `getAttribute('src')`), and assert the empty-state line is NOT shown.
  - a snapshot with `networkSvg: null` and empty arrays → assert the existing empty-state line shows and there is no `<img>`.
  Run → FAIL.

- [ ] **Step 2: Implement** — in `NetworkView.tsx`:
  - import `svgToDataUri` from `@/engines/export/svgDataUri`.
  - after the `if (!snapshot)` guard, compute `const svg = snapshot.networkSvg ?? null`.
  - change the `empty` early-return: render the diagram section if `svg` is present even when the tables are empty; only show the empty-state `<p>` when `svg` is null AND `empty` is true.
  - add a `<section>` with an `<h2>{t('section.diagram')}</h2>` and `<img src={svgToDataUri(svg)} alt={t('img.alt')} className="max-w-full" />` rendered when `svg` is non-null, placed before the three DataTable sections.
  - add `section.diagram` and `img.alt` keys to all four `network.json` (no VMware tokens; e.g. EN `section.diagram: "Network topology"`, `img.alt: "Proxmox network diagram"`).

- [ ] **Step 3: Run tests** — `npm run test:run -- NetworkView keyParity terminology` → PASS.

- [ ] **Step 4: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`. Then:

```bash
git add src/components/network/NetworkView.tsx src/components/network/NetworkView.test.tsx src/i18n/locales/*/network.json
git commit -m "feat(pC-03): render Proxmox network diagram in the Network view"
```

---

### Task 4: Embed the diagram in the HTML report

**Files:**

- Modify: `src/engines/export/html/renderReport.tsx` (extend `RenderReportInput`; add a Network-diagram block)
- Modify: the report caller that builds `RenderReportInput` (find it — grep `renderReport(` / `RenderReportInput`; likely `src/hooks/useExport.ts` or an `assembleHtml`/html `index.ts`)
- Test: `src/engines/export/html/renderReport.test.tsx` (or the existing report test)

**Interfaces:**

- Consumes: `svgToDataUri` (Task 2), the active snapshot's `networkSvg` from the caller.
- Produces: `RenderReportInput.networkSvg?: string | null`; an `<img>` in the existing/an adjacent Network section when present; omitted when null. PPTX unaffected.

- [ ] **Step 1: Write the failing test** — in the report test, render `renderReport` with `networkSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>'` and assert the output markup contains `data:image/svg+xml;base64,` inside an `<img`. Render again with `networkSvg: null`/absent and assert no svg data-URI appears. Run → FAIL.

- [ ] **Step 2: Extend the input type** — add `networkSvg?: string | null` to `RenderReportInput`.

- [ ] **Step 3: Render the image** — in the `<Section id="network" …>` (or a new `<Section id="network-diagram" …>` right after it), add `{networkSvg ? <img src={svgToDataUri(networkSvg)} alt={strings['network.diagramAlt'] ?? 'Network diagram'} /> : null}`. Import `svgToDataUri`. Add a `network.diagramAlt` key to the export strings/`pptx`-or-report string source as the other report strings are sourced (match how `strings['network.title']` is populated — grep `ExportStrings`/`ExportStrings` builder; if report strings come from a `report`/`pptx` namespace, add the key in all four locales there).

- [ ] **Step 4: Thread it from the caller** — in the report caller, read the active snapshot (`useSnapshotStore.getState ? selectActiveSnapshot` or whatever the caller already has — it already has the snapshot to compute `capturedAt`/`vCenterLabel` for the filename) and pass `networkSvg: activeSnapshot?.networkSvg ?? null` into `renderReport`. Find the exact call site via grep and wire it.

- [ ] **Step 5: Run tests** — `npm run test:run -- renderReport keyParity terminology` → PASS. Full `npm run test:run`.

- [ ] **Step 6: Verify and commit** — `npm run typecheck`, `npx @biomejs/biome check .`, full `npm run test:run`, coverage gate (`npm run test:coverage -- --testTimeout=60000`, engines + `engines/export/html/` ≥75%). Then:

```bash
git add src/engines/export/html/renderReport.tsx src/engines/export/html/renderReport.test.tsx <caller file> src/i18n/locales/*/<strings>.json
git commit -m "feat(pC-04): embed Proxmox network diagram in the HTML report"
```

---

## Self-Review notes (author)

- Spec coverage: C1 carry SVG → Task 1; C2 render safely → Task 3 (+ helper Task 2); C3 HTML report → Task 4. ✅
- Correction vs spec: spec said NetworkView reads `networkSvg` from the active snapshot "directly" — confirmed correct (NetworkView already pulls `selectActiveSnapshot`). For the HTML report, `renderReport` consumes only `EstateView`, so Task 4 threads `networkSvg` through `RenderReportInput` (the SVG stays off `EstateView`, per spec). ✅
- Security: rendering is `<img>` data-URI only; `dangerouslySetInnerHTML` stays absent. Reviewer: confirm no raw-HTML injection was introduced.
- Worker variable-shadowing hazard called out in Task 1 (the existing `bundle` name is reused) — reviewer should confirm the SVG is captured before reassignment.
- Open detail for implementer (Task 4 Step 3/4): the exact report-strings source and the report caller's access to the active snapshot — flagged to grep and wire; reviewer confirms the chosen source matches existing report strings.
