<!-- generated-by: gsd-doc-writer -->
# ADR-0004: No Persistence of Parsed Dataset Rows (Memory-Only)

**Status:** Accepted
**Date:** 2026-05-15
**Inherited from:** vsizer ADR-0004
**Project:** vatlas
**Phase:** 1 — Foundation & Invariants

## Context

RVTools workbooks contain VM names, hostnames, IP addresses, and capacity
inventory. Any persistent browser storage (`localStorage`, `sessionStorage`,
`IndexedDB`, OPFS, service-worker caches) is a path by which parsed rows could
outlive the session or be read by other code. The product promise inherited
from vsizer is refresh-equals-data-gone. This ADR is the storage corollary of
the privacy invariant (see ADR-0001).

## Decision

Parsed RVTools rows are never written to `localStorage`, `sessionStorage`,
`IndexedDB`, OPFS, or any service-worker cache. The Zustand snapshot store
holds inputs in memory only with no `persist` middleware
(`src/store/snapshotStore.ts`). The only permitted browser-storage writes are
two UI-preference keys that contain no dataset content:

- `vatlas-theme` — theme preference (`src/hooks/useTheme.ts`)
- `vatlas-lang` — locale code, via the i18next browser language detector
  (`src/i18n/index.ts`)

## Rationale

- The two allowed keys store a theme string and a locale code; neither can
  carry workbook content, so they do not breach the privacy invariant.
- Keeping the store memory-only means a page refresh garbage-collects every
  parsed row — the refresh-equals-data-gone promise holds by construction.
- No `persist` middleware means there is no codepath that could serialize the
  snapshot map to disk.

## Alternatives Considered

- **`IndexedDB` cache for faster re-open of the last workbook.** Persists
  sensitive rows across sessions; rejected outright by the invariant.
- **`sessionStorage` for in-tab survival across reloads.** Still persistence
  of dataset rows; defeats the refresh-equals-data-gone promise; rejected.

## Consequences

- Multi-snapshot trends are an in-session feature: the user drags N workbooks
  in at once and vatlas holds them all in memory; a refresh wipes everything.
- Any future "remember my last file" style feature is out of scope unless it
  stores zero dataset content.
- Storage usage is auditable by grep — only `useTheme.ts` and the i18n
  detector reference `localStorage`, and only with the two whitelisted keys.
- Adding any new storage key requires amending this ADR and confirming it
  carries no dataset content.
