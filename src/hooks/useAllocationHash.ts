import { useCallback, useEffect, useState } from 'react'

/** Allocation ratios: vCPU per physical core, and vRAM overcommit factor. */
export interface AllocRatios {
  cpu: number
  ram: number
}

/** Slider bounds (UI-SPEC §Interaction). Parsed hash values are clamped here. */
export const CPU_MIN = 1
export const CPU_MAX = 16
export const RAM_MIN = 0.5
export const RAM_MAX = 4

/** First-load defaults (ALC-02). Also the fallback for any bad hash. */
export const DEFAULT_RATIOS: AllocRatios = { cpu: 4, ram: 1 }

/**
 * STRICT bounded-quantifier parser (RESEARCH Security V5 / STRIDE
 * Tampering-DoS T-04-09): at most 2 integer + 2 fractional digits per
 * number, anchored, no `.*` — ReDoS-safe. NEVER `eval`/`JSON.parse` the
 * raw (attacker-controlled) hash.
 */
const HASH_RE = /^#?alloc=cpu:(\d{1,2}(?:\.\d{1,2})?),ram:(\d{1,2}(?:\.\d{1,2})?)$/

const clamp = (n: number, min: number, max: number): number => (n < min ? min : n > max ? max : n)

/**
 * Parse `window.location.hash` into ratios. Any non-match, NaN, or
 * oversized/injection-y input → {@link DEFAULT_RATIOS}. Out-of-bounds
 * numbers are clamped to the slider range.
 */
export const parseAllocHash = (rawHash: string): AllocRatios => {
  // Hard length guard before the regex even runs (defense in depth).
  if (rawHash.length > 64) return { ...DEFAULT_RATIOS }
  const m = rawHash.match(HASH_RE)
  if (m === null) return { ...DEFAULT_RATIOS }
  const cpu = Number(m[1])
  const ram = Number(m[2])
  if (!Number.isFinite(cpu) || !Number.isFinite(ram)) return { ...DEFAULT_RATIOS }
  return { cpu: clamp(cpu, CPU_MIN, CPU_MAX), ram: clamp(ram, RAM_MIN, RAM_MAX) }
}

const formatHash = (r: AllocRatios): string => `#alloc=cpu:${r.cpu},ram:${r.ram}`

/**
 * URL-hash-ONLY allocation-ratio state (ALC-03 / privacy invariant). Built
 * by inverting the `useTheme` localStorage state-sync skeleton onto
 * `window.location.hash`. Writes via `history.replaceState` (no history
 * spam, no navigation). Touches NO `localStorage`/`sessionStorage` and uses
 * no persistence middleware — refresh-from-the-same-URL restores; a fresh
 * URL is the 4:1/1:1 default.
 *
 * Event-driven sync (a `hashchange` listener) — explicitly NOT a `useMemo`,
 * so it does not count against the single-`useMemo` invariant
 * (RESEARCH Pattern 5).
 */
export function useAllocationHash(): [AllocRatios, (next: AllocRatios) => void] {
  const [ratios, setRatiosState] = useState<AllocRatios>(() =>
    typeof window === 'undefined' ? { ...DEFAULT_RATIOS } : parseAllocHash(window.location.hash),
  )

  // Reflect back/forward + manual hash edits into state.
  useEffect(() => {
    const onHashChange = () => setRatiosState(parseAllocHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setRatios = useCallback((next: AllocRatios) => {
    const clamped: AllocRatios = {
      cpu: clamp(next.cpu, CPU_MIN, CPU_MAX),
      ram: clamp(next.ram, RAM_MIN, RAM_MAX),
    }
    history.replaceState(null, '', formatHash(clamped))
    setRatiosState(clamped)
  }, [])

  return [ratios, setRatios]
}
