import React, { useState } from 'react'
import { ChevronDown, ChevronRight, FolderTree, Search, FileCode } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface ExplorationActionCardProps {
  toolCall: ToolCallRecord
}

export const ExplorationActionCard: React.FC<ExplorationActionCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const isExecuting = toolCall.status === 'executing'
  const isFailed = toolCall.status === 'failed'

  const toolName = toolCall.toolName
  const args = toolCall.args || {}
  const result = toolCall.result || {}

  let icon = <FolderTree className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
  let title = 'Codebase Exploration'
  let badgeText = ''
  let content = ''

  if (toolName === 'list_dir') {
    icon = <FolderTree className="w-3.5 h-3.5 text-blue-400 shrink-0" />
    title = `List: ${args.path || '.'}`
    const count = result.totalEntries ?? (result.entries?.length || 0)
    badgeText = `${count} items`
    if (result.entries) {
      content = result.entries
        .map((e: any) => `${e.isDirectory ? '📁' : '📄'} ${e.relPath || e.name}${e.size ? ` (${e.size}B)` : ''}`)
        .join('\n')
    }
  } else if (toolName === 'find_files') {
    icon = <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    title = `Find: "${args.pattern}"`
    const count = result.matchCount ?? (result.matches?.length || 0)
    badgeText = `${count} files`
    if (result.matches) {
      content = result.matches.map((m: any) => m.relPath || m.name).join('\n')
    }
  } else if (toolName === 'search_code') {
    icon = <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    title = `Grep: "${args.query}"`
    const count = result.totalMatches ?? (result.matches?.length || 0)
    badgeText = `${count} matches`
    if (result.matches) {
      content = result.matches
        .map((m: any) => `${m.file}:${m.line}  ${m.content}`)
        .join('\n')
    }
  }

  const hasDetails = Boolean(content)

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] ${
          hasDetails ? 'cursor-pointer select-none' : ''
        } text-[11px] ${isExpanded && hasDetails ? 'border-b border-[#222]' : ''}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          {icon}
          <span className="text-zinc-100 font-semibold truncate text-xs">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {badgeText && (
            <VercelBadge variant="default">
              {badgeText}
            </VercelBadge>
          )}

          {isExecuting && (
            <VercelBadge variant="blue">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse shrink-0"></span>
              <span>searching</span>
            </VercelBadge>
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <span>error</span>
            </VercelBadge>
          )}

          {hasDetails && (
            <button
              type="button"
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Inspect results'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && hasDetails && (
        <div className="relative p-3 bg-[#050505] text-[11px] leading-relaxed select-text border-t border-[#1a1a1a]">
          <pre className="text-zinc-300 whitespace-pre-wrap m-0 max-h-52 overflow-y-auto font-mono scrollbar-thin">{content}</pre>
        </div>
      )}
    </div>
  )
}
