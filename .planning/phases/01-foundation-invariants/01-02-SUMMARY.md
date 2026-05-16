---
phase: 01-foundation-invariants
plan: 02
subsystem: privacy
tags: [privacy, security, csp, supply-chain, monkey-patch, cwe-319, tdd, vitest]

requires:
  - phase: 01-foundation-invariants
    plan: 01
    provides: "deployable shell; src/main.tsx privacy-guard import slot; biome noConsole; CI workflow"
provides:
  - "src/privacy/fetchGuard.ts — side-effect runtime guard (no exports)"
  - "PrivacyViolation thrown synchronously on non-same-origin fetch/XHR/sendBeacon/WebSocket"
  - "InsecureTransportViolation thrown on any non-wss WebSocket scheme (CWE-319)"
  - "fetchGuard wired as the FIRST import of src/main.tsx"
  - "index.html CSP meta: connect-src 'self' + full directive set"
  - "scripts/check-supply-chain.mjs — telemetry denylist + SheetJS pin gate"
  - "npm scripts check:supply-chain + prebuild"
  - "CI runs supply-chain check BEFORE npm ci"
  - "docs/adr/0001-privacy-invariant.md (Nygard)"
affects: [01-04-parser, 01-05-snapshot-store]

tech-stack:
  added: []
  patterns:
    - "Side-effect-only privacy module imported first in every entry point"
    - "WebSocket transport-security check ordered BEFORE origin check so cleartext is always InsecureTransportViolation"
    - "Single folded supply-chain script (KISS — 01-PATTERNS.md L613) over two split scripts"
    - "CI denylist gate placed before npm ci so a tainted package.json never installs"

key-files:
  created:
    - "src/privacy/fetchGuard.ts"
    - "src/privacy/fetchGuard.test.ts"
    - "scripts/check-supply-chain.mjs"
    - "docs/adr/0001-privacy-invariant.md"
  modified:
    - "src/main.tsx (fetchGuard now FIRST import)"
    - "index.html (CSP meta tag)"
    - "package.json (check:supply-chain + prebuild scripts)"
    - ".github/workflows/static.yml (supply-chain step before npm ci)"

decisions:
  - "Folded telemetry-denylist + SheetJS-pin into ONE scripts/check-supply-chain.mjs (plan/PATTERNS.md L613 KISS) instead of the two separate scripts named in critical_reminders — the PLAN.md is authoritative and explicitly directs the fold."
  - "WebSocket guard checks transport security (wss-only) BEFORE same-origin so a cleartext ws://localhost dev socket reports InsecureTransportViolation, not a mislabelled PrivacyViolation (ws://localhost and http://localhost are different origins)."
  - "sendBeacon guard installs even when jsdom lacks a native impl; same-origin calls return true (nothing to send, nothing leaked) — needed so the cross-origin throw is testable under jsdom 29."
  - "parser.worker.ts NOT pre-created — plan 01-02 owns only the contract for plan 01-04 (documented below). Option (b) of the critical_reminders chosen because the PLAN.md task body explicitly says 'We do NOT pre-create the file here'."
  - "fetch wrapper drops the receiver (fetch is a free function); XHR.open wrapper carries an explicit `this: XMLHttpRequest` — tsc -b under tsconfig.app.json is stricter than tsc --noEmit (noImplicitThis)."

metrics:
  duration: 24min
  tasks: 3
  files_created: 4
  files_modified: 4
  completed: 2026-05-15
---

# Phase 01 Plan 02: Privacy Guard Layer Summary

**Three-layer privacy invariant — a side-effect runtime monkey-patch that throws synchronously on any non-same-origin fetch/XHR/sendBeacon/WebSocket and on any cleartext WebSocket (CWE-319), a `connect-src 'self'` CSP meta tag, and a CI supply-chain gate banning telemetry SDKs and verifying the SheetJS pin — all wired before any business code runs.**

## Performance

- **Duration:** ~24 min
- **Tasks:** 3 (Task 1 split into RED + GREEN TDD commits)
- **Files created:** 4 · **Files modified:** 4

## Task Commits

1. **Task 1 RED** — `086d266` `test(01-02)` — `src/privacy/fetchGuard.test.ts` (11 failing tests).
2. **Task 1 GREEN** — `627152f` `feat(01-02)` — `src/privacy/fetchGuard.ts` (side-effect guard, no exports). 11/11 pass; semgrep 0 findings.
3. **Task 2** — `ed5d37f` `feat(01-02)` — `src/main.tsx` (fetchGuard FIRST import), `index.html` (CSP meta), `fetchGuard.ts` (`this`-typing Rule 3 fix). Build green, dev server boots clean.
4. **Task 3** — `9f6b1bd` `feat(01-02)` — `scripts/check-supply-chain.mjs`, `package.json`, `.github/workflows/static.yml`, `docs/adr/0001-privacy-invariant.md`, +3 branch-coverage tests. Negative tests verified; semgrep 0 findings.

## Verification (plan acceptance block — all 8)

1. No exports in `fetchGuard.ts` — OK
2. fetchGuard is the first import of `src/main.tsx` — OK
3. CSP carries `connect-src 'self'`, `worker-src 'self' blob:`, `frame-src 'none'`, `base-uri 'self'`, `form-action 'none'` — OK
4. `npm run check:supply-chain` exits 0 — OK; `@sentry/browser` → exit 1, xlsx `0.18.5` → exit 1 (both verified)
5. `awk '/Check supply chain/,/npm ci/' .github/workflows/static.yml | grep -q "npm ci"` — OK (check at line 35, `npm ci` at line 38)
6. ADR-0001 references PrivacyViolation, InsecureTransportViolation, CWE-319, `connect-src 'self'` — OK
7. Coverage `src/privacy/fetchGuard.ts`: **93.87% lines, 92.59% stmts, 100% funcs, 78.26% branches** — ≥75% line target met; global branch threshold cleared
8. `npm run typecheck && npm run lint && npm run test:run && npm run build` — all exit 0 (20 tests pass; build's `prebuild` hook runs `check-supply-chain: OK`)

## Required SUMMARY items (from plan <output>)

- **`npm run dev` HMR under CSP + guard:** Dev server boots cleanly in ~210 ms at `http://localhost:5173/vatlas/` with the CSP meta and runtime guard active, no console/CSP errors. Interactive browser HMR-roundtrip was not exercised (autonomous run, no browser). Per 01-RESEARCH.md A2, Vite's HMR uses its own internal runtime (not `globalThis.WebSocket`), so the guard never intercepts it — the guard only fires on application-code `new WebSocket(url)` calls. No `vite.config.ts` dev-CSP fallback was needed.
- **`worker-src 'self' blob:` sufficiency:** No hello-world Worker was instantiated during this plan (plan 01-04 owns the real `parser.worker.ts`). The directive is present in the CSP for plan 01-04 to validate against. The production build emits the CSP into `dist/index.html` (1 occurrence) and builds clean.
- **Final forbidden patterns in `scripts/check-supply-chain.mjs`:** `@sentry/`, `posthog-`, `@posthog/`, `posthog`, `@amplitude/`, `amplitude-`, `mixpanel`, `@datadog/`, `logrocket`, `@bugsnag/`, `heap-analytics`, `segment-analytics`, `@segment/`, `fullstory`, `@fullstory/`, `@hotjar/`, `hotjar` — plus a `service-worker` substring guard (PITFALLS.md Critical-2) and the exact SheetJS tarball pin check.
- **CI insertion line:** The supply-chain step is at **line 34–35** of `.github/workflows/static.yml** (`- name: Check supply chain ...` / `run: node scripts/check-supply-chain.mjs`), directly before`- name: Install dependencies` / `run: npm ci` at lines 37–38. Plan 04 can add a worker-bundle-size budget step nearby (after `Build`, line ~89).
- **Contract for Plan 04:** `src/engines/parser/parser.worker.ts` MUST have `import '../../privacy/fetchGuard'` as its first executable line (after any `/// <reference lib="webworker" />` pragma if used). The worker has its own global scope, so the main-thread patch in `src/main.tsx` does NOT cover it. The guard module is side-effect-only — import for effect, no symbols to bind.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tsc -b` stricter than `tsc --noEmit` — implicit-any `this`**

- **Found during:** Task 2 (`npm run build`).
- **Issue:** `npm run typecheck` (`tsc --noEmit`, root tsconfig) passed, but `npm run build` (`tsc -b`, `tsconfig.app.json`) flagged TS2683 implicit-any `this` on the fetch + XHR.open wrappers.
- **Fix:** Dropped the unneeded receiver on the fetch wrapper (`fetch` is a free function — `originalFetch(input, init)`); added an explicit `this: XMLHttpRequest` parameter to the XHR.open wrapper.
- **Files modified:** `src/privacy/fetchGuard.ts`. **Commit:** `ed5d37f`.

**2. [Rule 3 - Blocking] jsdom 29 has no native `navigator.sendBeacon`**

- **Found during:** Task 1 GREEN.
- **Issue:** The plan's guard guarded `sendBeacon` behind `'sendBeacon' in navigator`; jsdom 29 has no native impl, so the wrapper was never installed and the cross-origin `sendBeacon` test failed with `navigator.sendBeacon is not a function`.
- **Fix:** Install the wrapper whenever `navigator` exists. Cross-origin still throws `PrivacyViolation`; same-origin delegates to a native impl when present, otherwise returns `true` (nothing to send, nothing leaked). Defined via `Object.defineProperty` since jsdom's `navigator.sendBeacon` is absent rather than writable.
- **Files modified:** `src/privacy/fetchGuard.ts`. **Commit:** `627152f`.

**3. [Rule 1 - Bug] WebSocket check ordering mislabelled cleartext localhost as PrivacyViolation**

- **Found during:** Task 1 GREEN.
- **Issue:** Plan behavior requires a cleartext `ws://localhost/dev` socket to throw `InsecureTransportViolation` "even when localhost is same-origin in dev". Origin-first ordering produced `PrivacyViolation` instead, because `ws://localhost` and jsdom's `http://localhost` are different origins.
- **Fix:** Run the transport-security (wss-only) check BEFORE the same-origin check in the WebSocket wrapper. Cleartext is now always `InsecureTransportViolation`, matching the plan's must-have truth and STRIDE T-02-02.
- **Files modified:** `src/privacy/fetchGuard.ts`. **Commit:** `627152f`.

**4. [Rule 1 - Bug] Unhandled rejection from doomed jsdom relative/invalid fetch in tests**

- **Found during:** Task 3 (`npm run test:run` after adding branch tests).
- **Issue:** jsdom 29's native `fetch` rejects relative/invalid URLs (no document base). The guard correctly let them through (no `PrivacyViolation`), but the resulting native rejection surfaced as an `Unhandled Rejection` in the test run (still 20/20 passing, but noisy and a hard-failure risk under stricter Vitest config).
- **Fix:** Swallow the doomed downstream promise (`p.then(undefined, () => {})`) in the relative/invalid-URL tests. The guard's synchronous decision remains the sole assertion.
- **Files modified:** `src/privacy/fetchGuard.test.ts`. **Commit:** `9f6b1bd`.

**5. [Rule 2 - Missing Critical] Branch coverage below global 75% threshold**

- **Found during:** Task 3 (coverage run).
- **Issue:** First coverage pass: 90.74% stmts / 69.56% branches. The 75% global branch threshold (vitest.config.ts) would fail a dedicated coverage run; the catch/fallback branches were untested.
- **Fix:** Added 3 targeted tests (same-origin sendBeacon return-true path, malformed fetch target catch path, malformed WebSocket URL → InsecureTransportViolation). Branch coverage 69.56% → 78.26%, lines → 93.87%.
- **Files modified:** `src/privacy/fetchGuard.test.ts`. **Commit:** `9f6b1bd`.

---

**Total deviations:** 5 auto-fixed (3 Rule 3 blocking, 2 Rule 1, 1 Rule 2 — overlap counted once). No Rule 4 architectural changes. No scope creep — every change stayed within the plan's `files_modified` list.

## Naming note (critical_reminders vs PLAN.md)

The orchestrator's `critical_reminders` named two separate scripts (`scripts/check-telemetry-denylist.mjs`, `scripts/check-sheetjs-pin.mjs`) and `npm run check:telemetry` / `npm run check:sheetjs`. The authoritative PLAN.md (and 01-PATTERNS.md L613 KISS guidance) explicitly directs a single folded `scripts/check-supply-chain.mjs` with `npm run check:supply-chain` + `prebuild`. The PLAN.md is the binding source for executors, so the fold was implemented. Both intended behaviors (telemetry denylist AND SheetJS pin) are present and independently verified by negative tests.

## Security Scan

`semgrep --config=auto` run on `src/privacy/` (378 rules, 2 files) and `scripts/` (368 rules) — **0 findings, 0 blocking** on both. semgrep MCP tool was not in the available tool set; the semgrep CLI (`/opt/homebrew/bin/semgrep`) was used per CLAUDE.md.

## Known Stubs

None introduced. `src/engines/parser/parser.worker.ts` is intentionally NOT created here — the plan assigns it to plan 01-04 with the FIRST-import contract documented above. This is a deliberate cross-plan handoff, not a stub.

## Self-Check

**Files claimed:**

- `src/privacy/fetchGuard.ts`: FOUND
- `src/privacy/fetchGuard.test.ts`: FOUND
- `scripts/check-supply-chain.mjs`: FOUND
- `docs/adr/0001-privacy-invariant.md`: FOUND
- `src/main.tsx` (fetchGuard first import): FOUND
- `index.html` (CSP meta): FOUND
- `package.json` (check:supply-chain + prebuild): FOUND
- `.github/workflows/static.yml` (check before npm ci): FOUND

**Commits claimed:**

- `086d266` (Task 1 RED): FOUND
- `627152f` (Task 1 GREEN): FOUND
- `ed5d37f` (Task 2): FOUND
- `9f6b1bd` (Task 3): FOUND

**Gates re-run at SUMMARY time:** typecheck exit 0; biome 29 files clean; test:run 20 passed; build green with `check-supply-chain: OK` prebuild; coverage 93.87% lines / 78.26% branches.

## Self-Check: PASSED

---
*Phase: 01-foundation-invariants*
*Completed: 2026-05-15*
