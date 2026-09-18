import React, { useState } from 'react'
import { HelpCircle, Send, CheckCircle2, Circle, CheckSquare, Square } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import type { QuestionnaireQuestion } from '../../../../shared/schemas'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Badge } from '../../ui/badge'
import { cn } from '../../../lib/utils'

interface QuestionnaireCardProps {
  toolCall: ToolCallRecord
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
}

export const QuestionnaireCard: React.FC<QuestionnaireCardProps> = ({ toolCall, onSubmitAnswers }) => {
  const args = toolCall.args || {}
  const title = args.title || 'Clarifying Questions (/grill-me)'
  const description = args.description || 'The agent needs your decision on these options before proceeding.'
  const questions: QuestionnaireQuestion[] = args.questions || []

  const isCompleted = toolCall.status === 'completed'
  const savedAnswers = toolCall.result?.answers || {}

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

  const handleSingleSelect = (questionId: string, optionLabel: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionLabel }))
  }

  const handleMultiSelect = (questionId: string, optionLabel: string) => {
    setAnswers(prev => {
      const current = (prev[questionId] as string[]) || []
      const updated = current.includes(optionLabel)
        ? current.filter(o => o !== optionLabel)
        : [...current, optionLabel]
      return { ...prev, [questionId]: updated }
    })
  }

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: text }))
  }

  const handleSubmit = () => {
    if (onSubmitAnswers) {
      onSubmitAnswers(toolCall.id, answers)
    }
  }

  return (
    <div className="my-3 rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xs">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-xs text-zinc-100">{title}</span>
          </div>
          {description && (
            <p className="text-[11px] text-zinc-400 pl-6">{description}</p>
          )}
        </div>

        <Badge
          variant="outline"
          className={cn(
            'text-[10px] py-0 px-2 font-mono shrink-0',
            isCompleted
              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20'
              : 'border-blue-500/30 text-blue-400 bg-blue-950/20'
          )}
        >
          {isCompleted ? '✓ Answered' : `${questions.length} Question${questions.length !== 1 ? 's' : ''}`}
        </Badge>
      </div>

      {/* Questions list */}
      <div className="p-4 space-y-5">
        {questions.map((q, idx) => {
          const currentAnswer = isCompleted ? savedAnswers[q.id] : answers[q.id]

          return (
            <div key={q.id || idx} className="space-y-2">
              <div className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                <span className="text-zinc-500 font-mono text-[11px]">{idx + 1}.</span>
                <span>{q.question}</span>
                {q.required && !isCompleted && (
                  <span className="text-red-400 text-[10px]">*</span>
                )}
              </div>

              {/* Single Choice (Radio Tiles) */}
              {q.type === 'single_choice' && q.options && (
                <div className="grid grid-cols-1 gap-1.5 pl-4">
                  {q.options.map(opt => {
                    const isSelected = currentAnswer === opt.label
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleSingleSelect(q.id, opt.label)}
                        className={cn(
                          'flex items-start justify-between p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer select-none',
                          isSelected
                            ? 'bg-blue-600/10 border-blue-500/50 text-zinc-100 font-medium'
                            : 'bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200',
                          isCompleted && 'cursor-default pointer-events-none'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-zinc-200">{opt.label}</div>
                            {opt.description && (
                              <div className="text-[11px] text-zinc-500 mt-0.5">{opt.description}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Multiple Choice (Checkbox Tiles) */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="grid grid-cols-1 gap-1.5 pl-4">
                  {q.options.map(opt => {
                    const selectedList = (currentAnswer as string[]) || []
                    const isSelected = selectedList.includes(opt.label)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleMultiSelect(q.id, opt.label)}
                        className={cn(
                          'flex items-start justify-between p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer select-none',
                          isSelected
                            ? 'bg-blue-600/10 border-blue-500/50 text-zinc-100 font-medium'
                            : 'bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200',
                          isCompleted && 'cursor-default pointer-events-none'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-zinc-200">{opt.label}</div>
                            {opt.description && (
                              <div className="text-[11px] text-zinc-500 mt-0.5">{opt.description}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Free-form Text */}
              {q.type === 'text' && (
                <div className="pl-4">
                  <Input
                    placeholder={q.placeholder || 'Type your response here...'}
                    disabled={isCompleted}
                    value={(currentAnswer as string) || ''}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    className="text-xs h-8 bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Submit action */}
        {!isCompleted && (
          <div className="pt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 h-8 px-4 font-medium cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit & Resume</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
