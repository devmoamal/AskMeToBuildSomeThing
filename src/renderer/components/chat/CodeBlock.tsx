import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import hljs from 'highlight.js'

interface CodeBlockProps {
  className?: string
  language?: string
  value?: string
  children?: React.ReactNode
}

/**
 * Vercel Geist Monospace Code Block
 * Pitch black background, #222 hairline border, copy feedback
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({ className, language: propLang, value, children }) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(w+)/.exec(className || '')
  const language = propLang || (match ? match[1] : '')
  const codeString = value !== undefined ? value : String(children || '').replace(/\n$/, '')
  const isMultiLine = codeString.includes('\n')

  if (!isMultiLine && !language && children) {
    return (
      <code className="bg-[#111] text-zinc-200 border border-[#222] px-1.5 py-0.5 rounded text-[11px] font-mono">
        {children}
      </code>
    )
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(codeString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Syntax highlighting with highlight.js
  let highlightedHtml = ''
  try {
    if (language && hljs.getLanguage(language)) {
      highlightedHtml = hljs.highlight(codeString, { language, ignoreIllegals: true }).value
    } else {
      highlightedHtml = hljs.highlightAuto(codeString).value
    }
  } catch {
    highlightedHtml = ''
  }

  return (
    <div className="my-2.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0a0a0a] border-b border-[#222] text-xs text-zinc-400">
        <span className="font-mono text-[11px] lowercase text-zinc-400">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#1a1a1a] text-zinc-400 hover:text-white text-[11px] transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-zinc-200 select-text scrollbar-thin">
        {highlightedHtml ? (
          <pre className="m-0 p-0 bg-transparent font-mono">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          </pre>
        ) : (
          <pre className="m-0 p-0 bg-transparent font-mono">
            <code>{children || codeString}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
