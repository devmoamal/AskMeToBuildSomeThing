import React, { useState, useRef } from 'react'
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  MoreHorizontal,
  Trash2,
  Search,
  X,
  Pencil
} from 'lucide-react'
import type { Project, ProjectSession } from '../../../shared/types'
import { cn } from '../../lib/utils'
import { useClickOutside } from '../../hooks/useClickOutside'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const projectMenuRef = useRef<HTMLDivElement>(null)
  const sessionMenuRef = useRef<HTMLDivElement>(null)

  useClickOutside(projectMenuRef, () => setActiveMenuId(null), Boolean(activeMenuId))
  useClickOutside(sessionMenuRef, () => setSessionMenuId(null), Boolean(sessionMenuId))

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

  const filteredProjects = projects.filter(p => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || sessions.some(s => s.projectId === p.id && s.title.toLowerCase().includes(q))
  })

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Action Row: Open Project + Search */}
      <div className="px-3.5 py-1.5 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onPickFolder}
          className="flex items-center gap-1.5 text-[13px] text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 font-medium"
          title="Open project folder"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Open project</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSearching(!isSearching)
            if (isSearching) setSearchQuery('')
          }}
          className={cn(
            'p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer',
            isSearching && 'text-zinc-200'
          )}
          title="Search projects"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Clean Minimal Search Input (only when active) */}
      {isSearching && (
        <div className="px-3.5 pb-2 relative">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-7 px-2.5 pr-6 rounded-md bg-[#141414] border border-[#262626] text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Project List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
        {filteredProjects.map(proj => {
          const isCollapsed = !!collapsedProjects[proj.id]
          const isProjectActive = activeProjectId === proj.id
          const projectSessions = isProjectActive ? sessions : []

          return (
            <div key={proj.id} className="space-y-0.5 mb-0.5">
              {/* Project Folder Header - Clean, no background box, starts at edge */}
              <div
                onClick={() => {
                  onSelectProject(proj.id)
                  toggleProject(proj.id)
                }}
                className={cn(
                  'group flex items-center justify-between px-1.5 py-1.5 rounded-md transition-colors cursor-pointer select-none',
                  isProjectActive
                    ? 'text-white font-medium'
                    : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  {!isCollapsed ? (
                    <FolderOpen className="w-4 h-4 shrink-0 transition-colors text-zinc-200" />
                  ) : (
                    <Folder className="w-4 h-4 shrink-0 transition-colors text-zinc-400 group-hover:text-zinc-300" />
                  )}
                  <span className="truncate text-sm font-semibold tracking-tight text-zinc-200 group-hover:text-white">{proj.name}</span>
                </div>

                {/* Hover Actions */}
                <div
                  className={cn(
                    'flex items-center gap-0.5 transition-opacity',
                    activeMenuId === proj.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectProject(proj.id)
                      onNewSession('New Chat')
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="New chat in project"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <div
                    className={cn(
                      'relative transition-opacity',
                      activeMenuId === proj.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    ref={activeMenuId === proj.id ? projectMenuRef : null}
                    onMouseLeave={() => {
                      if (activeMenuId === proj.id) setActiveMenuId(null)
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(activeMenuId === proj.id ? null : proj.id)
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Project options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuId === proj.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-32 bg-[#141414] border border-[#262626] rounded-md shadow-xl p-1 z-50 animate-in fade-in duration-100"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null)
                            onSelectProject(proj.id)
                            onNewSession('New Chat')
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-zinc-400" />
                          <span>New Chat</span>
                        </button>

                        <div className="h-px bg-[#262626] my-0.5" />

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null)
                            onDeleteProject(proj.id)
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nested Project Sessions - Clean indentation, no vertical line */}
              {!isCollapsed && isProjectActive && (
                <div className="pl-3 space-y-0.5 my-0.5">
                  {projectSessions.map(sess => {
                    const isSessionActive = activeSessionId === sess.id
                    const isEditing = editingSessionId === sess.id

                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          setSessionMenuId(null)
                          onSelectProject(proj.id)
                          onSelectSession(sess.id)
                        }}
                        title={sess.title}
                        className={cn(
                          'group flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer select-none',
                          isSessionActive
                            ? 'bg-zinc-800/80 text-white font-medium'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
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
                            className="flex-1 bg-[#111] border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none"
                          />
                        ) : (
                          <span className="truncate flex-1 min-w-0 pr-1.5 text-sm">{sess.title}</span>
                        )}

                        {!isEditing && (
                          <div
                            className={cn(
                              'relative transition-opacity',
                              sessionMenuId === sess.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            )}
                            ref={sessionMenuId === sess.id ? sessionMenuRef : null}
                            onMouseLeave={() => {
                              if (sessionMenuId === sess.id) setSessionMenuId(null)
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSessionMenuId(sessionMenuId === sess.id ? null : sess.id)
                              }}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Chat options"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>

                            {sessionMenuId === sess.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-32 bg-[#141414] border border-[#262626] rounded-md shadow-xl p-1 z-50 animate-in fade-in duration-100"
                              >
                                <button
                                  type="button"
                                  onClick={() => startRename(sess)}
                                  className="w-full flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Rename</span>
                                </button>

                                <div className="h-px bg-[#262626] my-0.5" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSessionMenuId(null)
                                    onDeleteSession(sess.id)
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
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
          <div className="text-center py-10 px-2 text-xs text-zinc-600">
            No projects open
          </div>
        )}
      </div>
    </div>
  )
}
