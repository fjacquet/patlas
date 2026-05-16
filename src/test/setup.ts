// Vitest + RTL bootstrap. Loaded once per worker via `setupFiles` in
// vitest.config.ts. Side effects only — no exports.
import '@testing-library/jest-dom/vitest'

// Initialize i18next with bundled resources before any component renders so
// `useTranslation()` returns real strings instead of keys during tests.
import '../i18n'

// Node 22+ exposes a bare `localStorage` global that is `undefined` unless
// `--localstorage-file` is passed. Vitest 4's jsdom integration omits
// `localStorage`/`sessionStorage` from its `populateGlobal` key list, so
// `window.localStorage` and bare `localStorage` are both undefined under
// Node 26 + Vitest 4 + jsdom 29. Reach into jsdom's own window (vitest
// stashes it on `globalThis.jsdom`) and forward `localStorage` /
// `sessionStorage` to the test global.
interface JSDOMHandle {
  window: {
    localStorage: Storage
    sessionStorage: Storage
  }
}
const jsdomHandle = (globalThis as unknown as { jsdom?: JSDOMHandle }).jsdom
if (jsdomHandle?.window?.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      return jsdomHandle.window.localStorage
    },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      return jsdomHandle.window.sessionStorage
    },
  })
}

// jsdom never lays out the DOM, so `getBoundingClientRect`, the scroll
// metrics, and `ResizeObserver` all report 0 — which makes any
// `@tanstack/react-virtual` window collapse to zero rendered rows in tests
// (Phase-3 InventoryTree + DataTable). Provide a deterministic non-zero
// viewport so the virtualiser emits a bounded window under jsdom; the real
// browser ResizeObserver measurement supersedes these in production.
if (typeof window !== 'undefined') {
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  const VIEWPORT_H = 600
  const VIEWPORT_W = 320
  // jsdom defines `offsetHeight`/`offsetWidth` as getters that always return
  // 0. `@tanstack/virtual-core` measures the scroll element via exactly these
  // (it reads `element.offsetHeight`), so override them unconditionally to a
  // deterministic non-zero viewport for tests.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return VIEWPORT_H
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return VIEWPORT_W
    },
  })
  const origRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const base = origRect.call(this) as DOMRect
    if (base.height === 0 && base.width === 0) {
      return {
        ...base,
        width: VIEWPORT_W,
        height: VIEWPORT_H,
        top: 0,
        left: 0,
        right: VIEWPORT_W,
        bottom: VIEWPORT_H,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
    return base
  }
}

// jsdom doesn't implement `window.matchMedia` — `useTheme` calls it on
// mount. Stub a minimal shape that the hook treats as "no preference"
// (light mode by default; tests can override per-suite if needed).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
