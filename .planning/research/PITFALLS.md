# Domain Pitfalls — vatlas

**Domain:** VMware estate analytics web app, RVTools-only, 100% client-side
**Researched:** 2026-05-15
**Sibling lessons drawn from:** vsizer (RVTools+LiveOptics → PPTX), store-predict ADR-017

## Reading guide

Each pitfall carries: **what goes wrong**, **warning signs**, **prevention** (a concrete artifact — schema/test/constant/config), and the **roadmap phase** that should own it. The phase tags map to the foreseeable vatlas roadmap (Parser, Aggregation, EOS, DR-sim, Trends, HTML-export, PPTX-export, i18n, Performance, Privacy).

---

## Critical pitfalls

These cause wrong numbers, privacy violations, or rewrites. Wrong numbers in an operator-facing tool are worse than no numbers — the operator will base a budget conversation on them.

---

### Critical-1: "MB" in RVTools is MiB (no conversion) — vsizer's hard-won lesson

**What goes wrong:** RVTools column headers say "MB" (e.g., `Provisioned MB`, `In Use MB`, `Memory`) but the underlying values are base-2 mebibytes (MiB). A well-meaning contributor adds a `* 1.048576` "fix" to convert MB→MiB; every storage and memory total inflates by ~4.9%. A 100-TiB estate now claims 104.9 TiB.

**Why it happens:** SI vs IEC ambiguity is industry-wide; the label "MB" is wrong but ubiquitous. New contributors will "fix" this in good faith.

**Consequences:** Systematic over-sizing of every storage forecast, every DR survivor-capacity calculation, every memory headroom number. The error is multiplicative through aggregation.

**Warning signs:**
- Code review adds a conversion factor on any RVTools numeric.
- Totals don't match a hand-spot-check from RVTools' own UI for a known small workbook.
- A unit test computes "expected" memory as `rows * factor * 1.048576`.

**Prevention (concrete):**
- Inherit ADR-017 from store-predict verbatim into `docs/adr/0010-rvtools-mb-as-mib.md` on day one.
- Name every storage/memory column in canonical schemas as `*_mib` / `*_gib` — never `*_mb`. The type name carries the unit.
- Add a parser test fixture `fixtures/rvtools-mib-canary.xlsx` with hand-computed totals; if a contributor introduces a factor, the test fails immediately.
- Constant `BYTES_PER_MIB = 1024 * 1024` lives in `engines/units/constants.ts`; refuse to import `1_000_000` anywhere near storage code.

**Phase:** Parser (foundational — must be locked in before aggregation lands).

---

### Critical-2: Privacy invariant leak via dependency telemetry

**What goes wrong:** A dependency — analytics SDK, Sentry, LogRocket, posthog-js, a source-map upload service, or a fetch-polyfill with a "phone home" first-load — exfiltrates workbook bytes, parsed rows, or error payloads containing VM names / hostnames / IP addresses. The product invariant ("nothing leaves the browser") is silently broken. This is a reputation-killer for a tool that is *defined* by client-side privacy.

**Warning signs:**
- Network tab during `npm run preview` shows ANY outbound request after page load except the GH Pages base URL.
- New dependency adds an `analytics` / `telemetry` / `metrics` keyword in its package.json.
- An error boundary or logger interpolates a row object into a message string.
- A `Sentry.init({...})` lands without an explicit `beforeSend` scrubber.
- Source maps configured to upload to a vendor at build time.

**Prevention (concrete enumerated leak vectors):**

| Leak Vector | Mitigation |
|-------------|------------|
| Sentry / error-tracking SDK | Don't ship one. If you must, configure `beforeSend: () => null` for parsed-data namespaces and a denylist that drops `breadcrumbs`. Default Sentry config sends URL, query string, and console breadcrumbs — all dangerous when workbook content appears there. |
| Analytics SDKs (GA, Plausible, posthog, Amplitude, Mixpanel) | Forbidden. Add to `package.json` an explicit `// FORBIDDEN: telemetry SDKs` comment and a CI grep gate (`engines.forbidden = ['@sentry/*', 'posthog-*', '@amplitude/*', 'mixpanel*', '@datadog/*', 'logrocket*']`). |
| Source-map upload services (Sentry, Bugsnag, Datadog) | Build pipeline must NOT include a sourcemap upload step. Generate sourcemaps only for local debugging (`build:debug`), never the public deploy. |
| Error boundary serializing payload | `FallbackError` may only read `error.message` and `error.name`, never `error.cause` or any context-carried object that may contain rows. Test: pass an error with `{cause: {vms: [...]}}` and assert nothing from `cause` appears in the rendered fallback. |
| `console.error` / `console.log` left in prod | Biome rule `noConsole` is **error** in non-test files. CI fails on a console call. |
| Devtools-style "debug" overlays in prod | A `if (import.meta.env.DEV)` gate around every debug panel; never `process.env.NODE_ENV` (Vite). |
| fetch / XHR / WebSocket / sendBeacon | A runtime guard: in `src/main.tsx` install a wrapper that overrides `window.fetch`, `XMLHttpRequest.prototype.open`, `navigator.sendBeacon`, and `WebSocket` to throw if the URL host is NOT the document origin. Throwing is the right behavior; a silent block is hard to detect. |
| CSP header / meta tag | Ship a `<meta http-equiv="Content-Security-Policy">` with `connect-src 'self'` (no `*`, no third-party hosts). This is belt-and-suspenders to the runtime guard. |
| Service Worker registering and POSTing payloads | Don't register a service worker. CI grep for `navigator.serviceWorker.register`. |
| Web font fetched from Google Fonts / CDN | Self-host all fonts; `font-src 'self' data:` in CSP. (Also fixes Critical-7.) |
| Resource hints (`<link rel="prefetch">`) to third-party | None. CI grep `<link rel="preconnect"|prefetch"` for non-self URLs. |
| Iframe to third party | None. `frame-src 'none'` in CSP. |
| Sub-resource integrity bypass on a CDN script | Same: no CDN scripts in `index.html`; everything bundled. |

**Phase:** Privacy (cross-cutting; the fetch-wrapper + CI denylist must land in Phase 1 before any analytics-tempted feature ships).

---

### Critical-3: Stretched-cluster DR reservation math — the 50% rule is conditional, not universal

**What goes wrong:** The naive interpretation "stretched cluster = reserve 50%" is *only* right when the cluster is symmetric (equal host count and equal capacity per site) AND running active/active across both sites. Asymmetric stretched clusters (e.g., 6+4) reserve more than 50% on the bigger site. Single-site failover-only stretched clusters are different again. vsizer's ADR-0007 settled on "N/2 hosts of CPU+RAM headroom" — that is the symmetric simplification, which is correct *for the common case* but a footgun if presented as universal truth.

**Warning signs:**
- DR sim says "survivor capacity OK" for a 6+4 stretched cluster losing the 6-host site.
- Tests only cover even host-count clusters.
- The HA admission-control percentage in vCenter (if surfaced in RVTools) doesn't match the engine's assumed 50%.

**Prevention (concrete):**
- Carry over vsizer's ADR-0007 verbatim, and add an ADR extension: "asymmetric stretched cluster reservation = max(site_A_capacity, site_B_capacity) / total_capacity, not 0.5."
- Aggregation engine: compute reservation per-site, not as a flat percentage. If `vCluster` sheet exposes host fault-domain or site tag, use it; otherwise flag the cluster as "assumed symmetric" in the UI.
- DR sim test matrix: 4+4 (symmetric, classical), 6+4 (asymmetric), 8+0 (non-stretched failback target), 2+2 (minimum), all with mixed host capacities.
- A `confidence` field on every DR-sim result: `high` (sites resolved from data) / `medium` (assumed symmetric) / `low` (host fault domain unknown — should display a warning chip in the UI).

**Phase:** Aggregation (math owner) + DR-sim (UI surfaces the confidence).

---

### Critical-4: Multi-vCenter aggregation merges identities incorrectly

**What goes wrong:** Two workbooks loaded together. Both have a cluster named `Cluster-Prod`. The aggregator merges them. The user sees a single 20-host cluster that is actually two unrelated 10-host clusters in different datacenters. Or: the same VM has vMotion'd across vCenters between the two snapshots; its UUID appears in both; it gets double-counted in the estate-wide vCPU total.

**Why it happens:**
- Cluster names are not globally unique — they're scoped to the vCenter that created them.
- VM `VM UUID` (BIOS UUID) is globally unique but `vm.Object ID` (the vCenter MoRef like `vm-1234`) is per-vCenter.
- RVTools `vInfo` has both; choose wrong and you get duplicates or false merges.

**Warning signs:**
- Estate totals exceed the sum of per-vCenter totals (impossible — must be aggregation bug).
- A cluster appears with double its expected host count.
- Two vCenters share a cluster name but have different vCenter UUIDs.

**Prevention (concrete):**
- Aggregation key for clusters: `(vcenter_uuid, cluster_moref)`, never just `cluster_name`.
- Aggregation key for VMs: `vm_bios_uuid` (deduplicates vMotion across vCenters), with a secondary key `vm_instance_uuid` for VM-cloning edge cases.
- Datastores: `(vcenter_uuid, datastore_moref)` — same datastore mounted in two vCenters (cross-vCenter shared storage) is rare but real; surface as a "shared across vCenters" badge.
- Snapshot timestamp: capture from each workbook's vInfo "VI SDK API Version" / "Datacenter" / file mtime; if two workbooks were taken >24h apart, flag the aggregation as "snapshot drift" in the UI.
- RVTools version per workbook: read from a sheet like `dvInfo` or the first row metadata; if mixed across the loaded set, surface a "mixed RVTools versions" warning — column shapes may differ.
- Test fixtures: two synthetic workbooks with deliberately-colliding cluster names and one vMotion'd VM; assert the dedupe.

**Phase:** Aggregation (multi-workbook merge is its own module; deserves a dedicated `engines/aggregation/multiWorkbook.ts` file with its own ADR).

---

### Critical-5: SheetJS parse blocks the main thread on 10k+ VM workbooks

**What goes wrong:** A real estate has 15,000 VMs; the RVTools workbook is 80 MB; the user drops it into the browser; the tab freezes for 30 seconds; the user closes the tab thinking the app crashed. Worse — the heap balloons to 600 MB (SheetJS expands ~4-8x in memory; a 50 MB xlsx → 300-400 MB heap), and on a 4 GB Chromebook the tab actually OOMs.

**Warning signs:**
- "Performance" tab shows a multi-second main-thread blockage on `XLSX.read`.
- User reports a "spinner that never moves."
- Heap snapshot after load > 500 MB.
- Loading a second workbook for trends causes a tab crash.

**Prevention (concrete):**
- **Parse in a Web Worker** from day one. The worker reads the file via `FileReader` / `Blob.arrayBuffer()`, calls `XLSX.read(buf, { dense: true })`, and posts back already-normalized canonical rows (not the raw workbook).
- **Dense mode** (`{ dense: true }`) for SheetJS — designed for the Chrome arrays-of-arrays perf regression.
- **Drop raw cells eagerly** — never keep the SheetJS `WorkBook` object alive past the worker boundary. Post back `{ vInfo: Row[], vHost: Row[], ... }` and let the original be GC'd.
- **Per-workbook memory budget**: after parse, if `performance.memory.usedJSHeapSize` (Chrome-only, best-effort) > 1 GB, surface a UI warning "large estate detected — consider closing other tabs."
- **Snapshot retention policy in the store**: when N > 4 snapshots are loaded for trends, only keep aggregated time-series in memory; the raw rows of older snapshots are released. Aggregations are cheap (~KB); raw rows are heavy (~10s of MB).
- **Progress reporting from the worker**: SheetJS doesn't expose progress natively, but `FileReader.onprogress` for the read phase + a "parsing… (this may take ~30s on large estates)" message buys user patience.
- **Test with a real 10k-VM fixture**: keep one in `public/samples/` (synthetic; no real customer data) and a Vitest perf test that asserts parse < 10s on a desktop runner.

**Phase:** Performance (Phase 1 — must land alongside the parser, because retrofitting Worker boundaries later is painful).

---

### Critical-6: Powered-off VMs in capacity math

**What goes wrong:** RVTools reports vCPU, RAM, and provisioned storage for *all* VMs including powered-off ones. Naïve "total vCPU = sum(VInfo.CPUs)" inflates the consolidation ratio by including 2,000 zombie VMs that haven't booted in 3 years. The customer's "real" vCPU:pCPU ratio is 4:1; the report says 7:1. Conversely, *excluding* powered-off VMs from storage sizing under-counts capacity needs because thin-provisioned, powered-off VMs still occupy space.

**Warning signs:**
- Consolidation ratio reported far exceeds operator's gut feel.
- DR sim suggests massive headroom that contradicts vCenter's own admission control.
- Storage forecast looks low relative to known datastore fill rates.

**Prevention (concrete):**
- Three accounting modes, *explicitly surfaced in the UI*:
  - **Configured** (everything, powered on or off) — the "what's defined" view.
  - **Active** (only `powerState === 'poweredOn'`) — the "what's running today" view.
  - **Storage-realistic** (configured for storage/disk math, active for CPU/RAM) — the "honest sizing" view.
- The aggregation engine returns all three; the UI defaults to "Active" for CPU/RAM dashboards and "Configured" for storage, with a toggle.
- A "stale VMs" widget: count of powered-off VMs whose last boot (if available — `vInfo.PowerOff` timestamp in newer RVTools) was > 180 days ago. This number IS the conversation starter the operator wants.
- Test: synthetic workbook with 50% poweredOn / 50% poweredOff; assert three modes produce three distinct totals.

**Phase:** Aggregation. (UI surfacing in Inventory + Allocation phases.)

---

## Moderate pitfalls

Won't cause a rewrite but will cause an embarrassing report, an angry operator, or a wasted afternoon.

---

### Moderate-1: RVTools column drift across versions

**What goes wrong:** vsizer was tested against RVTools 4.x. A customer exports from RVTools 3.11 and the parser fails to find `Creation date` (which doesn't exist in 3.11) or finds an extra column like `Config Checksum` (removed in 4.0) and Zod rejects the row. Or worse — silently maps the wrong column because positional indexing was used instead of header-based lookup.

**Known column changes** (per RVTools release notes):

| Version | Sheet | Change |
|---------|-------|--------|
| 4.0 | vInfo | + `Virtual machine tags`, `min Required EVC mode key`; − `Config Checksum` (Base64Binary caused XML errors) |
| 4.0 | vCluster | + `Cluster tags`, custom attributes, `object ID` |
| 4.0 | vHost | + Host tags in maintenance/quarantine mode |
| 3.11 | vInfo | + `Creation date`, `Primary IP Address`, `vmx Config Checksum`, log/snapshot/suspend directories |
| 3.11 | vHost | + `Serial number`, `BIOS vendor` |
| 3.10 | vInfo | + latency-sensitivity, CBT, `disk.EnableUUID` |
| 3.10 | vHost | + Assigned License(s), ATS heartbeat/locking, Host Power Policy, CPU power |
| 3.7 | many | + `VM Folder` on vCPU/vMemory/vDisk/vPartition/vNetwork/vFloppy/vCD/vSnapshot/vTools |

**Warning signs:**
- Zod parse error mentions a column that exists in some sample files but not others.
- A column-name string literal appears outside a schema/alias dictionary.

**Prevention (concrete):**
- A **column alias dictionary** per canonical field: `cpus: ['CPUs', 'CPU', 'Number of vCPUs', 'vCPU']`. Header-based lookup, never positional.
- Every canonical field is **optional in Zod** at the row level; aggregation engines declare which fields they require and bail with a structured error (`"engines/aggregation/perCluster requires vInfo.cpus, missing in this workbook (RVTools 3.10 or older?)"`).
- Capture **RVTools version** from the workbook itself (if a metadata sheet exposes it) or by sniffing presence/absence of marker columns; bind to the loaded snapshot in the store; show in the trends overlay so the user sees "snapshot 1: RVTools 4.4 / snapshot 2: RVTools 3.11" and knows missing columns aren't a bug.
- Fixtures: one workbook per major RVTools generation (3.10, 3.11, 4.0, 4.4) — sourced from the existing real exports on disk (`~/Downloads/`, `~/Library/CloudStorage/`).

**Phase:** Parser.

---

### Moderate-2: French locale number formatting — the U+202F trap

**What goes wrong:** The French locale uses **U+202F NARROW NO-BREAK SPACE** as the thousands separator (not a regular space and not the regular non-breaking space U+00A0). `Intl.NumberFormat('fr-FR').format(1234567)` returns `"1 234 567"` where each space is U+202F. If the report or PPTX is opened in software that doesn't render U+202F (older PowerPoint, some PDF readers), it shows as a missing-glyph box. Also: comparing formatted strings with `===` against a regex like `/^\d+ \d+$/` will fail because `\s` matches U+202F but a literal space character does not.

**Warning signs:**
- A test asserts `format(1234) === "1 234"` with a regular space — works in node but the actual output uses U+202F.
- PPTX numbers display with a tofu (□) where the separator should be.
- A copy-paste of a number from the report into Excel parses incorrectly.

**Prevention (concrete):**
- Centralize all number formatting in `utils/format.ts` with explicit locale and unit suffixes (`formatGiB`, `formatGHz`, `formatPercent`, `formatRatio`).
- Tests use `\s` or explicit ` ` codepoints in assertions, not literal spaces.
- For PPTX numbers (where font fallback may be flaky), pass through a normalizer `pptxSafeFormat(n, locale)` that replaces U+202F → U+00A0 (the regular non-breaking space, which has wider font support).
- FR translation keys: never embed pre-formatted numbers in the translation string; always use `{{value}}` interpolation so the formatter sees the locale.
- Decimal separator gotcha: FR uses `,` decimal; the HTML report's "copy as CSV" button must export with locale-aware separators OR with raw numbers (raw is safer for re-import).

**Phase:** i18n + Export (HTML and PPTX both).

---

### Moderate-3: CPU Ready % interpretation — the per-vCPU vs summation trap

**What goes wrong:** RVTools doesn't export performance counters (no CPU Ready data) — but the user *might* paste counters in alongside, or vatlas might in future ingest a perf overlay. The trap: vCenter's "CPU Ready" is a *summation* in milliseconds across all vCPUs. A 4-vCPU VM with 10% CPU Ready summation is *actually* 2.5% per vCPU — under VMware's 5% threshold. Reporting the raw summation as a single percentage misleads operators into thinking the VM is contended when it isn't.

**Warning signs:**
- Any feature that surfaces "CPU Ready" without specifying "per vCPU."
- Threshold constant `CPU_READY_WARN = 0.05` applied to a summation value.

**Prevention (concrete):**
- If/when vatlas surfaces CPU Ready (likely future, not v1): the engine returns `{ readyPercentPerVcpu, readyPercentSummation, vcpuCount }`. UI displays per-vCPU by default; tooltip shows summation; threshold check uses per-vCPU.
- Document this in an ADR before the first feature that needs it. Even if v1 doesn't include perf data, the ADR exists so when it does, no one re-introduces the bug.

**Phase:** (Future, not v1. Flag for Phase planning when perf overlay is added.)

---

### Moderate-4: Hyperthreading double-count in vCPU:pCPU ratio

**What goes wrong:** RVTools `vHost` reports both `# CPU` (sockets), `# Cores` (physical cores), and `# CPU Threads` (logical, i.e., HT-enabled count). A consolidation-ratio calculation that uses *threads* claims a 2:1 ratio is actually 4:1 in physical-core terms. Operators read 2:1 and conclude "low utilization"; the host is in fact over-committed.

**Warning signs:**
- `vCPU / pCPU` denominator is sourced from `# CPU Threads`.
- Two reports of the same estate produce different ratios because one used cores, one used threads.

**Prevention (concrete):**
- Aggregation always computes the ratio against **physical cores** (`# Cores`), with a parallel "thread-basis ratio" in the same data structure for transparency.
- UI label: "vCPU per physical core" (not "vCPU per pCPU" — that term is ambiguous).
- The PPTX deck shows the physical-core ratio as the headline number, threads-basis as a footnote in a smaller font.
- vsizer's ADR-0009 (DR-aware vCPU/pCPU) extends naturally — confirm it uses cores, not threads, and inherit.

**Phase:** Aggregation.

---

### Moderate-5: MHz vs GHz conversion + reserved vs configured RAM

**What goes wrong:** RVTools reports CPU speed in **MHz** (`CPU MHz`), not GHz. A copy-paste into a "GHz" field shows 2600 GHz per host (a hilarious teraflop estate). RAM has a similar trap: `Memory` (MiB) is *configured* RAM; `Reservation` (MiB) is reserved (guaranteed) RAM. Summing configurations exceeds host physical RAM (oversubscription is fine and expected); summing reservations *also* exceeds host RAM is a real configuration error that vatlas should surface.

**Warning signs:**
- A number in the UI ending in three zeros where a single-digit GHz was expected.
- "Total RAM" suspiciously close to the host memory total instead of the sum of all VMs.

**Prevention (concrete):**
- `engines/units/` carries the conversion constants and named functions: `mhzToGhz(n: number): GHz`. The branded type `GHz` (TS branded number) is incompatible with raw `number`, so you can't accidentally render an unconverted value.
- Aggregation emits both configured and reserved separately; reserved > host_pCPU_GHz triggers a "configuration warning" surfaced in the cluster card.
- Test: a host with 2 sockets × 12 cores × 2600 MHz should compute to 62.4 GHz per host, not 62400.

**Phase:** Aggregation (units module is foundational and lands with the parser).

---

### Moderate-6: OS End-of-Support catalogue — the naming variant trap

**What goes wrong:** RVTools `vInfo.OS according to the configuration file` (the "configured" OS string) and `OS according to the VMware Tools` (the "running" OS string) disagree. Same OS, three names across the estate:
- `Red Hat Enterprise Linux 8 (64-bit)` (vCenter guest OS dropdown name)
- `Red Hat Enterprise Linux 8.10` (VMware Tools-detected, granular)
- `Red Hat Enterprise Linux Server release 8.10 (Ootpa)` (old format)
- `rhel8_64Guest` (the API enum name)
And Oracle Linux:
- `Oracle Linux Server 8.10`
- `OEL 8.10`
- `oracleLinux8_64Guest`

The EOS catalogue keyed on `'RHEL 8'` matches none of them. Result: 4,000 RHEL VMs show up as "OS unknown — no EOS forecast" and the operator can't trust the forecast.

**Known EOS landmarks** (verify before v1 ships; the catalogue must be a maintained JSON, not hardcoded):

| OS | EOS / End of Maintenance |
|----|--------------------------|
| RHEL 7 | 30 June 2024 (already passed — every RHEL 7 VM is overdue) |
| RHEL 8.10 (final minor) | 31 May 2029 (maintenance) |
| RHEL 9.4 (EUS) | EUS available |
| Windows Server 2012 R2 | 10 October 2023 (passed) |
| Windows Server 2016 | Extended Support ends 12 January 2027 |
| Windows Server 2019 | Extended Support ends 9 January 2029 |
| Windows Server 2022 | Mainstream support ends 13 October 2026 |
| Windows Server Annual 23H2 | 24 October 2025 (passed) |
| ESXi 7.0 | General Support ends 2 October 2025 (passed), Tech Guidance 2 October 2027 |
| ESXi 8.0 | General Support ends 11 October 2027, Tech Guidance 11 October 2029 |

**Warning signs:**
- "Unknown OS" bucket in the EOS forecast >5% of VMs.
- The forecast shows zero RHEL 7 risk in an estate that clearly has CentOS 7 / RHEL 7 hosts.
- Past EOS dates appear in the "future risk" buckets.

**Prevention (concrete):**
- An **OS normalizer** module with a regex-based classifier and a normalized canonical key (`{ family: 'rhel', major: 8, minor: 10, arch: 'x86_64' }`). Test against a fixture of 50 real OS strings (harvest from existing exports).
- The EOS catalogue is `src/data/os-eos.json`, keyed on `family + major + minor`, with `eosDate`, `extendedSupportDate?` (LTSS/ESU), and a `source` URL (Red Hat lifecycle page, MS lifecycle page).
- A **lifecycle phase bucketing** function: `phase(eosDate, now) → 'overdue' | '3mo' | '6mo' | '9mo' | '12mo' | 'safe'`. The "overdue" bucket exists because RHEL 7 and Win Server 2012 R2 are already past and *must not* be hidden.
- Extended support tiers: surface separately. RHEL ELS (Extended Life Cycle Support) and Windows ESU (Extended Security Updates) are paid; an asterisk in the UI clarifies.
- "Unknown OS" must be a real bucket in the dashboard — not silently dropped — and clicking it shows the unrecognized strings so the user (or the maintainer) can extend the normalizer.
- The catalogue carries a `lastVerified` date; CI warns when the date is >90 days old.

**Phase:** EOS (dedicated phase).

---

### Moderate-7: HTML report — fonts, charts, and the CSP-vs-base64 tradeoff

**What goes wrong:** The exported HTML "report" is opened by a colleague who isn't on the corporate network. The Google Fonts CSS 404s. The Inter font falls back to Times New Roman. The charts (SVG with external CSS) render unstyled. The corporate VPN's CSP-strict proxy blocks `data:` URIs, so even base64-inlined images don't load. The "shareable, self-contained" file is none of those things.

**Warning signs:**
- The report HTML contains `<link href="https://fonts.googleapis.com">` or any `https://` reference.
- SVG elements rely on a `<style>` block outside their parent.
- Opening the HTML file via `file://` (no network) shows missing styles.
- Resulting HTML > 30 MB (probably base64 chart images for every snapshot exploded).

**Prevention (concrete):**
- The HTML export is a **single file** built by a dedicated builder module `engines/export/html/`. No external references. Self-host fonts; subset them (only the glyphs actually used — Inter Latin Extended A is typically enough for FR+EN).
- All styles are **inline** in a single `<style>` block (or scoped per-component but written to the file). No external CSS, no `@import`.
- Charts: **render to inline SVG** (not `<img src="data:image/png;base64...">` for charts — too heavy and lossy). For SVG, ensure every text element has an explicit `font-family` attribute and that the font is embedded as `@font-face` with a `data:font/woff2;base64,…` source.
- CSP `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; font-src 'self' data:; img-src 'self' data:; style-src 'self' 'unsafe-inline'">` — `unsafe-inline` for styles is acceptable because the HTML is the trust boundary; nothing third-party is loaded.
- Test: build the report, serve via `python3 -m http.server`, also open via `file://`, also `curl --proto =file --proto-default file` — all three must render identically.
- Total size budget: < 5 MB for a "typical" estate snapshot, < 15 MB hard ceiling (warn the user above that). Bundle a "lite" report option that skips trends if the user has many snapshots.
- **Anchor ID collision across snapshots**: if the report concatenates multiple snapshots, every anchor must be prefixed `s1-cluster-prod`, not `cluster-prod`, or the in-page nav jumps to the wrong place.

**Phase:** HTML-export.

---

### Moderate-8: PPTX export — pptxgenjs gotchas (vsizer has hit these)

**What goes wrong:**

| Symptom | Cause |
|---------|-------|
| Long text spills outside the text box | `autoFit: true` in pptxgenjs means "Resize shape to fit text" (PowerPoint option 3), NOT "Shrink text on overflow" (option 2). The "shrink" option is poorly supported; some versions removed it (`shrinkText`) in favor of a new `fit` property. |
| "Shrink text" works in PowerPoint but text overflow in LibreOffice / OpenOffice | The shrink-text rendering depends on a select/deselect cycle that LibreOffice doesn't trigger. |
| Numbers in slides show `1,234.56` instead of `1 234,56` for FR users | pptxgenjs doesn't auto-localize; numbers are baked in at write-time. |
| Custom Tailwind colors don't match in PPTX | pptxgenjs takes hex strings; if you pass `bg-primary-500` (a CSS class), it ends up as a literal. |
| Chart fidelity poor compared to native | pptxgenjs's built-in chart types are limited; complex visualizations (treemaps, heatmaps) aren't supported and must be rendered as images. |
| "Repair errors" when opening the PPTX | Often a text box with text that's too long or contains illegal XML characters (control chars from VM names). |
| Tables exceed slide width with many columns | No built-in auto-fit; column widths are author's job. |

**Prevention (concrete):**
- A `pptxText(text, opts)` wrapper that: truncates with ellipsis at a known character budget for the given font size; strips control characters (`text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')`); and uses the `fit: 'shrink'` syntax (newer pptxgenjs) with a fallback to manual sizing.
- For numbers: pre-format on the JS side using the locale-aware formatter from `utils/format`, then pass the *string* to pptxgenjs. Apply the U+202F → U+00A0 substitution for PPTX context (Moderate-2).
- Color tokens: maintain a `src/theme/pptxPalette.ts` module that exports hex strings (`PALETTE.primary500 = '#1e40af'`) used by both Tailwind's CSS vars (via `index.css` `:root`) and the PPTX builder, keeping them in lockstep (vsizer's "Midnight Executive" pattern).
- For complex charts (treemap, heatmap): render the chart in the DOM, serialize the SVG to PNG via `html-to-image` or canvas, and embed as `addImage()`. Test at multiple zoom levels; SVG `<foreignObject>` content (CSS-styled HTML inside SVG) often doesn't survive this serialization, so charts must use pure SVG primitives (`<text>`, `<rect>`, not HTML divs styled with Tailwind).
- A "golden PPTX" snapshot test: build one with a known fixture, open with `python-pptx` in a CI step, assert text-box overflow, color, and slide count. This catches regressions without manual visual review.
- Total slide count budget: enforce a max (e.g., 80 slides) — beyond that, PowerPoint loads slowly on receivers' machines. Offer a "summary deck" mode that picks top-N clusters.

**Phase:** PPTX-export.

---

### Moderate-9: Chart library performance — re-render storms

**What goes wrong:** Recharts (and any naive React chart use) re-renders on every parent state change. Drop the cluster selector in the sidebar; the entire 40-chart dashboard re-renders. Frame rate tanks; the dark-mode toggle takes 800 ms. Worse: the chart library doesn't memo chart data, so unchanged data is reconciled every render.

**Warning signs:**
- React DevTools profiler shows charts re-rendering when unrelated state changes.
- Interaction latency on the inventory page > 100 ms.
- "Highlighted update" in DevTools flashes the entire chart grid on every keystroke in a filter input.

**Prevention (concrete):**
- Chart data passed to chart components is memoized with `useMemo` at the source (the selector hook), with stable reference equality. Zustand selectors must use `shallow` comparators where appropriate.
- Chart components wrapped in `React.memo` with a custom comparator (deep-equal on data, shallow on the rest).
- For dense datasets (treemap of all VMs in a 10k-VM estate), prefer a Canvas-based renderer (ECharts, Chart.js) or a Visx + offscreen-canvas approach over SVG. Recharts and SVG-based libraries degrade beyond a few thousand cells.
- A "chart budget" rule: if a single view renders > 12 charts, split into tabs.
- Library choice deferred to dedicated research, but evaluate explicitly on: treemap support, heatmap support, SVG export fidelity (for the HTML report), and React re-render cost. Candidate set: Recharts (familiar, limited), Apache ECharts (Canvas, fast, more setup), Visx (low-level, performant if you build the chart you need), nivo (pretty, slower SVG).

**Phase:** Performance + UI (charting library decision is a Phase 2 ADR).

---

### Moderate-10: DR sim trustworthiness — what makes the sim lie

**What goes wrong:** A DR sim that says "survivor capacity OK after losing the Paris site" while in reality vSphere HA admission control would refuse to power on half the VMs. The sim doesn't account for:
- **HA admission control reservations** (vSphere reserves capacity for restart; doesn't oversubscribe).
- **Memory reservations vs configured memory** (reserved memory must fit; configured can oversubscribe).
- **Stretched cluster split-brain** (when the witness is lost, neither side may run anything — depends on policy).
- **VM affinity / anti-affinity rules** (RVTools exposes `vRP` and `vCluster` rules; ignoring them yields a "passes capacity, fails policy" survivor set).
- **Per-VM HA restart priority** (low-priority VMs may not start at all post-failure; including them in capacity math is wrong).
- **License constraints** (e.g., Oracle per-core licensing forbidding migration to certain hosts — out of scope, but at least flag).

**Warning signs:**
- DR sim approves a scenario that the operator knows from experience would fail.
- No "assumptions" disclosure shown alongside the sim verdict.

**Prevention (concrete):**
- The DR sim explicitly carries an **assumptions panel**: a bullet list of what it modeled and what it didn't. The user agrees with the assumptions before the sim is "official."
- Sim output includes a `caveats` array; if memory reservation total exceeds 80% of survivor RAM (vs. configured), warn.
- Affinity/anti-affinity rules from `vRP`/`dvSwitch` sheets are parsed; if present, surface as "X anti-affinity rules detected — sim treats them as soft." Hard enforcement is a future enhancement.
- HA admission control config (if `vCluster` exposes it) is read; the sim's reservation matches it. Mismatch → warning.
- Powered-off VMs respected per Critical-6.
- Test: a synthetic cluster where capacity-only math says "survives" but reservation math says "fails"; assert the sim says "fails (memory reservations exceed survivor)".

**Phase:** DR-sim.

---

### Moderate-11: Datastore aggregation — same LUN counted twice

**What goes wrong:** Two clusters in the same vCenter share a datastore (common with shared SAN). RVTools `vDatastore` lists the datastore once. RVTools `vDisk` lists every VMDK pointing to that datastore. A naive "sum of VMDKs" computes 2× the actual datastore consumption. Or: across multiple vCenters that mount the same datastore (rare but real — cross-vCenter linked-mode storage), the datastore appears in two workbooks.

**Warning signs:**
- Total VMDK size > total datastore capacity (impossible — must be double-counting).
- Two datastores with the same NAA / UUID / URL appear after multi-vCenter merge.

**Prevention (concrete):**
- Datastore aggregation key: NAA/UUID (`Datastore URL` or `Address` in vDatastore), not name. Names can collide; NAAs cannot.
- VMDK→datastore mapping: each VMDK's `Path` is parsed for the datastore name (`[datastore_name] folder/file.vmdk`); the datastore name maps to the (vcenter_uuid, ds_uuid) canonical key.
- A sanity check at aggregation time: per-datastore, `sum(vmdk_provisioned) ≤ datastore_capacity * 10` (10× catches gross thin-provisioning, beyond that is a bug). If exceeded, log a warning to the in-app diagnostics panel.

**Phase:** Aggregation.

---

## Minor pitfalls

These won't ruin the report but will cost an afternoon if encountered cold.

---

### Minor-1: Trailing whitespace in identifiers

**What goes wrong:** Cluster name `"Cluster-Prod "` (trailing space) and `"Cluster-Prod"` parse as two distinct clusters; aggregation splits them.

**Prevention:** Every identifier-class field (cluster name, host name, VM name, datastore name, OS string, vCenter name) goes through `.trim()` in the Zod schema. `z.string().trim().min(1)`.

**Phase:** Parser.

---

### Minor-2: Multi-line cells

**What goes wrong:** A VM description or annotation contains `\n` (a multi-line cell in Excel). When the value flows into a PPTX text box or HTML `<td>`, it breaks layout or renders as a literal `\n` depending on serialization.

**Prevention:** A `oneLine(s)` helper: `s.replace(/\s+/g, ' ').trim()`. Apply at the display boundary (renderer/builder), not the schema — preserve original for export-as-CSV.

**Phase:** UI + Export.

---

### Minor-3: NULL / empty cell handling

**What goes wrong:** RVTools writes empty cells as `""`, `null`, or just an absent property depending on column. Zod with `z.number()` fails; `z.coerce.number()` silently converts `""` → `0` (a documented zod quirk), turning "missing memory data" into "0 GiB of memory" — a sneaky off-by-thousand error.

**Prevention:** Custom preprocessors per field: `z.preprocess(v => (v === '' || v == null) ? undefined : v, z.coerce.number().optional())`. Missing-data fields stay `undefined`, not `0`. Aggregation distinguishes "no data" from "zero."

**Phase:** Parser.

---

### Minor-4: Capitalization inconsistencies in OS strings

**What goes wrong:** `Microsoft Windows Server 2019` vs `microsoft windows server 2019` vs `MICROSOFT WINDOWS SERVER 2019`. Buckets split.

**Prevention:** OS normalizer lowercases for matching, preserves original for display. Already part of Moderate-6.

**Phase:** EOS.

---

### Minor-5: Ghost rows / hidden rows / RVTools-internal rows

**What goes wrong:** RVTools' "vMetaData" or summary rows at the top/bottom of some sheets look like data but aren't. Or: a hidden row inadvertently included.

**Prevention:** Parser skips rows where the primary identifier column is empty or matches known-internal markers (`/^Total/`, `/^Summary/`). Test fixture includes one such row.

**Phase:** Parser.

---

### Minor-6: Timestamp drift across snapshots loaded for trends

**What goes wrong:** User loads `2026-01.xlsx`, `2026-02.xlsx`, `2026-03.xlsx`. The trend X-axis shows three evenly-spaced points. In reality the workbooks were exported on 2026-01-31, 2026-02-15, and 2026-03-30 — non-uniform intervals. Trend slopes are misleading.

**Prevention:** Snapshot timestamp captured from each workbook (file mtime as fallback; export-timestamp metadata if RVTools writes it). Trend X-axis is *temporal*, not categorical. Surface the actual dates on hover.

**Phase:** Trends.

---

### Minor-7: i18n key drift FR ↔ EN

**What goes wrong:** A new feature ships with `en/dashboard.json` updated but `fr/dashboard.json` not. The FR UI silently shows the key name (`dashboard.cpuReadyTooltip`) instead of translated text. vsizer's CLAUDE.md notes this explicit risk: "untranslated keys produce silent fallthrough — there's no missing-key gate yet."

**Prevention:** A CI step that diffs the FR and EN key sets and fails on mismatch. The script is ~30 lines of node + JSON walking.

**Phase:** i18n (foundational).

---

### Minor-8: RTL safety (not a near-term concern but cheap to preempt)

**What goes wrong:** v1 ships FR + EN (both LTR). v2 wants AR or HE; layout breaks because of `mr-`/`ml-` Tailwind classes that hardcode direction.

**Prevention:** Use logical-property utilities (`ms-`, `me-`, `ps-`, `pe-`) where they exist in Tailwind v4; or accept the technical debt explicitly in an ADR. Not blocking for v1.

**Phase:** Future (post-v1 i18n expansion).

---

## Phase-specific warnings

A condensed cross-reference: which pitfalls bite each roadmap phase.

| Phase | Likely pitfalls | Mitigation summary |
|-------|----------------|--------------------|
| Parser | Critical-1, Critical-5, Moderate-1, Minor-1, Minor-3, Minor-5 | Inherit MB-as-MiB ADR; ship Web Worker on day one; alias dictionary for columns; preprocessors for empty cells |
| Aggregation | Critical-3, Critical-4, Critical-6, Moderate-4, Moderate-5, Moderate-11 | Per-site stretched math; (vcenter_uuid, moref) keys; configured/active accounting modes; physical-core ratios; branded GHz type; NAA-keyed datastore |
| EOS | Moderate-6, Minor-4 | OS normalizer regex bank; JSON catalogue with `lastVerified`; "overdue" bucket; unknown-OS surfaced |
| DR-sim | Critical-3, Moderate-10 | Assumptions panel; reservations math (not just capacity); confidence levels per cluster |
| Trends | Moderate-1, Minor-6 | Per-snapshot RVTools version surfaced; temporal X-axis |
| HTML-export | Moderate-2, Moderate-7 | Single-file invariant; subset self-hosted fonts; CSP meta tag; inline SVG charts; anchor namespacing per snapshot |
| PPTX-export | Moderate-2, Moderate-8 | `pptxText` wrapper; locale-aware pre-formatting; control-char stripping; golden snapshot CI test |
| i18n | Moderate-2, Minor-7 | Centralized formatters; U+202F handling; CI key-diff gate |
| Performance | Critical-5, Moderate-9 | Web Worker parsing; dense mode; chart memoization; Canvas for large datasets |
| Privacy | Critical-2 | Runtime fetch/XHR/WS/Beacon guard; CSP `connect-src 'self'`; CI denylist on telemetry packages; no source-map upload |

---

## Sources

### VMware / RVTools

- [VMware ESXi end-of-life dates](https://endoflife.date/esxi) — HIGH (verified: ESXi 7.0 EoS 2025-10-02, ESXi 8.0 EoS 2027-10-11)
- [RVTools release notes (vInfrastructure)](https://vinfrastructure.it/2020/05/rvtools-version-4-0/) — MEDIUM (column changes across 3.7→4.0)
- [Demystifying CPU Ready (%RDY) — ActualTech](https://www.actualtechmedia.com/wp-content/uploads/2013/11/demystifying-cpu-ready.pdf) — HIGH (per-vCPU summation interpretation)
- [vSphere HA Admission Control — Broadcom](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-availability/creating-and-using-vsphere-ha-clusters/vsphere-ha-admission-control.html) — HIGH (50% reservation for symmetric stretched)
- [vSphere HA settings for vSAN Stretched Cluster — Cormac Hogan](https://cormachogan.com/2015/09/16/vsphere-ha-settings-for-vsan-stretched-cluster/) — MEDIUM
- [Nutanix Sizing — RVTools powered-off VM handling](https://sizing-workshop.readthedocs.io/en/latest/datacollection/rvtools/rvtools.html) — HIGH (explicitly documents the powered-off trap)
- [vCPU/pCPU ratio guidelines — VMware blog 2025](https://blogs.vmware.com/cloud-foundation/2025/06/04/vcpu-to-pcpu-ratio-guidelines/) — HIGH (physical-core basis, not threads)
- [vCPU and logical CPU sizing with Hyper-Threading — VMwarebits](https://vmwarebits.com/content/vcpu-and-logical-cpu-sizing-hyper-threading-explained) — MEDIUM

### OS lifecycle

- [Red Hat Enterprise Linux lifecycle](https://access.redhat.com/support/policy/updates/errata) — HIGH (RHEL 7 EoS 2024-06-30, RHEL 8.10 maintenance 2029-05-31)
- [Windows Server lifecycle — Microsoft Learn](https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2025) — HIGH
- [Windows Server end-of-life — Lansweeper](https://www.lansweeper.com/blog/eol/windows-server-end-of-life/) — MEDIUM (consolidated reference)

### Web / library

- [SheetJS — Web Workers demo](https://docs.sheetjs.com/docs/demos/bigdata/worker/) — HIGH (recommended approach for large files)
- [SheetJS — Large Datasets / dense mode](https://docs.sheetjs.com/docs/demos/bigdata/stream/) — HIGH
- [pptxgenjs — autoFit issue #312](https://github.com/gitbrent/PptxGenJS/issues/312) — HIGH (autoFit behavior)
- [pptxgenjs — Shrink text in PowerPoint #544](https://github.com/gitbrent/PptxGenJS/issues/544) — MEDIUM
- [Intl.NumberFormat — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — HIGH
- [W3C i18n — number formatting](https://w3c.github.io/i18n-drafts/questions/qa-number-format.en.html) — HIGH (U+202F NNBSP confirmed)
- [Sentry — Scrubbing Sensitive Data](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/) — HIGH (`beforeSend` pattern)
- [CSP font-src directive — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/font-src) — HIGH
- [LogRocket — React chart library comparison](https://blog.logrocket.com/best-react-chart-libraries-2025/) — MEDIUM

### Internal (project)

- `/Users/fjacquet/Projects/rvtui/.planning/PROJECT.md` — vatlas scope and invariants
- `/Users/fjacquet/Projects/vsizer/CLAUDE.md` — sibling project conventions and ADR references
- `/Users/fjacquet/Projects/store-predict/docs/adr/017-rvtools-mb-as-mib.md` — ADR to inherit (Critical-1)
