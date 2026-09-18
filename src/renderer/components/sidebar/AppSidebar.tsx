import React, { useState, useEffect, useRef } from 'react'
import { Settings, PanelLeftClose } from 'lucide-react'
import { ChatsTab } from './ChatsTab'
import { ProjectsTab } from './ProjectsTab'
import type { Chat, ChatGroup, Project, ProjectSession, ProviderConfig } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface AppSidebarProps {
  isOpen?: boolean
  activeTab: 'chats' | 'projects'
  setActiveTab: (tab: 'chats' | 'projects') => void
  chats: Chat[]
  chatGroups: ChatGroup[]
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: (title?: string, groupId?: string | null) => void
  onNewGroup: (name: string) => void
  onToggleGroupCollapse: (group: ChatGroup) => void
  onRenameChat: (chatId: string, newTitle: string) => void
  onDeleteGroup: (groupId: string) => void
  onDeleteChat: (chatId: string) => void
  onMoveChatToGroup?: (chatId: string, groupId: string | null) => void

  projects: Project[]
  activeProjectId: string | null
  projectSessions: ProjectSession[]
  activeSessionId: string | null
  onSelectProject: (projectId: string) => void
  onSelectSession: (sessionId: string) => void
  onPickFolder: () => void
  onNewSession: (title?: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
  onDeleteProject: (projectId: string) => void
  onDeleteSession: (sessionId: string) => void

  providers: ProviderConfig[]
  onOpenSettings: () => void
  onCloseSidebar: () => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen = true,
  activeTab,
  setActiveTab,
  chats,
  chatGroups,
  activeChatId,
  onSelectChat,
  onNewChat,
  onNewGroup,
  onToggleGroupCollapse,
  onRenameChat,
  onDeleteGroup,
  onDeleteChat,
  onMoveChatToGroup,
  projects,
  activeProjectId,
  projectSessions,
  activeSessionId,
  onSelectProject,
  onSelectSession,
  onPickFolder,
  onNewSession,
  onRenameSession,
  onDeleteProject,
  onDeleteSession,
  onOpenSettings,
  onCloseSidebar
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('app_sidebar_width')
    return saved ? Math.max(200, Math.min(520, parseInt(saved, 10))) : 260
  })
  const isResizingRef = useRef(false)

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.max(200, Math.min(520, moveEvent.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setSidebarWidth(current => {
          localStorage.setItem('app_sidebar_width', current.toString())
          return current
        })
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (activeTab === 'chats') {
          onNewChat('New Chat')
        } else {
          onNewSession('New Chat')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, onNewChat, onNewSession])

  return (
    <aside
      style={isOpen ? { width: `${sidebarWidth}px` } : { width: '0px' }}
      className={cn(
        'sidebar-drawer h-screen shrink-0 overflow-hidden bg-[#0a0a0a] select-none font-sans relative',
        isOpen
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none'
      )}
      aria-hidden={!isOpen}
    >
      <div
        style={{ width: `${sidebarWidth}px` }}
        className={cn(
          'sidebar-inner h-full flex flex-col border-r border-[#1a1a1a] relative',
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0'
        )}
      >
        {/* Top Header: Title & Close */}
        <div className="h-11 px-3.5 flex items-center justify-between shrink-0">
          <span className="font-semibold text-[13px] text-zinc-200 tracking-tight">
            AskMeToBuildSomeThing
          </span>
          <button
            type="button"
            onClick={onCloseSidebar}
            className="side-toggle-btn p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-90 transition-all duration-200 cursor-pointer"
            title="Close sidebar (Ctrl+B)"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
          </button>
        </div>

      {/* Smooth Sliding Pill Segmented Control: Chats vs Projects */}
      <div className="px-3.5 pb-2 shrink-0">
        <div className="relative flex items-center p-0.5 rounded-lg bg-[#141414] border border-[#222]">
          {/* Smooth Sliding Highlight Pill */}
          <div
            className={cn(
              'absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-[#252528] border border-white/[0.08] shadow-xs transition-transform duration-200 ease-out pointer-events-none',
              activeTab === 'chats' ? 'left-0.5 translate-x-0' : 'left-0.5 translate-x-full'
            )}
          />

          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={cn(
              'relative z-10 flex-1 py-1 text-center text-xs transition-colors cursor-pointer rounded-md font-medium',
              activeTab === 'chats'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Chats
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={cn(
              'relative z-10 flex-1 py-1 text-center text-xs transition-colors cursor-pointer rounded-md font-medium',
              activeTab === 'projects'
                ? 'text-zinc-100 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Projects
          </button>
        </div>
      </div>

      {/* Main Sliding Content Track (Smooth Slide Between Chats and Projects) */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        <div
          className={cn(
            'w-[200%] h-full flex transition-transform duration-250 ease-out',
            activeTab === 'chats' ? 'translate-x-0' : '-translate-x-1/2'
          )}
        >
          {/* Page 1: Chats */}
          <div className="w-1/2 h-full flex flex-col min-h-0 overflow-hidden">
            <ChatsTab
              chats={chats}
              groups={chatGroups}
              activeChatId={activeChatId}
              onSelectChat={onSelectChat}
              onNewChat={onNewChat}
              onNewGroup={onNewGroup}
              onToggleGroupCollapse={onToggleGroupCollapse}
              onRenameChat={onRenameChat}
              onDeleteGroup={onDeleteGroup}
              onDeleteChat={onDeleteChat}
              onMoveChatToGroup={onMoveChatToGroup}
            />
          </div>

          {/* Page 2: Projects */}
          <div className="w-1/2 h-full flex flex-col min-h-0 overflow-hidden">
            <ProjectsTab
              projects={projects}
              activeProjectId={activeProjectId}
              sessions={projectSessions}
              activeSessionId={activeSessionId}
              onSelectProject={onSelectProject}
              onSelectSession={onSelectSession}
              onPickFolder={onPickFolder}
              onNewSession={onNewSession}
              onRenameSession={onRenameSession}
              onDeleteProject={onDeleteProject}
              onDeleteSession={onDeleteSession}
            />
          </div>
        </div>
      </div>

      {/* Clean Bottom Footer: Settings */}
      <div className="h-10 px-3 border-t border-[#1a1a1a] flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-zinc-500" />
          <span>Settings</span>
        </button>
      </div>
      </div>

      {/* Draggable Resize Handle */}
      {isOpen && (
        <div
          onMouseDown={startResizing}
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/60 z-30 group flex items-center justify-center transition-colors select-none"
          title="Drag to resize sidebar"
        >
          <div className="w-[2px] h-8 rounded-full bg-transparent group-hover:bg-blue-400 group-active:bg-blue-400 transition-colors" />
        </div>
      )}
    </aside>
  )
}
