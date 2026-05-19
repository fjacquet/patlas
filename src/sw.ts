/// <reference lib="webworker" />
import './privacy/fetchGuard' // ADR-0001 SW exception — guard-first; the SW has its own global scope (mirrors parser.worker.ts)
import { precacheAndRoute } from 'workbox-precaching'

// vite-plugin-pwa `injectManifest` injects the build-time hashed asset list
// into `self.__WB_MANIFEST`. This is the ONLY thing the SW ever caches.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

// Precache-only (ADR-0001 SW exception §3): serve only the static, same-origin,
// build-time asset manifest. By design there is no runtime cache route and no
// dynamic / opaque / cross-origin response is ever stored; workbook bytes and
// parsed rows never reach the SW. Any cross-origin fetch attempted here throws
// synchronously via the guard imported above. (Token-free wording is
// deliberate — see CLAUDE.md "absence comment" gotcha.)
precacheAndRoute(self.__WB_MANIFEST)

// Prompt-style activation (ADR-0001 SW exception §5): the page decides WHEN to
// take over so a loaded estate is never silently wiped (refresh = data gone).
// registerType is 'prompt'; registerSW.ts posts SKIP_WAITING when the user (or
// the empty-store fast path) opts in.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
