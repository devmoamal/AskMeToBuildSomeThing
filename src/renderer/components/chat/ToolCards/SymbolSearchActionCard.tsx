import React, { useState } from 'react'
import { Search, Code2, ChevronDown, ChevronRight, FileCode } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'

interface SymbolSearchActionCardProps {
  toolCall: ToolCallRecord
}

export const SymbolSearchActionCard: React.FC<SymbolSearchActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isOutline = toolCall.toolName === 'get_file_outline'
  const args = toolCall.args || {}
  const result = toolCall.result || {}
  const symbols = result.symbols || result.outline || []
  const query = args.query || args.path || ''

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Code2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">{toolCall.toolName}</span>
          <span className="text-[10px] text-muted-foreground truncate">"{query}"</span>
          <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] text-muted-foreground font-mono">
            {symbols.length || 0} symbols
          </span>
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-1 max-h-56 overflow-y-auto">
          {symbols.length === 0 ? (
            <div className="text-muted-foreground">No symbols found.</div>
          ) : (
            symbols.map((sym: any, idx: number) => {
              const name = typeof sym === 'string' ? sym : sym.name || sym.symbol
              const kind = typeof sym === 'object' ? sym.kind : ''
              const file = typeof sym === 'object' ? sym.file || sym.path : ''
              return (
                <div key={idx} className="flex items-center justify-between py-0.5 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-foreground truncate">{name}</span>
                    {kind && (
                      <span className="px-1 py-0.2 rounded bg-primary/10 text-primary text-[9px] uppercase">
                        {kind}
                      </span>
                    )}
                  </div>
                  {file && <span className="text-muted-foreground truncate ml-2">{file}</span>}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
