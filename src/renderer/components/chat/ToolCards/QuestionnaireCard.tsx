import React from 'react'
import { HelpCircle, CheckCircle2 } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface QuestionnaireCardProps {
  toolCall: ToolCallRecord
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
}

/**
 * Vercel AI SDK Decision / Questionnaire Resolution Component
 * Strict Geist aesthetic: #000000 card, #222 hairline border, zero hollow space
 */
export const QuestionnaireCard: React.FC<QuestionnaireCardProps> = ({ toolCall, onSubmitAnswers }) => {
  const args = toolCall.args || {}
  const result = toolCall.result || {}
  const title = args.title || 'Clarifying Question'
  const singleQuestionText = args.question || result.question || (args.questions && args.questions[0]?.question) || ''
  const answerVal = result.answer !== undefined 
    ? result.answer 
    : (result.answers ? Object.values(result.answers)[0] : '')
  const answerDisplay = Array.isArray(answerVal) ? answerVal.join(', ') : String(answerVal)

  const isCompleted = toolCall.status === 'completed'

  if (!isCompleted) {
    return (
      <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] p-3 text-xs font-sans shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-zinc-200 font-medium text-xs break-words leading-relaxed">
              {singleQuestionText || title}
            </span>
          </div>
          <VercelBadge variant="blue">
            active prompt
          </VercelBadge>
        </div>
      </div>
    )
  }

  return (
    <div className="my-2 rounded-lg border border-[#222] bg-[#000000] p-3 text-xs font-sans hover:border-[#333] transition-colors shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {/* Complete Question (wraps to new lines without truncation) */}
          <div className="text-xs text-zinc-300 font-medium leading-relaxed break-words">
            {singleQuestionText || title}
          </div>

          {/* Separator */}
          <div className="border-t border-[#222]" />

          {/* The Answer - Vertical flow */}
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-zinc-500 font-mono text-[10px]">Answer</span>
            <span className="text-white font-semibold leading-relaxed break-words">
              {answerDisplay || 'Confirmed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
