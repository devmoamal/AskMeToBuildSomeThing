import React, { useState, useRef } from 'react'
import {
  Plus,
  FolderPlus,
  Search,
  X,
  Trash2,
  MoreHorizontal,
  Pencil
} from 'lucide-react'
import type { Chat, ChatGroup } from '../../../shared/types'
import { GroupFolder } from './GroupFolder'
import { cn } from '../../lib/utils'
import { useClickOutside } from '../../hooks/useClickOutside'

interface ChatsTabProps {
  chats: Chat[]
  groups: ChatGroup[]
  activeChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: (title?: string, groupId?: string | null) => void
  onNewGroup: (name: string) => void
  onToggleGroupCollapse: (group: ChatGroup) => void
  onRenameChat: (chatId: string, newTitle: string) => void
  onDeleteGroup: (groupId: string) => void
  onDeleteChat: (chatId: string) => void
  onMoveChatToGroup?: (chatId: string, groupId: string | null) => void
}

export const ChatsTab: React.FC<ChatsTabProps> = ({
  chats,
  groups,
  activeChatId,
  onSelectChat,
  onNewChat,
  onNewGroup,
  onToggleGroupCollapse,
  onRenameChat,
  onDeleteGroup,
  onDeleteChat,
  onMoveChatToGroup
}) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [chatMenuId, setChatMenuId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [isDragOverUngrouped, setIsDragOverUngrouped] = useState(false)
  const [draggingChatId, setDraggingChatId] = useState<string | null>(null)

  const chatMenuRef = useRef<HTMLDivElement>(null)
  useClickOutside(chatMenuRef, () => setChatMenuId(null), Boolean(chatMenuId))

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    if (groupNameInput.trim()) {
      onNewGroup(groupNameInput.trim())
      setGroupNameInput('')
      setIsCreatingGroup(false)
    }
  }

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

  const filteredChats = chats.filter(c => {
    if (!searchQuery.trim()) return true
    return c.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const ungroupedChats = filteredChats.filter(c => !c.groupId)

  const handleUngroupedDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!isDragOverUngrouped) setIsDragOverUngrouped(true)
  }

  const handleUngroupedDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOverUngrouped(false)
  }

  const handleUngroupedDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOverUngrouped(false)
    const chatId = e.dataTransfer.getData('text/plain')
    if (chatId && onMoveChatToGroup) {
      onMoveChatToGroup(chatId, null)
    }
  }

  return (
    <div className="flex flex-col h-full select-none">
      {/* Top Action Row: New Chat + Folder + Search */}
      <div className="px-3.5 py-1.5 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => onNewChat('New Chat')}
          className="flex items-center gap-1.5 text-[13px] text-zinc-300 hover:text-white transition-colors cursor-pointer py-1 font-medium"
          title="New chat (Ctrl+N)"
        >
          <Plus className="w-4 h-4" />
          <span>New chat</span>
        </button>

        <div className="flex items-center gap-1">
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
            title="Search chats"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingGroup(!isCreatingGroup)}
            className={cn(
              'p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer',
              isCreatingGroup && 'text-zinc-200'
            )}
            title="New folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Clean Minimal Search Input (only when active) */}
      {isSearching && (
        <div className="px-3.5 pb-2 relative">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
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

      {/* Clean Inline Create Folder Form */}
      {isCreatingGroup && (
        <form onSubmit={handleCreateGroup} className="px-3.5 pb-2 flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            placeholder="Folder name..."
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsCreatingGroup(false)
            }}
            className="flex-1 h-7 px-2.5 bg-[#141414] border border-[#262626] rounded-md text-xs text-zinc-200 outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            className="h-7 px-2.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md cursor-pointer transition-colors"
          >
            Add
          </button>
        </form>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin">
        {/* Folders */}
        {groups.map(group => {
          const groupChats = filteredChats.filter(c => c.groupId === group.id)
          return (
            <GroupFolder
              key={group.id}
              group={group}
              chats={groupChats}
              activeChatId={activeChatId}
              onSelectChat={onSelectChat}
              onToggleCollapse={onToggleGroupCollapse}
              onNewChatInGroup={(gId) => onNewChat('New Chat', gId)}
              onRenameChat={onRenameChat}
              onDeleteGroup={onDeleteGroup}
              onDeleteChat={onDeleteChat}
              onMoveChatToGroup={onMoveChatToGroup}
            />
          )
        })}

        {/* Ungrouped Chats Drop Zone */}
        <div
          onDragOver={handleUngroupedDragOver}
          onDragLeave={handleUngroupedDragLeave}
          onDrop={handleUngroupedDrop}
          className={cn(
            'rounded-lg transition-all duration-150 p-0.5 space-y-0.5 min-h-[32px]',
            isDragOverUngrouped && 'bg-blue-950/20 border border-dashed border-blue-500/50 ring-1 ring-blue-500/30'
          )}
        >
          {isDragOverUngrouped && (
            <div className="text-[11px] text-blue-300/80 text-center py-1.5 font-medium pointer-events-none">
              Drop here to move out of folder
            </div>
          )}

          {ungroupedChats.map(chat => {
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
                    className="flex-1 bg-[#111] border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none"
                  />
                ) : (
                  <span className="truncate flex-1 min-w-0 pr-1.5 text-sm">{chat.title}</span>
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
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
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
                          className="w-full flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Rename</span>
                        </button>

                        <div className="h-px bg-[#262626] my-0.5" />

                        <button
                          type="button"
                          onClick={() => {
                            setChatMenuId(null)
                            onDeleteChat(chat.id)
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

        {chats.length === 0 && groups.length === 0 && (
          <div className="text-center py-10 px-2 text-xs text-zinc-600">
            No chats yet
          </div>
        )}
      </div>
    </div>
  )
}
