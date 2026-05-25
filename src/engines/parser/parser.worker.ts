/// <reference lib="webworker" />
import { bytes } from '@/engines/units'
import type { Snapshot } from '@/types'
import '../../privacy/fetchGuard' // Plan 02 contract — workers have their own global scope
import { inferCaptureDate, inferRvtoolsVersion, inferVCenterLabel } from './captureDate'
import { parseSnapshot } from './normalizeColumns'
import { parseXlsx } from './parseXlsx'

interface ParseRequest {
  kind: 'parse'
  buf: ArrayBuffer
  filename: string
  mtime: number
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.kind !== 'parse') return
  try {
    // `sheets` (the SheetJS-derived workbook) is scoped to this handler and
    // is NEVER posted back — only the canonical typed rows cross the
    // boundary (Critical-5 / STRIDE T-04-07). It is GC-eligible the moment
    // the handler returns.
    const sheets = parseXlsx(e.data.buf)
    const { snapshot: rows, warnings } = parseSnapshot(sheets)
    const capturedAt = inferCaptureDate(e.data.filename, e.data.mtime, sheets)
    const vCenterLabel = inferVCenterLabel(rows.vinfo, e.data.filename, sheets)
    const rvtoolsVersion = inferRvtoolsVersion(sheets)

    // Typed against `Omit<Snapshot, 'id' | 'parsedAt'>` so the compiler
    // enforces the full field list — a missing row set (e.g. `vmUsage`) is a
    // build error, not a silent runtime drop (postMessage itself is untyped).
    const snapshot: Omit<Snapshot, 'id' | 'parsedAt'> = {
      filename: e.data.filename,
      fileSize: bytes(e.data.buf.byteLength),
      capturedAt,
      vCenterLabel,
      rvtoolsVersion,
      viSdkUuid: rows.viSdkUuid,
      vMetaData: rows.vMetaData,
      source: 'rvtools',
      vinfo: rows.vinfo,
      vhost: rows.vhost,
      vmUsage: rows.vmUsage,
      vdatastore: rows.vdatastore,
      vpartition: rows.vpartition,
      vnetwork: rows.vnetwork,
      vswitch: rows.vswitch,
      dvswitch: rows.dvswitch,
      dvport: rows.dvport,
      parseErrors: rows.parseErrors,
    }
    self.postMessage({ kind: 'ok', snapshot, warnings })
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
