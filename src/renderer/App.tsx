import React, { useEffect, useState } from 'react'
import { useAppStore } from './hooks/useAppStore'
import { AppSidebar } from './components/sidebar/AppSidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { OnboardingModal } from './components/onboarding/OnboardingModal'
import { Sparkles, X, Download, RefreshCw, AlertCircle, ArrowUpCircle } from 'lucide-react'
import type { UpdateInfo, UpdateProgress } from '../shared/types'

export const App: React.FC = () => {
  const store = useAppStore()
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null)
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'providers' | 'memory' | 'scheduler' | 'safety' | 'shell' | 'prompts' | 'appearance' | 'data' | 'updates'
  >('providers')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatePhase, setUpdatePhase] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle')
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.updater) return
    const unbind = window.api.updater.onUpdateDetected((update) => {
      setAvailableUpdate(update)
    })
    return unbind
  }, [])

  useEffect(() => {
    if (!window.api?.updater) return
    const unbind = window.api.updater.onProgress((p) => {
      setDownloadProgress(p)
    })
    return unbind
  }, [])

  const handleOneClickUpdate = async () => {
    if (!availableUpdate) return
    setIsUpdating(true)
    setUpdatePhase('downloading')
    setUpdateError(null)
    try {
      const dlRes = await window.api.updater.downloadUpdate(
        availableUpdate.downloadUrl,
        availableUpdate.assetName
      )
      if (!dlRes.success || !dlRes.filePath) {
        throw new Error(dlRes.error || 'Failed to download update package')
      }

      setUpdatePhase('installing')
      const instRes = await window.api.updater.installUpdate(dlRes.filePath)
      if (!instRes.success) {
        throw new Error(instRes.error || 'Failed to install update')
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Update failed')
      setUpdatePhase('error')
      setIsUpdating(false)
    }
  }

  // Auto-download update in background if user enabled setting
  useEffect(() => {
    if (availableUpdate && store.settings?.autoDownloadUpdates && updatePhase === 'idle' && !isUpdating) {
      handleOneClickUpdate()
    }
  }, [availableUpdate, store.settings?.autoDownloadUpdates])

  // Apply theme class to documentElement
  useEffect(() => {
    const theme = store.settings?.theme || 'dark'
    const root = document.documentElement

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.classList.toggle('light', !prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
      root.classList.toggle('light', theme === 'light')
    }
  }, [store.settings?.theme])

  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(() => {
    return localStorage.getItem('sidebar_open') !== 'false'
  })

  // Auto-collapse sidebar when Canvas opens to maximize editing workspace (like ChatGPT Canvas)
  const prevActiveCanvasRef = React.useRef(store.activeCanvas)
  useEffect(() => {
    if (!prevActiveCanvasRef.current && store.activeCanvas) {
      setIsSidebarOpen(false)
    } else if (prevActiveCanvasRef.current && !store.activeCanvas) {
      const saved = localStorage.getItem('sidebar_open') !== 'false'
      setIsSidebarOpen(saved)
    }
    prevActiveCanvasRef.current = store.activeCanvas
  }, [store.activeCanvas])

  const isSidebarEffectivelyOpen = isSidebarOpen && !store.activeCanvas

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev
      localStorage.setItem('sidebar_open', String(next))
      return next
    })
  }

  // Global keyboard shortcuts (Ctrl+, for Settings, Ctrl+B for Sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        store.setIsSettingsOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store])

  // Main application view with ChatGPT-style Dual-Pane Canvas workspace
  const isNoProject = !store.activeProjectId || store.activeProjectId === '__no_project__'
  const activeProject = isNoProject ? null : store.projects.find(p => p.id === store.activeProjectId)
  const activeSession = store.projectSessions.find(s => s.id === store.activeSessionId)

  const viewTitle = isNoProject
    ? (activeSession?.title || 'New Chat')
    : (`${activeProject?.name || 'Project'}${activeSession ? ` - ${activeSession.title}` : ' - New Chat'}`)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Dynamic Production Runtime CSS Injected via Prompts / customize_app tool */}
      {store.settings?.customCss && (
        <style id="production-runtime-custom-css">
          {store.settings.customCss}
        </style>
      )}

      {/* Sidebar with Unified Projects (auto-collapsed when Canvas is open to maximize workspace) */}
      <AppSidebar
        isOpen={isSidebarEffectivelyOpen}
        projects={store.projects}
        activeProjectId={store.activeProjectId}
        projectSessions={store.projectSessions}
        activeSessionId={store.activeSessionId}
        generatingSessionIds={store.generatingSessionIds}
        onSelectProject={store.setActiveProjectId}
        onSelectSession={store.setActiveSessionId}
        onPickFolder={store.selectProjectFolder}
        onNewSession={store.createProjectSession}
        onRenameSession={store.renameSession}
        onDeleteProject={async (id) => {
          await window.api.projects.delete(id)
          store.refreshState()
        }}
        onDeleteSession={async (id) => {
          await window.api.projects.deleteSession(id)
          store.refreshState()
        }}
        providers={store.providers}
        onOpenSettings={() => {
          setSettingsInitialTab('providers')
          store.setIsSettingsOpen(true)
        }}
        onCloseSidebar={toggleSidebar}
      />

      {/* Main Chat / Project Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <ChatView
          mode={isNoProject ? 'chat' : 'project'}
          title={viewTitle}
          rawTitle={activeSession?.title}
          targetId={store.activeSessionId}
          onRenameCurrent={(newTitle) => {
            if (store.activeSessionId) {
              store.renameSession(store.activeSessionId, newTitle)
            }
          }}
          folderPath={!isNoProject ? activeProject?.folderPath : undefined}
          messages={store.messages}
          canvases={store.canvases}
          activeCanvas={store.activeCanvas}
          onCloseCanvas={() => store.setActiveCanvas(null)}
          onSaveCanvas={async (canvas) => {
            const saved = await window.api.canvases.save(canvas)
            store.setActiveCanvas(saved)
            store.refreshState()
          }}
          onExpandCanvasModal={(canvas) => store.setActiveCanvasModal(canvas)}
          onApplyAiAction={store.applyCanvasAiAction}
          providers={store.providers}
          selectedProviderId={store.currentThreadModel?.providerId}
          selectedModel={store.currentThreadModel?.model}
          onSelectModel={store.setSelectedModel}
          isGenerating={store.isGenerating}
          activeQuestionnaire={store.activeQuestionnaire}
          activeApproval={store.activeApproval}
          onSend={store.sendPrompt}
          onAbort={store.abortGeneration}
          onOpenCanvas={store.setActiveCanvas}
          onSubmitAnswers={store.submitQuestionnaireAnswers}
          onApproveTool={store.approveTool}
          onRollback={store.rollbackToMessage}
          promptDraft={store.promptDraft}
          onPromptDraftConsumed={() => store.setPromptDraft(null)}
          isSidebarOpen={isSidebarEffectivelyOpen}
          onToggleSidebar={toggleSidebar}
        />
      </main>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={store.isSettingsOpen}
        onClose={() => store.setIsSettingsOpen(false)}
        providers={store.providers}
        settings={store.settings}
        initialTab={settingsInitialTab}
        onSaveProvider={async (p) => {
          await window.api.providers.save(p)
          store.refreshState()
        }}
        onDeleteProvider={async (id) => {
          await window.api.providers.delete(id)
          store.refreshState()
        }}
        onSaveSettings={async (s) => {
          await window.api.settings.save(s)
          store.refreshState()
        }}
        onRefresh={store.refreshState}
      />

      {/* Required First-Time Setup Wizard Modal */}
      <OnboardingModal
        isOpen={store.isOnboardingOpen}
        onComplete={async (provider) => {
          await window.api.providers.save(provider)
          store.setIsOnboardingOpen(false)
          store.refreshState()
        }}
      />

      {/* Background Update Notification Toast / In-Place Updater */}
      {availableUpdate && (
        <div className="fixed bottom-4 right-4 z-50 min-w-[320px] max-w-[420px] p-3.5 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md shadow-2xl text-xs text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
          {updatePhase === 'idle' && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  Update Available
                  <span className="px-1.5 py-0.2 rounded bg-primary/15 text-primary text-[10px] font-mono">
                    v{availableUpdate.version}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {availableUpdate.releaseName || 'A new version is available on GitHub.'}
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={handleOneClickUpdate}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    Update & Restart
                  </button>
                  <button
                    onClick={() => {
                      setSettingsInitialTab('updates')
                      store.setIsSettingsOpen(true)
                    }}
                    className="px-2.5 py-1.5 rounded-md bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs font-medium transition-colors cursor-pointer"
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => setAvailableUpdate(null)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors cursor-pointer ml-auto"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {updatePhase === 'downloading' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Download className="w-3.5 h-3.5 text-primary animate-bounce" />
                  <span>Downloading v{availableUpdate.version}...</span>
                </div>
                <span className="font-mono text-[11px] text-primary font-semibold">
                  {downloadProgress?.percent || 0}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${downloadProgress?.percent || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {downloadProgress?.transferred
                    ? `${(downloadProgress.transferred / (1024 * 1024)).toFixed(1)} MB / ${(downloadProgress.total / (1024 * 1024)).toFixed(1)} MB`
                    : 'Connecting...'}
                </span>
                {downloadProgress?.bytesPerSecond ? (
                  <span className="font-mono">
                    {(downloadProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {updatePhase === 'installing' && (
            <div className="flex items-center gap-3 py-1">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              <div>
                <div className="font-semibold text-xs text-foreground">Installing & Restarting...</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Replacing application bundle and reopening AskMeToBuildSomeThing...
                </div>
              </div>
            </div>
          )}

          {updatePhase === 'error' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-xs">Update Failed</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{updateError}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={handleOneClickUpdate}
                  className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    setSettingsInitialTab('updates')
                    store.setIsSettingsOpen(true)
                  }}
                  className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs cursor-pointer"
                >
                  Settings
                </button>
                <button
                  onClick={() => {
                    setAvailableUpdate(null)
                    setUpdatePhase('idle')
                  }}
                  className="px-2 py-1 rounded hover:bg-muted text-muted-foreground text-xs cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
