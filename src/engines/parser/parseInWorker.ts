import type { ParseError, Snapshot } from '@/types'

/**
 * Main-thread surface for the parser. This module MUST NOT import `xlsx` —
 * SheetJS lives only in the worker chunk (Pitfall 9 / STRIDE T-04-08). Vite
 * code-splits `parser.worker.ts` into its own bundle via the `new URL(...,
 * import.meta.url)` pattern.
 */

type ParseRequest = { kind: 'parse'; buf: ArrayBuffer; filename: string; mtime: number }
type ParseResponse =
  | { kind: 'ok'; snapshot: Omit<Snapshot, 'id' | 'parsedAt'>; warnings: ParseError[] }
  | {
      kind: 'err'
      error: { name: string; message: string; sheet?: string; column?: string; kind?: string }
    }

// Module-scope singleton so multiple file drops reuse one worker
// (RESEARCH.md L432-438).
let worker: Worker | null = null

const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export const parseInWorker = async (
  file: File,
): Promise<{ snapshot: Omit<Snapshot, 'id' | 'parsedAt'>; warnings: ParseError[] }> => {
  const w = getWorker()
  const buf = await file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<ParseResponse>) => {
      w.removeEventListener('message', onMessage)
      if (e.data.kind === 'ok') {
        resolve({ snapshot: e.data.snapshot, warnings: e.data.warnings })
      } else {
        reject(Object.assign(new Error(e.data.error.message), e.data.error))
      }
    }
    w.addEventListener('message', onMessage)
    const msg: ParseRequest = {
      kind: 'parse',
      buf,
      filename: file.name,
      mtime: file.lastModified,
    }
    // Transferable: `buf` is neutered on the main thread after this (zero-copy).
    w.postMessage(msg, [buf])
  })
}
