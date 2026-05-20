# ADR-0001: Privacy Invariant (100 % Client-Side, No Telemetry, No Persistence of Dataset Rows)

**Status:** Accepted
**Date:** 2026-05-15
**Phase:** 1 — Foundation & Invariants

## Context

vatlas is operator-facing tooling that ingests RVTools workbooks containing VM
names, hostnames, IP addresses, capacity plans, and other potentially sensitive
infrastructure inventory. The product invariant inherited from vsizer is that
no workbook content ever leaves the user's browser. Telemetry SDKs,
error-reporting SDKs, analytics, source-map upload pipelines, and persistent
storage (localStorage / IndexedDB / OPFS / service workers) all represent paths
by which workbook content could be exfiltrated — silently and in good faith —
by a dependency or a contributor.

## Decision

1. The runtime monkey-patches `globalThis.fetch`,
   `XMLHttpRequest.prototype.open`, `navigator.sendBeacon`, and
   `globalThis.WebSocket` (in `src/privacy/fetchGuard.ts`) to throw
   synchronously on any non-same-origin URL (`PrivacyViolation`) and on any
   cleartext WebSocket scheme — only `wss:` is accepted
   (`InsecureTransportViolation`, CWE-319). For WebSocket the transport-security
   check runs *before* the origin check, so a cleartext `ws://localhost:port`
   dev socket is reported as `InsecureTransportViolation`, not mislabelled as a
   cross-origin `PrivacyViolation`.
2. `index.html` carries
   `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'; ...">`
   as defense in depth. `connect-src 'self'` is the principal PRV-02 directive
   — the browser blocks any cross-origin connection before the runtime guard
   even runs.
3. A CI step `node scripts/check-supply-chain.mjs` denies all known telemetry
   SDKs (`@sentry/*`, `posthog-*`, `@amplitude/*`, `mixpanel*`, `@datadog/*`,
   `logrocket*`, `@bugsnag/*`, `@segment/*`, `fullstory*`, `@hotjar/*`, etc.)
   and verifies the SheetJS tarball pin. It runs *before* `npm ci` so a tainted
   `package.json` never installs in CI, and as a local `prebuild` hook.
4. The Zustand store holds no `persist` middleware. Only `vatlas-lang` (locale
   code) and `vatlas-theme` (theme preference) may write to `localStorage`. No
   `sessionStorage` / `IndexedDB` / `OPFS`. No service worker registration
   **except** under the Amendment (v2.0) envelope below — which is precache-only
   for static build assets and never touches dataset rows.
5. `FallbackError` reads only `error.message` and `error.name` — never
   `error.cause` (which may carry parsed rows).
6. The Biome `noConsole` rule is `error` in non-test files; `warn` and `error`
   levels remain allowed.
7. The parser worker imports the same fetch-guard at the top of
   `src/engines/parser/parser.worker.ts` (Plan 04 — workers have their own
   global scope, so the main-thread patch does not cover them).

## Rationale

A silent block (e.g. dropping the request on the floor) is hard to detect — a
contributor adds Sentry, sees no errors, ships. Throwing loudly means the next
call site stack-traces immediately and the error boundary surfaces. CSP
`connect-src 'self'` is browser-enforced and runs before the runtime guard; the
runtime guard catches what CSP cannot (e.g. a CSP-bypassing future browser bug)
and gives a clear stack trace on the developer's machine. The CI denylist
catches violations before code lands in `main`. The three layers — CSP, runtime
monkey-patch, CI denylist — are intentionally redundant.

## Alternatives Considered

- **Service worker as a network kill-switch.** Service workers are a privacy
  attack surface (they can register, intercept, and POST data). Forbidden
  outright in v1.0; permitted in v2.0 ONLY under the tightly-bounded Amendment
  envelope below (precache-only, same-origin, guard-first). See the rewritten
  PITFALLS.md Critical-2.
- **CSP only, no runtime guard.** CSP is reactive; a runtime guard surfaces
  violations at the developer's machine before they ever land in production.
- **Sentry with `beforeSend: () => null`.** Adds complexity, easy to
  misconfigure, the Sentry SDK still ships and could be activated by a future
  commit.

## Amendment (v2.0): Service-Worker Exception — Accepted

**Status:** Accepted · **Date:** 2026-05-19 · **Phase:** 12

v1.0 forbade service workers outright. v2.0 makes vatlas installable and fully
offline, which is impossible without a service worker. The objection in
"Alternatives Considered" is specific — *register, intercept, and POST data* —
and is neutralized by a tightly-bounded envelope rather than waived:

1. **Own code, not a black box.** `vite-plugin-pwa` is used in `injectManifest`
   strategy. The service worker is `src/sw.ts` — audited project code — never a
   generated `generateSW` bundle.
2. **Guard-first.** `src/sw.ts`'s FIRST executable statement is
   `import './privacy/fetchGuard'`. Workers have their own global scope (the
   main-thread monkey-patch and the page `<meta>` CSP do not reach a SW), so
   this extends the runtime guard into the SW scope exactly as Decision §7 does
   for the parser worker. Any non-same-origin fetch from the SW throws.
3. **Precache-only.** The SW uses `precacheAndRoute(self.__WB_MANIFEST)` and
   **no `runtimeCaching`**. It serves only the static, build-time, hashed asset
   manifest. No dynamic, opaque, or cross-origin response is ever cached.
   Workbook bytes / parsed rows never reach the SW or any cache.
4. **Same-origin only.** SW script, registration, `manifest.webmanifest`, and
   every precached asset are same-origin under `/vatlas/`. No new cross-origin
   traffic is introduced.
5. **Update safety.** A pending SW never silently reloads a loaded estate
   (would breach "refresh = data gone"): auto-reload only when the snapshot
   store is empty, otherwise a user-controlled toast (`registerType: 'prompt'`).
6. **CI enforcement.** `scripts/check-supply-chain.mjs` allowlists exactly
   `vite-plugin-pwa` + `workbox-*`, denies any other service-worker-named
   dependency, and — when `vite-plugin-pwa` is present — fails the build unless
   `src/sw.ts` exists and imports the privacy guard first. The three-layer model
   (CSP, runtime guard, CI denylist) is *extended into the SW*, not weakened.

This envelope is binding: any change that adds `runtimeCaching`, removes the
guard-first import, or caches a non-same-origin response re-opens the original
attack surface and is a violation, not a refinement.

## Consequences

- The runtime guard adds ~30 lines + ~200 bytes minified to the bundle.
  Acceptable cost.
- Vite dev-mode HMR uses a same-origin WebSocket via Vite's internal runtime
  (not `globalThis.WebSocket`); the guard does not intercept it
  (01-RESEARCH.md A2). Validated by booting `npm run dev` under the CSP +
  guard during plan 01-02 execution.
- Any future feature that legitimately needs a network call (e.g. loading the
  `endoflife.date` catalogue in Phase 5) must serve the data from the same
  origin (bundle it at build time or proxy it through GH Pages).
- Adding a telemetry-adjacent package requires the CI denylist to be updated
  AND ADR-0001 to be amended.
- The `wss:`-only WebSocket rule means any future feature using WebSockets must
  use a secure scheme even in dev (HTTPS-localhost can be set up with `mkcert`).
