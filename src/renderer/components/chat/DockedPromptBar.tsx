import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  HelpCircle
} from 'lucide-react'
import type { QuestionnairePayload, QuestionnaireQuestion } from '../../../shared/schemas'
import { VercelKbd, VercelBadge } from '../ui/VercelIcon'
import { cn } from '../../lib/utils'

interface DockedPromptBarProps {
  activeQuestionnaire: {
    toolCallId: string
    payload: QuestionnairePayload
  } | null
  activeApproval: {
    toolCallId: string
    toolName: string
    args: any
  } | null
  onSubmitAnswers: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool: (toolCallId: string, approved: boolean) => void
  onCancel?: () => void
}

/**
 * Vercel Keyboard-First Docked Action HUD
 * Strict Geist aesthetic: #000000 card, #222 hairline border, high-contrast keys
 */
export const DockedPromptBar: React.FC<DockedPromptBarProps> = ({
  activeQuestionnaire,
  activeApproval,
  onSubmitAnswers,
  onApproveTool,
  onCancel
}) => {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const textInputRef = useRef<HTMLInputElement>(null)
  const answersRef = useRef(answers)
  answersRef.current = answers

  // Reset questionnaire state whenever toolCallId changes
  useEffect(() => {
    setAnswers({})
    setCurrentQIdx(0)
    setCustomInputs({})
  }, [activeQuestionnaire?.toolCallId])

  // Focus input when moving to a text question
  useEffect(() => {
    if (activeQuestionnaire) {
      setTimeout(() => {
        textInputRef.current?.focus()
      }, 50)
    }
  }, [currentQIdx, activeQuestionnaire?.toolCallId])

  const questions: QuestionnaireQuestion[] = activeQuestionnaire?.payload.questions || []
  const totalQuestions = questions.length
  const currentQ: QuestionnaireQuestion | undefined = questions[currentQIdx]

  // Global Keyboard listener for Enter and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        e.preventDefault()
        if (activeApproval) {
          onApproveTool(activeApproval.toolCallId, false)
        } else if (activeQuestionnaire) {
          if (onCancel) onCancel()
          else onSubmitAnswers(activeQuestionnaire.toolCallId, {})
        }
        return
      }

      if (activeApproval && e.key === 'Enter') {
        e.preventDefault()
        onApproveTool(activeApproval.toolCallId, true)
        return
      }

      if (activeQuestionnaire) {
        // If Enter is pressed inside an input field: advance step or submit
        if (isInput && e.key === 'Enter') {
          e.preventDefault()
          if (currentQIdx < totalQuestions - 1) {
            setCurrentQIdx(prev => prev + 1)
          } else {
            onSubmitAnswers(activeQuestionnaire.toolCallId, answersRef.current)
          }
          return
        }

        // When not in an input field:
        if (!isInput) {
          // Number keys 1-9 for quick selecting options of current question
          const num = parseInt(e.key, 10)
          if (!isNaN(num) && num >= 1 && currentQ?.options && num <= currentQ.options.length) {
            e.preventDefault()
            const selectedOpt = currentQ.options[num - 1]
            if (currentQ.type === 'single_choice') {
              const updated = { ...answersRef.current, [currentQ.id]: selectedOpt.label }
              setAnswers(updated)
            } else if (currentQ.type === 'multiple_choice') {
              setAnswers(prev => {
                const current = (prev[currentQ.id] as string[]) || []
                const updated = current.includes(selectedOpt.label)
                  ? current.filter(o => o !== selectedOpt.label)
                  : [...current, selectedOpt.label]
                return { ...prev, [currentQ.id]: updated }
              })
            }
            return
          }

          if (e.key === 'Enter') {
            e.preventDefault()
            if (currentQIdx < totalQuestions - 1) {
              setCurrentQIdx(prev => prev + 1)
            } else {
              onSubmitAnswers(activeQuestionnaire.toolCallId, answersRef.current)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeApproval, activeQuestionnaire, currentQ, currentQIdx, totalQuestions, onApproveTool, onSubmitAnswers, onCancel])

  if (!activeApproval && !activeQuestionnaire) {
    return null
  }

  // --- Vercel Tool Approval Bar ---
  if (activeApproval) {
    const isTerminal = activeApproval.toolName === 'use_terminal'
    const command = activeApproval.args?.command || ''
    const cwd = activeApproval.args?.cwd || ''
    const filePath = activeApproval.args?.path || ''

    return (
      <div className="absolute bottom-full left-0 right-0 mb-2 z-30 pointer-events-none select-none text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="pointer-events-auto w-full rounded-lg border border-[#222] bg-[#000000] overflow-hidden shadow-2xl">
          <div className="px-3.5 py-2.5 bg-[#0a0a0a] border-b border-[#222] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-white text-xs truncate">
                Permission Required
              </span>
              <VercelBadge variant="warning">
                {activeApproval.toolName}
              </VercelBadge>
            </div>
            <button
              type="button"
              onClick={() => onApproveTool(activeApproval.toolCallId, false)}
              className="p-1 text-zinc-500 hover:text-white rounded hover:bg-[#1a1a1a] transition-colors cursor-pointer shrink-0"
              title="Reject (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-3 bg-[#000000]">
            {isTerminal && command && (
              <div className="font-mono text-[11px] text-zinc-300 bg-[#080808] px-2.5 py-1.5 rounded-md border border-[#222] truncate">
                <span className="text-emerald-400 mr-1.5 font-bold">$</span>
                {command}
                {cwd && <span className="text-zinc-500 ml-2">({cwd})</span>}
              </div>
            )}

            {filePath && !isTerminal && (
              <div className="font-mono text-[11px] text-zinc-300 bg-[#080808] px-2.5 py-1.5 rounded-md border border-[#222] truncate">
                {filePath}
              </div>
            )}

            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => onApproveTool(activeApproval.toolCallId, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#333] hover:border-[#555] bg-black text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs"
              >
                <span>Reject</span>
                <VercelKbd>Esc</VercelKbd>
              </button>

              <button
                type="button"
                onClick={() => onApproveTool(activeApproval.toolCallId, true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-white hover:bg-zinc-200 text-black font-semibold transition-colors cursor-pointer text-xs shadow-xs"
              >
                <span>Allow & Run</span>
                <VercelKbd className="bg-black/10 border-black/20 text-black font-bold">↵</VercelKbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Vercel Sequential Question Bar ---
  if (!activeQuestionnaire || !currentQ) return null

  const selectedAnswer = answers[currentQ.id]
  const isMulti = currentQ.type === 'multiple_choice'
  const isSingle = currentQ.type === 'single_choice'
  const isText = currentQ.type === 'text'

  const customText = customInputs[currentQ.id] || ''

  const handleSelectOption = (optLabel: string) => {
    if (isSingle) {
      setAnswers(prev => ({ ...prev, [currentQ.id]: optLabel }))
    } else if (isMulti) {
      setAnswers(prev => {
        const current = (prev[currentQ.id] as string[]) || []
        const updated = current.includes(optLabel)
          ? current.filter(o => o !== optLabel)
          : [...current, optLabel]
        return { ...prev, [currentQ.id]: updated }
      })
    }
  }

  const handleCustomInputChange = (val: string) => {
    setCustomInputs(prev => ({ ...prev, [currentQ.id]: val }))
    setAnswers(prev => ({ ...prev, [currentQ.id]: val }))
  }

  const handleNextOrSubmit = () => {
    if (currentQIdx < totalQuestions - 1) {
      setCurrentQIdx(prev => prev + 1)
    } else {
      onSubmitAnswers(activeQuestionnaire.toolCallId, answers)
    }
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-30 pointer-events-none select-none text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="pointer-events-auto w-full rounded-lg border border-[#222] bg-[#000000] overflow-hidden shadow-2xl">
        {/* Geist Header Bar */}
        <div className="px-3.5 py-2.5 bg-[#0a0a0a] border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-white text-xs truncate">
              {activeQuestionnaire.payload.title || 'Decision Required'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
            {totalQuestions > 1 ? (
              <VercelBadge variant="default">
                {currentQIdx + 1} of {totalQuestions}
              </VercelBadge>
            ) : (
              <span className="text-zinc-500 text-[11px]">1 of 1</span>
            )}
            <button
              type="button"
              onClick={() => onCancel ? onCancel() : onSubmitAnswers(activeQuestionnaire.toolCallId, {})}
              className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded hover:bg-[#1a1a1a]"
              title="Dismiss (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Geist Body */}
        <div className="p-3.5 space-y-3 bg-[#000000]">
          {/* Question Text */}
          <div className="text-zinc-200 font-medium text-xs leading-relaxed px-0.5">
            {currentQ.question}
          </div>

          {/* Choice Options with numbers on LEFT and clean background */}
          {(isSingle || isMulti) && currentQ.options && currentQ.options.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[42vh] overflow-y-auto pr-0.5">
              {currentQ.options.map((opt, idx) => {
                const isSelected = isMulti
                  ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.label)
                  : selectedAnswer === opt.label

                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handleSelectOption(opt.label)}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-md border text-left flex items-start gap-2.5 transition-all cursor-pointer text-xs group',
                      isSelected
                        ? 'border-white/60 bg-white/[0.08] text-white shadow-xs'
                        : 'border-[#222] bg-[#0a0a0a] hover:border-[#383838] hover:bg-[#111] text-zinc-300'
                    )}
                  >
                    {/* Key Number on the LEFT */}
                    <VercelKbd
                      className={cn(
                        'shrink-0 mt-0.5 transition-colors',
                        isSelected
                          ? 'bg-white text-black border-white font-bold shadow-xs'
                          : 'border-white/15 bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200 group-hover:border-white/25'
                      )}
                    >
                      {idx + 1}
                    </VercelKbd>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={cn('leading-snug font-medium break-words', isSelected ? 'text-white' : 'text-zinc-200')}>
                        {opt.label}
                      </span>
                      {opt.description && (
                        <span className="text-[11px] text-zinc-500 leading-normal mt-0.5">
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Custom Answer Input Field */}
          <div className="flex items-center gap-2 pt-0.5 font-sans">
            <input
              ref={textInputRef}
              type="text"
              value={customText || (isText ? (answers[currentQ.id] as string || '') : '')}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              placeholder={currentQ.placeholder || (isText ? 'Type your answer here...' : 'Or type a custom answer...')}
              className="flex-1 h-8 px-3 rounded-md bg-[#080808] border border-[#222] focus:border-[#444] focus:outline-none text-xs text-white placeholder:text-zinc-600 transition-colors"
            />

            {/* Previous Question Button */}
            {currentQIdx > 0 && (
              <button
                type="button"
                onClick={() => setCurrentQIdx(prev => prev - 1)}
                className="h-8 px-2.5 rounded-md border border-[#222] hover:border-[#444] bg-[#0a0a0a] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Previous question"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Next / Confirm Button */}
            <button
              type="button"
              onClick={handleNextOrSubmit}
              className="h-8 px-3.5 rounded-md bg-white hover:bg-zinc-200 text-black font-semibold transition-colors cursor-pointer flex items-center gap-1.5 text-xs shadow-xs shrink-0"
            >
              <span>{currentQIdx < totalQuestions - 1 ? 'Next' : 'Confirm'}</span>
              <VercelKbd className="bg-black/10 border-black/20 text-black font-bold">↵</VercelKbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
