import React, { useState, useEffect, useMemo } from 'react'
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  Search,
  RefreshCw,
  GitBranch,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  AtSign,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react'
import type { FileTreeNode, GitStatusSummary } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface WorkspaceFileTreeProps {
  folderPath: string
  onOpenFileInCanvas?: (filePath: string, fileName: string) => void
  onInsertMention?: (mentionText: string) => void
  className?: string
}

function getFileIcon(extension?: string, isDirectory?: boolean, isOpen?: boolean) {
  if (isDirectory) {
    return isOpen ? (
      <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
    ) : (
      <Folder className="w-4 h-4 text-amber-500/80 shrink-0" />
    )
  }

  const ext = (extension || '').toLowerCase()
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) {
    return <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
  }
  if (['md', 'txt', 'rst', 'doc'].includes(ext)) {
    return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
  }
  if (['css', 'scss', 'less', 'html'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-pink-400 shrink-0" />
  }
  if (['csv', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
  }
  return <File className="w-4 h-4 text-muted-foreground shrink-0" />
}

export const WorkspaceFileTree: React.FC<WorkspaceFileTreeProps> = ({
  folderPath,
  onOpenFileInCanvas,
  onInsertMention,
  className
}) => {
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [gitStatus, setGitStatus] = useState<GitStatusSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const loadTreeAndGit = async () => {
    if (!window.api?.projects?.getDirectoryTree || !folderPath) return
    setIsLoading(true)
    try {
      const [fetchedTree, fetchedGit] = await Promise.all([
        window.api.projects.getDirectoryTree(folderPath),
        window.api.projects.getGitStatus ? window.api.projects.getGitStatus(folderPath) : null
      ])
      setTree(fetchedTree || [])
      setGitStatus(fetchedGit)

      // Auto-expand top level folders initially
      setExpandedFolders(prev => {
        if (prev.size === 0 && fetchedTree) {
          const next = new Set<string>()
          fetchedTree.forEach(node => {
            if (node.isDirectory) next.add(node.path)
          })
          return next
        }
        return prev
      })
    } catch (err) {
      console.error('Failed to load workspace file tree:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTreeAndGit()
  }, [folderPath])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Map git dirty status by relative path
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; staged?: boolean }>()
    if (gitStatus?.files) {
      for (const f of gitStatus.files) {
        map.set(f.path.replace(/\\/g, '/'), f)
      }
    }
    return map
  }, [gitStatus])

  // Filter tree recursively
  const filterNodes = (nodes: FileTreeNode[], query: string): FileTreeNode[] => {
    if (!query) return nodes
    const lower = query.toLowerCase()
    return nodes
      .map(node => {
        if (node.isDirectory && node.children) {
          const matchingChildren = filterNodes(node.children, query)
          if (matchingChildren.length > 0 || node.name.toLowerCase().includes(lower)) {
            return { ...node, children: matchingChildren }
          }
          return null
        }
        if (node.name.toLowerCase().includes(lower) || node.relativePath.toLowerCase().includes(lower)) {
          return node
        }
        return null
      })
      .filter(Boolean) as FileTreeNode[]
  }

  const displayedTree = useMemo(() => {
    return filterNodes(tree, searchFilter)
  }, [tree, searchFilter])

  const handleFileClick = async (node: FileTreeNode) => {
    if (node.isDirectory) {
      toggleFolder(node.path)
      return
    }
    if (onOpenFileInCanvas && window.api?.projects?.readFile) {
      try {
        const content = await window.api.projects.readFile(node.path)
        onOpenFileInCanvas(node.path, node.name)
      } catch (err) {
        console.error('Could not open file in canvas:', err)
      }
    }
  }

  const renderNode = (node: FileTreeNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path) || Boolean(searchFilter)
    const gitInfo = gitStatusMap.get(node.relativePath)

    return (
      <div key={node.path} className="select-none text-xs">
        <div
          onClick={() => handleFileClick(node)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={cn(
            'group flex items-center justify-between py-1 pr-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors text-foreground/90 hover:text-foreground',
            node.isDirectory ? 'font-medium' : 'font-normal'
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {node.isDirectory ? (
              <span className="p-0.5 text-muted-foreground/80 hover:text-foreground transition-colors shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}

            {getFileIcon(node.extension, node.isDirectory, isExpanded)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {gitInfo && (
              <span
                className={cn(
                  'px-1 py-0.2 rounded text-[10px] font-mono font-semibold',
                  gitInfo.status === 'modified' && 'bg-amber-500/15 text-amber-500',
                  gitInfo.status === 'added' && 'bg-emerald-500/15 text-emerald-500',
                  gitInfo.status === 'deleted' && 'bg-red-500/15 text-red-500',
                  gitInfo.status === 'untracked' && 'bg-blue-500/15 text-blue-500'
                )}
                title={`Git: ${gitInfo.status}`}
              >
                {gitInfo.status === 'modified' ? 'M' : gitInfo.status === 'added' ? 'A' : gitInfo.status === 'deleted' ? 'D' : '?'}
              </span>
            )}

            {!node.isDirectory && (
              <div className="hidden group-hover:flex items-center gap-1">
                {onInsertMention && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onInsertMention(`@file:${node.relativePath}`)
                    }}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    title="Insert @file reference into prompt"
                  >
                    <AtSign className="w-3 h-3" />
                  </button>
                )}
                {onOpenFileInCanvas && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFileClick(node)
                    }}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Open in Canvas"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-card/60 border-r border-border/50 text-foreground', className)}>
      {/* Header with Git branch & refresh */}
      <div className="p-2.5 border-b border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate min-w-0">
            <span className="text-xs font-semibold tracking-tight text-foreground truncate">
              Files
            </span>
            {gitStatus?.branch && gitStatus.branch !== 'unknown' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/80 text-[10px] font-mono text-muted-foreground truncate">
                <GitBranch className="w-2.5 h-2.5 text-primary shrink-0" />
                <span className="truncate">{gitStatus.branch}</span>
              </span>
            )}
          </div>

          <button
            onClick={loadTreeAndGit}
            disabled={isLoading}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh Files & Git Status"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin text-primary')} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-6 pr-2 py-1 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/40 focus:border-primary/50 rounded-md text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-hidden transition-all"
          />
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {displayedTree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {isLoading ? 'Scanning repository...' : searchFilter ? 'No files match search.' : 'Empty directory.'}
          </div>
        ) : (
          displayedTree.map(node => renderNode(node, 0))
        )}
      </div>

      {/* Footer summary */}
      {gitStatus && (
        <div className="p-2 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            {gitStatus.clean ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Working tree clean</span>
              </>
            ) : (
              <span>{gitStatus.files.length} changed file{gitStatus.files.length !== 1 ? 's' : ''}</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
