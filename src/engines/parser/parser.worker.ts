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
 * Returns `new Date()` when the pattern is absent or malformed.
 */
const parseCaptureDate = (filename: string): Date => {
  const m = filename.match(/Report_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
  if (!m) return new Date()
  const [, yr, mo, dy, hh, mm, ss] = m
  const d = new Date(Number(yr), Number(mo) - 1, Number(dy), Number(hh), Number(mm), Number(ss))
  return Number.isNaN(d.getTime()) ? new Date() : d
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    const u8 = new Uint8Array(e.data.buf)
    const isZip = u8[0] === 0x50 && u8[1] === 0x4b
    const { xlsx } = isZip ? extractProxmoxBundle(u8) : { xlsx: u8 }

    // `workbook` (the SheetJS-derived workbook) is scoped to this handler and
    // is NEVER posted back — only the canonical typed rows cross the
    // boundary (Critical-5 / STRIDE T-04-07). It is GC-eligible the moment
    // the handler returns.
    const workbook = parseXlsx(xlsx)
    const bundle = adaptProxmox(workbook)

    const capturedAt = parseCaptureDate(e.data.filename)
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
      vinfo: bundle.vinfo,
      vhost: bundle.vhost,
      vmUsage: bundle.vmUsage,
      vdatastore: bundle.vdatastore,
      vpartition: [],
      vnetwork: [],
      vswitch: [],
      dvswitch: [],
      dvport: [],
      parseErrors: bundle.warnings,
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
