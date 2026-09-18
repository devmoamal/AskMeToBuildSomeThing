import React, { useState, useEffect, useRef } from 'react'
import { FileCode, Copy, Check } from 'lucide-react'
import type { ToolCallRecord, CanvasDocument } from '../../../../shared/types'

interface CanvasCardProps {
  toolCall: ToolCallRecord
  onOpenCanvas?: (canvas: CanvasDocument) => void
}

export const CanvasCard: React.FC<CanvasCardProps> = ({ toolCall }) => {
  const [copied, setCopied] = useState(false)
  const args = toolCall.args || {}
  const title = args.title || 'Canvas Document'
  const language = args.language || 'text'
  const initialContent = args.content || toolCall.result?.content || ''

  const [content, setContent] = useState<string>(initialContent)
  const canvasId = toolCall.result?.canvasId || toolCall.id
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Synchronize when toolCall args/result update from agent stream
  useEffect(() => {
    if (initialContent && !content) {
      setContent(initialContent)
    }
  }, [initialContent])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContentChange = (newVal: string) => {
    setContent(newVal)

    // Debounced silent auto-save to database — no save button needed
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (window.api?.canvases?.save) {
          await window.api.canvases.save({
            id: canvasId,
            title,
            language,
            content: newVal
          })
        }
      } catch {
        // Silent catch for auto-save
      }
    }, 500)
  }

  // Count lines for status bar
  const lineCount = content ? content.split('\n').length : 1

  return (
    <div className="my-3 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/70 border-b border-zinc-800/80 text-xs text-zinc-300 select-none">
        <div className="flex items-center gap-2 truncate min-w-0">
          <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="font-medium text-xs text-zinc-200 truncate">{title}</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono text-[10px] uppercase shrink-0">
            {language}
          </span>
          <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline shrink-0">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
            title="Copy canvas content"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* In-Place Editable Canvas Area (No popup, no save button required) */}
      <div className="relative bg-zinc-950">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Canvas content..."
          spellCheck={false}
          className="w-full min-h-[160px] max-h-[480px] p-3.5 bg-transparent font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-y leading-relaxed border-0"
        />
      </div>
    </div>
  )
}
