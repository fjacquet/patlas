# Phase 2 — Deferred Items (out-of-scope discoveries)

| Found in | Item | Why deferred |
|----------|------|--------------|
| Plan 02-02 | `src/components/SnapshotListSidebar.tsx:25` has a pre-existing `useMemo()` call site (Phase-1 / plan 01-05). The PROJECT.md / 01-05 contract states `useEstateView` should be the project's *only* `useMemo`. | Pre-existing in an unrelated Phase-1 file — out of scope for 02-02 (SCOPE BOUNDARY: only auto-fix issues directly caused by this plan's changes). 02-PATTERNS explicitly cites `SnapshotListSidebar.tsx:25-28` as the *shipped reference idiom* for `useEstateView`, so it is an acknowledged exception, not a 02-02 regression. Plan 02-02 added exactly ONE new `useMemo` (`useEstateView.ts:19`) which contains no aggregation logic — the substantive success criterion is met. A future cleanup plan may migrate the sidebar sort into a store selector or accept the documented exception. |
