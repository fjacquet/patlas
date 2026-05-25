import { describe, expect, it } from 'vitest'
import i18n, { SUPPORTED_LANGUAGES } from './index'

describe('i18n locale smoke', () => {
  it('exposes all four locales', () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['de', 'en', 'fr', 'it'])
  })
  for (const lng of ['en', 'fr', 'de', 'it'] as const) {
    it(`resolves a common key under ${lng} (no raw-key fallthrough)`, async () => {
      await i18n.changeLanguage(lng)
      const label = i18n.t('common:lang.label')
      expect(label).not.toBe('lang.label')
      expect(label.length).toBeGreaterThan(0)
    })
  }
})
