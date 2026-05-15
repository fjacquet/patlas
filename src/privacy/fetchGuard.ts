// Runtime privacy/transport guard. Side-effect module — NO exports.
//
//   import './privacy/fetchGuard'
//
// MUST be the FIRST import in src/main.tsx and the FIRST executable line of
// any Web Worker entry point (Plan 04's src/engines/parser/parser.worker.ts).
// It must run before any other module captures a reference to `fetch`,
// `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon`.
//
// On import it installs wrappers that throw SYNCHRONOUSLY, before any network
// operation, on:
//   - PrivacyViolation           — non-same-origin URL on fetch/XHR/sendBeacon/WebSocket
//   - InsecureTransportViolation — non-`wss:` WebSocket scheme (CWE-319)
//
// `sameOrigin` semantics:
//   - same scheme + host + port as globalThis.location.origin
//   - relative URLs (no scheme/host) are treated as same-origin
//   - malformed URLs are treated as same-origin (let downstream parse fail)
//
// Rationale: docs/adr/0001-privacy-invariant.md. A loud throw is detectable;
// a silent block is not — see RESEARCH.md Pattern 9.

class PrivacyViolation extends Error {
  constructor(api: string, target: string) {
    super(`PrivacyViolation: ${api} attempted to reach non-same-origin URL ${target}`)
    this.name = 'PrivacyViolation'
  }
}

class InsecureTransportViolation extends Error {
  constructor(api: string, target: string) {
    super(`InsecureTransportViolation: ${api} attempted a cleartext connection to ${target}`)
    this.name = 'InsecureTransportViolation'
  }
}

const SECURE_WS_SCHEME = 'wss:' as const

const currentOrigin = (): string | undefined =>
  globalThis.location?.origin ?? (globalThis as { origin?: string }).origin

const sameOrigin = (target: string | URL): boolean => {
  try {
    const u = typeof target === 'string' ? new URL(target, globalThis.location?.href) : target
    const origin = currentOrigin()
    if (!origin) return false
    return u.origin === origin
  } catch {
    // Relative or malformed URL: no scheme/host means the current document —
    // treat as same-origin and let downstream parsing fail naturally.
    return true
  }
}

const isSecureWsUrl = (target: string | URL): boolean => {
  try {
    const u = typeof target === 'string' ? new URL(target, globalThis.location?.href) : target
    return u.protocol === SECURE_WS_SCHEME
  } catch {
    return false
  }
}

// Idempotency: a module-scoped flag. A second `import` of the SAME module
// instance is a no-op. Tests re-import via `vi.resetModules()`, which yields a
// fresh module instance (flag reset to false) against a fresh jsdom global —
// so each test re-installs the wrappers on pristine globals.
let installed = false

if (!installed) {
  installed = true

  // 1. fetch
  const originalFetch = globalThis.fetch
  globalThis.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const target =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input
          : input instanceof Request
            ? input.url
            : ''
    if (!sameOrigin(target as string | URL)) {
      throw new PrivacyViolation('fetch', String(target))
    }
    // `fetch` is a free function (not a method); no receiver to forward.
    return originalFetch(input, init)
  } as typeof fetch

  // 2. XMLHttpRequest
  if (typeof XMLHttpRequest !== 'undefined') {
    const origOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      pw?: string | null,
    ): void {
      if (!sameOrigin(url)) throw new PrivacyViolation('XMLHttpRequest', String(url))
      origOpen.apply(this, [method, url, async ?? true, user ?? null, pw ?? null])
    } as XMLHttpRequest['open']
  }

  // 3. navigator.sendBeacon
  //    Some environments (jsdom 29) do not implement sendBeacon natively. The
  //    guard's job is to BLOCK cross-origin beacons; it does not require a
  //    native implementation to do that. When a native impl exists we delegate
  //    to it for same-origin calls; otherwise same-origin is a no-op `true`
  //    (there is nothing to send through and nothing to leak).
  if (typeof navigator !== 'undefined') {
    const nativeBeacon =
      'sendBeacon' in navigator && typeof navigator.sendBeacon === 'function'
        ? navigator.sendBeacon.bind(navigator)
        : null
    const patchedBeacon = function patchedBeacon(
      url: string | URL,
      data?: BodyInit | null,
    ): boolean {
      if (!sameOrigin(url)) throw new PrivacyViolation('sendBeacon', String(url))
      return nativeBeacon ? nativeBeacon(url, data ?? null) : true
    } as Navigator['sendBeacon']
    Object.defineProperty(navigator, 'sendBeacon', {
      value: patchedBeacon,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  // 4. WebSocket — same-origin AND wss-only (CWE-319 mitigation).
  //    Vite dev HMR uses its own internal runtime, not globalThis.WebSocket,
  //    so the guard never intercepts HMR.
  if (typeof WebSocket !== 'undefined') {
    const OriginalWebSocket = WebSocket
    const PatchedWebSocket = function PatchedWebSocket(
      url: string | URL,
      protocols?: string | string[],
    ) {
      // Transport-security check FIRST: a cleartext `ws:` URL must always be
      // rejected with InsecureTransportViolation (CWE-319), even when it
      // points at a same-host dev port — `ws://localhost` and
      // `http://localhost` are different origins, so an origin-first ordering
      // would mis-report a cleartext localhost socket as a PrivacyViolation.
      if (!isSecureWsUrl(url)) throw new InsecureTransportViolation('WebSocket', String(url))
      if (!sameOrigin(url)) throw new PrivacyViolation('WebSocket', String(url))
      return new OriginalWebSocket(url, protocols)
    } as unknown as typeof WebSocket
    // Preserve static constants (CONNECTING / OPEN / CLOSING / CLOSED) as the
    // patched constructor's OWN enumerable properties. Defining them as own
    // properties (rather than relying on prototype inheritance) keeps
    // `WebSocket.OPEN` resolvable even though the spec exposes them as
    // non-writable on the original constructor.
    Object.setPrototypeOf(PatchedWebSocket, OriginalWebSocket)
    for (const key of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'] as const) {
      Object.defineProperty(PatchedWebSocket, key, {
        value: OriginalWebSocket[key],
        writable: false,
        enumerable: true,
        configurable: true,
      })
    }
    globalThis.WebSocket = PatchedWebSocket
  }
}
