import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, RotateCcw } from 'lucide-react'
import type { Message, CanvasDocument, MessagePart, ToolCallRecord } from '../../../shared/types'
import { ThinkingBlock } from './ThinkingBlock'
import { CodeBlock } from './CodeBlock'
import { TerminalActionCard } from './ToolCards/TerminalActionCard'
import { FileWriteActionCard } from './ToolCards/FileWriteActionCard'
import { FileReadActionCard } from './ToolCards/FileReadActionCard'
import { CanvasCard } from './ToolCards/CanvasCard'
import { QuestionnaireCard } from './ToolCards/QuestionnaireCard'
import { WebSearchActionCard } from './ToolCards/WebSearchActionCard'
import { parseThinkingAndContent } from '../../../shared/thinking'

/**
 * Predicts and auto-closes streaming markdown syntax (like open code fences) in real time
 */
function completeStreamingMarkdown(text: string): string {
  if (!text) return ''
  // Count unclosed code fences ```
  const fenceMatches = text.match(/```/g)
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    return text + '\n```'
  }
  return text
}

function getChronologicalMessageParts(message: Message): MessagePart[] {
  if (message.parts && message.parts.length > 0) {
    const expanded: MessagePart[] = []
    for (const p of message.parts) {
      if (p.type === 'text') {
        const { thinking, content, isThinkingActive } = parseThinkingAndContent(p.text)
        if (thinking) {
          expanded.push({ type: 'thinking', text: thinking, isGenerating: isThinkingActive })
        }
        if (content) {
          expanded.push({ type: 'text', text: content })
        }
      } else {
        expanded.push(p)
      }
    }
    return expanded
  }

  // Fallback for older messages without explicit parts:
  // Render thoughts -> tool calls -> content sequentially
  const fallbackParts: MessagePart[] = []
  const { thinking, content, isThinkingActive } = parseThinkingAndContent(message.content || '')

  if (thinking) {
    fallbackParts.push({ type: 'thinking', text: thinking, isGenerating: isThinkingActive })
  }

  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const tc of message.toolCalls) {
      fallbackParts.push({ type: 'tool_call', toolCall: tc })
    }
  }

  if (content) {
    fallbackParts.push({ type: 'text', text: content })
  }

  return fallbackParts
}

interface MessageBubbleProps {
  message: Message
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
  onRollbackRequest?: (message: Message) => void
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool,
  onRollbackRequest
}) => {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // User Message Bubble (Right-aligned, sleek rounded dark card with actions under)
  if (isUser) {
    return (
      <div className="flex flex-col items-end group my-1.5">
        <div className="relative max-w-[85%] rounded-2xl bg-zinc-800 text-zinc-100 px-4 py-2.5 text-sm leading-relaxed shadow-xs select-text">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Action buttons directly UNDER message, flowing naturally */}
        <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800/80 cursor-pointer"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {onRollbackRequest && (
            <button
              type="button"
              onClick={() => onRollbackRequest(message)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-500/10 cursor-pointer"
              title="Rollback to this message"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Rollback</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Assistant Message: Unified chronological follow-up stream (thing after thing)
  const parts = getChronologicalMessageParts(message)

  const markdownComponents = useMemo(() => ({
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-zinc-100 mt-5 mb-2.5 pb-1 border-b border-zinc-800/70 tracking-tight first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-semibold text-zinc-100 mt-4 mb-2 pb-0.5 border-b border-zinc-800/40 tracking-tight first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold text-zinc-200 mt-3 mb-1.5 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold text-zinc-200 mt-2.5 mb-1 first:mt-0">
        {children}
      </h4>
    ),
    p: ({ children }: any) => (
      <p className="my-2 leading-relaxed text-zinc-300 text-sm first:mt-0 last:mb-0">
        {children}
      </p>
    ),
    ul: ({ children }: any) => (
      <ul className="my-2 ml-5 list-disc space-y-1 text-zinc-300 text-sm marker:text-zinc-500">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="my-2 ml-5 list-decimal space-y-1 text-zinc-300 text-sm marker:text-zinc-500">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="leading-relaxed pl-0.5">
        {children}
      </li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="my-3 border-l-2 border-zinc-700 pl-3.5 italic text-zinc-400 text-sm">
        {children}
      </blockquote>
    ),
    hr: () => (
      <hr className="my-4 border-t border-zinc-800/80" />
    ),
    table: ({ children }: any) => (
      <div className="my-3 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70 shadow-xs">
        <table className="w-full text-left text-xs border-collapse font-sans">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-300 font-semibold">
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
        {children}
      </tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="hover:bg-zinc-900/40 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th className="px-3.5 py-2.5 font-semibold text-zinc-200 text-xs">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-3.5 py-2 text-zinc-300 text-xs leading-relaxed">
        {children}
      </td>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </a>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-zinc-100">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-zinc-200">{children}</em>
    ),
    code({ node, className, children, ...props }: any) {
      return (
        <CodeBlock className={className}>
          {children}
        </CodeBlock>
      )
    }
  }), [])

  return (
    <div className="flex flex-col text-zinc-200 select-text max-w-none space-y-2.5">
      {/* Sequential Chronological Stream: thing after thing */}
      {parts.map((part, idx) => {
        if (part.type === 'thinking') {
          return (
            <ThinkingBlock
              key={`think_${idx}`}
              thinking={part.text}
              isGenerating={part.isGenerating}
            />
          )
        }

        if (part.type === 'tool_call') {
          const tc = part.toolCall
          if (tc.toolName === 'use_terminal') {
            return (
              <TerminalActionCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
                onApprove={onApproveTool}
              />
            )
          }
          if (tc.toolName === 'create_file' || tc.toolName === 'edit_file') {
            return (
              <FileWriteActionCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
                onApprove={onApproveTool}
              />
            )
          }
          if (tc.toolName === 'read_file') {
            return (
              <FileReadActionCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
              />
            )
          }
          if (tc.toolName === 'make_canvas') {
            return (
              <CanvasCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
                onOpenCanvas={onOpenCanvas}
              />
            )
          }
          if (tc.toolName === 'ask_user') {
            return (
              <QuestionnaireCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
                onSubmitAnswers={onSubmitAnswers}
              />
            )
          }
          if (tc.toolName === 'web_search') {
            return (
              <WebSearchActionCard
                key={tc.id || `tc_${idx}`}
                toolCall={tc}
              />
            )
          }
          return null
        }

        if (part.type === 'text') {
          return (
            <div key={`text_${idx}`} className="text-zinc-200 text-sm leading-relaxed font-sans select-text">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {completeStreamingMarkdown(part.text)}
              </ReactMarkdown>
            </div>
          )
        }

        return null
      })}

      {/* Action buttons directly UNDER message, flowing naturally */}
      <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800 cursor-pointer"
          title="Copy response"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        {onRollbackRequest && (
          <button
            type="button"
            onClick={() => onRollbackRequest(message)}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-500/10 cursor-pointer"
            title="Rollback to this message"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Rollback</span>
          </button>
        )}
      </div>
    </div>
  )
}
