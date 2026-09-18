import React, { useState, useEffect } from 'react'
import { FileCode, Copy, Check, Save, Eye, Edit3, X, Maximize2, Minimize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CanvasDocument } from '../../../shared/types'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

interface CanvasModalProps {
  canvas: CanvasDocument | null
  onClose: () => void
  onSave?: (canvas: CanvasDocument) => void
}

export const CanvasModal: React.FC<CanvasModalProps> = ({ canvas, onClose, onSave }) => {
  if (!canvas) return null

  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [content, setContent] = useState(canvas.content)
  const [title, setTitle] = useState(canvas.title)
  const [copied, setCopied] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)

  useEffect(() => {
    setContent(canvas.content)
    setTitle(canvas.title)
  }, [canvas])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (onSave) {
      onSave({
        ...canvas,
        title,
        content,
        updatedAt: Date.now()
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in-0">
      <div
        className={cn(
          'flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-200',
          isFullScreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-5xl h-[88vh]'
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
            <div className="p-1.5 rounded-md bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <FileCode className="w-5 h-5" />
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 text-foreground flex-1 min-w-0"
            />

            <Badge variant="outline" className="text-[11px] font-mono shrink-0">
              v{canvas.version}
            </Badge>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switch: Preview vs Edit */}
            <div className="flex items-center p-0.5 bg-muted/80 rounded-lg border border-border/50 text-xs mr-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer',
                  activeTab === 'preview'
                    ? 'bg-card text-foreground font-medium shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Typeset Preview</span>
              </button>

              <button
                onClick={() => setActiveTab('edit')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer',
                  activeTab === 'edit'
                    ? 'bg-card text-foreground font-medium shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </Button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'preview' ? (
            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background/50">
              <div className="max-w-3xl mx-auto typeset text-foreground/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*No content*'}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 bg-[#0a0a0d]">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your markdown content here..."
                className="w-full h-full font-mono text-sm leading-relaxed p-4 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
