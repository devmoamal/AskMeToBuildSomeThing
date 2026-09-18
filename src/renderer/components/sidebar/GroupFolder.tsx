import React, { useState, useRef } from 'react'
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil
} from 'lucide-react'
import type { ChatGroup, Chat } from '../../../shared/types'
import { cn } from '../../lib/utils'
import { useClickOutside } from '../../hooks/useClickOutside'

interface GroupFolderProps {
  group: ChatGroup
  chats: Chat[]
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onToggleCollapse: (group: ChatGroup) => void
  onNewChatInGroup: (groupId: string) => void
  onRenameChat: (chatId: string, newTitle: string) => void
  onDeleteGroup: (groupId: string) => void
  onDeleteChat: (chatId: string) => void
  onMoveChatToGroup?: (chatId: string, groupId: string | null) => void
}

export const GroupFolder: React.FC<GroupFolderProps> = ({
  group,
  chats,
  activeChatId,
  onSelectChat,
  onToggleCollapse,
  onNewChatInGroup,
  onRenameChat,
  onDeleteGroup,
  onDeleteChat,
  onMoveChatToGroup
}) => {
  const [activeMenu, setActiveMenu] = useState(false)
  const [chatMenuId, setChatMenuId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggingChatId, setDraggingChatId] = useState<string | null>(null)

  const folderMenuRef = useRef<HTMLDivElement>(null)
  const chatMenuRef = useRef<HTMLDivElement>(null)

  useClickOutside(folderMenuRef, () => setActiveMenu(false), activeMenu)
  useClickOutside(chatMenuRef, () => setChatMenuId(null), Boolean(chatMenuId))

  const startRename = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditTitle(chat.title)
    setChatMenuId(null)
  }

  const handleSaveRename = (chatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim())
    }
    setEditingChatId(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const chatId = e.dataTransfer.getData('text/plain')
    if (chatId && onMoveChatToGroup) {
      onMoveChatToGroup(chatId, group.id)
      if (group.isCollapsed) {
        onToggleCollapse(group)
      }
    }
  }

  return (
    <div
      className="space-y-0.5 mb-0.5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Folder Header - Clean, no background box, starts at edge */}
      <div
        onClick={() => onToggleCollapse(group)}
        className={cn(
          'group flex items-center justify-between px-1.5 py-1.5 rounded-md transition-colors cursor-pointer select-none',
          isDragOver
            ? 'bg-blue-950/40 ring-1 ring-blue-500/50 text-blue-200'
            : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
        )}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {!group.isCollapsed ? (
            <FolderOpen className={cn(
              'w-4 h-4 shrink-0 transition-colors',
              isDragOver ? 'text-blue-400' : 'text-zinc-200'
            )} />
          ) : (
            <Folder className={cn(
              'w-4 h-4 shrink-0 transition-colors',
              isDragOver ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-300'
            )} />
          )}
          <span className="truncate text-sm font-semibold tracking-tight text-zinc-200 group-hover:text-white">{group.name}</span>
          {isDragOver && (
            <span className="text-[11px] text-blue-400 font-normal ml-1">Drop to move</span>
          )}
        </div>

        {/* Hover Actions */}
        <div
          className={cn(
            'flex items-center gap-0.5 transition-opacity',
            activeMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNewChatInGroup(group.id)
            }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="New chat in folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div
            className="relative"
            ref={folderMenuRef}
            onMouseLeave={() => {
              if (activeMenu) setActiveMenu(false)
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveMenu(!activeMenu)
              }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Folder options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {activeMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-32 bg-[#141414] border border-[#262626] rounded-md shadow-xl p-1 z-50 animate-in fade-in duration-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(false)
                    onNewChatInGroup(group.id)
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
                    setActiveMenu(false)
                    onDeleteGroup(group.id)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nested Chats - Clean indentation, no vertical line */}
      {!group.isCollapsed && (
        <div className="pl-3 space-y-0.5 my-0.5">
          {chats.map((chat) => {
            const isChatActive = activeChatId === chat.id
            const isEditing = editingChatId === chat.id

            return (
              <div
                key={chat.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', chat.id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDraggingChatId(chat.id)
                }}
                onDragEnd={() => setDraggingChatId(null)}
                onClick={() => {
                  setChatMenuId(null)
                  onSelectChat(chat.id)
                }}
                title={chat.title}
                className={cn(
                  'group flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors cursor-grab active:cursor-grabbing select-none',
                  isChatActive
                    ? 'bg-zinc-800/80 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]',
                  draggingChatId === chat.id && 'opacity-40 border border-dashed border-zinc-600'
                )}
              >
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editTitle}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveRename(chat.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(chat.id)
                      if (e.key === 'Escape') setEditingChatId(null)
                    }}
                    className="flex-1 bg-[#111] border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none"
                  />
                ) : (
                  <span className="truncate flex-1 min-w-0 pr-1.5">{chat.title}</span>
                )}

                {!isEditing && (
                  <div
                    className={cn(
                      'relative transition-opacity',
                      chatMenuId === chat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    ref={chatMenuId === chat.id ? chatMenuRef : null}
                    onMouseLeave={() => {
                      if (chatMenuId === chat.id) setChatMenuId(null)
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setChatMenuId(chatMenuId === chat.id ? null : chat.id)
                      }}
                      className="p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Chat options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {chatMenuId === chat.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-32 bg-[#141414] border border-[#262626] rounded-md shadow-xl p-1 z-50 animate-in fade-in duration-100"
                      >
                        <button
                          type="button"
                          onClick={() => startRename(chat)}
                          className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 text-zinc-400" />
                          <span>Rename</span>
                        </button>

                        <div className="h-px bg-[#262626] my-0.5" />

                        <button
                          type="button"
                          onClick={() => {
                            setChatMenuId(null)
                            onDeleteChat(chat.id)
                          }}
                          className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
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
}
