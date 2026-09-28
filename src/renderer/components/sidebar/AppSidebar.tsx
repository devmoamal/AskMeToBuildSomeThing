import React, { useState, useEffect, useRef } from 'react'
import { Settings, PanelLeftClose } from 'lucide-react'
import { ProjectsTab } from './ProjectsTab'
import type { Project, ProjectSession, ProviderConfig } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface AppSidebarProps {
  isOpen?: boolean
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
        onNewSession('New Chat')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNewSession])

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
        <div className="h-11 px-3.5 flex items-center justify-between shrink-0 border-b border-[#141414]">
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

        {/* Main Projects / Workspace View (No tabs split) */}
        <div className="flex-1 overflow-hidden relative min-h-0">
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
