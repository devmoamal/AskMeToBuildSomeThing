import React from 'react'
import {
  FileCode,
  FileText,
  FileJson,
  File,
  GitBranch,
  GitCompare,
  FileSpreadsheet
} from 'lucide-react'
import type { FileTreeNode } from '../../../shared/types'
import { cn } from '../../lib/utils'

export interface MentionItem {
  id: string
  label: string
  description: string
  insertText: string
  type: 'file' | 'git' | 'diff' | 'canvas'
}

interface MentionDropdownProps {
  selectedIndex: number
  onSelect: (item: MentionItem) => void
  filterText: string
  files: FileTreeNode[]
}

function flattenFiles(nodes: FileTreeNode[], max = 50): FileTreeNode[] {
  const result: FileTreeNode[] = []
  function recurse(list: FileTreeNode[]) {
    for (const node of list) {
      if (result.length >= max) return
      if (!node.isDirectory) {
        result.push(node)
      } else if (node.children) {
        recurse(node.children)
      }
    }
  }
  recurse(nodes)
  return result
}

export function getMentionItems(filterText: string, files: FileTreeNode[]): MentionItem[] {
  const cleanFilter = filterText.replace(/^@/, '').toLowerCase()

  // Base context items
  const baseItems: MentionItem[] = [
    {
      id: 'git',
      label: '@git',
      description: 'Current branch and git status',
      insertText: '@git',
      type: 'git'
    },
    {
      id: 'diff',
      label: '@diff',
      description: 'Active uncommitted git diffs',
      insertText: '@diff',
      type: 'diff'
    },
    {
      id: 'canvas',
      label: '@canvas',
      description: 'Reference active typeset canvas',
      insertText: '@canvas',
      type: 'canvas'
    }
  ]

  // Flatten and map file items
  const flatFiles = flattenFiles(files, 80)
  const fileItems: MentionItem[] = flatFiles.map(f => ({
    id: f.path,
    label: `@file:${f.relativePath}`,
    description: f.relativePath,
    insertText: `@file:${f.relativePath}`,
    type: 'file'
  }))

  const allItems = [...baseItems, ...fileItems]
  return allItems.filter(item =>
    item.label.toLowerCase().includes(cleanFilter) ||
    item.description.toLowerCase().includes(cleanFilter)
  ).slice(0, 8)
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  selectedIndex,
  onSelect,
  filterText,
  files
}) => {
  const filtered = getMentionItems(filterText, files)

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1 shadow-2xl z-50 text-foreground animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
        <span>Context Mentions</span>
        <span className="font-mono text-[9px] opacity-70">↑↓ to navigate</span>
      </div>

      <div className="space-y-0.5 max-h-56 overflow-y-auto">
        {filtered.map((item, idx) => {
          const isSelected = idx === selectedIndex

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none',
                isSelected ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted/60 text-foreground/80'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-md shrink-0',
                  isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-primary'
                )}
              >
                {item.type === 'git' && <GitBranch className="w-3.5 h-3.5" />}
                {item.type === 'diff' && <GitCompare className="w-3.5 h-3.5" />}
                {item.type === 'canvas' && <FileText className="w-3.5 h-3.5" />}
                {item.type === 'file' && <FileCode className="w-3.5 h-3.5" />}
              </div>

              <div className="truncate flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{item.label}</div>
                <div
                  className={cn(
                    'text-[10px] truncate',
                    isSelected ? 'opacity-80' : 'text-muted-foreground'
                  )}
                >
                  {item.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
