// MUST be the first import — installs runtime privacy/transport guards on
// globalThis.fetch, XMLHttpRequest.prototype.open, navigator.sendBeacon, and
// globalThis.WebSocket. Throws synchronously on non-same-origin or
// cleartext-transport (CWE-319) attempts before any other module captures a
// reference to those globals. See docs/adr/0001-privacy-invariant.md.
import './privacy/fetchGuard'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// i18n must initialize before App renders so `useTranslation()` resolves
// keys synchronously on the first paint.
import './i18n'
import './index.css'
// PWA registration — imported AFTER the privacy guard (it must stay the first
// import). registerSW uses navigator.serviceWorker, not fetch, so the guard
// does not block it; the SW is same-origin and precache-only (ADR-0001
// SW exception).
import { registerPwa } from './pwa/registerSW'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('patlas: missing #root element in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerPwa()
