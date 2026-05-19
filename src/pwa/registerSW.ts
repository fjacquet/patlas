import { registerSW } from 'virtual:pwa-register'
import { useSnapshotStore } from '@store/snapshotStore'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { shouldAutoReload } from './updatePolicy'

/**
 * Register the precache-only service worker with the ADR-0001 SW-exception
 * smart-update policy (§5):
 *
 * - snapshot store EMPTY  → auto-reload (zero friction, always fresh)
 * - snapshot store LOADED → a user-controlled toast; the new SW waits until
 *   the user opts in, so an in-progress estate + unsaved report is never
 *   silently destroyed (preserves `refresh = data gone`).
 *
 * Called once from main.tsx after the privacy guard is installed. SW
 * registration uses `navigator.serviceWorker` (not `fetch`), so the runtime
 * guard does not block it; the SW is same-origin under `/vatlas/`.
 */
export function registerPwa(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (shouldAutoReload(useSnapshotStore.getState().snapshots.size)) {
        void updateSW(true)
        return
      }
      toast(i18n.t('pwa.updateAvailable'), {
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: i18n.t('pwa.reload'),
          onClick: () => {
            void updateSW(true)
          },
        },
      })
    },
  })
}
