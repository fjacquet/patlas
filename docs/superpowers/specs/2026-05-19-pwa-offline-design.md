# vatlas → Installable, Fully-Offline PWA

- **Date:** 2026-05-19
- **Status:** Approved (design); pending implementation plan
- **Scope:** Add a Progressive Web App layer to vatlas: installable + works with zero network, without breaching the privacy invariant or data-lifetime model.

## Goal

vatlas opens and runs with **no network at all**. App shell, JS/CSS chunks, fonts,
`favicon.svg`, `theme-init.js`, and the bundled EOS dataset are served from a
service-worker precache. Installability (standalone window, home-screen/desktop
icon) falls out of the same work and is in scope as a side effect.

Non-goals: runtime caching of any cross-origin resource (none exist), background
sync, push notifications, offline persistence of dataset rows (forbidden by the
privacy invariant), a separate single-file portable build.

## Constraints (binding)

- **Privacy invariant (ADR-0001/0004):** no dataset rows persisted anywhere; the
  service worker may cache **only static build assets**, never workbook-derived
  data. Refresh-equals-data-gone remains true.
- **Runtime network guard:** any non-same-origin `fetch`/`XHR`/`WS`/`sendBeacon`
  throws synchronously. The SW, its registration, the webmanifest, icons, and
  every precached asset are **same-origin under `/vatlas/`**, so the guard is
  never engaged. The design introduces zero cross-origin traffic.
- **CSP:** `index.html` ships a strict CSP meta tag. Service workers fall under
  `worker-src 'self'` (already present). `manifest-src` has no explicit
  directive and therefore inherits `default-src 'self'`; icons are same-origin
  under `img-src 'self'`. Expectation: **no CSP change required.** This is
  verified empirically during implementation, not assumed.
- **Base path:** Vite `base` is `/vatlas/` (GitHub Pages). The PWA `scope` and
  `start_url` must be `/vatlas/`; Workbox derives this from the Vite base.
- **Supply chain:** `scripts/check-supply-chain.mjs` must still pass. New dev
  dependencies (`vite-plugin-pwa` and its Workbox tree) carry no telemetry; the
  plan runs the gate to confirm no false-positive and no `xlsx` pin drift.
- **Engineering principles:** KISS/DRY/functional. No new runtime abstraction;
  the only app-code addition is a small registration module with the update
  policy.

## Architecture

`vite-plugin-pwa` (Workbox) is added as a **dev dependency** and registered in
`vite.config.ts`. At build time it:

1. **Precache manifest** — Workbox enumerates every hashed asset Vite emits
   (JS chunks incl. the manual vendor chunks, CSS, fonts, `favicon.svg`,
   `theme-init.js`, the bundled EOS dataset JSON) and precaches them
   cache-first. Result: a cold load with the network fully offline renders the
   full app shell.
2. **`manifest.webmanifest`** — `name` "vAtlas", `short_name` "vAtlas",
   `description` reused from the existing `<meta name=description>`,
   `display: standalone`, `scope` and `start_url` = `/vatlas/`,
   `theme_color`/`background_color` from the Midnight Executive palette tokens,
   maskable + standard icons derived from the existing brand SVG.
3. **`sw.js` + registration glue** — emitted same-origin under `/vatlas/`.

No `runtimeCaching` rules. No remote navigation fallback. The SW's entire world
is the same-origin precache.

## Update policy — smart auto-update

The naïve "auto-update + reload" conflicts with `refresh = data gone`: a
background deploy could silently destroy a loaded estate and unsaved report.
The accepted policy gates the reload on whether work is in progress:

- **Snapshot store empty** (landing page, nothing loaded): full auto-update —
  `skipWaiting` + `clientsClaim` + automatic reload. Always fresh, zero
  friction. This is the overwhelming common case.
- **Snapshot store has data**: the new SW installs and **waits**. A single
  non-blocking `sonner` toast ("New version ready — reload to apply") lets the
  user reload when they choose. No silent data loss.

Implementation shape: the plugin uses a prompt-style registration
(`registerType: 'prompt'`); a small registration module subscribes to the
"need refresh" event, reads the snapshot store's loaded-count selector, and
either calls `updateSW(true)` immediately (store empty) or raises the toast
(store non-empty). `sonner`'s `<Toaster />` is already mounted at the root —
no new runtime dependency.

## Components / files touched

- `package.json` — add `vite-plugin-pwa` (+ transitive Workbox) to
  `devDependencies`.
- `vite.config.ts` — register `VitePWA({ registerType: 'prompt', manifest,
  workbox: { ... } })`; keep existing `base`, `manualChunks`, aliases intact.
- `src/` — one new small module (e.g. `src/pwa/registerSW.ts`) holding the
  smart-auto-update logic; imported once from the app entry. No engine, store,
  or `useEstateView` changes.
- Icon assets under `public/` (or generated) — maskable + any-purpose icons
  from the existing brand mark.
- Tests — unit test for the update-policy decision function (store-empty →
  immediate update; store-non-empty → toast path), pure and store-mockable.
- Docs — ADR note that the SW caches static assets only (privacy boundary
  restated); `CLAUDE.md` Gotchas/Commands updated if a new script is added.

## Data flow

Build: Vite emits hashed assets → Workbox writes precache manifest into `sw.js`.
Runtime first visit: app loads from network, SW installs, precaches assets.
Subsequent visits / offline: SW serves all assets cache-first; app boots with no
network. New deploy: new `sw.js` detected → smart-auto-update decision → reload
now (store empty) or toast (store non-empty). Workbook data: never touches the
SW or any cache, ever.

## Error handling

- SW registration failure (unsupported browser, blocked): app continues to work
  exactly as today (online-only). Registration is best-effort and non-fatal.
- Precache miss while offline: only possible if assets were never cached (first
  visit was offline) — app shows its normal load failure, same as today.
- Update toast dismissed: old version keeps running; the new SW applies on the
  next natural full reload. No forced state loss.

## Testing strategy

- **Unit:** the update-policy decision is a pure function over a loaded-count
  input — assert both branches. Gate under existing coverage rules.
- **Build assertion:** a check that `sw.js` and `manifest.webmanifest` are
  emitted into the build output and the manifest `scope`/`start_url` are
  `/vatlas/`.
- **Supply chain:** `npm run check:supply-chain` passes with the new dev deps.
- **Manual/Playwright (offline):** load app, go offline, hard-reload, confirm
  full render; confirm install prompt eligibility (manifest + SW criteria).

## Open questions

None blocking. Icon source asset detail (reuse `favicon.svg` vs a dedicated
maskable variant) is resolved during implementation.
