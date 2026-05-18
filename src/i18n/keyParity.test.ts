/**
 * Minor-7 — EN↔FR key-parity CI gate. A recursive deep key-diff over EVERY
 * registered namespace: a translator (or a future edit) cannot ship a key in
 * one locale and not the other (which would render a raw key-path to a user).
 * Rides the existing `npm run test:run` CI step — no workflow edit needed.
 */
import { describe, expect, it } from 'vitest'
import { resources } from './index'

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  )

describe('i18n EN↔FR key parity', () => {
  for (const ns of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
    it(`namespace "${ns}" has identical keys in en and fr`, () => {
      expect(keys(resources.en[ns]).sort()).toEqual(keys(resources.fr[ns]).sort())
    })
  }
})
