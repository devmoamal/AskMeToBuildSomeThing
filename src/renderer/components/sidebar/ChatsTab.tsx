import React, { useState } from 'react'
import {
  Plus,
  FolderPlus,
  Search,
  Trash2,
  MoreVertical,
  Pencil
} from 'lucide-react'
import type { Chat, ChatGroup } from '../../../shared/types'
import { GroupFolder } from './GroupFolder'
import { cn, formatRelativeTime } from '../../lib/utils'

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
  onDeleteChat
}) => {
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [chatMenuId, setChatMenuId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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

  return (
    <div className="flex flex-col h-full select-none">
      {/* Clean Actions Bar (without redundant 'Chats' title or harsh borders) */}
      <div className="flex items-center justify-between px-3 py-1 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsSearching(!isSearching)}
            className={cn(
              'p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer',
              isSearching && 'text-zinc-100 bg-zinc-800'
            )}
            title="Search chats"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsCreatingGroup(!isCreatingGroup)}
            className={cn(
              'p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer',
              isCreatingGroup && 'text-zinc-100 bg-zinc-800'
            )}
            title="New folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onNewChat('New Chat')}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
          title="Start a new chat"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Filter / Search bar */}
      {isSearching && (
        <div className="px-3 pb-1.5">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-700"
          />
        </div>
      )}

      {/* Inline Create Group Form */}
      {isCreatingGroup && (
        <form onSubmit={handleCreateGroup} className="px-3 pb-1.5 flex items-center gap-1.5">
          <input
            type="text"
            autoFocus
            placeholder="Folder name..."
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsCreatingGroup(false)
            }}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-700"
          />
          <button
            type="submit"
            className="px-2 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md cursor-pointer"
          >
            Save
          </button>
        </form>
      )}

      {/* Chat List Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {/* Groups */}
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
            />
          )
        })}

        {/* Ungrouped Chats */}
        {ungroupedChats.length > 0 && (
          <div className="space-y-0.5">
            {ungroupedChats.map(chat => {
              const isChatActive = activeChatId === chat.id
              const isEditing = editingChatId === chat.id

              return (
                <div
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  title={chat.title}
                  className={cn(
                    'group relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer select-none',
                    isChatActive
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
                      onBlur={() => handleSaveRename(chat.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(chat.id)
                        if (e.key === 'Escape') setEditingChatId(null)
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none"
                    />
                  ) : (
                    <span className="truncate flex-1 min-w-0 pr-2">{chat.title}</span>
                  )}

                  {/* Relative timestamp or hover actions (fixed layout, zero size jump) */}
                  {!isEditing && (
                    <div className="relative flex items-center justify-end shrink-0 w-16 h-5">
                      <span className="text-[10px] text-zinc-500 group-hover:opacity-0 transition-opacity">
                        {formatRelativeTime(chat.updatedAt)}
                      </span>

                      <div className="absolute right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setChatMenuId(chatMenuId === chat.id ? null : chat.id)
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                            title="Chat options"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>

                          {chatMenuId === chat.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50"
                            >
                              <button
                                type="button"
                                onClick={() => startRename(chat)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Rename</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setChatMenuId(null)
                                  onDeleteChat(chat.id)
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
                            onDeleteChat(chat.id)
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

        {chats.length === 0 && groups.length === 0 && (
          <div className="text-center py-10 px-4 space-y-1.5">
            <div className="text-xs text-zinc-500">No chats yet</div>
            <button
              type="button"
              onClick={() => onNewChat('New Chat')}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Start a new chat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
