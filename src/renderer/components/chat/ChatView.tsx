import React, { useState } from 'react'
import { MessageList } from './MessageList'
import { ChatInput, type AttachedFile } from './ChatInput'
import type {
  Message,
  CanvasDocument,
  ProviderConfig
} from '../../../shared/types'
import { PanelLeftOpen, Pencil } from 'lucide-react'

interface ChatViewProps {
  mode: 'chat' | 'project'
  title: string
  rawTitle?: string
  targetId?: string | null
  onRenameCurrent?: (newTitle: string) => void
  folderPath?: string
  messages: Message[]
  canvases: CanvasDocument[]
  activeCanvas?: CanvasDocument | null
  onCloseCanvas?: () => void
  onSaveCanvas?: (canvas: CanvasDocument) => void
  onExpandCanvasModal?: (canvas: CanvasDocument) => void
  providers: ProviderConfig[]
  selectedProviderId?: string
  selectedModel?: string
  onSelectModel: (providerId: string, model: string) => void
  isGenerating: boolean
  onSend: (text: string, attachments?: AttachedFile[]) => void
  onAbort: () => void
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  mode,
  title,
  rawTitle,
  targetId,
  onRenameCurrent,
  folderPath,
  messages,
  canvases,
  activeCanvas,
  onCloseCanvas,
  onSaveCanvas,
  onExpandCanvasModal,
  providers,
  selectedProviderId,
  selectedModel,
  onSelectModel,
  isGenerating,
  onSend,
  onAbort,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')

  const handleStartRename = () => {
    if (!onRenameCurrent || !targetId) return
    setEditTitleValue(rawTitle || title)
    setIsEditingTitle(true)
  }

  const handleSaveRename = () => {
    if (editTitleValue.trim() && onRenameCurrent) {
      onRenameCurrent(editTitleValue.trim())
    }
    setIsEditingTitle(false)
  }

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-zinc-950">
      {/* Left / Main Chat Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Clean Thread Header */}
        <header className="h-11 px-4 flex items-center justify-between shrink-0 bg-zinc-950">
          <div className="flex items-center gap-2.5 truncate min-w-0">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
                title="Open sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none max-w-xs"
              />
            ) : (
              <div
                onClick={handleStartRename}
                className="group flex items-center gap-1.5 truncate cursor-pointer"
                title={targetId ? 'Click to rename' : undefined}
              >
                <span className="font-semibold text-xs text-zinc-200 truncate">{title}</span>
                {targetId && onRenameCurrent && (
                  <Pencil className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            )}

            {folderPath && (
              <span className="text-[11px] text-zinc-500 font-mono truncate max-w-xs">
                · {folderPath}
              </span>
            )}
          </div>
        </header>

        {/* Messages stream */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <MessageList
            messages={messages}
            isGenerating={isGenerating}
            onOpenCanvas={onOpenCanvas}
            onSubmitAnswers={onSubmitAnswers}
            onApproveTool={onApproveTool}
          />
        </div>

        {/* Bottom Message Input with Model Selector & Plus Menu */}
        <ChatInput
          mode={mode}
          isGenerating={isGenerating}
          providers={providers}
          selectedProviderId={selectedProviderId}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          onSend={onSend}
          onAbort={onAbort}
          placeholder={
            mode === 'project'
              ? 'Ask about this project, request code, or canvas notes...'
              : 'Ask questions, brainstorm, or type /canvas or /grill-me...'
          }
        />
      </div>
    </div>
  )
}
