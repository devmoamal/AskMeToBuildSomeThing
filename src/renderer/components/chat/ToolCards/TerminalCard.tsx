import React, { useState } from 'react'
import { Terminal, Check, X, Copy, Loader2, Play } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/utils'

interface TerminalCardProps {
  toolCall: ToolCallRecord
  onApprove?: (toolCallId: string, approved: boolean) => void
}

export const TerminalCard: React.FC<TerminalCardProps> = ({ toolCall, onApprove }) => {
  const [copied, setCopied] = useState(false)
  const args = toolCall.args || {}
  const command = args.command || ''
  const cwd = args.cwd || ''

  const isRequiresApproval = toolCall.status === 'requires_approval'
  const isExecuting = toolCall.status === 'executing'
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'

  const stdout = toolCall.result?.stdout || ''
  const stderr = toolCall.result?.stderr || toolCall.error || ''
  const exitCode = toolCall.result?.exitCode

  const handleCopy = () => {
    navigator.clipboard.writeText(stdout || stderr || command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2.5 rounded-xl border border-border/80 bg-black/40 overflow-hidden shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/30 border-b border-border/60">
        <div className="flex items-center gap-2 truncate">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <code className="text-xs font-mono font-medium text-foreground truncate">{command}</code>
        </div>

        <div className="flex items-center gap-2">
          {exitCode !== undefined && (
            <span className={cn('text-[10px] font-mono', exitCode === 0 ? 'text-green-400' : 'text-red-400')}>
              code: {exitCode}
            </span>
          )}

          <Badge
            variant="outline"
            className={cn(
              'text-[10px] py-0 px-1.5 capitalize',
              isExecuting && 'border-amber-500/40 text-amber-400 bg-amber-950/20',
              isCompleted && 'border-green-500/40 text-green-400 bg-green-950/20',
              isFailed && 'border-red-500/40 text-red-400 bg-red-950/20',
              isRequiresApproval && 'border-blue-500/40 text-blue-400 bg-blue-950/20'
            )}
          >
            {isExecuting && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1 inline" />}
            {toolCall.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Directory context */}
      {cwd && (
        <div className="px-3.5 py-1 text-[10px] font-mono text-muted-foreground/60 border-b border-border/30 bg-black/20 truncate">
          cwd: {cwd}
        </div>
      )}

      {/* Approval Prompt */}
      {isRequiresApproval && onApprove && (
        <div className="p-3 bg-blue-950/20 border-b border-blue-500/30 flex items-center justify-between">
          <span className="text-xs text-blue-200">The agent is requesting permission to run this command:</span>
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
              className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Play className="w-3 h-3 mr-1" />
              <span>Allow & Run</span>
            </Button>
          </div>
        </div>
      )}

      {/* Terminal Output Stream */}
      {(stdout || stderr) && (
        <div className="relative group p-3 font-mono text-xs max-h-48 overflow-y-auto bg-black/50">
          <button
            onClick={handleCopy}
            title="Copy Output"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-muted/60 hover:bg-muted rounded text-muted-foreground transition-opacity cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {stdout && <pre className="text-zinc-300 whitespace-pre-wrap">{stdout}</pre>}
          {stderr && <pre className="text-red-400 whitespace-pre-wrap mt-1">{stderr}</pre>}
        </div>
      )}
    </div>
  )
}
