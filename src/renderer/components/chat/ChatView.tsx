import React, { useState, useRef } from 'react'
import { MessageList } from './MessageList'
import { ChatInput, type AttachedFile } from './ChatInput'
import { DockedPromptBar } from './DockedPromptBar'
import { CanvasPanel } from '../canvas/CanvasPanel'
import type {
  Message,
  CanvasDocument,
  ProviderConfig
} from '../../../shared/types'
import type { QuestionnairePayload } from '../../../shared/schemas'
import { PanelLeftOpen, Pencil } from 'lucide-react'
import { cn } from '../../lib/utils'

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
  onApplyAiAction?: (action: string, canvas: CanvasDocument) => Promise<void> | void
  providers: ProviderConfig[]
  selectedProviderId?: string
  selectedModel?: string
  onSelectModel: (providerId: string, model: string) => void
  isGenerating: boolean
  activeQuestionnaire?: {
    toolCallId: string
    payload: QuestionnairePayload
  } | null
  activeApproval?: {
    toolCallId: string
    toolName: string
    args: any
  } | null
  onSend: (text: string, attachments?: AttachedFile[]) => void
  onAbort: () => void
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
  onCancelPrompt?: () => void
  onRollback?: (message: Message) => void
  promptDraft?: string | null
  onPromptDraftConsumed?: () => void
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
  onApplyAiAction,
  providers,
  selectedProviderId,
  selectedModel,
  onSelectModel,
  isGenerating,
  activeQuestionnaire,
  activeApproval,
  onSend,
  onAbort,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool,
  onCancelPrompt,
  onRollback,
  promptDraft,
  onPromptDraftConsumed,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false)
  const [chatSplitPercent, setChatSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('chat_canvas_split_percent')
    return saved ? Math.max(25, Math.min(75, parseFloat(saved))) : 48
  })
  const isSplitResizingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const startSplitResizing = (e: React.MouseEvent) => {
    e.preventDefault()
    isSplitResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isSplitResizingRef.current) return
      const relativeX = moveEvent.clientX - containerRect.left
      const newPercent = Math.max(25, Math.min(75, (relativeX / containerRect.width) * 100))
      setChatSplitPercent(newPercent)
    }

    const handleMouseUp = () => {
      if (isSplitResizingRef.current) {
        isSplitResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setChatSplitPercent(current => {
          localStorage.setItem('chat_canvas_split_percent', current.toString())
          return current
        })
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

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
    <div ref={containerRef} className="flex-1 flex h-screen overflow-hidden bg-zinc-950 relative">
      {/* Left / Main Chat Column */}
      {(!isCanvasFullscreen || !activeCanvas) && (
        <div
          style={activeCanvas && !isCanvasFullscreen ? { width: `${chatSplitPercent}%` } : undefined}
          className={cn(
            'flex flex-col h-full overflow-hidden min-w-0 transition-all duration-200',
            activeCanvas ? 'border-r border-zinc-900/80' : 'flex-1'
          )}
        >
          {/* Clean Thread Header */}
          <header className="h-11 px-4 flex items-center justify-between shrink-0 bg-zinc-950">
            <div className="flex items-center gap-2.5 truncate min-w-0">
              {!activeCanvas && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className={cn(
                    'side-toggle-btn flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:scale-90 cursor-pointer shrink-0',
                    isSidebarOpen
                      ? 'w-0 h-7 p-0 opacity-0 scale-75 pointer-events-none -mr-2.5 overflow-hidden'
                      : 'w-7 h-7 p-1 opacity-100 scale-100 mr-0'
                  )}
                  title="Open sidebar (Ctrl+B)"
                  aria-label="Open sidebar"
                  tabIndex={isSidebarOpen ? -1 : 0}
                >
                  <PanelLeftOpen className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
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
          <div className="flex-1 overflow-hidden flex flex-col relative">
            <MessageList
              messages={messages}
              isGenerating={isGenerating}
              onOpenCanvas={onOpenCanvas}
              onSubmitAnswers={onSubmitAnswers}
              onApproveTool={onApproveTool}
              onRollback={onRollback}
              isPromptActive={Boolean(activeQuestionnaire || activeApproval)}
            />
          </div>

          {/* Bottom Message Input with Model Selector & Plus Menu */}
          <ChatInput
            mode={mode}
            isGenerating={isGenerating}
            isPromptActive={Boolean(activeQuestionnaire || activeApproval)}
            providers={providers}
            selectedProviderId={selectedProviderId}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            onSend={onSend}
            onAbort={onAbort}
            promptDraft={promptDraft}
            onPromptDraftConsumed={onPromptDraftConsumed}
            placeholder={
              mode === 'project'
                ? 'Ask about this project, request code, or canvas notes...'
                : 'Ask questions, brainstorm, or type /canvas or /grill-me...'
            }
            promptBar={
              <DockedPromptBar
                activeQuestionnaire={activeQuestionnaire ?? null}
                activeApproval={activeApproval ?? null}
                onSubmitAnswers={onSubmitAnswers || (() => {})}
                onApproveTool={onApproveTool || (() => {})}
                onCancel={onCancelPrompt}
              />
            }
          />
        </div>
      )}

      {/* Resizable Divider between Chat and Canvas */}
      {activeCanvas && !isCanvasFullscreen && (
        <div
          onMouseDown={startSplitResizing}
          className="w-2 h-full cursor-col-resize shrink-0 bg-transparent hover:bg-blue-500/30 active:bg-blue-500/60 z-20 transition-colors flex items-center justify-center -mx-1 group select-none"
          title="Drag to resize panels"
        >
          <div className="w-[2px] h-8 rounded-full bg-transparent group-hover:bg-blue-400 group-active:bg-blue-400 transition-colors" />
        </div>
      )}

      {/* Right / Side-by-Side Canvas Workspace (ChatGPT Style) */}
      {activeCanvas && (
        <div className="flex-1 h-full min-w-0 overflow-hidden">
          <CanvasPanel
            canvas={activeCanvas}
            isFullscreen={isCanvasFullscreen}
            onToggleFullscreen={() => setIsCanvasFullscreen(!isCanvasFullscreen)}
            onClose={() => {
              setIsCanvasFullscreen(false)
              if (onCloseCanvas) onCloseCanvas()
            }}
            onSave={onSaveCanvas || (() => {})}
          />
        </div>
      )}
    </div>
  )
}
