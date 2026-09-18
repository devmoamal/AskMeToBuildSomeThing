import React, { useState } from 'react'
import { FileText, FilePlus, Check, X, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/utils'

interface FileActionCardProps {
  toolCall: ToolCallRecord
  onApprove?: (toolCallId: string, approved: boolean) => void
}

export const FileActionCard: React.FC<FileActionCardProps> = ({ toolCall, onApprove }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const isWrite = toolCall.toolName === 'create_file'
  const filePath = toolCall.args?.path || 'unknown-path'
  const content = toolCall.args?.content || toolCall.result?.content || ''
  const isRequiresApproval = toolCall.status === 'requires_approval'

  const lines = toolCall.result?.lines || (content ? content.split('\n').length : 0)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2.5 rounded-xl border border-border/80 bg-card/60 overflow-hidden shadow-xs">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2 bg-muted/30 border-b border-border/40 cursor-pointer select-none hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {isWrite ? <FilePlus className="w-4 h-4 text-emerald-400 shrink-0" /> : <FileText className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="text-xs font-mono font-medium text-foreground truncate">{filePath}</span>
        </div>

        <div className="flex items-center gap-2">
          {lines > 0 && (
            <span className="text-[10px] text-muted-foreground/70 font-mono">
              {lines} line{lines !== 1 ? 's' : ''}
            </span>
          )}

          <Badge
            variant="outline"
            className={cn(
              'text-[10px] py-0 px-1.5',
              isWrite ? 'border-emerald-500/30 text-emerald-400' : 'border-blue-500/30 text-blue-400'
            )}
          >
            {isWrite ? 'Write File' : 'Read File'}
          </Badge>
        </div>
      </div>

      {/* Approval Prompt */}
      {isRequiresApproval && onApprove && (
        <div className="p-3 bg-amber-950/20 border-b border-amber-500/30 flex items-center justify-between">
          <span className="text-xs text-amber-200">The agent is requesting permission to write this file:</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApprove(toolCall.id, false)}
              className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-950/30"
            >
              <X className="w-3 h-3 mr-1" />
              <span>Cancel</span>
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(toolCall.id, true)}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Check className="w-3 h-3 mr-1" />
              <span>Approve Write</span>
            </Button>
          </div>
        </div>
      )}

      {/* Content Preview */}
      {isExpanded && content && (
        <div className="relative group p-3 bg-black/40 font-mono text-xs max-h-60 overflow-y-auto">
          <button
            onClick={handleCopy}
            title="Copy Content"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-muted/60 hover:bg-muted rounded text-muted-foreground transition-opacity cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <pre className="text-zinc-300 whitespace-pre-wrap">{content}</pre>
        </div>
      )}
    </div>
  )
}
