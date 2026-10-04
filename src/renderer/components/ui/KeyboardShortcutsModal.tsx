import React from 'react'
import { Keyboard, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keys: string[]
  description: string
  category: 'Navigation' | 'Editor' | 'Agent'
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'B'], description: 'Toggle Sidebar', category: 'Navigation' },
  { keys: ['Ctrl', ','], description: 'Open Settings', category: 'Navigation' },
  { keys: ['Ctrl', 'K'], description: 'Open Command Palette', category: 'Navigation' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Toggle Workspace File Tree', category: 'Navigation' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Review Session Diffs', category: 'Navigation' },
  { keys: ['/'], description: 'Open Slash Commands Menu', category: 'Editor' },
  { keys: ['@'], description: 'Mention Files & Project Context', category: 'Editor' },
  { keys: ['Enter'], description: 'Send Message / Execute Agent', category: 'Editor' },
  { keys: ['Shift', 'Enter'], description: 'Insert Line Break', category: 'Editor' },
  { keys: ['Esc'], description: 'Close Active Modal / Dropdown', category: 'Navigation' },
  { keys: ['/plan'], description: 'Switch to Architect / Plan Mode', category: 'Agent' },
  { keys: ['/diff'], description: 'Inspect Working Tree Git Diffs', category: 'Agent' },
  { keys: ['/todos'], description: 'Inspect Session Task Checklist', category: 'Agent' },
  { keys: ['/compact'], description: 'Compress Conversation Context', category: 'Agent' }
]

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-card border border-border/80 shadow-2xl rounded-2xl text-foreground">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Keyboard className="w-4 h-4" />
            </div>
            <DialogTitle className="text-sm font-semibold text-foreground">
              Keyboard Shortcuts
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {['Navigation', 'Editor', 'Agent'].map((cat) => {
            const items = SHORTCUTS.filter(s => s.category === cat)
            return (
              <div key={cat} className="space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat}
                </div>
                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 px-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                    >
                      <span className="text-foreground/90">{item.description}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="px-1.5 py-0.5 rounded bg-muted/80 border border-border/60 text-[10px] font-mono text-muted-foreground font-semibold shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
