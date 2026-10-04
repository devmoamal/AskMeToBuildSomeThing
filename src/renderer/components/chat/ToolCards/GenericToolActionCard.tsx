import React, { useState } from 'react'
import { Wrench, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { cn } from '../../../lib/utils'

interface GenericToolActionCardProps {
  toolCall: ToolCallRecord
}

export const GenericToolActionCard: React.FC<GenericToolActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isExecuting = toolCall.status === 'executing'
  const isFailed = toolCall.status === 'failed'
  const isCompleted = toolCall.status === 'completed'

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">{toolCall.toolName}</span>

          {isExecuting ? (
            <span className="flex items-center gap-1 text-[10px] text-primary">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              running...
            </span>
          ) : isFailed ? (
            <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 text-[10px] font-semibold flex items-center gap-1">
              <XCircle className="w-2.5 h-2.5" />
              failed
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              completed
            </span>
          )}
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-2 max-h-60 overflow-y-auto">
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Arguments</div>
              <pre className="p-1.5 rounded bg-muted/60 text-foreground overflow-x-auto text-[10px]">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.result !== undefined && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">Result</div>
              <pre className="p-1.5 rounded bg-muted/60 text-foreground overflow-x-auto text-[10px]">
                {typeof toolCall.result === 'string'
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div className="p-1.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px]">
              {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
