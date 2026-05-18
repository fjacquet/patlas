/**
 * Phase 10 — worker global shim. Side-effect module (NO exports), imported
 * SECOND in export.worker.ts (right after `fetchGuard`, BEFORE any heavy
 * import). ESM hoists `import` statements, so a top-level shim *statement*
 * runs too late — a dependency that reads `window` at module-eval (react-dom
 * server entry / zrender / pptxgenjs) throws `ReferenceError: window is not
 * defined` before it. Importing this module first guarantees the shim is in
 * place before those modules evaluate (imports run top-to-bottom; this one
 * has no imports of its own).
 *
 * A Web Worker's global IS `self`/`globalThis`; aliasing `window` to it lets
 * libraries that defensively read `window.X` resolve without taking a DOM
 * path (renderToStaticMarkup / ECharts SSR remain DOM-free — they only
 * touch `window` for feature probes, never real layout).
 */
const g = globalThis as unknown as { window?: unknown; self?: unknown }
if (typeof g.window === 'undefined') g.window = globalThis
if (typeof g.self === 'undefined') g.self = globalThis
