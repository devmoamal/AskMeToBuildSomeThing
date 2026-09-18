import React, { useEffect } from 'react'
import { useAppStore } from './hooks/useAppStore'
import { AppSidebar } from './components/sidebar/AppSidebar'
import { ChatView } from './components/chat/ChatView'
import { SettingsDialog } from './components/settings/SettingsDialog'
import { OnboardingModal } from './components/onboarding/OnboardingModal'

export const App: React.FC = () => {
  const store = useAppStore()

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
  const activeChat = store.chats.find(c => c.id === store.activeChatId)
  const activeProject = store.projects.find(p => p.id === store.activeProjectId)
  const activeSession = store.projectSessions.find(s => s.id === store.activeSessionId)

  const viewTitle = store.activeTab === 'chats'
    ? (activeChat?.title || 'New Chat')
    : (`${activeProject?.name || 'Project'}${activeSession ? ` - ${activeSession.title}` : ' - New Chat'}`)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar with slide tabs (auto-collapsed when Canvas is open to maximize workspace) */}
      <AppSidebar
        isOpen={isSidebarEffectivelyOpen}
        activeTab={store.activeTab}
        setActiveTab={store.setActiveTab}
        chats={store.chats}
        chatGroups={store.chatGroups}
        activeChatId={store.activeChatId}
        onSelectChat={store.setActiveChatId}
        onNewChat={store.createNewChat}
        onNewGroup={store.createChatGroup}
        onToggleGroupCollapse={store.toggleGroupCollapse}
        onRenameChat={store.renameChat}
        onDeleteGroup={async (id) => {
          await window.api.chats.deleteGroup(id)
          store.refreshState()
        }}
        onDeleteChat={async (id) => {
          await window.api.chats.delete(id)
          store.refreshState()
        }}
        onMoveChatToGroup={async (chatId, groupId) => {
          const c = store.chats.find(x => x.id === chatId)
          if (c) {
            await window.api.chats.save({ id: c.id, title: c.title, groupId })
            store.refreshState()
          }
        }}
        projects={store.projects}
        activeProjectId={store.activeProjectId}
        projectSessions={store.projectSessions}
        activeSessionId={store.activeSessionId}
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
        onOpenSettings={() => store.setIsSettingsOpen(true)}
        onCloseSidebar={toggleSidebar}
      />

      {/* Main Chat / Project Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <ChatView
          mode={store.activeTab === 'chats' ? 'chat' : 'project'}
          title={viewTitle}
          rawTitle={store.activeTab === 'chats' ? activeChat?.title : activeSession?.title}
          targetId={store.activeTab === 'chats' ? store.activeChatId : store.activeSessionId}
          onRenameCurrent={(newTitle) => {
            if (store.activeTab === 'chats' && store.activeChatId) {
              store.renameChat(store.activeChatId, newTitle)
            } else if (store.activeTab === 'projects' && store.activeSessionId) {
              store.renameSession(store.activeSessionId, newTitle)
            }
          }}
          folderPath={store.activeTab === 'projects' ? activeProject?.folderPath : undefined}
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
    </div>
  )
}
