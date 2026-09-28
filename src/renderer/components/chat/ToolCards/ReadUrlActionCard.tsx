import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Copy, Check, Compass, Link2 } from 'lucide-react'
import type { ToolCallRecord, ReadUrlOutput } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface ReadUrlActionCardProps {
  toolCall: ToolCallRecord
}

/**
 * Vercel AI SDK Tool Card for read_url (Self-Hosted Site Crawler)
 * Geist aesthetic: #000000 card, #222 hairline border, monospace header & badges
 */
export const ReadUrlActionCard: React.FC<ReadUrlActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = toolCall.args?.url || 'unknown-url'
  const isExecuting = toolCall.status === 'executing'
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'

  const output = toolCall.result as ReadUrlOutput | undefined
  const content = output?.content || ''
  const title = output?.title
  const isTruncated = output?.truncated
  const subpages = output?.internalLinks || []

  let hostname = ''
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    hostname = url
  }

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const displayTitle = title || hostname || url

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => (content || isFailed) && setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] cursor-pointer select-none text-[11px] ${
          isExpanded && content ? 'border-b border-[#222]' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-zinc-100 font-semibold truncate text-xs" title={url}>
            {displayTitle}
          </span>
          {hostname && title && (
            <span className="text-[10px] text-zinc-500 truncate hidden sm:inline">
              ({hostname})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isExecuting && (
            <VercelBadge variant="blue">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse shrink-0"></span>
              <span>crawling</span>
            </VercelBadge>
          )}

          {isCompleted && (
            <>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 font-mono">
                local
              </span>
              {subpages.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono hidden md:inline">
                  {subpages.length} subpages
                </span>
              )}
              <VercelBadge variant="default">
                {Math.round(content.length / 1000)}k chars
              </VercelBadge>
              {isTruncated && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono">
                  trimmed
                </span>
              )}
            </>
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <span>failed</span>
            </VercelBadge>
          )}

          <button
            type="button"
            onClick={handleOpenLink}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Open original page in browser"
          >
            <ExternalLink className="w-3 h-3" />
          </button>

          {content && (
            <button
              type="button"
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Inspect markdown content'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && content && (
        <div className="relative p-3 bg-[#050505] text-[11px] leading-relaxed select-text border-t border-[#1a1a1a]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-900 text-zinc-400 text-[10px]">
            <span className="truncate pr-2 font-sans">{url}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111] hover:bg-[#1a1a1a] text-zinc-300 border border-[#222] transition-colors shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy MD'}</span>
            </button>
          </div>
          <pre className="text-zinc-300 whitespace-pre-wrap m-0 max-h-56 overflow-y-auto font-mono text-[10px] leading-relaxed scrollbar-thin">
            {content}
          </pre>
        </div>
      )}

      {isExpanded && isFailed && toolCall.error && (
        <div className="p-3 bg-[#110505] text-red-400 text-[11px] border-t border-red-950 font-sans">
          Crawl error: {toolCall.error}
        </div>
      )}
    </div>
  )
}
