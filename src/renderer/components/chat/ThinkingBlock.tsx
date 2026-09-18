import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ThinkingBlockProps {
  thinking: string
  isGenerating?: boolean
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isGenerating }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!thinking.trim()) return null

  return (
    <div className="mb-2.5">
      {/* Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer select-none transition-colors',
          'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80',
          isGenerating && 'text-blue-400'
        )}
      >
        <Sparkles className={cn('w-3 h-3 text-zinc-400', isGenerating && 'animate-pulse text-blue-400')} />
        <span>
          {isGenerating ? 'Thinking...' : 'Thought for a few seconds'}
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-500" />
        )}
      </button>

      {/* Expanded Reasoning */}
      {isExpanded && (
        <div className="mt-1.5 pl-3 border-l-2 border-zinc-800/80 py-1 space-y-1">
          <div className="text-xs text-zinc-400/90 leading-relaxed whitespace-pre-wrap font-sans">
            {thinking}
          </div>
        </div>
      )}
    </div>
  )
}
