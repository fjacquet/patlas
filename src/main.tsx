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

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('vatlas: missing #root element in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
