import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Copy, ChevronDown, ChevronRight, Loader2, Terminal } from 'lucide-react'
import type { ToolCallRecord } from '../../../../shared/types'
import { VercelBadge } from '../../ui/VercelIcon'

interface TerminalActionCardProps {
  toolCall: ToolCallRecord
  onApprove?: (toolCallId: string, approved: boolean) => void
}

/**
 * Vercel Deployment / Build Log Terminal Block
 * Strict Geist aesthetic: #000000 card, #222 hairline border, prompt $
 */
export const TerminalActionCard: React.FC<TerminalActionCardProps> = ({ toolCall }) => {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  const args = toolCall.args || {}
  const command = args.command || ''
  const cwd = args.cwd || ''

  const isRequiresApproval = toolCall.status === 'requires_approval'
  const isExecuting = toolCall.status === 'executing'
  const isCompleted = toolCall.status === 'completed'
  const isFailed = toolCall.status === 'failed'

  const stdout = toolCall.result?.stdout || ''
  const stderr = toolCall.result?.stderr || toolCall.error || ''
  const exitCode = toolCall.result?.exitCode

  useEffect(() => {
    if (terminalRef.current && isExecuting) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [stdout, stderr, isExecuting])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(stdout || stderr || command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-1.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden hover:border-[#333] transition-colors shadow-xs font-mono text-xs">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`h-8 px-3 flex items-center justify-between bg-[#0a0a0a] cursor-pointer select-none text-[11px] ${
          isExpanded ? 'border-b border-[#222]' : ''
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-zinc-100 font-semibold truncate text-xs" title={command}>
            {command || 'command'}
          </span>
          {cwd && (
            <span className="text-[10px] text-zinc-600 truncate hidden sm:inline max-w-[120px]">
              {cwd}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isExecuting && (
            <VercelBadge variant="blue">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse shrink-0"></span>
              <span>executing</span>
            </VercelBadge>
          )}

          {isCompleted && exitCode !== undefined && exitCode !== 0 && (
            <VercelBadge variant="error">
              <X className="w-2.5 h-2.5" />
              <span>exit {exitCode}</span>
            </VercelBadge>
          )}

          {isFailed && (
            <VercelBadge variant="error">
              <X className="w-2.5 h-2.5" />
              <span>failed</span>
            </VercelBadge>
          )}

          {isRequiresApproval && (
            <VercelBadge variant="warning">
              <span>approval needed</span>
            </VercelBadge>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer rounded hover:bg-[#1a1a1a]"
            title="Copy command/output"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            type="button"
            className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          ref={terminalRef}
          className="relative p-3.5 font-mono text-[11px] max-h-56 overflow-y-auto bg-[#050505] leading-relaxed select-text scrollbar-thin"
        >
          {stdout && <pre className="text-zinc-300 whitespace-pre-wrap m-0 font-mono">{stdout}</pre>}
          {stderr && <pre className="text-rose-400 whitespace-pre-wrap m-0 font-mono mt-1">{stderr}</pre>}
          {isExecuting && !stdout && !stderr && (
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Streaming stdout...</span>
            </div>
          )}
          {!isExecuting && !stdout && !stderr && (
            <div className="text-zinc-600 italic">No output</div>
          )}
        </div>
      )}
    </div>
  )
}
