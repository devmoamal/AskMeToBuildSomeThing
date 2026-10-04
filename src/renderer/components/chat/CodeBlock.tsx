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
 * Pitch black background, #222 hairline border, copy feedback,
 * language badge, optional line numbers (≤50 lines), file path display.
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({ className, language: propLang, value, children }) => {
  const [copied, setCopied] = useState(false)

  // Extract language and optional title from className like `language-tsx title="src/App.tsx"`
  const langMatch = /language-([\w-]+)/.exec(className || '')
  const titleMatch = /title="([^"]+)"/.exec(className || '')
  const filePath = titleMatch ? titleMatch[1] : null

  const rawLang = propLang || (langMatch ? langMatch[1] : '')
  // Strip any trailing modifiers (e.g. "tsx" from "tsx title=...")
  const language = rawLang.split(/\s/)[0]

  const codeString = value !== undefined ? value : String(children || '').replace(/\n$/, '')
  const isMultiLine = codeString.includes('\n')

  // Inline code (no language, single line) → compact style
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

  // Syntax highlighting
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

  // Line numbers — only for blocks with ≤50 lines
  const lines = codeString.split('\n')
  const showLineNumbers = lines.length <= 50 && lines.length > 1

  return (
    <div className="my-2.5 rounded-lg border border-[#222] bg-[#000000] overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0a0a0a] border-b border-[#222]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Language badge */}
          {language && (
            <span className="text-[10px] font-mono text-zinc-500 capitalize shrink-0">
              {language}
            </span>
          )}
          {/* File path */}
          {filePath && (
            <>
              <span className="text-zinc-700 text-[10px]">·</span>
              <span className="text-[10px] font-mono text-zinc-500 truncate" title={filePath}>
                {filePath}
              </span>
            </>
          )}
          {/* Fallback label when neither language nor filePath */}
          {!language && !filePath && (
            <span className="text-[10px] font-mono text-zinc-600">code</span>
          )}
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#1a1a1a] text-zinc-400 hover:text-white text-[11px] transition-colors cursor-pointer shrink-0"
          title="Copy code"
        >
          {copied
            ? <Check className="w-3 h-3 text-emerald-400" />
            : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto text-xs font-mono leading-relaxed text-zinc-200 select-text scrollbar-thin">
        {showLineNumbers ? (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => {
                // Build per-line highlighted HTML
                const lineHtml = highlightedHtml
                  ? highlightedHtml.split('\n')[i] ?? ''
                  : null
                return (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="select-none text-right pr-4 pl-3.5 py-0 text-zinc-600 text-[11px] w-[1%] whitespace-nowrap border-r border-[#1a1a1a]">
                      {i + 1}
                    </td>
                    <td className="pl-4 pr-3.5 py-0 whitespace-pre">
                      {lineHtml !== null ? (
                        <span dangerouslySetInnerHTML={{ __html: lineHtml }} />
                      ) : (
                        line
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-3.5">
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
        )}
      </div>
    </div>
  )
}
