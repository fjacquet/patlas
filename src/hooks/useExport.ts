/**
 * Phase 10 — main-thread export driver. Resolves store inputs + the
 * active-locale i18n strings + the D-05 filename ON THE MAIN THREAD
 * (Pitfall 2 — never read the store/hook inside the worker), posts an
 * `ExportRequest` to the singleton export worker (parseInWorker.ts shape),
 * tracks a sonner toast lifecycle, and downloads the returned bytes as a
 * Blob. One synthesis at a time; no modal (D-06).
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ExportKind, ExportRequest, ExportResponse } from '@/engines/export/types'
import {
  selectActiveSnapshot,
  selectPlannedRatios,
  selectSnapshots,
  selectThresholds,
  useSnapshotStore,
} from '@/store/snapshotStore'

/** D-05: `vatlas_{vCenter|multi}_{ISO date}.{ext}`. Path-traversal-safe —
 *  sanitize to `[A-Za-z0-9_-]`, cap 64, fallback `estate` (T-10-19). */
export function exportFilename(
  vCenterLabel: string,
  snapshotCount: number,
  capturedAt: Date,
  ext: 'html' | 'pptx',
): string {
  const sanitize = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'estate'
  const vc = snapshotCount > 1 ? 'multi' : sanitize(vCenterLabel)
  const iso = capturedAt.toISOString().slice(0, 10)
  return `vatlas_${vc}_${iso}.${ext}`
}

let worker: Worker | null = null
const getWorker = (): Worker => {
  if (!worker) {
    // Relative path (NOT the @/ alias) — Vite's worker static-analysis
    // resolves `new URL('./x', import.meta.url)` literally, matching the
    // shipped parseInWorker.ts pattern. An alias here fails to bundle.
    worker = new Worker(new URL('../engines/export/export.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return worker
}

function flattenBundle(b: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object')
      Object.assign(out, flattenBundle(v as Record<string, unknown>, `${prefix}${k}.`))
    else out[`${prefix}${k}`] = String(v)
  }
  return out
}

export function useExport(): { run: (kind: ExportKind) => Promise<void>; busy: boolean } {
  const { i18n } = useTranslation()
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (kind: ExportKind) => {
      if (busy) return
      // Resolve ALL inputs on the main thread (Pitfall 2).
      const st = useSnapshotStore.getState()
      const active = selectActiveSnapshot(st)
      if (!active) return
      const snapshots = selectSnapshots(st)
      const all = [...snapshots.values()]
      const planned = selectPlannedRatios(st)
      const locale = (i18n.language?.startsWith('fr') ? 'fr' : 'en') as 'en' | 'fr'
      const ext = kind === 'html' ? 'html' : 'pptx'
      const filename = exportFilename(active.vCenterLabel, snapshots.size, active.capturedAt, ext)
      const strings = {
        ...flattenBundle(
          (i18n.getResourceBundle(i18n.language, 'report') ?? {}) as Record<string, unknown>,
        ),
        ...flattenBundle(
          (i18n.getResourceBundle(i18n.language, 'pptx') ?? {}) as Record<string, unknown>,
        ),
      }
      const req: ExportRequest = {
        kind,
        active,
        all,
        mode: 'configured',
        today: Date.now(),
        opts: {
          plannedRatios: { cpuRatio: planned.cpu, ramRatio: planned.ram },
          thresholds: selectThresholds(st),
        },
        strings,
        locale,
        filename,
      }

      setBusy(true)
      const toastId = toast.loading(strings['toast.progress'] ?? 'Generating report…')
      const w = getWorker()
      await new Promise<void>((resolve) => {
        // A worker script/runtime failure fires 'error'/'messageerror',
        // NOT 'message' — without these the promise would hang forever and
        // `busy`/the loading toast would never clear (CodeRabbit
        // useExport.ts:131). Tear down listeners on whichever fires first.
        const cleanup = () => {
          w.removeEventListener('message', onMessage)
          w.removeEventListener('error', onFail)
          w.removeEventListener('messageerror', onFail)
        }
        const onFail = () => {
          cleanup()
          toast.error(strings['toast.error'] ?? 'Export did not complete.', { id: toastId })
          resolve()
        }
        const onMessage = (e: MessageEvent<ExportResponse>) => {
          cleanup()
          if (e.data.kind === 'ok') {
            const url = URL.createObjectURL(new Blob([e.data.bytes]))
            const a = document.createElement('a')
            a.href = url
            a.download = e.data.filename
            a.click()
            URL.revokeObjectURL(url)
            toast.success(
              (strings['toast.success'] ?? 'Report ready — {{filename}}').replace(
                '{{filename}}',
                e.data.filename,
              ),
              { id: toastId },
            )
          } else {
            toast.error(strings['toast.error'] ?? 'Export did not complete.', { id: toastId })
          }
          resolve()
        }
        w.addEventListener('message', onMessage)
        w.addEventListener('error', onFail)
        w.addEventListener('messageerror', onFail)
        w.postMessage(req)
      })
      setBusy(false)
    },
    [busy, i18n],
  )

  return { run, busy }
}
