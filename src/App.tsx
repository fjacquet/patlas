import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { FallbackError } from './components/FallbackError'
import { LanguageToggle } from './components/LanguageToggle'
import { ThemeToggle } from './components/ThemeToggle'
import { UploadZone } from './components/UploadZone'
import { useTheme } from './hooks/useTheme'

function App() {
  const { resolved } = useTheme()

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
        <main className="flex flex-1 items-center justify-center p-8">
          {/* Plan 05 swaps this for: hasSnapshots ? <SnapshotListSidebar /> : <UploadZone variant="hero" /> */}
          <UploadZone
            onFiles={(files) => {
              // STUB: Plan 05 will wire this to the parser worker
              // (`useSnapshotUpload`). Logging only the filename — never
              // file contents — is the Phase-1 privacy posture.
              console.warn(
                'Plan 05 will wire this to the parser worker:',
                files.map((f) => f.name),
              )
            }}
          />
        </main>
      </div>
      <Toaster theme={resolved} position="bottom-right" />
    </ErrorBoundary>
  )
}

export default App
