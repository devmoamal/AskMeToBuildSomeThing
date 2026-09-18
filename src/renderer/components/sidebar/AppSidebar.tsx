import React from 'react'
import { MessageSquare, FolderGit2, Settings, PanelLeftClose } from 'lucide-react'
import { ChatsTab } from './ChatsTab'
import { ProjectsTab } from './ProjectsTab'
import type { Chat, ChatGroup, Project, ProjectSession, ProviderConfig } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface AppSidebarProps {
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
  return (
    <aside className="w-64 h-screen flex flex-col bg-zinc-950 border-r border-zinc-900/60 select-none shrink-0">
      {/* App Header with Sidebar Collapse */}
      <div className="px-3.5 py-2.5 flex items-center justify-between">
        <span className="font-medium text-xs tracking-tight text-zinc-300 truncate">
          AskMeToBuildSomeThing
        </span>
        <button
          type="button"
          onClick={onCloseSidebar}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
          title="Close sidebar (Ctrl+B)"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Slide Tabs (Chats vs Projects) */}
      <div className="px-3 py-1.5">
        <div className="grid grid-cols-2 p-0.5 bg-zinc-900/90 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('chats')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all cursor-pointer text-xs',
              activeTab === 'chats'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all cursor-pointer text-xs',
              activeTab === 'projects'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Projects</span>
          </button>
        </div>
      </div>

      {/* Main Tab Tree */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chats' ? (
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
          />
        ) : (
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
        )}
      </div>

      {/* Bottom Sidebar: Minimalist Settings */}
      <div className="p-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-medium">Settings</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800/60">
            Ctrl+,
          </span>
        </button>
      </div>
    </aside>
  )
}
