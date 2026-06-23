import { unzipSync } from 'fflate'

/** Extract the Proxmox report bundle. The `.zip` contains `report.xlsx` and
 *  (optionally) `network-diagram.svg`. Runs in the worker only.
 *
 *  Returns `{ xlsx: null, networkSvg: null }` when the zip contains no inner
 *  `.xlsx` entry — this signals a bare `.xlsx` file (which is itself a ZIP)
 *  rather than a Proxmox bundle. */
export const extractProxmoxBundle = (
  buffer: Uint8Array,
): { xlsx: Uint8Array | null; networkSvg: string | null } => {
  const entries = Object.entries(unzipSync(buffer))
  const xlsxEntry = entries.find(([n]) => n.toLowerCase().endsWith('.xlsx'))
  if (!xlsxEntry) {
    return { xlsx: null, networkSvg: null }
  }
  const svgEntry = entries.find(([n]) => n.toLowerCase().endsWith('.svg'))
  return {
    xlsx: xlsxEntry[1],
    networkSvg: svgEntry ? new TextDecoder().decode(svgEntry[1]) : null,
  }
}
