/**
 * OS-family classifier (DSH-04) — pure, no deps, Zod-free. 3-way split
 * for the donut ONLY; this is NOT the Phase-5 EOS normalizer.
 *
 * Prefers `osConfig` (the vCenter guest-OS dropdown — stable); falls back
 * to `osTools` (running guest OS). `other` is a real, visible bucket —
 * never dropped, never thrown, never empty-string-special-cased away.
 */
import type { OsFamily } from '@/types/estate'

export type { OsFamily }

export function classifyOsFamily(osConfig: string, osTools: string): OsFamily {
  const s = (osConfig || osTools).toLowerCase()
  if (/windows|microsoft/.test(s)) return 'windows'
  if (/linux|rhel|red hat|centos|ubuntu|debian|suse|sles|oracle|rocky|alma|photon|coreos/.test(s)) {
    return 'linux'
  }
  return 'other'
}
