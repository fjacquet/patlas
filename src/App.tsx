import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { GlobalDashboard } from './components/dashboard/GlobalDashboard'
import { ExportButtons } from './components/ExportButtons'
import { EosView } from './components/eos/EosView'
import { FallbackError } from './components/FallbackError'
import { HostsView } from './components/hosts/HostsView'
import { InventoryView } from './components/inventory/InventoryView'
import { LanguageToggle } from './components/LanguageToggle'
import { NetworkView } from './components/network/NetworkView'
import { PlanningView } from './components/planning/PlanningView'
import { SnapshotListSidebar } from './components/SnapshotListSidebar'
import { StorageView } from './components/storage/StorageView'
import { ThemeToggle } from './components/ThemeToggle'
import { TrendsView } from './components/trends/TrendsView'
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
          <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">vAtlas</h1>
          <div className="flex items-center gap-2">
            {hasSnapshots ? <ExportButtons /> : null}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        {hasSnapshots ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Improvement 1: primary navigation is a vertical rail (was a
                top-bar strip). Conventional LEFT placement — far-left
                column, before the snapshot sidebar + drop zone.
                Keyboard/ARIA unchanged. */}
            <nav className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 p-4 dark:border-surface-700">
              <ViewToggle value={activeView} onChange={setActiveView} orientation="vertical" />
            </nav>
            <SnapshotListSidebar />
            {activeView === 'inventory' ? (
              <InventoryView />
            ) : activeView === 'hosts' ? (
              <HostsView />
            ) : activeView === 'planning' ? (
              <PlanningView />
            ) : activeView === 'eos' ? (
              <EosView />
            ) : activeView === 'trends' ? (
              <TrendsView />
            ) : activeView === 'storage' ? (
              <StorageView />
            ) : activeView === 'network' ? (
              <NetworkView />
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
