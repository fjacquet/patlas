import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { ClusterHealthView } from './components/clusterhealth/ClusterHealthView'
import { GlobalDashboard } from './components/dashboard/GlobalDashboard'
import { ExportButtons } from './components/ExportButtons'
import { EosView } from './components/eos/EosView'
import { FallbackError } from './components/FallbackError'
import { GovernanceView } from './components/governance/GovernanceView'
import { HostsView } from './components/hosts/HostsView'
import { InventoryView } from './components/inventory/InventoryView'
import { LanguageToggle } from './components/LanguageToggle'
import { MonsterVmView } from './components/monstervm/MonsterVmView'
import { NetworkView } from './components/network/NetworkView'
import { PrivacyBadge } from './components/PrivacyBadge'
import { PlanningView } from './components/planning/PlanningView'
import { ProtectionView } from './components/protection/ProtectionView'
import { RightSizingView } from './components/rightsizing/RightSizingView'
import { RrdHeadroomView } from './components/rrd/RrdHeadroomView'
import { StorageGrowthView } from './components/rrd/StorageGrowthView'
import { SnapshotListSidebar } from './components/SnapshotListSidebar'
import { SnapshotSprawlView } from './components/snapshots/SnapshotSprawlView'
import { StorageView } from './components/storage/StorageView'
import { StorageContentView } from './components/storagecontent/StorageContentView'
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
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-700 dark:text-slate-200">pAtlas</h1>
            <PrivacyBadge />
          </div>
          <div className="flex items-center gap-2">
            {hasSnapshots ? <ExportButtons /> : null}
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        {hasSnapshots ? (
          <div className="flex flex-1 overflow-hidden">
            {/* ONE left column: the primary nav (vertical) sits at the top of
                the snapshot sidebar, above the drop zone + snapshot list — no
                more two separate left rails. Keyboard/ARIA unchanged. */}
            <SnapshotListSidebar
              header={
                <ViewToggle value={activeView} onChange={setActiveView} orientation="vertical" />
              }
            />
            {activeView === 'inventory' ? (
              <InventoryView />
            ) : activeView === 'hosts' ? (
              <HostsView />
            ) : activeView === 'rrdheadroom' ? (
              <RrdHeadroomView />
            ) : activeView === 'storagegrowth' ? (
              <StorageGrowthView />
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
            ) : activeView === 'rightsizing' ? (
              <RightSizingView />
            ) : activeView === 'monstervm' ? (
              <MonsterVmView />
            ) : activeView === 'snapshots' ? (
              <SnapshotSprawlView />
            ) : activeView === 'storagecontent' ? (
              <StorageContentView />
            ) : activeView === 'clusterhealth' ? (
              <ClusterHealthView />
            ) : activeView === 'protection' ? (
              <ProtectionView />
            ) : activeView === 'governance' ? (
              <GovernanceView />
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
