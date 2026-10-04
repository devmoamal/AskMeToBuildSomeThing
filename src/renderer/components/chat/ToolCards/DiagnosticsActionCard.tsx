import React, { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Activity } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { cn } from '../../../lib/utils'

interface DiagnosticsActionCardProps {
  toolCall: ToolCallRecord
}

export const DiagnosticsActionCard: React.FC<DiagnosticsActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isExecuting = toolCall.status === 'executing'
  const isFailed = toolCall.status === 'failed'

  const result = toolCall.result
  const passed = result?.passed ?? (result?.errors?.length === 0)
  const errorCount = result?.errors?.length || 0
  const warningCount = result?.warnings?.length || 0

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">check_diagnostics</span>
          {isExecuting ? (
            <span className="text-[10px] text-primary animate-pulse">running diagnostics...</span>
          ) : passed ? (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              0 errors (clean)
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 text-[10px] font-semibold flex items-center gap-1">
              <XCircle className="w-2.5 h-2.5" />
              {errorCount} error(s){warningCount > 0 ? `, ${warningCount} warn` : ''}
            </span>
          )}
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-1.5 overflow-x-auto">
          {result?.summary && (
            <div className="text-muted-foreground font-sans">{result.summary}</div>
          )}
          {result?.errors && result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.map((err: any, idx: number) => (
                <div key={idx} className="p-1.5 rounded bg-rose-500/10 text-rose-400 font-mono text-[10px] border border-rose-500/20">
                  <span className="font-semibold">{err.file || 'Error'}:{err.line || ''}</span> - {err.message || JSON.stringify(err)}
                </div>
              ))}
            </div>
          )}
          {(!result?.errors || result.errors.length === 0) && (
            <div className="text-emerald-500 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No compiler or syntax errors detected in workspace.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
