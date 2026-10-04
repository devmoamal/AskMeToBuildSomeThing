import React, { useState, useEffect, useMemo } from 'react'
import {
  GitCompare,
  X,
  Copy,
  Check,
  RefreshCw,
  FileCode,
  FileText,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import type { GitStatusSummary, GitFileChange } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface SessionReviewModalProps {
  folderPath: string
  isOpen: boolean
  onClose: () => void
}

export const SessionReviewModal: React.FC<SessionReviewModalProps> = ({
  folderPath,
  isOpen,
  onClose
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null)
  const [diffText, setDiffText] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileFilter, setFileFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadDiffAndStatus = async (targetFile?: string) => {
    if (!window.api?.projects || !folderPath) return
    setIsLoading(true)
    try {
      const [statusRes, diffRes] = await Promise.all([
        window.api.projects.getGitStatus(folderPath),
        window.api.projects.getGitDiff({
          folderPath,
          filePath: targetFile || undefined
        })
      ])
      setGitStatus(statusRes)
      setDiffText(diffRes.diff || '')
    } catch (err) {
      console.error('Failed to load git diff:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadDiffAndStatus(selectedFile || undefined)
    }
  }, [isOpen, folderPath, selectedFile])

  const filteredFiles = useMemo(() => {
    if (!gitStatus?.files) return []
    if (!fileFilter.trim()) return gitStatus.files
    const q = fileFilter.toLowerCase()
    return gitStatus.files.filter(f => f.path.toLowerCase().includes(q))
  }, [gitStatus?.files, fileFilter])

  const handleCopy = () => {
    if (!diffText) return
    navigator.clipboard.writeText(diffText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parse total additions and deletions from diff
  const stats = useMemo(() => {
    if (!diffText) return { additions: 0, deletions: 0 }
    let additions = 0
    let deletions = 0
    const lines = diffText.split('\n')
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) additions++
      else if (l.startsWith('-') && !l.startsWith('---')) deletions++
    }
    return { additions, deletions }
  }, [diffText])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden text-foreground">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Session Changes Review
                </h3>
                {gitStatus?.branch && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-mono text-muted-foreground">
                    {gitStatus.branch}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="text-emerald-500 font-medium">+{stats.additions} lines</span>
                <span>•</span>
                <span className="text-rose-500 font-medium">-{stats.deletions} lines</span>
                <span>•</span>
                <span>{gitStatus?.files.length || 0} modified file(s)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDiffAndStatus(selectedFile || undefined)}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Refresh Diffs"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin text-primary')} />
            </button>
            <button
              onClick={handleCopy}
              disabled={!diffText}
              className="px-3 py-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Diff'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view of files list & unified diff viewer */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Changed Files Sidebar */}
          <div className="w-64 border-r border-border/60 bg-muted/15 flex flex-col shrink-0">
            <div className="px-3 py-2 border-b border-border/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Changed Files</span>
              <span>{filteredFiles.length} / {gitStatus?.files.length || 0}</span>
            </div>

            {/* Filter Search Input */}
            <div className="p-2 border-b border-border/40">
              <input
                type="text"
                placeholder="Filter files..."
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-md bg-muted/60 border border-border/50 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              <div
                onClick={() => setSelectedFile(null)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-between',
                  selectedFile === null
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/80 hover:bg-muted/60'
                )}
              >
                <span>All Changes</span>
                <span className="text-[10px] font-mono opacity-80">
                  {gitStatus?.files.length || 0}
                </span>
              </div>

              {filteredFiles.map((file) => {
                const isSelected = selectedFile === file.path
                const basename = file.path.split(/[\\/]/).pop()

                return (
                  <div
                    key={file.path}
                    onClick={() => setSelectedFile(file.path)}
                    className={cn(
                      'group px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-between gap-2',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-foreground/80 hover:bg-muted/60'
                    )}
                    title={file.path}
                  >
                    <div className="truncate min-w-0">
                      <div className="truncate">{basename}</div>
                      <div className={cn('text-[10px] truncate', isSelected ? 'opacity-80' : 'text-muted-foreground')}>
                        {file.path}
                      </div>
                    </div>

                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold shrink-0',
                        isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : (
                          file.status === 'modified' && 'bg-amber-500/15 text-amber-500',
                          file.status === 'added' && 'bg-emerald-500/15 text-emerald-500',
                          file.status === 'deleted' && 'bg-rose-500/15 text-rose-500',
                          file.status === 'untracked' && 'bg-blue-500/15 text-blue-500'
                        )
                      )}
                    >
                      {file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : '?'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Unified Diff Viewer */}
          <div className="flex-1 overflow-auto bg-card p-4 font-mono text-xs select-text">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
                Loading diffs...
              </div>
            ) : !diffText ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
                <p className="text-sm font-medium">No uncommitted changes detected.</p>
                <p className="text-xs">The working tree is completely clean.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {diffText.split('\n').map((line, idx) => {
                  const isAddition = line.startsWith('+') && !line.startsWith('+++')
                  const isDeletion = line.startsWith('-') && !line.startsWith('---')
                  const isHunk = line.startsWith('@@')
                  const isHeader = line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')

                  return (
                    <div
                      key={idx}
                      className={cn(
                        'px-2 py-0.5 rounded-xs leading-relaxed whitespace-pre font-mono text-[11px]',
                        isAddition && 'bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 font-medium',
                        isDeletion && 'bg-rose-500/15 text-rose-400 dark:text-rose-300',
                        isHunk && 'bg-cyan-500/10 text-cyan-400 font-semibold my-1 border-y border-cyan-500/20',
                        isHeader && 'text-muted-foreground font-semibold border-t border-border/30 pt-1 mt-2',
                        !isAddition && !isDeletion && !isHunk && !isHeader && 'text-foreground/80'
                      )}
                    >
                      {line}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
