import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Check, Layers } from 'lucide-react'
import type { ToolCallRecord, CanvasDocument } from '../../../../shared/types'
import { TerminalActionCard } from './TerminalActionCard'
import { FileWriteActionCard } from './FileWriteActionCard'
import { FileReadActionCard } from './FileReadActionCard'
import { CanvasCard } from './CanvasCard'
import { QuestionnaireCard } from './QuestionnaireCard'
import { WebSearchActionCard } from './WebSearchActionCard'
import { ReadUrlActionCard } from './ReadUrlActionCard'
import { ExplorationActionCard } from './ExplorationActionCard'
import { DiagnosticsActionCard } from './DiagnosticsActionCard'
import { GitStatusActionCard } from './GitStatusActionCard'
import { CheckpointActionCard } from './CheckpointActionCard'
import { SymbolSearchActionCard } from './SymbolSearchActionCard'
import { TodoActionCard } from './TodoActionCard'
import { GenericToolActionCard } from './GenericToolActionCard'
import { VercelBadge } from '../../ui/VercelIcon'

interface AgentActivityTimelineProps {
  toolCalls: ToolCallRecord[]
  onOpenCanvas?: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
}

/**
 * Universal Agent Tool Activity Timeline
 * Cleanly groups and renders all multi-turn tool steps with theme-aware styling
 */
export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({
  toolCalls,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool
}) => {
  // All action steps except canvas and interactive questionnaire
  const actionSteps = toolCalls.filter(tc =>
    tc.toolName !== 'make_canvas' &&
    tc.toolName !== 'ask_user'
  )
  const canvasCalls = toolCalls.filter(tc => tc.toolName === 'make_canvas')
  const questionnaireCalls = toolCalls.filter(tc => tc.toolName === 'ask_user')

  const hasExecuting = actionSteps.some(tc => tc.status === 'executing')
  const hasApproval = actionSteps.some(tc => tc.status === 'requires_approval')
  const hasFailed = actionSteps.some(tc => tc.status === 'failed')
  const completedCount = actionSteps.filter(tc => tc.status === 'completed').length
  const totalCount = actionSteps.length

  const [isExpanded, setIsExpanded] = useState(hasExecuting || hasApproval)
  const prevExecutingRef = React.useRef(hasExecuting || hasApproval)

  useEffect(() => {
    const isBusy = hasExecuting || hasApproval
    if (isBusy && !prevExecutingRef.current) {
      setIsExpanded(true)
    } else if (!isBusy && prevExecutingRef.current) {
      setIsExpanded(false)
    }
    prevExecutingRef.current = isBusy
  }, [hasExecuting, hasApproval])

  const readCount = actionSteps.filter(tc => tc.toolName === 'read_file').length
  const writeCount = actionSteps.filter(tc => tc.toolName === 'create_file').length
  const editCount = actionSteps.filter(tc => tc.toolName === 'edit_file').length
  const cmdCount = actionSteps.filter(tc => tc.toolName === 'use_terminal').length
  const searchCount = actionSteps.filter(tc => tc.toolName === 'web_search').length
  const crawlCount = actionSteps.filter(tc => tc.toolName === 'read_url').length
  const diagCount = actionSteps.filter(tc => tc.toolName === 'check_diagnostics').length
  const gitCount = actionSteps.filter(tc => tc.toolName === 'git_status' || tc.toolName === 'manage_checkpoints').length
  const symbolCount = actionSteps.filter(tc => tc.toolName === 'search_symbols' || tc.toolName === 'get_file_outline').length
  const todoCount = actionSteps.filter(tc => tc.toolName === 'manage_todos').length
  const exploreCount = actionSteps.filter(tc => tc.toolName === 'list_dir' || tc.toolName === 'find_files' || tc.toolName === 'search_code').length

  const summaryParts = []
  if (todoCount > 0) summaryParts.push(`${todoCount} task update`)
  if (diagCount > 0) summaryParts.push(`${diagCount} diagnostics`)
  if (symbolCount > 0) summaryParts.push(`${symbolCount} symbol search`)
  if (gitCount > 0) summaryParts.push(`${gitCount} git checkpoint`)
  if (exploreCount > 0) summaryParts.push(`${exploreCount} explore`)
  if (readCount > 0) summaryParts.push(`${readCount} read`)
  if (writeCount > 0) summaryParts.push(`${writeCount} create`)
  if (editCount > 0) summaryParts.push(`${editCount} edit`)
  if (cmdCount > 0) summaryParts.push(`${cmdCount} cmd${cmdCount !== 1 ? 's' : ''}`)
  if (searchCount > 0) summaryParts.push(`${searchCount} search${searchCount !== 1 ? 'es' : ''}`)
  if (crawlCount > 0) summaryParts.push(`${crawlCount} crawl${crawlCount !== 1 ? 's' : ''}`)

  return (
    <div className="space-y-1.5 select-text my-1.5">
      {actionSteps.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs font-mono">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-3 flex items-center justify-between bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer select-none text-[11px]"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground font-medium truncate">
                tool_invocations:
              </span>
              <span className="text-foreground font-semibold truncate">
                {summaryParts.slice(0, 3).join(', ') || `${totalCount} steps`}
                {summaryParts.length > 3 && ` +${summaryParts.length - 3} more`}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              {hasExecuting ? (
                <VercelBadge variant="blue">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>running ({completedCount}/{totalCount})</span>
                </VercelBadge>
              ) : hasApproval ? (
                <VercelBadge variant="warning">
                  <span>approval needed</span>
                </VercelBadge>
              ) : hasFailed ? (
                <VercelBadge variant="error">
                  <span>error</span>
                </VercelBadge>
              ) : (
                <VercelBadge variant="success">
                  <Check className="w-2.5 h-2.5" />
                  <span>{totalCount} finished</span>
                </VercelBadge>
              )}

              <button
                type="button"
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="p-2 space-y-1.5 bg-card/60 border-t border-border/40">
              {actionSteps.map(tc => {
                if (tc.toolName === 'use_terminal') {
                  return <TerminalActionCard key={tc.id} toolCall={tc} onApprove={onApproveTool} />
                }
                if (tc.toolName === 'create_file' || tc.toolName === 'edit_file') {
                  return <FileWriteActionCard key={tc.id} toolCall={tc} onApprove={onApproveTool} />
                }
                if (tc.toolName === 'read_file') {
                  return <FileReadActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'web_search') {
                  return <WebSearchActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'read_url') {
                  return <ReadUrlActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'list_dir' || tc.toolName === 'find_files' || tc.toolName === 'search_code') {
                  return <ExplorationActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'check_diagnostics') {
                  return <DiagnosticsActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'git_status') {
                  return <GitStatusActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'manage_checkpoints') {
                  return <CheckpointActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'search_symbols' || tc.toolName === 'get_file_outline') {
                  return <SymbolSearchActionCard key={tc.id} toolCall={tc} />
                }
                if (tc.toolName === 'manage_todos') {
                  return <TodoActionCard key={tc.id} toolCall={tc} />
                }
                return <GenericToolActionCard key={tc.id} toolCall={tc} />
              })}
            </div>
          )}
        </div>
      )}

      {canvasCalls.map(tc => (
        <CanvasCard key={tc.id} toolCall={tc} onOpenCanvas={onOpenCanvas} />
      ))}

      {questionnaireCalls.map(tc => (
        <QuestionnaireCard
          key={tc.id}
          toolCall={tc}
          onSubmitAnswers={onSubmitAnswers}
        />
      ))}
    </div>
  )
}
