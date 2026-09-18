import React, { useState } from 'react'
import { Copy, Check, ArrowUpRight, FileText } from 'lucide-react'
import type { ToolCallRecord, CanvasDocument } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface CanvasCardProps {
  toolCall: ToolCallRecord
  onOpenCanvas?: (canvas: CanvasDocument) => void
}

/**
 * Vercel Artifact / Deployment Canvas Card
 * Strict Geist aesthetic: #000000 card, #222 hairline border, pure white action button
 */
export const CanvasCard: React.FC<CanvasCardProps> = ({ toolCall, onOpenCanvas }) => {
  const [copied, setCopied] = useState(false)
  const args = toolCall.args || {}
  const title = args.title || toolCall.result?.title || 'Canvas Document'
  const language = args.language || toolCall.result?.language || 'markdown'
  const content = toolCall.result?.content || args.content || ''
  const canvasId = toolCall.result?.canvasId || toolCall.id
  const version = toolCall.result?.version || 1

  const lines = content ? content.split('\n') : []
  const preview = lines.slice(0, 2).join('\n').trim()

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpen = () => {
    if (onOpenCanvas) {
      onOpenCanvas({
        id: canvasId,
        title,
        language,
        content,
        version,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
  }

  return (
    <div
      onClick={handleOpen}
      className="my-2 rounded-lg border border-[#222] bg-[#000000] hover:border-[#444] transition-all cursor-pointer overflow-hidden shadow-xs group select-none font-sans text-xs"
    >
      <div className="px-3.5 py-2 bg-[#0a0a0a] border-b border-[#222] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <FileText className="w-3 h-3" />
          </div>
          <span className="font-medium text-white truncate group-hover:text-zinc-200 transition-colors">
            {title}
          </span>
          <VercelBadge variant="default" className="uppercase">
            {language}
          </VercelBadge>
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded hover:bg-[#1a1a1a]"
            title="Copy content"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1 text-[11px] font-semibold bg-white hover:bg-zinc-200 text-black px-2.5 py-1 rounded-md transition-all shadow-xs cursor-pointer"
          >
            <span>Open Canvas</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {preview && (
        <div className="px-4 py-2 font-mono text-[11px] text-zinc-400 bg-[#050505] truncate leading-relaxed">
          {preview}
        </div>
      )}
    </div>
  )
}
