/**
 * Cross-locale key-parity CI gate. A recursive deep key-diff over EVERY
 * namespace present under `locales/en/`, comparing fr/de/it against en: a
 * translator (or a future edit) cannot ship a key in one locale and not the
 * others (which would render a raw key-path to a user).
 *
 * Reads the JSON files directly rather than the wired `resources` export, so a
 * namespace's parity can be verified the moment its translation files land —
 * before it is registered in `index.ts`. The namespace list is derived from
 * the `en/` directory, so a new namespace is covered automatically.
 * Rides the existing `npm run test:run` CI step — no workflow edit needed.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const LOCALES = ['fr', 'de', 'it'] as const
const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), 'locales')

const NAMESPACES = readdirSync(resolve(localesDir, 'en'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort()

const flatten = (obj: unknown, prefix = ''): string[] => {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  )
}
const load = (locale: string, ns: string): unknown =>
  JSON.parse(readFileSync(resolve(localesDir, locale, `${ns}.json`), 'utf8'))

describe('i18n key parity across locales', () => {
  for (const ns of NAMESPACES) {
    it(`${ns}: fr/de/it key sets match en`, () => {
      const en = new Set(flatten(load('en', ns)))
      for (const locale of LOCALES) {
        const other = new Set(flatten(load(locale, ns)))
        const missing = [...en].filter((k) => !other.has(k))
        const extra = [...other].filter((k) => !en.has(k))
        expect({ locale, ns, missing, extra }).toEqual({ locale, ns, missing: [], extra: [] })
      }
    })
  }
})
