import React, { useState } from 'react'
import { ListTodo, CheckCircle2, Circle, Loader2, MinusCircle, ChevronDown, ChevronRight } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'

interface TodoActionCardProps {
  toolCall: ToolCallRecord
}

export const TodoActionCard: React.FC<TodoActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const args = toolCall.args || {}
  const result = toolCall.result || {}
  const todos = result.todos || args.todos || []
  const completed = todos.filter((t: any) => t.status === 'completed').length

  return (
    <div className="rounded-lg border border-border/50 bg-card/60 overflow-hidden font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <ListTodo className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate">manage_todos</span>
          <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-semibold">
            {completed}/{todos.length} done
          </span>
        </div>

        <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-2.5 border-t border-border/40 bg-muted/20 text-[11px] space-y-1">
          {todos.length === 0 ? (
            <div className="text-muted-foreground">No tasks listed.</div>
          ) : (
            todos.map((t: any, idx: number) => {
              const isDone = t.status === 'completed'
              const isRunning = t.status === 'in_progress'
              const isCancelled = t.status === 'cancelled'

              return (
                <div key={idx} className="flex items-center gap-2 py-0.5 text-[11px]">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  ) : isCancelled ? (
                    <MinusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                  <span className={isDone || isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}>
                    {t.content}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
