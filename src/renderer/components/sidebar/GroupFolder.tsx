import React, { useState } from 'react'
import {
  Folder,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MoreVertical,
  Pencil
} from 'lucide-react'
import type { ChatGroup, Chat } from '../../../shared/types'
import { cn, formatRelativeTime } from '../../lib/utils'

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
  onDeleteChat
}) => {
  const [activeMenu, setActiveMenu] = useState(false)
  const [chatMenuId, setChatMenuId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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

  return (
    <div className="space-y-0.5">
      {/* Folder Header */}
      <div
        onClick={() => onToggleCollapse(group)}
        className="group flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(group)
            }}
            className="p-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
          >
            {group.isCollapsed ? (
              <ChevronRight className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0" />
            )}
          </button>

          <Folder className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
          <span className="truncate text-xs">{group.name}</span>
        </div>

        {/* Hover Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveMenu(!activeMenu)
              }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Folder options"
            >
              <MoreVertical className="w-3 h-3" />
            </button>

            {activeMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(false)
                    onNewChatInGroup(group.id)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded text-left cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(false)
                    onDeleteGroup(group.id)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 rounded text-left cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Folder</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNewChatInGroup(group.id)
            }}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            title="New chat in folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Nested Chats */}
      {!group.isCollapsed && (
        <div className="pl-4 space-y-0.5 mt-0.5">
          {chats.map((chat) => {
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
    </div>
  )
}

