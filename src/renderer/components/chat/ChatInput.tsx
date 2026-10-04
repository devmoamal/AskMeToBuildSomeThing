import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Square, Plus, Paperclip, Image, FileText, X, Sparkles, HelpCircle, Hammer, Compass, Lightbulb, GitCompare, ListTodo, AtSign } from 'lucide-react'
import { Button } from '../ui/button'
import { ModelSelector } from './ModelSelector'
import { SlashCommandDropdown, SLASH_COMMANDS, type SlashCommandItem } from './SlashCommandDropdown'
import { MentionDropdown, getMentionItems, type MentionItem } from './MentionDropdown'
import type { ProviderConfig, FileTreeNode } from '../../../shared/types'
import { cn } from '../../lib/utils'
import { compressImage } from '../../lib/image-compressor'

export interface AttachedFile {
  id: string
  name: string
  path?: string
  isImage?: boolean
  mediaType?: string
  base64?: string
  previewUrl?: string
  savingsRatio?: number
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
  tokenUsage?: { inputTokens: number; totalTokens: number } | null
  executionMode?: 'build' | 'plan' | 'ask'
  onChangeExecutionMode?: (mode: 'build' | 'plan' | 'ask') => void
  workspaceFiles?: FileTreeNode[]
  onOpenDiffReview?: () => void
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
  placeholder = 'Ask anything... (type / for commands or @ for files)',
  promptDraft,
  onPromptDraftConsumed,
  promptBar,
  tokenUsage,
  executionMode = 'build',
  onChangeExecutionMode,
  workspaceFiles = [],
  onOpenDiffReview
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

  // @ Mention state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null)

  // Execution elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  useEffect(() => {
    let timer: any = null
    if (isGenerating) {
      setElapsedSeconds(0)
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isGenerating])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)

  const activeMentionItems = showMentionDropdown ? getMentionItems(mentionFilter, workspaceFiles) : []

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

    if (showMentionDropdown && activeMentionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % activeMentionItems.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + activeMentionItems.length) % activeMentionItems.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = activeMentionItems[mentionIndex % activeMentionItems.length]
        if (selected) {
          handleSelectMention(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionDropdown(false)
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
    const cursor = e.target.selectionStart ?? val.length
    setText(val)

    if (val.startsWith('/')) {
      setShowSlashDropdown(true)
      setShowMentionDropdown(false)
      setSlashFilter(val)
      setSlashIndex(0)
      return
    }

    setShowSlashDropdown(false)

    // Check for @mention trigger
    const textBeforeCursor = val.slice(0, cursor)
    const match = textBeforeCursor.match(/(^|\s)@([a-zA-Z0-9_\-./:]*)$/)
    if (match) {
      setShowMentionDropdown(true)
      setMentionFilter(match[2] || '')
      setMentionIndex(0)
      const atIndex = textBeforeCursor.lastIndexOf('@')
      setMentionRange({ start: atIndex, end: cursor })
    } else {
      setShowMentionDropdown(false)
      setMentionRange(null)
    }
  }

  const handleSelectCommand = (cmd: SlashCommandItem) => {
    setText(`${cmd.command} `)
    setShowSlashDropdown(false)
    textareaRef.current?.focus()
  }

  const handleSelectMention = (item: MentionItem) => {
    if (mentionRange) {
      const before = text.slice(0, mentionRange.start)
      const after = text.slice(mentionRange.end)
      const newText = `${before}${item.insertText} ${after}`
      setText(newText)
      setShowMentionDropdown(false)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newCursor = before.length + item.insertText.length + 1
          textareaRef.current.setSelectionRange(newCursor, newCursor)
        }
      }, 10)
    } else {
      setText((prev) => `${prev}${item.insertText} `)
      setShowMentionDropdown(false)
      textareaRef.current?.focus()
    }
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
      for (const fp of filePaths) {
        try {
          const raw = await window.api.projects.readImageAsBase64(fp)
          const compressed = await compressImage(raw.dataUrl)
          const name = fp.split(/[\\/]/).pop() || 'image'
          setAttachments(prev => [
            ...prev,
            {
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name,
              path: fp,
              isImage: true,
              mediaType: compressed.mediaType,
              base64: compressed.base64,
              previewUrl: compressed.dataUrl,
              savingsRatio: compressed.savingsRatio
            }
          ])
        } catch (err) {
          console.error('Failed to compress picked image', err)
          const name = fp.split(/[\\/]/).pop() || 'image'
          setAttachments(prev => [
            ...prev,
            { id: `att_${Date.now()}_${Math.random()}`, name, path: fp, isImage: true }
          ])
        }
      }
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items || items.length === 0) return

    const imageItems: File[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageItems.push(file)
        }
      }
    }

    if (imageItems.length > 0) {
      // If paste contains only images (e.g. screenshot), prevent raw insertion
      const textData = e.clipboardData.getData('text/plain')
      if (!textData) {
        e.preventDefault()
      }

      for (const file of imageItems) {
        try {
          const compressed = await compressImage(file)
          const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-')
          const name = file.name && file.name !== 'image.png' ? file.name : `screenshot-${timestamp}.png`
          setAttachments(prev => [
            ...prev,
            {
              id: `att_paste_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name,
              isImage: true,
              mediaType: compressed.mediaType,
              base64: compressed.base64,
              previewUrl: compressed.dataUrl,
              savingsRatio: compressed.savingsRatio
            }
          ])
        } catch (err) {
          console.error('Failed to compress clipboard image', err)
        }
      }
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
    setShowMentionDropdown(false)
    setMentionRange(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const hasContent = text.trim().length > 0 || attachments.length > 0

  return (
    <div className="relative px-4 pb-2.5 pt-1 bg-background">
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

        {/* @ Mention dropdown */}
        {showMentionDropdown && (
          <MentionDropdown
            selectedIndex={mentionIndex}
            onSelect={handleSelectMention}
            filterText={mentionFilter}
            files={workspaceFiles}
          />
        )}

        {/* Input container card */}
        <div className="relative flex flex-col rounded-xl border border-border/70 bg-card/75 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-xs backdrop-blur-xs">
          {/* Attached Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2 pb-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/80 text-foreground text-xs border border-border/60 max-w-[260px]"
                >
                  {att.previewUrl ? (
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      className="w-4 h-4 rounded-xs object-cover shrink-0 border border-border/50"
                    />
                  ) : att.isImage ? (
                    <Image className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                  )}
                  <span className="truncate flex-1 font-mono text-[11px]">{att.name}</span>
                  {att.savingsRatio !== undefined && att.savingsRatio > 0 && (
                    <span
                      title={`Compressed to WebP/JPEG saving ~${att.savingsRatio}% size/tokens`}
                      className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono shrink-0"
                    >
                      -{att.savingsRatio}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
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
            onPaste={handlePaste}
            disabled={isPromptActive}
            placeholder={isPromptActive ? 'Respond to the prompt above to continue...' : placeholder}
            className={cn(
              'w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[38px]',
              isPromptActive && 'opacity-50 cursor-not-allowed'
            )}
          />

          {/* Footer Actions Toolbar */}
          <div className="flex items-center justify-between px-2 py-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Plus Action Menu */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Add attachment or action"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Plus Menu Popover */}
                {isPlusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover border border-border rounded-lg shadow-xl p-1 z-50 text-foreground animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={handlePickFiles}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-popover-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Attach File</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePickImages}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-popover-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                    >
                      <Image className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Attach Image</span>
                    </button>

                    <div className="h-px bg-border my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setText('/canvas ')
                        textareaRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-popover-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>/canvas (Markdown Canvas)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlusMenuOpen(false)
                        setText('/ask-user ')
                        textareaRef.current?.focus()
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-popover-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
                      <span>/ask-user (Questionnaire)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Model Selector */}
              <ModelSelector
                providers={providers}
                selectedProviderId={selectedProviderId}
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
              />

              {/* Segmented Execution Mode Switcher */}
              {onChangeExecutionMode && (
                <div className="flex items-center rounded-lg p-0.5 bg-muted/60 border border-border/50 text-[11px]">
                  <button
                    type="button"
                    onClick={() => onChangeExecutionMode('build')}
                    title="Build Mode: Read/Write files, run commands, execute implementation tasks"
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                      executionMode === 'build'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <Hammer className="w-3 h-3" />
                    <span className="hidden sm:inline">Build</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeExecutionMode('plan')}
                    title="Plan Mode: Architectural design, plan tasks before executing"
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                      executionMode === 'plan'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <Compass className="w-3 h-3" />
                    <span className="hidden sm:inline">Plan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeExecutionMode('ask')}
                    title="Ask Mode: Codebase mentor, explanations & Q&A without editing files"
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                      executionMode === 'ask'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                    )}
                  >
                    <Lightbulb className="w-3 h-3" />
                    <span className="hidden sm:inline">Ask</span>
                  </button>
                </div>
              )}

              {/* Quick @ mention button */}
              <button
                type="button"
                onClick={() => {
                  setText(prev => `${prev}@`)
                  setShowMentionDropdown(true)
                  setMentionFilter('')
                  setMentionIndex(0)
                  textareaRef.current?.focus()
                }}
                className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                title="Mention context item or file (@)"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>

              {/* Plan Mode Text Badge (if user explicitly typed /plan) */}
              {text.trim().startsWith('/plan') && (
                <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-md shadow-xs">
                  PLAN MODE
                </span>
              )}

              {/* Token Usage Badge */}
              {tokenUsage && tokenUsage.totalTokens > 0 && (
                <span
                  className="hidden sm:inline-block text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded-md"
                  title={`Active session context: ~${tokenUsage.totalTokens.toLocaleString()} tokens`}
                >
                  ~{tokenUsage.totalTokens > 1000 ? `${(tokenUsage.totalTokens / 1000).toFixed(1)}k` : tokenUsage.totalTokens} tok
                </span>
              )}
            </div>

            {/* Send / Stop / Diff Button */}
            <div className="flex items-center gap-1.5">
              {onOpenDiffReview && (
                <button
                  type="button"
                  onClick={onOpenDiffReview}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer border border-border/50"
                  title="Review uncommitted changes and git diffs"
                >
                  <GitCompare className="w-3 h-3 text-emerald-500" />
                  <span className="hidden md:inline">Diff</span>
                </button>
              )}

              {isGenerating ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground animate-pulse px-1">
                    {elapsedSeconds}s
                  </span>
                  <button
                    type="button"
                    onClick={onAbort}
                    className="flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[11px] font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer shadow-xs"
                    title="Stop agent run"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Stop</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!hasContent || isPromptActive}
                  onClick={handleSubmit}
                  className={cn(
                    'flex items-center justify-center h-6.5 w-6.5 rounded-md transition-all cursor-pointer',
                    hasContent && !isPromptActive
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
                      : 'bg-muted text-muted-foreground border border-border/50 cursor-not-allowed opacity-50'
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
