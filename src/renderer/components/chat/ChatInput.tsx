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
  providers: ProviderConfig[]
  selectedProviderId?: string
  selectedModel?: string
  onSelectModel: (providerId: string, model: string) => void
  onSend: (text: string, attachments?: AttachedFile[]) => void
  onAbort: () => void
  placeholder?: string
}

export const ChatInput: React.FC<ChatInputProps> = ({
  mode,
  isGenerating,
  providers,
  selectedProviderId,
  selectedModel,
  onSelectModel,
  onSend,
  onAbort,
  placeholder = 'Ask anything... (type / for canvas or commands)'
}) => {
  const [text, setText] = useState('')
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
    if ((!trimmed && attachments.length === 0) || isGenerating) return
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
    <div className="relative px-4 pb-4 pt-1 bg-zinc-950">
      <div className="max-w-3xl mx-auto w-full relative">
        {/* Slash command dropdown */}
        {showSlashDropdown && (
          <SlashCommandDropdown
            selectedIndex={slashIndex}
            onSelect={handleSelectCommand}
            filterText={slashFilter}
          />
        )}

        {/* Input container card */}
        <div className="relative flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/60 focus-within:border-zinc-700/80 focus-within:bg-zinc-900/90 transition-all shadow-xs">
          {/* Attached Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-xs border border-zinc-700/60 max-w-[220px]"
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
            placeholder={placeholder}
            className="w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none leading-relaxed min-h-[44px]"
          />

          {/* Footer Actions Toolbar */}
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <div className="flex items-center gap-1.5">
              {/* Plus Action Menu */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  title="Add attachment or action"
                >
                  <Plus className="w-4 h-4" />
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
                className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!hasContent}
                onClick={handleSubmit}
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full transition-colors cursor-pointer',
                  hasContent
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-xs'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                )}
                title="Send message"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
