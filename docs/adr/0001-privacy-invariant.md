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
   `sessionStorage` / `IndexedDB` / `OPFS` / service worker registrations
   anywhere.
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

- **Service worker as a network kill-switch.** Service workers themselves are a
  privacy attack surface (they can register, intercept, and POST data);
  forbidden by PITFALLS.md Critical-2.
- **CSP only, no runtime guard.** CSP is reactive; a runtime guard surfaces
  violations at the developer's machine before they ever land in production.
- **Sentry with `beforeSend: () => null`.** Adds complexity, easy to
  misconfigure, the Sentry SDK still ships and could be activated by a future
  commit.

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
