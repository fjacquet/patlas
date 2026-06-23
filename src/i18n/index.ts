import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import deAlerts from './locales/de/alerts.json'
import deAlloc from './locales/de/alloc.json'
import deCommon from './locales/de/common.json'
import deDashboard from './locales/de/dashboard.json'
import deEos from './locales/de/eos.json'
import deInventory from './locales/de/inventory.json'
import deMonstervm from './locales/de/monstervm.json'
import deMvc from './locales/de/mvc.json'
import deNetwork from './locales/de/network.json'
import dePptx from './locales/de/pptx.json'
import deRci from './locales/de/rci.json'
import deReport from './locales/de/report.json'
import deRightsizing from './locales/de/rightsizing.json'
import deSnapshots from './locales/de/snapshots.json'
import deStorage from './locales/de/storage.json'
import deTrends from './locales/de/trends.json'
import deUpload from './locales/de/upload.json'
import enAlerts from './locales/en/alerts.json'
import enAlloc from './locales/en/alloc.json'
import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enEos from './locales/en/eos.json'
import enInventory from './locales/en/inventory.json'
import enMonstervm from './locales/en/monstervm.json'
import enMvc from './locales/en/mvc.json'
import enNetwork from './locales/en/network.json'
import enPptx from './locales/en/pptx.json'
import enRci from './locales/en/rci.json'
import enReport from './locales/en/report.json'
import enRightsizing from './locales/en/rightsizing.json'
import enSnapshots from './locales/en/snapshots.json'
import enStorage from './locales/en/storage.json'
import enTrends from './locales/en/trends.json'
import enUpload from './locales/en/upload.json'
import frAlerts from './locales/fr/alerts.json'
import frAlloc from './locales/fr/alloc.json'
import frCommon from './locales/fr/common.json'
import frDashboard from './locales/fr/dashboard.json'
import frEos from './locales/fr/eos.json'
import frInventory from './locales/fr/inventory.json'
import frMonstervm from './locales/fr/monstervm.json'
import frMvc from './locales/fr/mvc.json'
import frNetwork from './locales/fr/network.json'
import frPptx from './locales/fr/pptx.json'
import frRci from './locales/fr/rci.json'
import frReport from './locales/fr/report.json'
import frRightsizing from './locales/fr/rightsizing.json'
import frSnapshots from './locales/fr/snapshots.json'
import frStorage from './locales/fr/storage.json'
import frTrends from './locales/fr/trends.json'
import frUpload from './locales/fr/upload.json'
import itAlerts from './locales/it/alerts.json'
import itAlloc from './locales/it/alloc.json'
import itCommon from './locales/it/common.json'
import itDashboard from './locales/it/dashboard.json'
import itEos from './locales/it/eos.json'
import itInventory from './locales/it/inventory.json'
import itMonstervm from './locales/it/monstervm.json'
import itMvc from './locales/it/mvc.json'
import itNetwork from './locales/it/network.json'
import itPptx from './locales/it/pptx.json'
import itRci from './locales/it/rci.json'
import itReport from './locales/it/report.json'
import itRightsizing from './locales/it/rightsizing.json'
import itSnapshots from './locales/it/snapshots.json'
import itStorage from './locales/it/storage.json'
import itTrends from './locales/it/trends.json'
import itUpload from './locales/it/upload.json'

/**
 * Languages shipped at build-time. The detector falls back to `fallbackLng`
 * when the browser locale is something we don't yet translate.
 */
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'it'] as const
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
  'alloc',
  'rci',
  'eos',
  'trends',
  'storage',
  'alerts',
  'network',
  'report',
  'pptx',
  'rightsizing',
  'monstervm',
  'snapshots',
] as const
export const DEFAULT_NS = 'common' satisfies (typeof NAMESPACES)[number]

export const resources = {
  en: {
    common: enCommon,
    upload: enUpload,
    dashboard: enDashboard,
    inventory: enInventory,
    mvc: enMvc,
    alloc: enAlloc,
    rci: enRci,
    eos: enEos,
    trends: enTrends,
    storage: enStorage,
    alerts: enAlerts,
    network: enNetwork,
    report: enReport,
    pptx: enPptx,
    rightsizing: enRightsizing,
    monstervm: enMonstervm,
    snapshots: enSnapshots,
  },
  fr: {
    common: frCommon,
    upload: frUpload,
    dashboard: frDashboard,
    inventory: frInventory,
    mvc: frMvc,
    alloc: frAlloc,
    rci: frRci,
    eos: frEos,
    trends: frTrends,
    storage: frStorage,
    alerts: frAlerts,
    network: frNetwork,
    report: frReport,
    pptx: frPptx,
    rightsizing: frRightsizing,
    monstervm: frMonstervm,
    snapshots: frSnapshots,
  },
  de: {
    common: deCommon,
    upload: deUpload,
    dashboard: deDashboard,
    inventory: deInventory,
    mvc: deMvc,
    alloc: deAlloc,
    rci: deRci,
    eos: deEos,
    trends: deTrends,
    storage: deStorage,
    alerts: deAlerts,
    network: deNetwork,
    report: deReport,
    pptx: dePptx,
    rightsizing: deRightsizing,
    monstervm: deMonstervm,
    snapshots: deSnapshots,
  },
  it: {
    common: itCommon,
    upload: itUpload,
    dashboard: itDashboard,
    inventory: itInventory,
    mvc: itMvc,
    alloc: itAlloc,
    rci: itRci,
    eos: itEos,
    trends: itTrends,
    storage: itStorage,
    alerts: itAlerts,
    network: itNetwork,
    report: itReport,
    pptx: itPptx,
    rightsizing: itRightsizing,
    monstervm: itMonstervm,
    snapshots: itSnapshots,
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
      lookupLocalStorage: 'patlas-lang',
      caches: ['localStorage'],
    },
  })

export default i18n
