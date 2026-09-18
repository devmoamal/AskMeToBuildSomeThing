import React, { useState, useEffect, useRef } from 'react'
import {
  FileCode,
  FileText,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  Pencil
} from 'lucide-react'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { marked } from 'marked'
import type { CanvasDocument } from '../../../shared/types'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

// Initialize Turndown with GFM tables and ATX headers
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})
turndownService.use(gfm)

// Preserve fenced code blocks with language tag cleanly
turndownService.addRule('fencedCodeBlock', {
  filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
  replacement: (_content, node) => {
    const codeEl = (node as HTMLElement).querySelector('code')
    const className = codeEl?.className || ''
    const match = className.match(/language-(\w+)/)
    const lang = match ? match[1] : ''
    const text = codeEl?.textContent || ''
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`
  }
})

interface CanvasPanelProps {
  canvas: CanvasDocument
  onClose: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onSave: (updated: CanvasDocument) => Promise<void> | void
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  canvas,
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
  onSave
}) => {
  const [copied, setCopied] = useState(false)
  const [content, setContent] = useState(canvas.content)
  const [title, setTitle] = useState(canvas.title)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(canvas.title)

  const isMarkdown = canvas.language.toLowerCase() === 'markdown' || canvas.language.toLowerCase() === 'md'

  const wysiwygRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isUserTypingRef = useRef(false)
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Sync state if canvas updates externally (e.g. initial load or different canvas selection)
  useEffect(() => {
    setTitle(canvas.title)
    setTitleInput(canvas.title)
    setContent(canvas.content)

    if (isMarkdown && wysiwygRef.current && !isUserTypingRef.current) {
      const html = marked.parse(canvas.content || '', { gfm: true, breaks: true }) as string
      wysiwygRef.current.innerHTML = html
    }
  }, [canvas.id, canvas.version, canvas.title, canvas.language])

  // Initial mount render for WYSIWYG
  useEffect(() => {
    if (isMarkdown && wysiwygRef.current && !isUserTypingRef.current) {
      const html = marked.parse(canvas.content || '', { gfm: true, breaks: true }) as string
      wysiwygRef.current.innerHTML = html
    }
  }, [])

  // Sync scroll for code editor line gutter
  const handleCodeScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Handle Tab key in code editor
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const val = textarea.value

      const updated = val.substring(0, start) + '  ' + val.substring(end)
      handleCodeChange(updated)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  // Code editor change handler with debounced auto-save
  const handleCodeChange = (newVal: string) => {
    setContent(newVal)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSave({
          ...canvas,
          title,
          content: newVal,
          updatedAt: Date.now()
        })
      } catch {
        // Silent catch
      }
    }, 500)
  }

  // WYSIWYG Markdown Input Handler (converts live DOM -> Markdown and auto-saves silently)
  const handleWysiwygInput = () => {
    if (!wysiwygRef.current) return
    isUserTypingRef.current = true

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
    }
    typingTimerRef.current = setTimeout(() => {
      isUserTypingRef.current = false
    }, 1200)

    try {
      const html = wysiwygRef.current.innerHTML
      const md = turndownService.turndown(html)
      setContent(md)

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await onSave({
            ...canvas,
            title,
            content: md,
            updatedAt: Date.now()
          })
        } catch {
          // Silent catch
        }
      }, 500)
    } catch (err) {
      console.error('Failed to parse WYSIWYG content to markdown:', err)
    }
  }

  // WYSIWYG onBlur flush
  const handleWysiwygBlur = async () => {
    isUserTypingRef.current = false
    if (!wysiwygRef.current) return
    try {
      const html = wysiwygRef.current.innerHTML
      const md = turndownService.turndown(html)
      setContent(md)
      await onSave({
        ...canvas,
        title,
        content: md,
        updatedAt: Date.now()
      })
    } catch {
      // Silent catch
    }
  }

  // Handle Tab key in WYSIWYG
  const handleWysiwygKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
    }
  }

  // Save title rename
  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim()
    if (trimmed && trimmed !== title) {
      setTitle(trimmed)
      await onSave({
        ...canvas,
        title: trimmed,
        content,
        updatedAt: Date.now()
      })
    } else {
      setTitleInput(title)
    }
    setIsEditingTitle(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const lang = canvas.language.toLowerCase()
    let ext = 'txt'
    if (lang === 'markdown' || lang === 'md') ext = 'md'
    else if (lang === 'python' || lang === 'py') ext = 'py'
    else if (lang === 'typescript' || lang === 'ts') ext = 'ts'
    else if (lang === 'javascript' || lang === 'js') ext = 'js'
    else if (lang === 'html') ext = 'html'
    else if (lang === 'css') ext = 'css'
    else if (lang === 'json') ext = 'json'

    const filename = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.${ext}`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const lines = content.split('\n')
  const lineCount = lines.length

  return (
    <div
      className={cn(
        'h-full flex flex-col bg-zinc-950 border-l border-zinc-900 z-20 shrink-0 select-none relative animate-in fade-in duration-200',
        isFullscreen ? 'w-full' : 'w-[52%]'
      )}
    >
      {/* Header Toolbar (ChatGPT Canvas Style) */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-950 shrink-0">
        {/* Document Title & Badges */}
        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
          {isMarkdown ? (
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <FileCode className="w-4 h-4 text-amber-400 shrink-0" />
          )}

          {isEditingTitle ? (
            <input
              type="text"
              autoFocus
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle()
                if (e.key === 'Escape') {
                  setTitleInput(title)
                  setIsEditingTitle(false)
                }
              }}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-100 outline-none max-w-xs"
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              className="group flex items-center gap-1.5 truncate cursor-pointer"
              title="Click to rename canvas"
            >
              <span className="font-semibold text-xs text-zinc-200 truncate">{title}</span>
              <Pencil className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-800 text-zinc-400 font-mono">
            {canvas.language}
          </Badge>

          <span className="text-[10px] text-zinc-500 font-mono">v{canvas.version}</span>
        </div>

        {/* Toolbar Action Buttons (Copy, Download, Fullscreen, Close) */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Export / Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
              title={isFullscreen ? 'Restore side-by-side view' : 'Maximize to fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Close canvas"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden relative select-text">
        {isMarkdown ? (
          /* Rich WYSIWYG Markdown Display Editor (Direct Edit on Rendered Display - No Raw Markdown Code) */
          <div className="h-full overflow-y-auto p-8 select-text">
            <div className="max-w-3xl mx-auto">
              <div
                ref={wysiwygRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleWysiwygInput}
                onBlur={handleWysiwygBlur}
                onKeyDown={handleWysiwygKeyDown}
                className="canvas-wysiwyg min-h-[550px] outline-none select-text cursor-text pb-20"
                data-placeholder="Start typing your document..."
              />
            </div>
          </div>
        ) : (
          /* High-Fidelity Code Editor with Line Numbers Gutter */
          <div className="h-full flex flex-row bg-zinc-950 overflow-hidden font-mono text-xs">
            {/* Line Numbers Gutter */}
            <div
              ref={gutterRef}
              className="w-12 py-3.5 pr-2 select-none text-right font-mono text-[11px] text-zinc-600 bg-zinc-950/90 border-r border-zinc-900/60 overflow-hidden shrink-0 leading-relaxed"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="h-5 leading-5 text-zinc-600">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editable Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleCodeChange(e.target.value)}
              onScroll={handleCodeScroll}
              onKeyDown={handleCodeKeyDown}
              spellCheck={false}
              placeholder="Type code here..."
              className="flex-1 h-full py-3.5 px-3 bg-transparent text-zinc-200 font-mono text-xs leading-5 resize-none outline-none overflow-y-auto whitespace-pre tab-2 selection:bg-blue-600/30"
              style={{ tabSize: 2 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
