import React, { useState } from 'react'
import { GitBranch, GitCommit, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { cn } from '../../../lib/utils'

interface GitStatusActionCardProps {
  toolCall: ToolCallRecord
}

export const GitStatusActionCard: React.FC<GitStatusActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const result = toolCall.result
  const branch = result?.branch || 'git'
  const files = result?.files || result?.changedFiles || []
  const clean = result?.clean ?? (files.length === 0)

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">git_status</span>
          <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] text-muted-foreground font-mono">
            {branch}
          </span>
          {clean ? (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">
              clean
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 text-[10px] font-semibold">
              {files.length} changed
            </span>
          )}
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-1">
          {files.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Working tree clean, no uncommitted changes.
            </div>
          ) : (
            <div className="space-y-0.5">
              {files.map((f: any, idx: number) => {
                const pathStr = typeof f === 'string' ? f : f.path || f.file
                const statusStr = typeof f === 'object' ? f.status : 'modified'
                return (
                  <div key={idx} className="flex items-center justify-between py-0.5 text-[10px]">
                    <span className="truncate text-foreground/90">{pathStr}</span>
                    <span className="px-1 py-0.2 rounded bg-amber-500/15 text-amber-500 font-mono text-[9px] uppercase">
                      {statusStr}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
