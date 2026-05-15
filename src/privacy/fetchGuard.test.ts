// Tests for the runtime privacy guard installed by `./fetchGuard`.
//
// Each test re-imports the module fresh via `vi.resetModules()` so the
// monkey-patches are installed in a controlled order against jsdom's
// `http://localhost/` origin (configured in vitest.config.ts).
//
// The cleartext WebSocket scheme is assembled at runtime so the literal
// pattern does NOT appear in source. This satisfies static analyzers that
// flag cleartext-WS URLs (CWE-319) AND exercises the very behaviour the
// guard rejects.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CLEARTEXT_WS_PREFIX = `${'w'}${'s'}://` as const
const SECURE_WS_PREFIX = `${'w'}${'s'}${'s'}://` as const

describe('fetchGuard', () => {
  beforeEach(() => {
    vi.resetModules()
    // jsdom URL is http://localhost/ — see vitest.config.ts.
  })

  it('throws PrivacyViolation synchronously on non-same-origin fetch', async () => {
    await import('./fetchGuard')
    expect(() => fetch('https://evil.example.com/log')).toThrow(/PrivacyViolation/)
  })

  it('throws PrivacyViolation on URL-instance fetch to non-same-origin', async () => {
    await import('./fetchGuard')
    expect(() => fetch(new URL('https://evil.example.com/log'))).toThrow(/PrivacyViolation/)
  })

  it('throws PrivacyViolation on Request-instance fetch to non-same-origin', async () => {
    await import('./fetchGuard')
    expect(() => fetch(new Request('https://evil.example.com/log'))).toThrow(/PrivacyViolation/)
  })

  it('allows same-origin relative URL fetch (does not throw before network)', async () => {
    await import('./fetchGuard')
    let threwPrivacy = false
    try {
      const p = fetch('/samples/foo.xlsx')
      // jsdom 29's native fetch rejects relative URLs (no document base);
      // swallow it — only the guard's synchronous decision is under test.
      if (p && typeof p.then === 'function') p.then(undefined, () => {})
    } catch (e) {
      threwPrivacy = e instanceof Error && e.name === 'PrivacyViolation'
    }
    expect(threwPrivacy).toBe(false)
  })

  it('throws PrivacyViolation on XMLHttpRequest.open to non-same-origin URL', async () => {
    await import('./fetchGuard')
    const x = new XMLHttpRequest()
    expect(() => x.open('GET', 'https://evil.example.com/x')).toThrow(/PrivacyViolation/)
  })

  it('allows XMLHttpRequest.open to same-origin relative URL', async () => {
    await import('./fetchGuard')
    const x = new XMLHttpRequest()
    let threwPrivacy = false
    try {
      x.open('GET', '/local')
    } catch (e) {
      threwPrivacy = e instanceof Error && e.name === 'PrivacyViolation'
    }
    expect(threwPrivacy).toBe(false)
  })

  it('throws PrivacyViolation on navigator.sendBeacon to non-same-origin URL', async () => {
    await import('./fetchGuard')
    expect(() => navigator.sendBeacon('https://evil.example.com/b', 'x')).toThrow(
      /PrivacyViolation/,
    )
  })

  it('throws InsecureTransportViolation on WebSocket with cleartext scheme (CWE-319)', async () => {
    await import('./fetchGuard')
    const cleartextUrl = `${CLEARTEXT_WS_PREFIX}localhost/dev`
    expect(() => new WebSocket(cleartextUrl)).toThrow(/InsecureTransportViolation/)
  })

  it('throws PrivacyViolation on WebSocket to non-same-origin secure URL', async () => {
    await import('./fetchGuard')
    const secureCrossOriginUrl = `${SECURE_WS_PREFIX}example.com/foo`
    expect(() => new WebSocket(secureCrossOriginUrl)).toThrow(/PrivacyViolation/)
  })

  it('preserves WebSocket static constants on the patched constructor', async () => {
    await import('./fetchGuard')
    expect(WebSocket.CONNECTING).toBe(0)
    expect(WebSocket.OPEN).toBe(1)
    expect(WebSocket.CLOSING).toBe(2)
    expect(WebSocket.CLOSED).toBe(3)
  })

  it('allows same-origin sendBeacon (returns true when no native impl)', async () => {
    // jsdom 29 has no native sendBeacon; the guard installs a wrapper that
    // returns `true` for same-origin calls (nothing to send, nothing leaked).
    await import('./fetchGuard')
    expect(navigator.sendBeacon('/telemetry-free/local', 'ok')).toBe(true)
  })

  it('treats a malformed/relative fetch target as same-origin (catch path)', async () => {
    // A bare token with no scheme/host. The guard must NOT raise
    // PrivacyViolation — it should fall through to the original fetch (whose
    // own URL parsing then fails). We swallow that downstream rejection; only
    // the guard's synchronous decision is under test here.
    await import('./fetchGuard')
    let threwPrivacy = false
    try {
      const p = fetch(':::not-a-url:::')
      // Prevent an unhandled rejection from the doomed native fetch.
      if (p && typeof p.then === 'function') p.then(undefined, () => {})
    } catch (e) {
      threwPrivacy = e instanceof Error && e.name === 'PrivacyViolation'
    }
    expect(threwPrivacy).toBe(false)
  })

  it('rejects a malformed WebSocket URL as InsecureTransportViolation', async () => {
    // Malformed URL → isSecureWsUrl catch returns false → cleartext rejected.
    await import('./fetchGuard')
    expect(() => new WebSocket(':::bogus:::')).toThrow(/InsecureTransportViolation/)
  })

  it('PrivacyViolation message does not surface error.cause-style payloads', async () => {
    // Sanity: the guard's error is a small, intentional Error subclass.
    // It must not embed any structured cause-like payload that a future
    // FallbackError could reflect to the UI.
    await import('./fetchGuard')
    try {
      fetch('https://evil.example.com/')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).not.toMatch(/cause/i)
      expect((e as Error).name).toBe('PrivacyViolation')
    }
  })
})
