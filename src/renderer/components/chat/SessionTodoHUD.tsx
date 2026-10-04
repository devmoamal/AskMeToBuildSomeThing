import React, { useState } from 'react'
import {
  ListTodo,
  CheckCircle2,
  Circle,
  Loader2,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import type { SessionTodoItem } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface SessionTodoHUDProps {
  todos: SessionTodoItem[]
  onUpdateStatus?: (id: string, status: SessionTodoItem['status']) => void
  isGenerating?: boolean
  className?: string
}

export const SessionTodoHUD: React.FC<SessionTodoHUDProps> = ({
  todos,
  onUpdateStatus,
  isGenerating = false,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!todos || todos.length === 0) return null

  const total = todos.length
  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.find(t => t.status === 'in_progress')
  const percent = Math.round((completed / total) * 100)

  const handleToggle = (todo: SessionTodoItem) => {
    if (!onUpdateStatus) return
    const nextStatus = todo.status === 'completed' ? 'pending' : 'completed'
    onUpdateStatus(todo.id, nextStatus)
  }

  return (
    <div
      className={cn(
        'mx-4 my-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-md shadow-xs overflow-hidden transition-all duration-200',
        className
      )}
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2 flex items-center justify-between hover:bg-muted/40 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
            <ListTodo className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-semibold text-foreground tracking-tight">
              Tasks
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {completed}/{total} ({percent}%)
            </span>

            {/* Currently active task chip */}
            {inProgress && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium truncate max-w-[240px]">
                <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0" />
                <span className="truncate">{inProgress.content}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-2">
          {/* Progress Bar mini */}
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0 hidden xs:block">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="h-0.5 w-full bg-border/40">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Expandable Task List */}
      {isExpanded && (
        <div className="p-2.5 space-y-1 bg-muted/20 border-t border-border/30">
          {todos.map((todo) => {
            const isDone = todo.status === 'completed'
            const isRunning = todo.status === 'in_progress'
            const isCancelled = todo.status === 'cancelled'

            return (
              <div
                key={todo.id}
                onClick={() => handleToggle(todo)}
                className={cn(
                  'group flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-xs',
                  isDone && 'text-muted-foreground',
                  isRunning && 'bg-primary/5 text-foreground font-medium'
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  ) : isCancelled ? (
                    <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-xs leading-snug break-words',
                      isDone && 'line-through text-muted-foreground/80',
                      isCancelled && 'line-through text-muted-foreground/60'
                    )}
                  >
                    {todo.content}
                  </span>
                </div>

                {todo.priority && todo.priority !== 'medium' && (
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 uppercase tracking-wider',
                      todo.priority === 'high'
                        ? 'bg-rose-500/15 text-rose-500 font-semibold'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {todo.priority}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
