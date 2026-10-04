import React, { useState, useRef, useEffect } from 'react'
import { MessageList } from './MessageList'
import { ChatInput, type AttachedFile } from './ChatInput'
import { DockedPromptBar } from './DockedPromptBar'
import { CanvasPanel } from '../canvas/CanvasPanel'
import { SessionTodoHUD } from './SessionTodoHUD'
import { SessionReviewModal } from './SessionReviewModal'
import { WorkspaceFileTree } from '../sidebar/WorkspaceFileTree'
import { KeyboardShortcutsModal } from '../ui/KeyboardShortcutsModal'
import type {
  Message,
  CanvasDocument,
  ProviderConfig,
  SessionTodoItem,
  FileTreeNode
} from '../../../shared/types'
import type { QuestionnairePayload } from '../../../shared/schemas'
import { PanelLeftOpen, Pencil, FolderTree, GitCompare, Keyboard, X } from 'lucide-react'
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
  tokenUsage?: { inputTokens: number; totalTokens: number } | null
  onSuggestionClick?: (text: string) => void
  sessionTodos?: SessionTodoItem[]
  onUpdateTodoStatus?: (id: string, status: SessionTodoItem['status']) => void
  executionMode?: 'build' | 'plan' | 'ask'
  onChangeExecutionMode?: (mode: 'build' | 'plan' | 'ask') => void
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
  onToggleSidebar,
  tokenUsage,
  onSuggestionClick,
  sessionTodos = [],
  onUpdateTodoStatus,
  executionMode = 'build',
  onChangeExecutionMode
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false)
  const [isFileTreeOpen, setIsFileTreeOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [workspaceFiles, setWorkspaceFiles] = useState<FileTreeNode[]>([])

  const [chatSplitPercent, setChatSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('chat_canvas_split_percent')
    return saved ? Math.max(25, Math.min(75, parseFloat(saved))) : 48
  })
  const isSplitResizingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load workspace file tree for context mentions
  useEffect(() => {
    let isMounted = true
    if (folderPath && window.api?.projects?.getDirectoryTree) {
      window.api.projects.getDirectoryTree(folderPath).then(tree => {
        if (isMounted && tree) {
          setWorkspaceFiles(tree)
        }
      }).catch(err => console.error('Failed to load directory tree:', err))
    } else {
      setWorkspaceFiles([])
    }
    return () => { isMounted = false }
  }, [folderPath])

  // Global hotkeys for file tree, review diffs, shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        if (folderPath) {
          e.preventDefault()
          setIsFileTreeOpen(prev => !prev)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        if (folderPath) {
          e.preventDefault()
          setIsReviewModalOpen(prev => !prev)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setIsShortcutsModalOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [folderPath])

  const handleOpenFileInCanvas = async (filePath: string, fileName: string) => {
    if (!window.api?.projects?.readFile) return
    try {
      const fileContent = await window.api.projects.readFile(filePath)
      if (typeof fileContent === 'string') {
        const ext = fileName.split('.').pop() || 'txt'
        const newCanvas: CanvasDocument = {
          id: `canvas_${Date.now()}`,
          projectSessionId: targetId || undefined,
          title: fileName,
          content: fileContent,
          language: ext,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        if (onSaveCanvas) {
          onSaveCanvas(newCanvas)
        }
        onOpenCanvas(newCanvas)
      }
    } catch (err) {
      console.error('Failed to open file in canvas:', err)
    }
  }

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
    <div ref={containerRef} className="flex-1 flex h-screen overflow-hidden bg-background relative">
      {/* Collapsible Workspace File Tree Drawer */}
      {folderPath && isFileTreeOpen && (
        <div className="w-64 h-full border-r border-border shrink-0 bg-card/90 backdrop-blur-xs flex flex-col z-10 transition-all select-none">
          <div className="h-11 px-3 flex items-center justify-between border-b border-border/60 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FolderTree className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] uppercase tracking-wider font-semibold">Workspace</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFileTreeOpen(false)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Close File Explorer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkspaceFileTree
              folderPath={folderPath}
              onOpenFileInCanvas={handleOpenFileInCanvas}
            />
          </div>
        </div>
      )}

      {/* Left / Main Chat Column */}
      {(!isCanvasFullscreen || !activeCanvas) && (
        <div
          style={activeCanvas && !isCanvasFullscreen ? { width: `${chatSplitPercent}%` } : undefined}
          className={cn(
            'flex flex-col h-full overflow-hidden min-w-0 transition-all duration-200',
            activeCanvas ? 'border-r border-border/80' : 'flex-1'
          )}
        >
          {/* Clean Thread Header */}
          <header className="h-11 px-4 flex items-center justify-between shrink-0 bg-background border-b border-border/40">
            <div className="flex items-center gap-2.5 truncate min-w-0">
              {!activeCanvas && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className={cn(
                    'side-toggle-btn flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 cursor-pointer shrink-0 transition-all',
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
                  className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground outline-none max-w-xs"
                />
              ) : (
                <div
                  onClick={handleStartRename}
                  className="group flex items-center gap-1.5 truncate cursor-pointer"
                  title={targetId ? 'Click to rename' : undefined}
                >
                  <span className="font-semibold text-xs text-foreground truncate">{title}</span>
                  {targetId && onRenameCurrent && (
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              )}

              {folderPath && (
                <span className="text-[11px] text-muted-foreground font-mono truncate max-w-xs hidden sm:inline">
                  · {folderPath}
                </span>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {folderPath && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsFileTreeOpen(prev => !prev)}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors cursor-pointer',
                      isFileTreeOpen
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                    title="Toggle Workspace Files Explorer (Ctrl+Shift+F)"
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Files</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(true)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                    title="Review Session Diffs (Ctrl+Shift+D)"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="hidden sm:inline">Diff</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(true)}
                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                title="Keyboard Shortcuts (Ctrl+/)"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Session Task Checklist HUD */}
          {sessionTodos && sessionTodos.length > 0 && (
            <SessionTodoHUD
              todos={sessionTodos}
              onUpdateStatus={onUpdateTodoStatus}
              isGenerating={isGenerating}
            />
          )}

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
              onSuggestionClick={onSuggestionClick}
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
            tokenUsage={tokenUsage}
            executionMode={executionMode}
            onChangeExecutionMode={onChangeExecutionMode}
            workspaceFiles={workspaceFiles}
            onOpenDiffReview={folderPath ? () => setIsReviewModalOpen(true) : undefined}
            placeholder={
              mode === 'project'
                ? 'Ask about this project, request code, or canvas notes... (use @ for files)'
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
          className="w-2 h-full cursor-col-resize shrink-0 bg-transparent hover:bg-primary/30 active:bg-primary/60 z-20 transition-colors flex items-center justify-center -mx-1 group select-none"
          title="Drag to resize panels"
        >
          <div className="w-[2px] h-8 rounded-full bg-transparent group-hover:bg-primary group-active:bg-primary transition-colors" />
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

      {/* Session Changes / Diff Review Modal */}
      {folderPath && (
        <SessionReviewModal
          folderPath={folderPath}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
        />
      )}

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </div>
  )
}
