import React, { useState } from 'react'
import { History, ShieldCheck, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'

interface CheckpointActionCardProps {
  toolCall: ToolCallRecord
}

export const CheckpointActionCard: React.FC<CheckpointActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const args = toolCall.args || {}
  const result = toolCall.result || {}
  const action = args.action || result.action || 'create'

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          {action === 'restore' ? (
            <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          <span className="font-semibold text-foreground truncate">manage_checkpoints</span>
          <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-semibold">
            {action}
          </span>
          {args.description && (
            <span className="text-[10px] text-muted-foreground truncate">
              "{args.description}"
            </span>
          )}
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-1">
          {result.message && <div className="text-foreground/90">{result.message}</div>}
          {result.checkpoint && (
            <div className="text-[10px] text-muted-foreground font-mono">
              Checkpoint: {result.checkpoint.id || result.checkpoint.hash || ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
