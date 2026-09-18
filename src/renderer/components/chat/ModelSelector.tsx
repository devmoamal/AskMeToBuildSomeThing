import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Check, Search, X } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')
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
        setSearchQuery('')
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

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    const results: { prov: ProviderConfig; modelName: string; isSelected: boolean }[] = []

    for (const prov of providers) {
      const models = prov.models && prov.models.length > 0 ? prov.models : (prov.defaultModel ? [prov.defaultModel] : ['default'])
      for (const m of models) {
        if (m.toLowerCase().includes(q) || prov.name.toLowerCase().includes(q)) {
          const isSelected = (selectedProviderId === prov.id || (!selectedProviderId && prov.isDefault)) &&
            (selectedModel === m || (!selectedModel && (prov.defaultModel === m || prov.models[0] === m)))
          results.push({ prov, modelName: m, isSelected })
        }
      }
    }
    return results
  }, [providers, searchQuery, selectedProviderId, selectedModel])

  if (providers.length === 0) {
    return null
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Clean Text-Only Trigger Button (NO BOX / NO BORDER / NO BACKGROUND) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100 transition-colors text-xs cursor-pointer bg-transparent border-none p-0 outline-none select-none group"
        title="Change active model"
      >
        <span className="truncate max-w-[140px] font-sans text-[11px] text-zinc-400 group-hover:text-zinc-200">
          {currentModelName}
        </span>
        <ChevronDown className={cn('w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {/* Accordion Dropdown Popup with Simple Search */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 max-h-80 flex flex-col bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Simple Search Input */}
          <div className="relative mb-1.5 px-0.5">
            <Search className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full h-7 pl-7 pr-6 rounded-md bg-[#141414] border border-[#262626] text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-[#444] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
            {searchQuery.trim() ? (
              filteredModels.length > 0 ? (
                filteredModels.map(({ prov, modelName, isSelected }) => (
                  <button
                    key={`${prov.id}-${modelName}`}
                    type="button"
                    onClick={() => {
                      onSelectModel(prov.id, modelName)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-left',
                      isSelected
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'text-zinc-400 hover:bg-[#161616] hover:text-zinc-200'
                    )}
                  >
                    <div className="truncate flex-1">
                      <span className="truncate">{modelName}</span>
                      <span className="text-[10px] text-zinc-600 ml-1.5 font-mono">({prov.name})</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0 ml-1.5" />}
                  </button>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-zinc-600">
                  No models matching &quot;{searchQuery}&quot;
                </div>
              )
            ) : (
              providers.map(prov => {
                const isExpanded = expandedProviders[prov.id] !== false
                const models = prov.models && prov.models.length > 0 ? prov.models : (prov.defaultModel ? [prov.defaultModel] : ['default'])

                return (
                  <div key={prov.id} className="rounded-md overflow-hidden">
                    {/* Provider Header / Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleProvider(prov.id)}
                      className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#161616] rounded transition-colors text-left cursor-pointer"
                    >
                      <span className="truncate">{prov.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-600">
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
                                  : 'text-zinc-400 hover:bg-[#161616] hover:text-zinc-200'
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
