import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { Message, CanvasDocument } from '../../../shared/types'
import { MessageBubble } from './MessageBubble'
import { Compass, Sparkles, Layers, FileCode, ArrowDown, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface MessageListProps {
  messages: Message[]
  isGenerating: boolean
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
  onRollback?: (message: Message) => void
  isPromptActive?: boolean
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool,
  onRollback,
  isPromptActive = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<{
    message: Message
    count: number
  } | null>(null)

  const handleRollbackRequest = (message: Message) => {
    const index = messages.findIndex(m => m.id === message.id)
    const count = index !== -1 ? messages.length - 1 - index : 0
    setRollbackTarget({ message, count })
  }

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    isAtBottomRef.current = isNearBottom
    setShowScrollBottom(!isNearBottom)
  }, [])

  // Auto-scroll instantly to bottom as new content streams, unless user scrolled up
  useEffect(() => {
    if (isAtBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, isGenerating, isPromptActive])

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
      isAtBottomRef.current = true
      setShowScrollBottom(false)
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
        <div className="max-w-md w-full space-y-6 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              AskMeToBuildSomeThing
            </h2>
            <p className="text-xs text-zinc-400">
              What would you like to build or explore today?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium mb-1">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>Architecture</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Scope components, schemas, and app logic
              </p>
            </div>

            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium mb-1">
                <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                <span>/canvas</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Generate markdown notes and specifications
              </p>
            </div>

            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium mb-1">
                <Compass className="w-3.5 h-3.5 text-zinc-400" />
                <span>Project Files</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Read, create, and iterate on project files
              </p>
            </div>

            <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 transition-all">
              <div className="flex items-center gap-2 text-zinc-200 text-xs font-medium mb-1">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>/grill-me</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Structured interactive questionnaires
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenCanvas={onOpenCanvas}
              onSubmitAnswers={onSubmitAnswers}
              onApproveTool={onApproveTool}
              onRollbackRequest={handleRollbackRequest}
            />
          ))}

          {isGenerating && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 pl-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Thinking...</span>
            </div>
          )}

          <div className={cn('transition-all duration-200', isPromptActive ? 'h-72' : 'h-2')} />
        </div>
      </div>

      {/* Floating Scroll to Bottom button when scrolled up */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            'absolute right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/95 border border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 shadow-xl backdrop-blur-md transition-all cursor-pointer z-20',
            isPromptActive ? 'bottom-80' : 'bottom-3'
          )}
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Latest</span>
        </button>
      )}

      {/* Vercel-style Rollback Confirmation Modal */}
      <Dialog open={Boolean(rollbackTarget)} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent className="max-w-[420px] bg-[#000000] border border-[#222222] text-zinc-100 p-6 rounded-xl shadow-2xl">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-500" />
              <span>Rollback to Message</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-normal">
              This will remove this message and subsequent items from history and move the text into your input box.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-3">
            {/* Target Message Preview */}
            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#222222] text-xs text-zinc-300 font-mono line-clamp-3 select-text max-h-24 overflow-y-auto leading-relaxed">
              {rollbackTarget?.message.content || 'Empty message'}
            </div>

            {rollbackTarget && (
              <div className="p-3 rounded-lg bg-[#14080a] border border-[#331418] text-xs text-rose-300 leading-relaxed">
                <p className="font-medium text-rose-300">
                  {rollbackTarget.count > 0
                    ? `Deletes this message and ${rollbackTarget.count} subsequent message${rollbackTarget.count !== 1 ? 's' : ''} from history.`
                    : 'Deletes this message from history.'}
                </p>
                <p className="text-[11px] text-rose-300/70 mt-1">
                  The message text will be placed in your chat input box ready for editing.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row justify-end items-center gap-2 pt-2 border-t border-[#1a1a1a]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRollbackTarget(null)}
              className="h-8 px-3 text-xs bg-transparent border-[#262626] text-zinc-400 hover:text-white hover:bg-[#161616] cursor-pointer rounded-md transition-colors"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => {
                if (rollbackTarget && onRollback) {
                  onRollback(rollbackTarget.message)
                }
                setRollbackTarget(null)
              }}
              className="h-8 px-3.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium cursor-pointer rounded-md transition-colors shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Confirm Rollback</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
