import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Cpu } from 'lucide-react'
import type { ProviderConfig } from '../../../shared/types'
import { cn } from '../../lib/utils'

interface ModelSelectorProps {
  providers: ProviderConfig[]
  selectedProviderId?: string
  selectedModel?: string
  onSelectModel: (providerId: string, model: string) => void
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  providers,
  selectedProviderId,
  selectedModel,
  onSelectModel
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  // Determine current active model name
  const activeProvider = providers.find(p => p.id === selectedProviderId) || providers.find(p => p.isDefault) || providers[0]
  const currentModelName = selectedModel || activeProvider?.defaultModel || activeProvider?.models[0] || 'Select Model'

  // Initialize expanded state for the active provider
  useEffect(() => {
    if (activeProvider) {
      setExpandedProviders(prev => ({
        ...prev,
        [activeProvider.id]: true
      }))
    }
  }, [activeProvider?.id])

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const toggleProvider = (providerId: string) => {
    setExpandedProviders(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }))
  }

  if (providers.length === 0) {
    return null
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer',
          'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-700/40 shadow-xs'
        )}
        title="Change active model"
      >
        <Cpu className="w-3 h-3 text-zinc-400 shrink-0" />
        <span className="truncate max-w-[140px] font-mono text-[11px]">{currentModelName}</span>
        <ChevronDown className={cn('w-3 h-3 text-zinc-500 transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {/* Accordion Dropdown Popup */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-80 overflow-y-auto bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50">
          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Models
          </div>

          <div className="space-y-1 mt-0.5">
            {providers.map(prov => {
              const isExpanded = expandedProviders[prov.id] !== false
              const models = prov.models && prov.models.length > 0 ? prov.models : (prov.defaultModel ? [prov.defaultModel] : ['default'])

              return (
                <div key={prov.id} className="rounded-md overflow-hidden">
                  {/* Provider Header / Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleProvider(prov.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded transition-colors text-left cursor-pointer"
                  >
                    <span className="truncate">{prov.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <span>{models.length}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </span>
                  </button>

                  {/* Models Accordion List */}
                  {isExpanded && (
                    <div className="pl-2 pr-1 py-0.5 space-y-0.5">
                      {models.map(modelName => {
                        const isSelected = (selectedProviderId === prov.id || (!selectedProviderId && prov.isDefault)) &&
                          (selectedModel === modelName || (!selectedModel && (prov.defaultModel === modelName || prov.models[0] === modelName)))

                        return (
                          <button
                            key={modelName}
                            type="button"
                            onClick={() => {
                              onSelectModel(prov.id, modelName)
                              setIsOpen(false)
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors cursor-pointer text-left',
                              isSelected
                                ? 'bg-zinc-800 text-zinc-100 font-medium'
                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                            )}
                          >
                            <span className="truncate flex-1">{modelName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0 ml-1.5" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
