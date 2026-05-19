import { describe, expect, it } from 'vitest'
import { evaluateSupplyChain, REQUIRED_XLSX_PIN } from '../scripts/check-supply-chain.mjs'

const CLEAN_PKG = {
  dependencies: { react: '^19.2.6', xlsx: REQUIRED_XLSX_PIN },
  devDependencies: { vitest: '^4.1.2' },
}

const GUARD_FIRST = `import './privacy/fetchGuard'\nimport { precacheAndRoute } from 'workbox-precaching'\n`
const GUARD_FIRST_WITH_COMMENTS = `// SW entry — ADR-0001 exception\n/* block\n   comment */\n\nimport './privacy/fetchGuard'\nimport { precacheAndRoute } from 'workbox-precaching'\n`
const GUARD_NOT_FIRST = `import { precacheAndRoute } from 'workbox-precaching'\nimport './privacy/fetchGuard'\n`
// Established worker convention: webworker ref + guard import with trailing comment.
const GUARD_FIRST_WORKER_STYLE = `/// <reference lib="webworker" />\nimport './privacy/fetchGuard' // ADR-0001 SW exception — guard-first\nimport { precacheAndRoute } from 'workbox-precaching'\n`

describe('evaluateSupplyChain', () => {
  it('passes a clean package with no service worker', () => {
    expect(evaluateSupplyChain({ pkg: CLEAN_PKG, swSource: null })).toEqual({
      ok: true,
      errors: [],
    })
  })

  it('flags a telemetry dependency', () => {
    const r = evaluateSupplyChain({
      pkg: { dependencies: { '@sentry/react': '^8' } },
      swSource: null,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/telemetry/i)
  })

  it('flags an xlsx pin that is not the SheetJS tarball', () => {
    const r = evaluateSupplyChain({
      pkg: { dependencies: { xlsx: '^0.18.5' } },
      swSource: null,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/xlsx must pin/i)
  })

  it('accepts the exact SheetJS tarball pin', () => {
    const r = evaluateSupplyChain({
      pkg: { dependencies: { xlsx: REQUIRED_XLSX_PIN } },
      swSource: null,
    })
    expect(r.ok).toBe(true)
  })

  it('denies a service-worker-named dependency outside the exception', () => {
    const r = evaluateSupplyChain({
      pkg: { dependencies: { 'sw-service-worker-toolbox': '^1' } },
      swSource: null,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/outside the ADR-0001 exception/i)
  })

  it('allowlists vite-plugin-pwa + workbox-* (no rogue error)', () => {
    const r = evaluateSupplyChain({
      pkg: {
        devDependencies: { 'vite-plugin-pwa': '^1' },
        dependencies: { 'workbox-precaching': '^7', 'workbox-window': '^7' },
      },
      swSource: GUARD_FIRST,
    })
    expect(r.ok).toBe(true)
  })

  it('fails when vite-plugin-pwa is present but src/sw.ts is missing', () => {
    const r = evaluateSupplyChain({
      pkg: { devDependencies: { 'vite-plugin-pwa': '^1' } },
      swSource: null,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/src\/sw\.ts is missing/i)
  })

  it('fails when src/sw.ts does not import the guard first', () => {
    const r = evaluateSupplyChain({
      pkg: { devDependencies: { 'vite-plugin-pwa': '^1' } },
      swSource: GUARD_NOT_FIRST,
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/first executable statement/i)
  })

  it('passes when the guard import is first, even behind comments/blank lines', () => {
    const r = evaluateSupplyChain({
      pkg: { devDependencies: { 'vite-plugin-pwa': '^1' } },
      swSource: GUARD_FIRST_WITH_COMMENTS,
    })
    expect(r.ok).toBe(true)
  })

  it('accepts the established worker convention (webworker ref + trailing comment)', () => {
    const r = evaluateSupplyChain({
      pkg: { devDependencies: { 'vite-plugin-pwa': '^1' } },
      swSource: GUARD_FIRST_WORKER_STYLE,
    })
    expect(r.ok).toBe(true)
  })
})
