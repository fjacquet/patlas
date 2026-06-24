import type { EosCatalogue } from './catalogueSchema'

/** Map a Proxmox VE version string to its major release and EOL date.
 *  Accepts '8.2', '8.2.2', '8', and 'pve-manager/8.2.2/...'. Patch-level EOL
 *  is the `null` sentinel (proxmox-ve EOL is tracked by major). */
export function classifyPve(
  pveVersion: string,
  catalogue: EosCatalogue,
): { major: string | null; majorEol: string | null; patchEol: null } {
  const m = pveVersion.match(/(\d+)(?:\.\d+)*/)
  const major = m?.[1] ?? null
  if (major === null) {
    return { major: null, majorEol: null, patchEol: null }
  }
  const release = catalogue.products['proxmox-ve']?.releases.find((r) => r.name === major)
  return { major, majorEol: release?.eolFrom ?? null, patchEol: null }
}
