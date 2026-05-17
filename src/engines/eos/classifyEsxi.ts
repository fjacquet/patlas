import type { EosCatalogue } from './catalogueSchema'

/**
 * ESXi host build string → major-version support state — pure, Zod-free.
 * Consumes ONLY `vhost.esxVersion` + the typed catalogue passed as a
 * parameter; it never reads any VM guest-OS field (Pitfall 6, D-09a/b —
 * nested-ESXi guest-OS rows are VMs, never host counts; host vs VM
 * cardinality must never be conflated).
 *
 * `patchEol` is ALWAYS `null`: the endoflife.date v1 catalogue exposes EOL
 * per MAJOR version only (`9.0`/`8.0`/`7.0`/…); there is no patch/build-level
 * EOL field anywhere (confirmed live 2026-05-17, Pitfall 1 / D-09c). The
 * presenter surfaces this null as the em-dash sentinel — a patch-level date
 * is never fabricated. The full build string is still shown factually as
 * plain text by the presenter (D-09a — no regression of P5's plain text).
 */
export function classifyEsxi(
  esxVersion: string,
  catalogue: EosCatalogue,
): { major: string | null; majorEol: string | null; patchEol: null } {
  const m = esxVersion.match(/esxi\s*(\d+\.\d+)/i)
  const major = m?.[1] ?? null
  if (major === null) {
    return { major: null, majorEol: null, patchEol: null }
  }
  const release = catalogue.products.esxi?.releases.find((r) => r.name === major)
  return { major, majorEol: release?.eolFrom ?? null, patchEol: null }
}
