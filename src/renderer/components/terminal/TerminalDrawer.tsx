import React, { useState, useEffect, useRef } from 'react'
import { Terminal as TerminalIcon, X, Trash2, Send, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'

interface TerminalDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectFolder?: string
  defaultShell?: string
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen,
  onClose,
  projectFolder,
  defaultShell = 'powershell'
}) => {
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [inputCommand, setInputCommand] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [height, setHeight] = useState(240)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = window.api.terminal.onTerminalOutput((chunk: string) => {
      setOutputLines(prev => [...prev, chunk])
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [outputLines, isOpen])

  if (!isOpen) return null

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    const cmd = inputCommand.trim()
    if (!cmd || isRunning) return

    setOutputLines(prev => [...prev, `\n> ${cmd}\n`])
    setInputCommand('')
    setIsRunning(true)

    try {
      const res = await window.api.terminal.runCommand({
        command: cmd,
        cwd: projectFolder,
        shell: defaultShell
      })
      if (res.stdout) setOutputLines(prev => [...prev, res.stdout])
      if (res.stderr) setOutputLines(prev => [...prev, `[stderr] ${res.stderr}`])
    } catch (err: any) {
      setOutputLines(prev => [...prev, `\n[error] ${err.message}\n`])
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div
      style={{ height: `${height}px` }}
      className="border-t border-border bg-[#0b0b0e] flex flex-col shrink-0 text-foreground z-30"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-card/80 border-b border-border/50 text-xs select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-foreground/90">Terminal</span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
            {defaultShell}
          </span>
          {projectFolder && (
            <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-sm">
              {projectFolder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOutputLines([])}
            title="Clear output"
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setHeight(h => (h === 240 ? 380 : 240))}
            title="Toggle size"
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {height === 240 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            title="Close terminal"
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Console */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-zinc-300 space-y-0.5 select-text">
        {outputLines.length === 0 ? (
          <div className="text-zinc-600 italic">Project terminal initialized. Enter a command below.</div>
        ) : (
          outputLines.map((line, i) => (
            <span key={i} className="whitespace-pre-wrap leading-relaxed block">
              {line}
            </span>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Input Form */}
      <form onSubmit={handleRun} className="flex items-center gap-2 p-2 bg-card/60 border-t border-border/40">
        <span className="text-amber-400 font-mono text-xs pl-2 select-none">$</span>
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          placeholder={`Run command in ${projectFolder ? projectFolder.split(/[\\/]/).pop() : 'project'}...`}
          disabled={isRunning}
          className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isRunning || !inputCommand.trim()}
          className="h-6 text-[11px] px-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
        >
          <Send className="w-3 h-3 mr-1" />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </Button>
      </form>
    </div>
  )
}
