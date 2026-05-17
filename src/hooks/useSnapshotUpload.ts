import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { parseInWorker } from '@/engines/parser'
import { filenameIsoDate } from '@/engines/parser/captureDate'
import { aggregateTrendGroup } from '@/engines/trends'
import { useSnapshotStore } from '@/store/snapshotStore'

export interface UseSnapshotUploadResult {
  upload: (files: File[]) => Promise<void>
  isUploading: boolean
  /** Factual warm-up progress for the scoped "trends preparing — N/M"
   *  indicator (D-02). `done` = snapshots added so far, `total` = files
   *  in the current drop. Both 0 when idle. No blocking overlay. */
  done: number
  total: number
}

// DD-C: keep the active/latest + newest-4 hydrated; release older raw rows
// for GC when more than this many snapshots are loaded (Critical-5).
const HYDRATED_BUDGET = 4

/**
 * Orchestrates UploadZone → parser worker → store.
 *
 * D-01/D-02: files are ordered latest-`capturedAt`-first (filename-ISO
 * probe — shared with the parser, no duplicated regex), the FIRST (latest)
 * snapshot is parsed and added so the dashboard is interactive immediately,
 * and the remaining snapshots warm in a NON-blocking background drain. The
 * singleton Worker is preserved: still exactly one `parseInWorker` in
 * flight at a time (sequential drain) — the change is non-blocking to the
 * React render, not parallel parsing (STRIDE T-08-06).
 *
 * DD-C: after each add, when > 4 snapshots are loaded the oldest-by-
 * `capturedAt` non-active snapshot's raw rows are released, its trend
 * aggregate carried first (computed BEFORE the rows are emptied —
 * Pitfall 4).
 *
 * PRIVACY (Critical-2 / Pitfall 4): on failure we pass ONLY `err.message`
 * to the toast — never the error object, whose `.cause` may carry rows.
 */
export function useSnapshotUpload(): UseSnapshotUploadResult {
  const [isUploading, setIsUploading] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const { t } = useTranslation('upload')

  const parseOne = async (file: File): Promise<boolean> => {
    try {
      const { snapshot } = await parseInWorker(file)
      useSnapshotStore.getState().addSnapshot({
        id: crypto.randomUUID(),
        parsedAt: new Date(),
        ...snapshot,
      })
      maybeReleaseOldest()
      setDone((n) => n + 1)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(t('errors.parseFailed', { message }), { description: file.name })
      return false
    }
  }

  const upload = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    setIsUploading(true)
    setTotal(files.length)
    setDone(0)

    // Latest-`capturedAt`-first via the shared filename-ISO probe; files
    // without a filename date keep drop order (the user can re-order via
    // the D-03 inline capturedAt edit, which recomputes through the memo).
    const ordered = [...files].sort((a, b) => {
      const da = filenameIsoDate(a.name)?.getTime() ?? Number.NEGATIVE_INFINITY
      const db = filenameIsoDate(b.name)?.getTime() ?? Number.NEGATIVE_INFINITY
      return db - da
    })

    const [first, ...rest] = ordered
    if (first) await parseOne(first)

    if (rest.length === 0) {
      setIsUploading(false)
      return
    }

    // Non-blocking background drain — NOT awaited by `upload`, so the
    // caller's render proceeds off the first snapshot (5 s criterion).
    // Still strictly sequential (singleton Worker preserved).
    void (async () => {
      for (const file of rest) {
        await parseOne(file)
      }
      setIsUploading(false)
    })()
  }

  return { upload, isUploading, done, total }
}

/**
 * DD-C: when > HYDRATED_BUDGET snapshots are loaded, release the oldest-by-
 * `capturedAt` snapshot that is neither the active/latest nor within the
 * newest HYDRATED_BUDGET. Its aggregate is computed from its still-present
 * rows BEFORE `releaseRawRows` empties them (Pitfall 4 ordering).
 */
function maybeReleaseOldest(): void {
  const state = useSnapshotStore.getState()
  const all = [...state.snapshots.values()]
  if (all.length <= HYDRATED_BUDGET) return

  const liveByRecency = all
    .filter((s) => s.rawReleased !== true)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())

  // Keep the newest HYDRATED_BUDGET hydrated; never release the active.
  const releaseCandidates = liveByRecency
    .slice(HYDRATED_BUDGET)
    .filter((s) => s.id !== state.activeSnapshotId)
  const victim = releaseCandidates.at(-1) // the oldest eligible
  if (!victim) return

  // Aggregate captured BEFORE rows are emptied (Pitfall 4).
  const aggregate = aggregateTrendGroup([victim], 'active', {})
  useSnapshotStore.getState().releaseRawRows(victim.id, aggregate)
}
