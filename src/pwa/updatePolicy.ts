/**
 * The ADR-0001 SW-exception update decision (§5), pure and unit-testable.
 *
 * Auto-reload ONLY when nothing is loaded. With a loaded estate the new
 * service worker must wait for an explicit user action — auto-reloading would
 * wipe the in-memory estate + unsaved report and break the `refresh = data
 * gone` product promise.
 */
export function shouldAutoReload(loadedSnapshotCount: number): boolean {
  return loadedSnapshotCount === 0
}
