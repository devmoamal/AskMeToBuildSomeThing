import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface FileReadActionCardProps {
  toolCall: ToolCallRecord
}

/**
 * Vercel AI SDK <Tool /> Primitive for read_file
 * Strict Geist aesthetic: #000000 card, #222 hairline border, monospace badges
 */
export const FileReadActionCard: React.FC<FileReadActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const filePath = toolCall.args?.path || 'unknown-file'
  const content = toolCall.result?.content || ''
  const isExecuting = toolCall.status === 'executing'
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'
  const lines = toolCall.result?.lines || (content ? content.split('\n').length : 0)

  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const directory = lastSlashIndex !== -1 ? filePath.slice(0, lastSlashIndex + 1) : ''
  const filename = lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => content && setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] cursor-pointer select-none text-[11px] ${
          isExpanded && content ? 'border-b border-[#222]' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-zinc-100 font-semibold truncate text-xs" title={filePath}>
            {filename}
          </span>
          {directory && (
            <span className="text-[10px] text-zinc-600 truncate hidden md:inline">
              {directory}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {lines > 0 && (
            <VercelBadge variant="default">
              {lines} lines
            </VercelBadge>
          )}

          {isExecuting && (
            <VercelBadge variant="blue">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse shrink-0"></span>
              <span>reading</span>
            </VercelBadge>
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <span>error</span>
            </VercelBadge>
          )}

          {content && (
            <button
              type="button"
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Inspect payload'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && content && (
        <div className="relative p-3 bg-[#050505] text-[11px] leading-relaxed select-text border-t border-[#1a1a1a]">
          <pre className="text-zinc-300 whitespace-pre-wrap m-0 max-h-48 overflow-y-auto font-mono scrollbar-thin">{content}</pre>
        </div>
      )}
    </div>
  )
}
