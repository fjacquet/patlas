# App-wide German + Italian Localization — Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add German (`de`) and Italian (`it`) locales across every i18n namespace so the whole app — UI, exports, and the new Right-sizing view — is available in `en`, `fr`, `de`, `it`.

**Architecture:** Pure i18n data work. For each namespace, create `de/<ns>.json` and `it/<ns>.json` mirroring the `en/<ns>.json` key structure exactly, then register the two locales in `src/i18n/index.ts` (`SUPPORTED_LANGUAGES`, per-namespace imports, `resources`). The language switcher and detector are already data-driven by `SUPPORTED_LANGUAGES`, so they need no structural change beyond two new `lang.*` label keys. A key-parity test guards completeness; a smoke test proves the app renders under each locale.

**Tech Stack:** react-i18next 16 · i18next 26 · i18next-browser-languagedetector · Vitest. No new dependencies. Translations are bundled at build time — **no runtime translation API** (privacy/no-network invariant preserved).

**Spec:** `docs/superpowers/specs/2026-05-25-vm-rightsizing-stress-and-de-it-i18n-design.md` (Workstream B).

**Dependency on Plan 1:** Execute **after** Plan 1. Plan 1 creates the `rightsizing` namespace and the new `inventory:col.*` / `pptx` right-sizing keys in `en`+`fr`; this plan translates the *current* set of namespaces, which by then includes `rightsizing`. The namespace count below is **17** = the 16 existing + `rightsizing`.

**Conventions for every task:**

- Lint/format with `npx @biomejs/biome check .` (NOT `npm run lint`). JSON files must be valid and Biome-formatted.
- Tests with `npm run test:run`. Typecheck with `npm run typecheck`.
- **Key parity is sacred:** `de/<ns>.json` and `it/<ns>.json` must have the EXACT same key paths as `en/<ns>.json` — no missing, no extra. The parity test enforces this.
- **Preserve, never translate:** interpolation tokens (`{{count}}`, `{{name}}`, …), ICU/i18next plural suffixes (`_one`, `_other`, `_zero`, …), HTML-ish placeholders, and number/unit symbols. Translate only human-readable text.
- **No pre-formatted numbers** in strings (project rule) — keep number formatting in code.
- **No editorial-verb drift:** match the neutral, non-verdict tone the `en`/`fr` strings already use (ADR-0012). Do not introduce "should/recommended/poor/good" equivalents.
- Commit prefix `feat(i18n-NN): …`. Signed commits — never `--no-gpg-sign`.

---

## Namespaces (17)

`common`, `upload`, `dashboard`, `inventory`, `mvc`, `str`, `alloc`, `dr`, `rci`, `eos`, `trends`, `storage`, `alerts`, `network`, `report`, `pptx`, `rightsizing`.

## File map

**Create (34 files):** `src/i18n/locales/de/<ns>.json` and `src/i18n/locales/it/<ns>.json` for each of the 17 namespaces.

**Create (tests):**

- `src/i18n/keyParity.test.ts` — every namespace has identical key paths across `en`/`fr`/`de`/`it`.
- `src/i18n/localeSmoke.test.ts` — i18n initializes and resolves a known key under each locale.

**Modify:**

- `src/i18n/index.ts` — add `de`/`it` imports (17 each), add to `resources`, add `'de'`/`'it'` to `SUPPORTED_LANGUAGES`.
- `src/i18n/locales/en/common.json`, `fr/common.json` — add `lang.de` + `lang.it` label keys (the switcher renders `t('lang.<code>')` for every supported language).

## Translation glossary (consistency anchor)

Use these renderings consistently across all namespaces. **Flag the `de`/`it` columns for native/technical review before release** (tracked risk in the spec — UI terms only, not vendor CLI).

| en | de | it |
|---|---|---|
| Cluster | Cluster | Cluster |
| Host | Host | Host |
| Datastore | Datastore | Datastore |
| Snapshot | Snapshot | Snapshot |
| VM / Virtual machine | VM / Virtuelle Maschine | VM / Macchina virtuale |
| Allocation | Zuweisung | Allocazione |
| Threshold | Schwellenwert | Soglia |
| Overcommit | Überbelegung | Sovrallocazione |
| Powered on / off | Eingeschaltet / Ausgeschaltet | Acceso / Spento |
| Stretched cluster | Stretched-Cluster | Cluster stretched |
| CPU Ready | CPU Ready | CPU Ready |
| Ballooning | Ballooning | Ballooning |
| Swapped | Ausgelagert | Swap |
| Right-sizing | Dimensionierung | Dimensionamento |
| Oversized (alloc ≫ usage) | Zuweisung ≫ Nutzung | Allocazione ≫ utilizzo |
| Undersized | Nutzung nahe Zuweisung | Utilizzo prossimo all'allocazione |
| Storage | Speicher | Storage |
| Disaster Recovery | Disaster Recovery | Disaster Recovery |
| End of Support | Support-Ende | Fine supporto |
| Upload | Hochladen | Caricamento |
| Export | Export | Esportazione |
| Report | Bericht | Report |
| Trend | Trend | Andamento |
| Capacity | Kapazität | Capacità |
| Utilization | Auslastung | Utilizzo |
| Provisioned | Bereitgestellt | Provisionato |

> Keep product nouns that are conventionally left in English in VMware contexts (Cluster, Host, Datastore, Snapshot, CPU Ready, Ballooning, Disaster Recovery) untranslated, as above.

---

# Phase A — Parity test first (the completeness gate)

### Task 1: Key-parity test

**Files:**

- Create: `src/i18n/keyParity.test.ts`

- [x] **Step 1: Write the test.** It compares the flattened key paths of each namespace across all four locales by reading the JSON files directly (so it does not depend on `index.ts` wiring):

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = ['en', 'fr', 'de', 'it'] as const
const NAMESPACES = [
  'common', 'upload', 'dashboard', 'inventory', 'mvc', 'str', 'alloc', 'dr',
  'rci', 'eos', 'trends', 'storage', 'alerts', 'network', 'report', 'pptx',
  'rightsizing',
] as const

const flatten = (obj: unknown, prefix = ''): string[] => {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  )
}
const load = (locale: string, ns: string): unknown =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `src/i18n/locales/${locale}/${ns}.json`), 'utf8'),
  )

describe('i18n key parity across locales', () => {
  for (const ns of NAMESPACES) {
    it(`${ns}: de/it/fr key sets match en`, () => {
      const en = new Set(flatten(load('en', ns)))
      for (const locale of LOCALES) {
        if (locale === 'en') continue
        const other = new Set(flatten(load(locale, ns)))
        const missing = [...en].filter((k) => !other.has(k))
        const extra = [...other].filter((k) => !en.has(k))
        expect({ locale, ns, missing, extra }).toEqual({ locale, ns, missing: [], extra: [] })
      }
    })
  }
})
```

- [x] **Step 2: Run it (expected: FAIL)**

Run: `npm run test:run -- src/i18n/keyParity.test.ts`
Expected: FAIL — `de`/`it` files don't exist yet (ENOENT), and once created, any drift surfaces here. This is the gate every later task runs against.

- [x] **Step 3: Commit**

```bash
git add src/i18n/keyParity.test.ts
git commit -m "feat(i18n-01): add cross-locale key-parity test"
```

---

# Phase B — Translate namespaces (de + it)

> **Method for every translation task below (applies to each namespace):**
>
> 1. Read `src/i18n/locales/en/<ns>.json` (the authoritative source) and `fr/<ns>.json` (a translation precedent for tone).
> 2. Create `de/<ns>.json` and `it/<ns>.json` with the **identical key structure**.
> 3. Translate each leaf string per the glossary. **Preserve** `{{tokens}}`, plural-suffix keys (`*_one`/`*_other`), HTML/markup, and unit symbols verbatim.
> 4. Validate JSON + format: `npx @biomejs/biome check src/i18n/locales/de/<ns>.json src/i18n/locales/it/<ns>.json`.
> 5. Run the parity test scoped to confirm the namespace passes.

### Task 2: `common` (+ switcher label keys)

**Files:**

- Create: `src/i18n/locales/de/common.json`, `src/i18n/locales/it/common.json`
- Modify: `src/i18n/locales/en/common.json`, `src/i18n/locales/fr/common.json`

- [x] **Step 1: Read** `en/common.json` + `fr/common.json`. Note the existing `lang` block (`lang.label`, `lang.fr`, `lang.en`).

- [x] **Step 2: Add the two new switcher labels** to BOTH `en/common.json` and `fr/common.json` under `lang`:

```json
    "de": "DE",
    "it": "IT"
```

(Match the existing style of `lang.fr`/`lang.en` — they appear to be short codes; keep whatever convention those use. If they spell the language out, spell `de`/`it` out too: en → "German"/"Italian", fr → "Allemand"/"Italien".)

- [x] **Step 3: Create `de/common.json` and `it/common.json`** mirroring the full `en/common.json` structure (translated), including the `lang` block. The `lang.*` values are the *display labels* shown in the switcher — they should read the same in every locale (e.g. `lang.de` = "DE"/"Deutsch", `lang.it` = "IT"/"Italiano"), not be re-translated per current language.

- [x] **Step 4: Validate + parity (common only)**

Run: `npx @biomejs/biome check src/i18n/locales/de/common.json src/i18n/locales/it/common.json && npm run test:run -- src/i18n/keyParity.test.ts -t common`
Expected: `common` parity PASSES (other namespaces still fail — expected until their tasks).

- [x] **Step 5: Commit**

```bash
git add src/i18n/locales/en/common.json src/i18n/locales/fr/common.json src/i18n/locales/de/common.json src/i18n/locales/it/common.json
git commit -m "feat(i18n-02): de/it common.json + switcher labels"
```

### Task 3: `upload`, `alerts`, `report`

**Files:** create `de/`+`it/` for each of `upload`, `alerts`, `report` (6 files).

- [x] **Step 1:** Apply the translation method to `upload`, `alerts`, `report`.
- [x] **Step 2: Validate + parity**

Run: `npx @biomejs/biome check src/i18n/locales/de src/i18n/locales/it && npm run test:run -- src/i18n/keyParity.test.ts -t "upload|alerts|report"`
Expected: those three pass.

- [x] **Step 3: Commit**

```bash
git add src/i18n/locales/de/upload.json src/i18n/locales/it/upload.json src/i18n/locales/de/alerts.json src/i18n/locales/it/alerts.json src/i18n/locales/de/report.json src/i18n/locales/it/report.json
git commit -m "feat(i18n-03): de/it upload, alerts, report"
```

### Task 4: `dashboard`, `inventory`, `rci`

**Files:** create `de/`+`it/` for `dashboard`, `inventory`, `rci` (6 files).

- [x] **Step 1:** Apply the translation method. `inventory` includes the `col.*` keys (incl. the right-sizing columns added in Plan 1) — translate the column headers per the glossary (e.g. `col.cpuUtilPct` → DE "CPU-Auslastung %" / IT "Utilizzo CPU %").
- [x] **Step 2: Validate + parity**

Run: `npm run test:run -- src/i18n/keyParity.test.ts -t "dashboard|inventory|rci"`
Expected: pass.

- [x] **Step 3: Commit**

```bash
git add src/i18n/locales/de/dashboard.json src/i18n/locales/it/dashboard.json src/i18n/locales/de/inventory.json src/i18n/locales/it/inventory.json src/i18n/locales/de/rci.json src/i18n/locales/it/rci.json
git commit -m "feat(i18n-04): de/it dashboard, inventory, rci"
```

### Task 5: `str`, `alloc`, `dr`, `mvc`

**Files:** create `de/`+`it/` for `str`, `alloc`, `dr`, `mvc` (8 files).

- [x] **Step 1:** Apply the translation method (stretched-cluster, allocation, DR, multi-vCenter terms — see glossary).
- [x] **Step 2: Validate + parity**

Run: `npm run test:run -- src/i18n/keyParity.test.ts -t "str|alloc|dr|mvc"`
Expected: pass.

- [x] **Step 3: Commit**

```bash
git add src/i18n/locales/de/str.json src/i18n/locales/it/str.json src/i18n/locales/de/alloc.json src/i18n/locales/it/alloc.json src/i18n/locales/de/dr.json src/i18n/locales/it/dr.json src/i18n/locales/de/mvc.json src/i18n/locales/it/mvc.json
git commit -m "feat(i18n-05): de/it str, alloc, dr, mvc"
```

### Task 6: `eos`, `trends`, `storage`, `network`

**Files:** create `de/`+`it/` for `eos`, `trends`, `storage`, `network` (8 files).

- [x] **Step 1:** Apply the translation method.
- [x] **Step 2: Validate + parity**

Run: `npm run test:run -- src/i18n/keyParity.test.ts -t "eos|trends|storage|network"`
Expected: pass.

- [x] **Step 3: Commit**

```bash
git add src/i18n/locales/de/eos.json src/i18n/locales/it/eos.json src/i18n/locales/de/trends.json src/i18n/locales/it/trends.json src/i18n/locales/de/storage.json src/i18n/locales/it/storage.json src/i18n/locales/de/network.json src/i18n/locales/it/network.json
git commit -m "feat(i18n-06): de/it eos, trends, storage, network"
```

### Task 7: `pptx`, `rightsizing`

**Files:** create `de/`+`it/` for `pptx`, `rightsizing` (4 files).

- [x] **Step 1:** Apply the translation method. `pptx` includes the deck strings (incl. the right-sizing slide group from Plan 1). `rightsizing` uses the neutral category labels — translate per the glossary (DE "Zuweisung ≫ Nutzung" / IT "Allocazione ≫ utilizzo", etc.). Preserve `{{count}}` in the `basis.maxOfN` strings.
- [x] **Step 2: Validate + parity (all namespaces now)**

Run: `npm run test:run -- src/i18n/keyParity.test.ts`
Expected: **ALL 17 namespaces PASS** (every locale complete).

- [x] **Step 3: Commit**

```bash
git add src/i18n/locales/de/pptx.json src/i18n/locales/it/pptx.json src/i18n/locales/de/rightsizing.json src/i18n/locales/it/rightsizing.json
git commit -m "feat(i18n-07): de/it pptx, rightsizing — parity complete"
```

---

# Phase C — Wire the locales in

### Task 8: Register `de`/`it` in `src/i18n/index.ts`

**Files:**

- Modify: `src/i18n/index.ts`

- [x] **Step 1: Add the imports.** After the `fr*` import block, add a `de*` and an `it*` import block — one import per namespace, mirroring the `en*`/`fr*` naming, e.g.:

```ts
import deCommon from './locales/de/common.json'
import deUpload from './locales/de/upload.json'
// … all 17 …
import deRightsizing from './locales/de/rightsizing.json'
import itCommon from './locales/it/common.json'
// … all 17 …
import itRightsizing from './locales/it/rightsizing.json'
```

- [x] **Step 2: Extend `SUPPORTED_LANGUAGES`:**

```ts
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'it'] as const
```

(The `SupportedLanguage` type derives from this, so the switcher + detector pick the new codes up automatically. `fallbackLng` stays `'fr'`.)

- [x] **Step 3: Add `rightsizing` to `NAMESPACES`** if Plan 1 didn't already (it should have — verify; the parity test's list must match `NAMESPACES`).

- [x] **Step 4: Extend `resources`** with `de` and `it` maps mirroring the `en`/`fr` maps exactly (all 17 namespaces):

```ts
  de: {
    common: deCommon, upload: deUpload, dashboard: deDashboard, inventory: deInventory,
    mvc: deMvc, str: deStr, alloc: deAlloc, dr: deDr, rci: deRci, eos: deEos,
    trends: deTrends, storage: deStorage, alerts: deAlerts, network: deNetwork,
    report: deReport, pptx: dePptx, rightsizing: deRightsizing,
  },
  it: {
    common: itCommon, upload: itUpload, dashboard: itDashboard, inventory: itInventory,
    mvc: itMvc, str: itStr, alloc: itAlloc, dr: itDr, rci: itRci, eos: itEos,
    trends: itTrends, storage: itStorage, alerts: itAlerts, network: itNetwork,
    report: itReport, pptx: itPptx, rightsizing: itRightsizing,
  },
```

- [x] **Step 5: Typecheck + lint (expected: PASS)**

Run: `npm run typecheck && npx @biomejs/biome check src/i18n/index.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/i18n/index.ts
git commit -m "feat(i18n-08): register de/it locales + imports + resources"
```

---

# Phase D — Verify

### Task 9: Locale smoke test

**Files:**

- Create: `src/i18n/localeSmoke.test.ts`

- [x] **Step 1: Write the test:**

```ts
import { describe, expect, it } from 'vitest'
import i18n, { SUPPORTED_LANGUAGES } from './index'

describe('i18n locale smoke', () => {
  it('exposes all four locales', () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['de', 'en', 'fr', 'it'])
  })
  for (const lng of ['en', 'fr', 'de', 'it'] as const) {
    it(`resolves a common key under ${lng} (no raw-key fallthrough)`, async () => {
      await i18n.changeLanguage(lng)
      const label = i18n.t('common:lang.label')
      expect(label).not.toBe('lang.label')
      expect(label.length).toBeGreaterThan(0)
    })
  }
})
```

- [x] **Step 2: Run it (expected: PASS)**

Run: `npm run test:run -- src/i18n/localeSmoke.test.ts`
Expected: PASS.

- [x] **Step 3: Manual switcher check**

Run: `npm run dev` → the language toggle now shows four options; switching to DE and IT re-renders the app (Dashboard, Inventory, Right-sizing, exports) with translated strings and no raw `key.path` text.

- [x] **Step 4: Commit**

```bash
git add src/i18n/localeSmoke.test.ts
git commit -m "feat(i18n-09): locale smoke test (4 locales resolve)"
```

### Task 10: Full gate + docs

- [x] **Step 1: Full gate**

Run: `npm run typecheck && npx @biomejs/biome check . && npm run test:run && npm run check:supply-chain && npm run check:bundle-size`
Expected: all PASS. (Bundle grows by the JSON weight only; confirm within budget.)

- [x] **Step 2: Update docs.** Record `de`+`it` support (4 locales) in the project docs / feature inventory; note the native-review follow-up for `de`/`it` technical terminology. Flip any phase checkbox/progress row manually (the SDK does not match the ROADMAP format).

- [x] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(i18n-10): record de/it localization (4 locales) + review follow-up"
```

---

## Self-review checklist (done while writing)

- **Spec coverage (Workstream B):** de+it across all namespaces incl. `rightsizing` (Tasks 2–7) ✓; i18n config wiring — `SUPPORTED_LANGUAGES`, imports, `resources` (Task 8) ✓; language switcher (data-driven; `lang.de`/`lang.it` keys in Task 2) ✓; detector unchanged, `fr` fallback retained (Task 8) ✓; bundled at build time / no network (no fetch added) ✓; key-parity guard (Task 1) ✓; native-review risk recorded (Task 10) ✓.
- **Ordering:** parity test first (drives completeness) → translate → wire `index.ts` (imports require files to exist) → smoke test → gate. ✓
- **No placeholders:** every task has the file set, the method, exact run commands, and expected results. Per-key translated strings are produced at execution from the known `en` source under the glossary — the test gate guarantees completeness. The one fully-modeled file is `common` (the switcher labels), shown concretely. ✓
- **Risk:** `de`/`it` technical-term quality needs native review — explicitly carried, not silently assumed correct.

```
