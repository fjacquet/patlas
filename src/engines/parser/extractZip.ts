import { unzipSync } from 'fflate'

/** Extract the Proxmox report bundle. The `.zip` contains `report.xlsx` and
 *  (optionally) `network-diagram.svg`. Runs in the worker only. */
export const extractProxmoxBundle = (
  buffer: Uint8Array,
): { xlsx: Uint8Array; networkSvg: string | null } => {
  const entries = Object.entries(unzipSync(buffer))
  const xlsxEntry = entries.find(([n]) => n.toLowerCase().endsWith('.xlsx'))
  if (!xlsxEntry) {
    const e = new Error('zip bundle contains no .xlsx report') as Error & { name: string }
    e.name = 'ParseError'
    throw e
  }
  const svgEntry = entries.find(([n]) => n.toLowerCase().endsWith('.svg'))
  return {
    xlsx: xlsxEntry[1],
    networkSvg: svgEntry ? new TextDecoder().decode(svgEntry[1]) : null,
  }
}
