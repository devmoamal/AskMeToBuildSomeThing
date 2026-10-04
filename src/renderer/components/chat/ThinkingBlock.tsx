import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Brain, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isGenerating?: boolean
}

/**
 * Enhanced reasoning block with elapsed timer, word count, and auto-expand.
 * Auto-expands while generating, collapses when done.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isGenerating }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finalElapsedRef = useRef(0)

  // Auto-expand while generating, collapse when done
  useEffect(() => {
    if (isGenerating) {
      setIsExpanded(true)
    } else {
      setIsExpanded(false)
    }
  }, [isGenerating])

  // Timer: count up every second while generating
  useEffect(() => {
    if (isGenerating) {
      // Reset if starting fresh
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Snapshot the final elapsed
      finalElapsedRef.current = elapsed
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating])

  if (!thinking.trim()) return null

  const wordCount = thinking.trim().split(/\s+/).filter(Boolean).length
  const displayElapsed = isGenerating ? elapsed : finalElapsedRef.current

  return (
    <div className="my-1.5 select-none">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="group/think inline-flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 transition-colors text-xs cursor-pointer bg-transparent border-none p-0 outline-none"
      >
        {isGenerating ? (
          <Brain
            className="w-3.5 h-3.5 shrink-0 text-blue-400 animate-pulse"
          />
        ) : (
          <CheckCircle2
            className="w-3.5 h-3.5 shrink-0 text-emerald-500 group-hover/think:text-emerald-400 transition-colors"
          />
        )}

        <span className="text-xs text-zinc-400 group-hover/think:text-zinc-200 transition-colors">
          {isGenerating
            ? `Thinking... ${displayElapsed}s`
            : `Thought for ${displayElapsed}s`}
        </span>

        {!isGenerating && wordCount > 0 && (
          <span className="text-[10px] text-zinc-600 bg-zinc-800/60 rounded px-1 py-px ml-0.5">
            ~{wordCount} words
          </span>
        )}

        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover/think:text-zinc-300 transition-colors" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover/think:text-zinc-300 transition-colors" />
        )}
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div
          className={cn(
            'mt-1.5 pl-3 py-0.5 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap select-text border-l transition-colors',
            isGenerating ? 'border-blue-500/40' : 'border-zinc-700/60'
          )}
        >
          {thinking}
        </div>
      </div>
    </div>
  )
}
