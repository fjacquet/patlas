import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateSupplyChain } from '../scripts/check-supply-chain.mjs'
import { shouldAutoReload } from '../src/pwa/updatePolicy'

describe('PWA smart-update policy (ADR-0001 SW exception §5)', () => {
  it('auto-reloads only when no snapshot is loaded', () => {
    expect(shouldAutoReload(0)).toBe(true)
  })
  it('does NOT auto-reload with a loaded estate (refresh = data gone)', () => {
    expect(shouldAutoReload(1)).toBe(false)
    expect(shouldAutoReload(5)).toBe(false)
  })
})

describe('src/sw.ts honors the ADR-0001 SW exception envelope', () => {
  const sw = readFileSync(resolve(process.cwd(), 'src/sw.ts'), 'utf-8')
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

  it('passes the supply-chain gate against the real package.json + src/sw.ts', () => {
    expect(evaluateSupplyChain({ pkg, swSource: sw })).toEqual({ ok: true, errors: [] })
  })

  it('is precache-only — no Workbox runtime strategy in the authored source', () => {
    expect(sw).toContain('precacheAndRoute')
    for (const strategy of [
      'NetworkFirst',
      'NetworkOnly',
      'StaleWhileRevalidate',
      'CacheFirst',
      'registerRoute',
      'runtimeCaching',
    ]) {
      expect(sw).not.toContain(strategy)
    }
  })
})
