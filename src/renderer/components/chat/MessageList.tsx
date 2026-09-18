import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { Message, CanvasDocument } from '../../../shared/types'
import { MessageBubble } from './MessageBubble'
import { Compass, Sparkles, Layers, FileCode, ArrowDown } from 'lucide-react'

interface MessageListProps {
  messages: Message[]
  isGenerating: boolean
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

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
  }, [messages, isGenerating])

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
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenCanvas={onOpenCanvas}
              onSubmitAnswers={onSubmitAnswers}
              onApproveTool={onApproveTool}
            />
          ))}

          {isGenerating && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 pl-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>Thinking...</span>
            </div>
          )}

          <div className="h-2" />
        </div>
      </div>

      {/* Floating Scroll to Bottom button when scrolled up */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/95 border border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 shadow-xl backdrop-blur-md transition-all cursor-pointer z-20"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Latest</span>
        </button>
      )}
    </div>
  )
}
