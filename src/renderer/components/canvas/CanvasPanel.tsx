import React, { useState, useEffect } from 'react'
import {
  FileCode,
  X,
  Maximize2,
  Copy,
  Check,
  Edit3,
  Eye,
  Save
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CanvasDocument } from '../../../shared/types'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

interface CanvasPanelProps {
  canvas: CanvasDocument
  onClose: () => void
  onExpandModal: () => void
  onSave: (updated: CanvasDocument) => Promise<void> | void
}

export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  canvas,
  onClose,
  onExpandModal,
  onSave
}) => {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(canvas.content)
  const [title, setTitle] = useState(canvas.title)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setContent(canvas.content)
    setTitle(canvas.title)
  }, [canvas.id, canvas.content, canvas.title])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave({
        ...canvas,
        title,
        content,
        updatedAt: Date.now()
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const isMarkdown = canvas.language.toLowerCase() === 'markdown' || canvas.language.toLowerCase() === 'md'

  return (
    <div className="w-[48%] h-full flex flex-col bg-zinc-950 border-l border-zinc-900/80 z-20 shrink-0 select-none animate-in fade-in duration-150">
      {/* Canvas Top Bar */}
      <div className="h-11 px-3.5 flex items-center justify-between border-b border-zinc-900/80 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2 truncate min-w-0">
          <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-medium text-xs text-zinc-200 truncate">{title}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-zinc-800 text-zinc-400">
            {canvas.language}
          </Badge>
          <span className="text-[10px] text-zinc-500 font-mono">v{canvas.version}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* View / Edit Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title={isEditing ? 'View rendered' : 'Edit content'}
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Copy content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Expand to Fullscreen Modal */}
          <button
            type="button"
            onClick={onExpandModal}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Expand to modal"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Panel */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor / Viewer Body */}
      <div className="flex-1 overflow-y-auto p-4 select-text">
        {isEditing ? (
          <div className="flex flex-col h-full space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 outline-none resize-none leading-relaxed"
              placeholder="Edit canvas code or markdown..."
            />
            <div className="flex justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setContent(canvas.content)
                  setIsEditing(false)
                }}
                className="h-7 text-xs border-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {isMarkdown ? (
              <div className="prose prose-invert max-w-none text-zinc-200 text-xs leading-relaxed font-sans typeset">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-3 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-200 leading-relaxed whitespace-pre">
                  <code>{content}</code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
