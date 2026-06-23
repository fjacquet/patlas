import { unzipSync } from 'fflate'

/** Extract the Proxmox report bundle. The `.zip` contains `report.xlsx` and
 *  (optionally) `network-diagram.svg`. Runs in the worker only. */
export const extractProxmoxBundle = (buffer: Uint8Array): { xlsx: Uint8Array; networkSvg: string | null } => {
  const files = unzipSync(buffer)
  const xlsxName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.xlsx'))
  if (!xlsxName) {
    const e = new Error('zip bundle contains no .xlsx report') as Error & { name: string }
    e.name = 'ParseError'
    throw e
  }
  const svgName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.svg'))
  return {
    xlsx: files[xlsxName]!,
    networkSvg: svgName ? new TextDecoder().decode(files[svgName]!) : null,
  }
}
