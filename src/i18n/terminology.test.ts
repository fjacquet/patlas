import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = ['en', 'fr', 'de', 'it']
const FORBIDDEN = /\b(RVTools|vCenter|ESXi?|datastore)\b/i // VMware terms that must not survive in values
const root = join(__dirname, 'locales')

describe('no VMware terminology in user-facing strings', () => {
  for (const loc of LOCALES) {
    it(`${loc} has no VMware terms`, () => {
      const hits: string[] = []
      for (const f of readdirSync(join(root, loc))) {
        const json = readFileSync(join(root, loc, f), 'utf8')
        for (const line of json.split('\n')) {
          // check values only (lines are "key": "value"); skip the key side
          const val = line.split(':').slice(1).join(':')
          if (FORBIDDEN.test(val)) hits.push(`${loc}/${f}: ${line.trim()}`)
        }
      }
      expect(hits).toEqual([])
    })
  }
})
