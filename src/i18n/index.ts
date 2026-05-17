import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAlerts from './locales/en/alerts.json'
import enAlloc from './locales/en/alloc.json'
import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enDr from './locales/en/dr.json'
import enEos from './locales/en/eos.json'
import enInventory from './locales/en/inventory.json'
import enMvc from './locales/en/mvc.json'
import enRci from './locales/en/rci.json'
import enStorage from './locales/en/storage.json'
import enStr from './locales/en/str.json'
import enTrends from './locales/en/trends.json'
import enUpload from './locales/en/upload.json'
import frAlerts from './locales/fr/alerts.json'
import frAlloc from './locales/fr/alloc.json'
import frCommon from './locales/fr/common.json'
import frDashboard from './locales/fr/dashboard.json'
import frDr from './locales/fr/dr.json'
import frEos from './locales/fr/eos.json'
import frInventory from './locales/fr/inventory.json'
import frMvc from './locales/fr/mvc.json'
import frRci from './locales/fr/rci.json'
import frStorage from './locales/fr/storage.json'
import frStr from './locales/fr/str.json'
import frTrends from './locales/fr/trends.json'
import frUpload from './locales/fr/upload.json'

/**
 * Languages shipped at build-time. The detector falls back to `fallbackLng`
 * when the browser locale is something we don't yet translate.
 */
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/**
 * Namespaces are split per UI concern so a translator can hand back one file
 * at a time without touching unrelated keys. Add a new namespace by listing
 * it here AND adding the matching JSON files under `locales/<lang>/`.
 */
export const NAMESPACES = [
  'common',
  'upload',
  'dashboard',
  'inventory',
  'mvc',
  'str',
  'alloc',
  'dr',
  'rci',
  'eos',
  'trends',
  'storage',
  'alerts',
] as const
export const DEFAULT_NS = 'common' satisfies (typeof NAMESPACES)[number]

export const resources = {
  en: {
    common: enCommon,
    upload: enUpload,
    dashboard: enDashboard,
    inventory: enInventory,
    mvc: enMvc,
    str: enStr,
    alloc: enAlloc,
    dr: enDr,
    rci: enRci,
    eos: enEos,
    trends: enTrends,
    storage: enStorage,
    alerts: enAlerts,
  },
  fr: {
    common: frCommon,
    upload: frUpload,
    dashboard: frDashboard,
    inventory: frInventory,
    mvc: frMvc,
    str: frStr,
    alloc: frAlloc,
    dr: frDr,
    rci: frRci,
    eos: frEos,
    trends: frTrends,
    storage: frStorage,
    alerts: frAlerts,
  },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: DEFAULT_NS,
    ns: NAMESPACES,
    // React already escapes interpolated values; double-escaping mangles
    // characters like `&` and `<` in tooltip text.
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'vatlas-lang',
      caches: ['localStorage'],
    },
  })

export default i18n
