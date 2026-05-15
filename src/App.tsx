import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { FallbackError } from './components/FallbackError'
import { LanguageToggle } from './components/LanguageToggle'
import { SnapshotListSidebar } from './components/SnapshotListSidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { UploadZone } from './components/UploadZone'
import { useSnapshotUpload } from './hooks/useSnapshotUpload'
import { useTheme } from './hooks/useTheme'
import { selectHasSnapshots, useSnapshotStore } from './store/snapshotStore'

function App() {
  const { resolved } = useTheme()
  const hasSnapshots = useSnapshotStore(selectHasSnapshots)
  const { upload, isUploading } = useSnapshotUpload()

  return (
    <ErrorBoundary FallbackComponent={FallbackError}>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-3 dark:border-surface-700">
          <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">vatlas</h1>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        {hasSnapshots ? (
          <div className="flex flex-1 overflow-hidden">
            <SnapshotListSidebar />
            <main className="flex-1 p-8">
              {/* Phase 2 lands the dashboard here. */}
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Snapshots loaded. Dashboard arrives in Phase 2.
              </p>
            </main>
          </div>
        ) : (
          <main className="flex flex-1 items-center justify-center p-8">
            <UploadZone onFiles={upload} disabled={isUploading} variant="hero" />
          </main>
        )}
      </div>
      <Toaster theme={resolved} position="bottom-right" />
    </ErrorBoundary>
  )
}

export default App
