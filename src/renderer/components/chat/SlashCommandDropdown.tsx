import React from 'react'
import { FileCode, HelpCircle, ListTodo, Globe } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SlashCommandItem {
  command: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    command: '/canvas',
    label: '/canvas',
    description: 'Create an editable in-chat Typeset markdown canvas document',
    icon: FileCode
  },
  {
    command: '/search',
    label: '/search',
    description: 'Search the live web with DuckDuckGo for documentation, facts, or news',
    icon: Globe
  },
  {
    command: '/grill-me',
    label: '/grill-me',
    description: 'Ask deep clarifying questions via interactive questionnaire',
    icon: HelpCircle
  },
  {
    command: '/plan',
    label: '/plan',
    description: 'Draft a structured architectural implementation plan',
    icon: ListTodo
  }
]

interface SlashCommandDropdownProps {
  selectedIndex: number
  onSelect: (cmd: SlashCommandItem) => void
  filterText: string
}

export const SlashCommandDropdown: React.FC<SlashCommandDropdownProps> = ({
  selectedIndex,
  onSelect,
  filterText
}) => {
  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.command.toLowerCase().includes(filterText.toLowerCase()) ||
    cmd.description.toLowerCase().includes(filterText.toLowerCase())
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-popover p-1 shadow-xl z-50 text-foreground">
      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Commands
      </div>
      <div className="space-y-0.5">
        {filtered.map((item, idx) => {
          const Icon = item.icon
          const isSelected = idx === selectedIndex

          return (
            <div
              key={item.command}
              onClick={() => onSelect(item)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60 text-foreground/80'
              )}
            >
              <div className="p-1 rounded bg-muted/80 text-primary shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="truncate flex-1 min-w-0">
                <div className="font-medium text-xs text-foreground">{item.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{item.description}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
