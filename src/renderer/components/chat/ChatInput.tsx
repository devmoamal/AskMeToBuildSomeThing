import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square, Plus, Paperclip, Image, FileText, X, Sparkles, HelpCircle } from 'lucide-react'
import { Button } from '../ui/button'
import { ModelSelector } from './ModelSelector'
import { SlashCommandDropdown, SLASH_COMMANDS, type SlashCommandItem } from './SlashCommandDropdown'
import type { ProviderConfig } from '../../../shared/types'
import { cn } from '../../lib/utils'

export interface AttachedFile {
  id: string
  name: string
  path: string
  isImage?: boolean
}

interface ChatInputProps {
  mode: 'chat' | 'project'
  isGenerating: boolean
  isPromptActive?: boolean
  providers: ProviderConfig[]
  selectedProviderId?: string
  selectedModel?: string
  onSelectModel: (providerId: string, model: string) => void
  onSend: (text: string, attachments?: AttachedFile[]) => void
  onAbort: () => void
  placeholder?: string
  promptDraft?: string | null
  onPromptDraftConsumed?: () => void
  promptBar?: React.ReactNode
}

export const ChatInput: React.FC<ChatInputProps> = ({
  mode,
  isGenerating,
  isPromptActive = false,
  providers,
  selectedProviderId,
  selectedModel,
  onSelectModel,
  onSend,
  onAbort,
  placeholder = 'Ask anything... (type / for canvas or commands)',
  promptDraft,
  onPromptDraftConsumed,
  promptBar
}) => {
  const [text, setText] = useState('')

  // Auto-fill prompt when rollback & edit is triggered
  useEffect(() => {
    if (promptDraft !== undefined && promptDraft !== null) {
      setText(promptDraft)
      if (onPromptDraftConsumed) {
        onPromptDraftConsumed()
      }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(promptDraft.length, promptDraft.length)
        }
      }, 50)
    }
  }, [promptDraft, onPromptDraftConsumed])
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false)
  const [showSlashDropdown, setShowSlashDropdown] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashIndex, setSlashIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [text])

  // Close plus menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false)
      }
    }
    if (isPlusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPlusMenuOpen])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashIndex((prev) => (prev + 1) % SLASH_COMMANDS.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashIndex((prev) => (prev - 1 + SLASH_COMMANDS.length) % SLASH_COMMANDS.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = SLASH_COMMANDS[slashIndex]
        if (selected) {
          handleSelectCommand(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashDropdown(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)

    if (val.startsWith('/')) {
      setShowSlashDropdown(true)
      setSlashFilter(val)
      setSlashIndex(0)
    } else {
      setShowSlashDropdown(false)
    }
  }

  const handleSelectCommand = (cmd: SlashCommandItem) => {
    setText(`${cmd.command} `)
    setShowSlashDropdown(false)
    textareaRef.current?.focus()
  }

  const handlePickFiles = async () => {
    setIsPlusMenuOpen(false)
    if (!window.api?.projects?.pickFile) return
    const filePaths = await window.api.projects.pickFile()
    if (filePaths && filePaths.length > 0) {
      const newItems: AttachedFile[] = filePaths.map(fp => {
        const name = fp.split(/[\\/]/).pop() || 'file'
        return { id: `att_${Date.now()}_${Math.random()}`, name, path: fp }
      })
      setAttachments(prev => [...prev, ...newItems])
    }
  }

  const handlePickImages = async () => {
    setIsPlusMenuOpen(false)
    if (!window.api?.projects?.pickImage) return
    const filePaths = await window.api.projects.pickImage()
    if (filePaths && filePaths.length > 0) {
      const newItems: AttachedFile[] = filePaths.map(fp => {
        const name = fp.split(/[\\/]/).pop() || 'image'
        return { id: `att_${Date.now()}_${Math.random()}`, name, path: fp, isImage: true }
      })
      setAttachments(prev => [...prev, ...newItems])
    }
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSubmit = () => {
    const trimmed = text.trim()
    if ((!trimmed && attachments.length === 0) || isGenerating || isPromptActive) return
    onSend(trimmed, attachments.length > 0 ? attachments : undefined)
    setText('')
    setAttachments([])
    setShowSlashDropdown(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const hasContent = text.trim().length > 0 || attachments.length > 0

  return (
    <div className="relative px-4 pb-2.5 pt-1 bg-zinc-950">
      <div className="max-w-3xl mx-auto w-full relative">
        {/* Floating prompt HUD attached to top/back of input box */}
        {promptBar}

        {/* Slash command dropdown */}
        {showSlashDropdown && (
          <SlashCommandDropdown
            selectedIndex={slashIndex}
            onSelect={handleSelectCommand}
            filterText={slashFilter}
          />
        )}

        {/* Input container card */}
        <div className="relative flex flex-col rounded-lg border border-[#222] bg-[#0a0a0a] focus-within:border-[#383838] transition-all shadow-xs">
          {/* Attached Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2 pb-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs border border-zinc-700/60 max-w-[220px]"
                >
                  {att.isImage ? (
                    <Image className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  )}
                  <span className="truncate flex-1 font-mono text-[11px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isPromptActive}
            placeholder={isPromptActive ? 'Respond to the prompt above to continue...' : placeholder}
            className={cn(
              'w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none leading-relaxed min-h-[38px]',
              isPromptActive && 'opacity-50 cursor-not-allowed'
            )}
          />

          {/* Footer Actions Toolbar */}
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              {/* Plus Action Menu */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="flex items-center justify-center h-6 w-6 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  title="Add attachment or action"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Plus Menu Popover */}
                {isPlusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl p-1 z-50">
                    <button
                      type="button"
                      onClick={handlePickFiles}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Attach File</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePickImages}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
                    >
                      <Image className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Attach Image</span>
                    </button>

                    <div className="h-px bg-zinc-800 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setText('/canvas ')
                        textareaRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                      <span>/canvas (Markdown Canvas)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setText('/ask-user ')
                        textareaRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                      <span>/ask-user (Questionnaire)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Model Selector right beside plus! */}
              <ModelSelector
                providers={providers}
                selectedProviderId={selectedProviderId}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
              />
            </div>

          {/* Send / Stop Button */}
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={onAbort}
                className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 transition-colors cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!hasContent || isPromptActive}
                onClick={handleSubmit}
                className={cn(
                  'flex items-center justify-center h-6 w-6 rounded-md transition-all cursor-pointer',
                  hasContent && !isPromptActive
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-xs'
                    : 'bg-[#1a1a1a] text-zinc-600 border border-[#222] cursor-not-allowed opacity-50'
                )}
                title="Send message"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
