import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Check, Layers } from 'lucide-react'
import type { ToolCallRecord, CanvasDocument } from '../../../../shared/types'
import { TerminalActionCard } from './TerminalActionCard'
import { FileWriteActionCard } from './FileWriteActionCard'
import { FileReadActionCard } from './FileReadActionCard'
import { CanvasCard } from './CanvasCard'
import { QuestionnaireCard } from './QuestionnaireCard'
import { WebSearchActionCard } from './WebSearchActionCard'
import { VercelBadge } from '../../ui/VercelIcon'

interface AgentActivityTimelineProps {
  toolCalls: ToolCallRecord[]
  onOpenCanvas?: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
}

/**
 * Vercel AI SDK Tool Invocations Timeline
 * Groups multi-tool steps into a sleek collapsible Geist container
 */
export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({
  toolCalls,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool
}) => {
  const actionSteps = toolCalls.filter(tc =>
    tc.toolName === 'use_terminal' || tc.toolName === 'create_file' || tc.toolName === 'read_file' || tc.toolName === 'web_search'
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

  const summaryParts = []
  if (readCount > 0) summaryParts.push(`${readCount} read`)
  if (writeCount > 0) summaryParts.push(`${writeCount} create`)
  if (editCount > 0) summaryParts.push(`${editCount} edit`)
  if (cmdCount > 0) summaryParts.push(`${cmdCount} cmd${cmdCount !== 1 ? 's' : ''}`)
  if (searchCount > 0) summaryParts.push(`${searchCount} search${searchCount !== 1 ? 'es' : ''}`)

  return (
    <div className="space-y-1.5 select-text my-1.5">
      {actionSteps.length > 0 && (
        <div className="rounded-lg border border-[#222] bg-[#000000] overflow-hidden shadow-xs font-mono">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-3 flex items-center justify-between bg-[#0a0a0a] hover:bg-[#111] transition-colors cursor-pointer select-none text-[11px]"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-zinc-400 font-medium truncate">
                tool_invocations:
              </span>
              <span className="text-white font-semibold truncate">
                {summaryParts.join(', ') || `${totalCount} steps`}
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
                className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="p-2 space-y-1.5 bg-[#050505] border-t border-[#1a1a1a]">
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
                return null
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
