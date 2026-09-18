import React, { useState } from 'react'
import { Check, X, Copy, ChevronDown, ChevronRight, FilePlus, FileEdit } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface FileWriteActionCardProps {
  toolCall: ToolCallRecord
  onApprove?: (toolCallId: string, approved: boolean) => void
}

/**
 * Vercel AI SDK <Tool /> Primitive for create_file / edit_file
 * Clean Geist visual spec: #000000 card, #222 hairline border, diff badges
 */
export const FileWriteActionCard: React.FC<FileWriteActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isEdit = toolCall.toolName === 'edit_file'
  const filePath = toolCall.args?.path || 'unknown-path'
  const content = toolCall.args?.content || toolCall.result?.content || ''
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'
  const lines = toolCall.result?.lines || (content ? content.split('\n').length : 0)
  const addedLines = toolCall.result?.addedLines
  const removedLines = toolCall.result?.removedLines

  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const directory = lastSlashIndex !== -1 ? filePath.slice(0, lastSlashIndex + 1) : ''
  const filename = lastSlashIndex !== -1 ? filePath.slice(lastSlashIndex + 1) : filePath

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] cursor-pointer select-none text-[11px] ${
          isExpanded && content ? 'border-b border-[#222]' : ''
        }`}
      >
        {/* Left: Icon of creating/editing and filename only */}
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          {isEdit ? (
            <FileEdit className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <FilePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="text-zinc-100 font-semibold truncate text-xs" title={filePath}>
            {filename}
          </span>
          {directory && (
            <span className="text-[10px] text-zinc-600 truncate hidden md:inline">
              {directory}
            </span>
          )}
        </div>

        {/* Right: Diff badges (No written badge!) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isEdit ? (
            <>
              {addedLines !== undefined && addedLines > 0 && (
                <VercelBadge variant="success">
                  +{addedLines}
                </VercelBadge>
              )}
              {removedLines !== undefined && removedLines > 0 && (
                <VercelBadge variant="error">
                  -{removedLines}
                </VercelBadge>
              )}
              {(addedLines === undefined || (addedLines === 0 && removedLines === 0)) && lines > 0 && (
                <VercelBadge variant="default">
                  {lines} lines
                </VercelBadge>
              )}
            </>
          ) : (
            lines > 0 && (
              <VercelBadge variant="success">
                +{lines} line{lines !== 1 ? 's' : ''}
              </VercelBadge>
            )
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <X className="w-2.5 h-2.5" />
              <span>failed</span>
            </VercelBadge>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded hover:bg-[#1a1a1a]"
            title="Copy file content"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            type="button"
            className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && content && (
        <div className="p-3 bg-[#050505] text-[11px] max-h-60 overflow-y-auto leading-relaxed border-t border-[#1a1a1a] select-text scrollbar-thin">
          <pre className="text-zinc-300 whitespace-pre-wrap m-0 font-mono">{content}</pre>
        </div>
      )}
    </div>
  )
}
