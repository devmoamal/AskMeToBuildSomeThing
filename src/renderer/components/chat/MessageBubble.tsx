import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, Maximize2 } from 'lucide-react'
import type { Message, CanvasDocument } from '../../../shared/types'
import { CanvasCard } from './ToolCards/CanvasCard'
import { QuestionnaireCard } from './ToolCards/QuestionnaireCard'
import { TerminalCard } from './ToolCards/TerminalCard'
import { FileActionCard } from './ToolCards/FileActionCard'
import { ThinkingBlock } from './ThinkingBlock'

interface MessageBubbleProps {
  message: Message
  onOpenCanvas: (canvas: CanvasDocument) => void
  onSubmitAnswers?: (toolCallId: string, answers: Record<string, string | string[]>) => void
  onApproveTool?: (toolCallId: string, approved: boolean) => void
}

function parseThinkingAndContent(rawText: string) {
  const thinkingParts: string[] = []
  let content = rawText
  let isThinkingActive = false

  // Match all closed <think>...</think> blocks globally
  const closedThinkRegex = /<think>([\s\S]*?)<\/think>/g
  let match: RegExpExecArray | null
  while ((match = closedThinkRegex.exec(rawText)) !== null) {
    if (match[1].trim()) {
      thinkingParts.push(match[1].trim())
    }
  }
  // Remove all closed think tags and their contents from message body
  content = content.replace(closedThinkRegex, '')

  // Check for unclosed <think> tag at the tail (streaming in progress)
  const openThinkIndex = content.indexOf('<think>')
  if (openThinkIndex !== -1) {
    const trailingThinking = content.slice(openThinkIndex + 7).trim()
    if (trailingThinking) {
      thinkingParts.push(trailingThinking)
    }
    content = content.slice(0, openThinkIndex)
    isThinkingActive = true
  }

  return {
    thinking: thinkingParts.join('\n\n---\n\n').trim(),
    content: content.trim(),
    isThinkingActive
  }
}

const CodeBlock: React.FC<{
  className?: string
  children: React.ReactNode
}> = ({ className, children }) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeString = String(children).replace(/\n$/, '')
  const isMultiLine = codeString.includes('\n')

  if (!isMultiLine && !language) {
    return (
      <code className="bg-zinc-800/80 text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    )
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-3 rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/70 border-b border-zinc-800/60 text-xs text-zinc-400">
        <span className="font-mono text-[11px] lowercase text-zinc-400">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-200">
        <pre className="m-0 p-0 bg-transparent">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  )
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenCanvas,
  onSubmitAnswers,
  onApproveTool
}) => {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // User Message Bubble (Right-aligned, sleek rounded dark card)
  if (isUser) {
    return (
      <div className="flex justify-end group">
        <div className="relative max-w-[85%] rounded-2xl bg-zinc-800 text-zinc-100 px-4 py-2.5 text-sm leading-relaxed shadow-xs select-text">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  // Assistant Message (Clean left-aligned markdown stream, NO icon beside response)
  const { thinking, content, isThinkingActive } = parseThinkingAndContent(message.content || '')

  return (
    <div className="flex flex-col group text-zinc-200 select-text max-w-none">
      {/* Reasoning / Thinking Accordion */}
      {thinking && (
        <ThinkingBlock thinking={thinking} isGenerating={isThinkingActive} />
      )}

      {/* Main Text Content */}
      {content && (
        <div className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed font-sans">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                return (
                  <CodeBlock className={className}>
                    {children}
                  </CodeBlock>
                )
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      {/* Tool Calls Activity Cards */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="space-y-2 pt-1">
          {message.toolCalls.map((tc) => {
            if (tc.toolName === 'make_canvas') {
              return <CanvasCard key={tc.id} toolCall={tc} onOpenCanvas={onOpenCanvas} />
            }
            if (tc.toolName === 'ask_user') {
              return (
                <QuestionnaireCard
                  key={tc.id}
                  toolCall={tc}
                  onSubmitAnswers={onSubmitAnswers}
                />
              )
            }
            if (tc.toolName === 'use_terminal') {
              return (
                <TerminalCard
                  key={tc.id}
                  toolCall={tc}
                  onApprove={onApproveTool}
                />
              )
            }
            if (tc.toolName === 'create_file' || tc.toolName === 'read_file') {
              return (
                <FileActionCard
                  key={tc.id}
                  toolCall={tc}
                  onApprove={onApproveTool}
                />
              )
            }
            return null
          })}
        </div>
      )}

      {/* Subtle Copy button */}
      {content && (
        <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-800 cursor-pointer"
            title="Copy response"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
