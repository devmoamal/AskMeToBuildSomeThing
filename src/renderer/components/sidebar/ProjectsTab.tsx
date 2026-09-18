import React, { useState } from 'react'
import {
  Folder,
  FolderPlus,
  Plus,
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil
} from 'lucide-react'
import type { Project, ProjectSession } from '../../../shared/types'
import { cn, formatRelativeTime } from '../../lib/utils'

interface ProjectsTabProps {
  projects: Project[]
  activeProjectId: string | null
  sessions: ProjectSession[]
  activeSessionId: string | null
  onSelectProject: (projectId: string) => void
  onSelectSession: (sessionId: string) => void
  onPickFolder: () => void
  onNewSession: (title?: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
  onDeleteProject: (projectId: string) => void
  onDeleteSession: (sessionId: string) => void
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  projects,
  activeProjectId,
  sessions,
  activeSessionId,
  onSelectProject,
  onSelectSession,
  onPickFolder,
  onNewSession,
  onRenameSession,
  onDeleteProject,
  onDeleteSession
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({})
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [sessionMenuId, setSessionMenuId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const toggleProject = (projectId: string) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  const startRename = (sess: ProjectSession) => {
    setEditingSessionId(sess.id)
    setEditTitle(sess.title)
    setSessionMenuId(null)
  }

  const handleSaveRename = (sessionId: string) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim())
    }
    setEditingSessionId(null)
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Clean Actions Bar with Open/Add Project folder button on the right */}
      <div className="flex items-center justify-end px-3 py-1 text-xs">
        <button
          type="button"
          onClick={onPickFolder}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          title="Open project folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {projects.map(proj => {
          const isCollapsed = !!collapsedProjects[proj.id]
          const isProjectActive = activeProjectId === proj.id
          const projectSessions = isProjectActive ? sessions : []

          return (
            <div key={proj.id} className="space-y-0.5">
              {/* Project Folder Row */}
              <div
                onClick={() => {
                  onSelectProject(proj.id)
                  if (collapsedProjects[proj.id]) {
                    toggleProject(proj.id)
                  }
                }}
                className={cn(
                  'group flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                  isProjectActive
                    ? 'text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                )}
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleProject(proj.id)
                    }}
                    className="p-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 shrink-0" />
                    )}
                  </button>

                  <Folder className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  <span className="truncate text-xs">{proj.name}</span>
                </div>

                {/* Hover actions for folder */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(activeMenuId === proj.id ? null : proj.id)
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                      title="Project options"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>

                    {activeMenuId === proj.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null)
                            onSelectProject(proj.id)
                            onNewSession('New Chat')
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null)
                            onDeleteProject(proj.id)
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Project</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectProject(proj.id)
                      onNewSession('New Chat')
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                    title="New chat in this project"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Nested Chats / Sessions */}
              {!isCollapsed && isProjectActive && (
                <div className="pl-4 space-y-0.5 mt-0.5">
                  {projectSessions.map(sess => {
                    const isSessionActive = activeSessionId === sess.id
                    const isEditing = editingSessionId === sess.id

                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          onSelectProject(proj.id)
                          onSelectSession(sess.id)
                        }}
                        title={sess.title}
                        className={cn(
                          'group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer select-none',
                          isSessionActive
                            ? 'bg-zinc-800 text-zinc-100 font-medium shadow-xs'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                        )}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editTitle}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleSaveRename(sess.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(sess.id)
                              if (e.key === 'Escape') setEditingSessionId(null)
                            }}
                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none"
                          />
                        ) : (
                          <span className="truncate flex-1 min-w-0 pr-2">
                            {sess.title}
                          </span>
                        )}

                        {/* Relative Timestamp or Hover Actions (fixed layout, zero size jump) */}
                        {!isEditing && (
                          <div className="relative flex items-center justify-end shrink-0 w-16 h-5">
                            <span className="text-[10px] text-zinc-500 group-hover:opacity-0 transition-opacity">
                              {formatRelativeTime(sess.updatedAt)}
                            </span>

                            <div className="absolute right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSessionMenuId(sessionMenuId === sess.id ? null : sess.id)
                                  }}
                                  className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                                  title="Chat options"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </button>

                                {sessionMenuId === sess.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => startRename(sess)}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Rename</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSessionMenuId(null)
                                        onDeleteSession(sess.id)
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteSession(sess.id)
                                }}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/40 cursor-pointer"
                                title="Delete chat"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {projects.length === 0 && (
          <div className="text-center py-10 px-4 space-y-1.5">
            <FolderPlus className="w-6 h-6 text-zinc-600 mx-auto" />
            <div className="text-xs text-zinc-500">No projects open</div>
            <button
              type="button"
              onClick={onPickFolder}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Open a project folder
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
