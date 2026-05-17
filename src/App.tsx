import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { GlobalDashboard } from './components/dashboard/GlobalDashboard'
import { FallbackError } from './components/FallbackError'
import { HostsView } from './components/hosts/HostsView'
import { InventoryView } from './components/inventory/InventoryView'
import { LanguageToggle } from './components/LanguageToggle'
import { SnapshotListSidebar } from './components/SnapshotListSidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { UploadZone } from './components/UploadZone'
import { type AppView, ViewToggle } from './components/ViewToggle'
import { useSnapshotUpload } from './hooks/useSnapshotUpload'
import { useTheme } from './hooks/useTheme'
import { selectHasSnapshots, useSnapshotStore } from './store/snapshotStore'

function App() {
  const { resolved } = useTheme()
  const hasSnapshots = useSnapshotStore(selectHasSnapshots)
  const { upload, isUploading } = useSnapshotUpload()
  const [activeView, setActiveView] = useState<AppView>('dashboard')

  return (
    <ErrorBoundary FallbackComponent={FallbackError}>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-3 dark:border-surface-700">
          <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">vatlas</h1>
          <div className="flex items-center gap-2">
            <ViewToggle value={activeView} onChange={setActiveView} />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        {hasSnapshots ? (
          <div className="flex flex-1 overflow-hidden">
            <SnapshotListSidebar />
            {activeView === 'inventory' ? (
              <InventoryView />
            ) : activeView === 'hosts' ? (
              <HostsView />
            ) : (
              <GlobalDashboard />
            )}
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
