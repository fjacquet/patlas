/// <reference lib="webworker" />
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types'
import '../../privacy/fetchGuard' // Plan 02 contract — workers have their own global scope
import { adaptProxmox } from './adapters/proxmox'
import { extractProxmoxBundle } from './extractZip'
import { parseXlsx } from './parseXlsx'

interface ParseRequest {
  kind: 'parse'
  buf: ArrayBuffer
  filename: string
  mtime: number
}

/**
 * Parse a `Report_YYYYMMDD_HHMMSS` filename into a Date.
 * Falls back to `mtime` (file last-modified epoch ms) when the pattern is
 * absent or malformed, or to `new Date()` when `mtime` is not finite.
 */
const parseCaptureDate = (filename: string, mtime: number): Date => {
  const fallback = Number.isFinite(mtime) ? new Date(mtime) : new Date()
  const m = filename.match(/Report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
  if (!m) return fallback
  const [, yr, mo, dy, hh, mm, ss] = m
  const d = new Date(Number(yr), Number(mo) - 1, Number(dy), Number(hh), Number(mm), Number(ss))
  return Number.isNaN(d.getTime()) ? fallback : d
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    const u8 = new Uint8Array(e.data.buf)
    const isZip = u8.byteLength >= 2 && u8[0] === 0x50 && u8[1] === 0x4b
    let networkSvg: string | null = null
    let xlsxBytes: Uint8Array = u8
    if (isZip) {
      const zip = extractProxmoxBundle(u8)
      if (zip.xlsx) xlsxBytes = zip.xlsx // Proxmox .zip bundle
      networkSvg = zip.networkSvg
      // else: a bare .xlsx (itself a zip with no inner .xlsx) → parse u8 directly
    }

    // `workbook` (the SheetJS-derived workbook) is scoped to this handler and
    // is NEVER posted back — only the canonical typed rows cross the
    // boundary (Critical-5 / STRIDE T-04-07). It is GC-eligible the moment
    // the handler returns.
    const workbook = parseXlsx(xlsxBytes)
    const bundle = adaptProxmox(workbook)

    const capturedAt = parseCaptureDate(e.data.filename, e.data.mtime)
    const vCenterLabel = bundle.clusterName || e.data.filename

    // Typed against `Omit<Snapshot, 'id' | 'parsedAt'>` so the compiler
    // enforces the full field list — a missing row set is a build error,
    // not a silent runtime drop (postMessage itself is untyped).
    const snapshot: Omit<Snapshot, 'id' | 'parsedAt'> = {
      filename: e.data.filename,
      fileSize: bytes(e.data.buf.byteLength),
      capturedAt,
      vCenterLabel,
      rvtoolsVersion: '',
      viSdkUuid: null,
      vMetaData: [],
      source: 'proxmox',
      guests: bundle.guests,
      nodes: bundle.nodes,
      vmUsage: bundle.vmUsage,
      proxmoxSnapshots: bundle.proxmoxSnapshots,
      proxmoxStorageContent: bundle.proxmoxStorageContent,
      proxmoxHaResources: bundle.proxmoxHaResources,
      proxmoxHaStatus: bundle.proxmoxHaStatus,
      proxmoxBackupJobs: bundle.proxmoxBackupJobs,
      storages: bundle.storages,
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      parseErrors: bundle.warnings,
      networkSvg,
    }
    self.postMessage({ kind: 'ok', snapshot, warnings: bundle.warnings })
  } catch (err) {
    const e2 = err as {
      name?: string
      message?: string
      column?: string
      sheet?: string
      kind?: string
    }
    // Explicit field list — NO `cause`, NO parsed VM data (STRIDE T-04-04).
    self.postMessage({
      kind: 'err',
      error: {
        name: e2.name ?? 'ParseError',
        message: e2.message ?? 'parse failed',
        column: e2.column,
        sheet: e2.sheet,
        kind: e2.kind,
      },
    })
  }
}
