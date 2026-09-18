import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isGenerating?: boolean
}

/**
 * Clean seamless reasoning text (no box/container)
 * Click to expand/collapse thought stream
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isGenerating }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!thinking.trim()) return null

  return (
    <div className="my-1.5 select-none">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="group/think inline-flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 transition-colors text-xs cursor-pointer bg-transparent border-none p-0 outline-none"
      >
        <span className={cn('w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0 group-hover/think:bg-zinc-300 transition-colors', isGenerating && 'bg-blue-400 animate-pulse')} />
        <span className="text-xs text-zinc-400 group-hover/think:text-zinc-200 transition-colors">
          {isGenerating ? 'Thinking...' : 'Thought for a few seconds'}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover/think:text-zinc-300 transition-colors" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover/think:text-zinc-300 transition-colors" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-1.5 pl-3 border-l border-zinc-800 py-0.5 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap select-text">
          {thinking}
        </div>
      )}
    </div>
  )
}
