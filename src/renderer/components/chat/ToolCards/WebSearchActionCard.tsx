import React, { useState } from 'react'
import { Globe, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import type { ToolCallRecord, WebSearchOutput, WebSearchResult } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface WebSearchActionCardProps {
  toolCall: ToolCallRecord
}

/**
 * Vercel AI SDK Tool Card for web_search
 * Strict Geist aesthetic: #000000 card, #222 hairline border, monospace headers & badges
 */
export const WebSearchActionCard: React.FC<WebSearchActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const query = toolCall.args?.query || 'web search'
  const isExecuting = toolCall.status === 'executing'
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'

  const output = toolCall.result as WebSearchOutput | undefined
  const results: WebSearchResult[] = output?.results || []
  const count = results.length

  const handleOpenLink = (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => (count > 0 || isFailed) && setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] cursor-pointer select-none text-[11px] ${
          isExpanded && count > 0 ? 'border-b border-[#222]' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-zinc-100 font-semibold truncate text-xs" title={query}>
            &quot;{query}&quot;
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isExecuting && (
            <VercelBadge variant="blue">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse shrink-0"></span>
              <span>searching</span>
            </VercelBadge>
          )}

          {isCompleted && (
            <VercelBadge variant="default">
              {count} {count === 1 ? 'result' : 'results'}
            </VercelBadge>
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <span>error</span>
            </VercelBadge>
          )}

          {count > 0 && (
            <button
              type="button"
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Inspect search results'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && count > 0 && (
        <div className="relative p-3 bg-[#050505] text-[11px] leading-relaxed select-text border-t border-[#1a1a1a]">
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 font-sans">
            {results.map((res, idx) => {
              let hostname = ''
              try {
                hostname = new URL(res.url).hostname.replace(/^www\./, '')
              } catch {
                hostname = res.url
              }

              return (
                <div
                  key={`${res.url}_${idx}`}
                  className="p-2 rounded bg-[#0e0e0e] border border-[#1f1f1f] hover:border-[#333] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={res.url}
                      onClick={(e) => handleOpenLink(res.url, e)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1.5 truncate group"
                    >
                      <span className="truncate">{res.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                    </a>
                    {hostname && (
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                        {hostname}
                      </span>
                    )}
                  </div>
                  {res.snippet && (
                    <p className="mt-1 text-zinc-300 text-[11px] leading-snug line-clamp-2">
                      {res.snippet}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isExpanded && isFailed && toolCall.error && (
        <div className="p-3 bg-[#110505] text-red-400 text-[11px] border-t border-red-950">
          Search error: {toolCall.error}
        </div>
      )}
    </div>
  )
}
