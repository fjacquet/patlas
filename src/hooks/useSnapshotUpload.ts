import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { parseInWorker } from '@/engines/parser'
import { useSnapshotStore } from '@/store/snapshotStore'

export interface UseSnapshotUploadResult {
  upload: (files: File[]) => Promise<void>
  isUploading: boolean
}

/**
 * Orchestrates UploadZone → parser worker → store, one file at a time.
 *
 * The for-loop is sequential on purpose (STRIDE T-05-07): `parseInWorker` is a
 * module-scope singleton Worker, so N drops parse one after another rather than
 * spawning N workers. A per-file `try/catch` means one bad workbook never
 * aborts the rest of the batch.
 *
 * PRIVACY (Critical-2 / Pitfall 4): on failure we pass ONLY `err.message` to
 * the toast — never the error object, whose `.cause` may carry parsed rows.
 */
export function useSnapshotUpload(): UseSnapshotUploadResult {
  const [isUploading, setIsUploading] = useState(false)
  const { t } = useTranslation('upload')

  const upload = async (files: File[]): Promise<void> => {
    if (files.length === 0) return
    setIsUploading(true)
    try {
      for (const file of files) {
        try {
          const { snapshot } = await parseInWorker(file)
          useSnapshotStore.getState().addSnapshot({
            id: crypto.randomUUID(),
            parsedAt: new Date(),
            ...snapshot,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          toast.error(t('errors.parseFailed', { message }), { description: file.name })
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading }
}
