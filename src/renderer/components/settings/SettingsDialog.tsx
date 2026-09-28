import React, { useState, useEffect } from 'react'
import {
  Settings,
  Server,
  Shield,
  Terminal,
  MessageSquareCode,
  Palette,
  Database,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Cpu,
  Clock,
  Ban,
  TerminalSquare
} from 'lucide-react'
import type { ProviderConfig, AppSettings, UpdateCheckResult, UpdateProgress, ScheduledTask, ProjectMemory } from '../../../shared/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  providers: ProviderConfig[]
  settings: AppSettings | null
  onSaveProvider: (provider: ProviderConfig) => Promise<void>
  onDeleteProvider: (id: string) => Promise<void>
  onSaveSettings: (settings: Partial<AppSettings>) => Promise<void>
  onRefresh: () => void
  initialTab?: 'providers' | 'memory' | 'scheduler' | 'safety' | 'shell' | 'prompts' | 'appearance' | 'data' | 'updates'
}

type TabType = 'providers' | 'memory' | 'scheduler' | 'safety' | 'shell' | 'prompts' | 'appearance' | 'data' | 'updates'

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  providers,
  settings,
  onSaveProvider,
  onDeleteProvider,
  onSaveSettings,
  onRefresh,
  initialTab
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'providers')

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab)
    }
  }, [initialTab, isOpen])

  // Provider Form State
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Updater State
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [downloadingUpdate, setDownloadingUpdate] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null)
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [installMessage, setInstallMessage] = useState<string | null>(null)

  // Local settings state
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings)

  // Scheduled tasks state
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Project memories state
  const [memories, setMemories] = useState<ProjectMemory[]>([])
  const [newMemoryKey, setNewMemoryKey] = useState('')
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState<'architecture' | 'decision' | 'gotcha' | 'preference'>('architecture')

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!window.api?.updater) return
    const unbind = window.api.updater.onProgress((p) => {
      setDownloadProgress(p)
    })
    return unbind
  }, [])

  const loadScheduledTasks = async () => {
    if (!window.api?.scheduler) return
    setLoadingTasks(true)
    try {
      const tasks = await window.api.scheduler.getAll()
      setScheduledTasks(tasks)
    } catch (e) {
      console.error('Failed to load scheduled tasks:', e)
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadMemories = async () => {
    if (!window.api?.memory) return
    try {
      const mems = await window.api.memory.getProjectMemories('global')
      setMemories(mems)
    } catch (e) {
      console.error('Failed to load memories:', e)
    }
  }

  useEffect(() => {
    if (activeTab === 'scheduler' && isOpen) {
      loadScheduledTasks()
    }
    if (activeTab === 'memory' && isOpen) {
      loadMemories()
    }
  }, [activeTab, isOpen])

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true)
    setInstallMessage(null)
    try {
      const res = await window.api.updater.checkForUpdates()
      setUpdateResult(res)
    } catch (e: any) {
      setUpdateResult({ available: false, currentVersion: 'unknown', error: e.message })
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleDownloadAndInstall = async () => {
    if (!updateResult?.updateInfo) return
    setDownloadingUpdate(true)
    setDownloadProgress(null)
    setInstallMessage('Downloading update package...')
    try {
      const res = await window.api.updater.downloadUpdate(
        updateResult.updateInfo.downloadUrl,
        updateResult.updateInfo.assetName
      )
      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath)
        setDownloadingUpdate(false)
        setInstallingUpdate(true)
        setInstallMessage('Download complete! Installing update and restarting...')
        const instRes = await window.api.updater.installUpdate(res.filePath)
        if (!instRes.success) {
          setInstallMessage(`Installation error: ${instRes.error || 'Failed to install update'}`)
          setInstallingUpdate(false)
        }
      } else {
        setInstallMessage(`Download failed: ${res.error || 'Unknown error'}`)
        setDownloadingUpdate(false)
      }
    } catch (e: any) {
      setInstallMessage(`Update error: ${e.message}`)
      setDownloadingUpdate(false)
      setInstallingUpdate(false)
    }
  }

  const handleInstallUpdate = async () => {
    if (!downloadedFilePath) return
    setInstallingUpdate(true)
    setInstallMessage('Installing update and restarting application...')
    try {
      const res = await window.api.updater.installUpdate(downloadedFilePath)
      if (res.success) {
        setInstallMessage(res.message || 'Update applied! Restarting...')
      } else {
        setInstallMessage(`Installation error: ${res.error || 'Unknown error'}`)
        setInstallingUpdate(false)
      }
    } catch (e: any) {
      setInstallMessage(`Installation error: ${e.message}`)
      setInstallingUpdate(false)
    }
  }

  if (!isOpen || !localSettings) return null

  const handleTestAndFetch = async () => {
    if (!editingProvider?.baseUrl) {
      setTestResult({ success: false, message: 'Please enter a Base URL' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const config: ProviderConfig = {
        id: editingProvider.id || `prov_${Date.now()}`,
        name: editingProvider.name || 'Custom Provider',
        type: editingProvider.type || 'openai',
        baseUrl: editingProvider.baseUrl,
        apiKey: editingProvider.apiKey || '',
        models: editingProvider.models || [],
        defaultModel: editingProvider.defaultModel,
        isDefault: editingProvider.isDefault || false,
        createdAt: editingProvider.createdAt || Date.now()
      }

      const res = await window.api.providers.testConnection(config)
      if (res.success) {
        const fetchedModels = await window.api.providers.fetchModels(config)
        setEditingProvider((prev: Partial<ProviderConfig> | null) => ({
          ...prev,
          models: fetchedModels,
          defaultModel: prev?.defaultModel || fetchedModels[0]
        }))
        setTestResult({
          success: true,
          message: `Connected! Retrieved ${fetchedModels.length} models.`
        })
      } else {
        setTestResult(res)
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveProvider = async () => {
    if (!editingProvider?.name || !editingProvider.baseUrl) return

    const config: ProviderConfig = {
      id: editingProvider.id || `prov_${Date.now()}`,
      name: editingProvider.name,
      type: editingProvider.type || 'openai',
      baseUrl: editingProvider.baseUrl,
      apiKey: editingProvider.apiKey || '',
      models: editingProvider.models || [],
      defaultModel: editingProvider.defaultModel || editingProvider.models?.[0] || 'default',
      isDefault: Boolean(editingProvider.isDefault),
      createdAt: editingProvider.createdAt || Date.now()
    }

    await onSaveProvider(config)
    setEditingProvider(null)
    setTestResult(null)
    onRefresh()
  }

  const handleSaveSettingsField = async (fields: Partial<AppSettings>) => {
    const updated = { ...localSettings, ...fields }
    setLocalSettings(updated)
    await onSaveSettings(fields)
  }

  const handleCancelTask = async (id: string) => {
    if (!window.api?.scheduler) return
    await window.api.scheduler.cancel(id)
    await loadScheduledTasks()
  }

  const handleDeleteTask = async (id: string) => {
    if (!window.api?.scheduler) return
    await window.api.scheduler.delete(id)
    await loadScheduledTasks()
  }

  const handleAddMemory = async () => {
    if (!newMemoryKey.trim() || !newMemoryContent.trim() || !window.api?.memory) return
    const mem: ProjectMemory = {
      id: `mem_${Date.now()}`,
      projectId: 'global',
      key: newMemoryKey.trim(),
      content: newMemoryContent.trim(),
      category: newMemoryCategory,
      updatedAt: Date.now()
    }
    await window.api.memory.saveProjectMemory(mem)
    setNewMemoryKey('')
    setNewMemoryContent('')
    await loadMemories()
  }

  const handleDeleteMemory = async (id: string) => {
    if (!window.api?.memory) return
    await window.api.memory.deleteProjectMemory(id)
    await loadMemories()
  }

  const navItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: React.ReactNode }> = [
    { id: 'providers', label: 'AI Providers & Models', icon: Server },
    { id: 'memory', label: 'Memory & Infinite AI', icon: Cpu },
    { id: 'scheduler', label: 'Task Scheduler', icon: Clock, badge: scheduledTasks.filter(t => t.status === 'pending').length > 0 ? (
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
    ) : undefined },
    { id: 'shell', label: 'Terminal & Execution', icon: Terminal },
    { id: 'safety', label: 'Tool Safety & Approvals', icon: Shield },
    { id: 'prompts', label: 'System Prompts', icon: MessageSquareCode },
    { id: 'appearance', label: 'Appearance & Themes', icon: Palette },
    { id: 'data', label: 'Data & Storage', icon: Database },
    { id: 'updates', label: 'App Updates', icon: RefreshCw, badge: updateResult?.available ? (
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
    ) : undefined }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[840px] max-w-[94vw] h-[640px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#0c0c0e] border border-white/[0.08] shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-white/[0.06] bg-[#09090b] shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/[0.06] text-zinc-200 border border-white/[0.08]">
              <Settings className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-zinc-100 tracking-tight">Settings & Workspace Configuration</DialogTitle>
              <p className="text-[11px] text-zinc-400">Configure AI providers, infinite memory, scheduled tasks, and execution rules.</p>
            </div>
          </div>
        </DialogHeader>

        {/* Content with Left Nav & Right Pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Settings Tabs Sidebar */}
          <nav className="w-54 border-r border-white/[0.06] bg-[#09090b]/80 p-2.5 space-y-1 shrink-0 select-none overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    if (item.id === 'updates' && !updateResult && !checkingUpdate) {
                      handleCheckUpdates()
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-left',
                    isActive
                      ? 'bg-white/[0.08] text-white border border-white/[0.08] shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-blue-400' : 'text-zinc-500')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge}
                </button>
              )
            })}
          </nav>

          {/* Tab Pane */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#0c0c0e] text-zinc-100 space-y-5">
            {/* 1. Providers Tab */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100">AI Model Providers</h3>
                    <p className="text-xs text-zinc-400">
                      Configure OpenAI-compatible (Ollama, Groq, OpenRouter) or Anthropic Claude API endpoints.
                    </p>
                  </div>
                  {!editingProvider && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingProvider({
                          type: 'openai',
                          baseUrl: 'https://api.openai.com/v1',
                          models: [],
                          isDefault: providers.length === 0
                        })
                        setTestResult(null)
                      }}
                      className="text-xs gap-1.5 h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Provider</span>
                    </Button>
                  )}
                </div>

                {/* Edit / Add Provider Form */}
                {editingProvider ? (
                  <div className="p-4.5 rounded-xl border border-white/[0.08] bg-[#141418] space-y-3.5">
                    <div className="font-semibold text-xs text-blue-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" />
                      <span>{editingProvider.id ? 'Edit Provider' : 'Add New Provider'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-300 block mb-1.5">Provider Name</label>
                        <Input
                          placeholder="e.g. OpenAI / Anthropic / Ollama"
                          value={editingProvider.name || ''}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, name: e.target.value }))}
                          className="h-8.5 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-zinc-300 block mb-1.5">Type</label>
                        <select
                          value={editingProvider.type || 'openai'}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, type: e.target.value as any }))}
                          className="w-full h-8.5 rounded-lg border border-white/[0.1] bg-[#18181e] px-2.5 text-xs text-zinc-100 outline-none hover:border-white/[0.2] transition-colors"
                        >
                          <option value="openai">OpenAI Compatible (OpenAI, Ollama, OpenRouter, Groq)</option>
                          <option value="anthropic">Anthropic Compatible (Claude API)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1.5">Base URL</label>
                      <Input
                        placeholder="https://api.openai.com/v1"
                        value={editingProvider.baseUrl || ''}
                        onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, baseUrl: e.target.value }))}
                        className="h-8.5 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1.5">API Key</label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={editingProvider.apiKey || ''}
                        onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, apiKey: e.target.value }))}
                        className="h-8.5 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100 font-mono"
                      />
                    </div>

                    {/* Test & Fetch button */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isTesting}
                        onClick={handleTestAndFetch}
                        className="h-8 text-xs gap-1.5 border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
                      >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                        <span>Test & Fetch Models</span>
                      </Button>

                      {testResult && (
                        <div className={cn('text-xs flex items-center gap-1.5', testResult.success ? 'text-emerald-400' : 'text-rose-400')}>
                          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Default model picker */}
                    {editingProvider.models && editingProvider.models.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-zinc-300 block mb-1.5">Default Model</label>
                        <select
                          value={editingProvider.defaultModel || editingProvider.models[0]}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, defaultModel: e.target.value }))}
                          className="w-full h-8.5 rounded-lg border border-white/[0.1] bg-[#18181e] px-2.5 text-xs text-zinc-100 outline-none hover:border-white/[0.2] transition-colors"
                        >
                          {editingProvider.models.map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is-default-provider"
                          checked={Boolean(editingProvider.isDefault)}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, isDefault: e.target.checked }))}
                          className="rounded border-white/[0.2] text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="is-default-provider" className="text-xs font-medium text-zinc-300 cursor-pointer">
                          Set as Default Provider
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingProvider(null)
                            setTestResult(null)
                          }}
                          className="h-8 text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveProvider}
                          className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
                        >
                          Save Provider
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {providers.map((prov) => (
                      <div
                        key={prov.id}
                        className="p-3.5 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center justify-between hover:border-white/[0.12] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-300">
                            <Server className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-zinc-100">{prov.name}</span>
                              {prov.isDefault && (
                                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] py-0 px-1.5">
                                  Default
                                </Badge>
                              )}
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{prov.type}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono truncate max-w-sm mt-0.5">
                              {prov.baseUrl}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingProvider(prov)
                              setTestResult(null)
                            }}
                            className="h-7.5 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteProvider(prov.id)}
                            className="h-7.5 px-2 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Memory & Infinite AI Tab */}
            {activeTab === 'memory' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    Infinite Autonomous AI & Context Memory
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Control continuous loop autonomy, token pruning, and long-term project memory.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-white/[0.06] bg-[#141418] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-zinc-100 flex items-center gap-2">
                        <span>Infinite Autonomous Mode (Never Stop)</span>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] py-0 px-1.5">
                          Recommended
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        Removes artificial iteration caps. The AI works uninterrupted through all research, editing, and test verification until the task is completely finished. No "continue" prompts needed.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.infiniteLoop ?? true}
                      onCheckedChange={(val) => handleSaveSettingsField({ infiniteLoop: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">Historical Tool Output Pruning</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        Automatically collapses large historical file reads and terminal logs from earlier turns into single-line summaries. Saves up to 85% of tokens and keeps chats running indefinitely without context overflow.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.pruneHistoricalToolOutputs ?? true}
                      onCheckedChange={(val) => handleSaveSettingsField({ pruneHistoricalToolOutputs: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">Auto Context Compaction</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        Automatically synthesizes older conversational milestones into a compact executive memory block when the context window fills up.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoCompactContext ?? true}
                      onCheckedChange={(val) => handleSaveSettingsField({ autoCompactContext: val })}
                    />
                  </div>
                </div>

                {/* Persistent Project Rules & Memory */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-zinc-200">Persistent Project Memories & Rules</h4>
                      <p className="text-[11px] text-zinc-400">Rules and conventions injected automatically into every agent turn.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141418] space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Key (e.g. TestFramework)"
                        value={newMemoryKey}
                        onChange={(e) => setNewMemoryKey(e.target.value)}
                        className="h-8 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100"
                      />
                      <select
                        value={newMemoryCategory}
                        onChange={(e) => setNewMemoryCategory(e.target.value as any)}
                        className="h-8 rounded-lg border border-white/[0.1] bg-[#18181e] px-2 text-xs text-zinc-100 outline-none"
                      >
                        <option value="architecture">Architecture</option>
                        <option value="decision">Decision</option>
                        <option value="gotcha">Gotcha</option>
                        <option value="preference">Preference</option>
                      </select>
                      <Button
                        size="sm"
                        onClick={handleAddMemory}
                        disabled={!newMemoryKey.trim() || !newMemoryContent.trim()}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                      >
                        Add Rule
                      </Button>
                    </div>
                    <Input
                      placeholder="Content (e.g. Always use Bun test runner with bun test)"
                      value={newMemoryContent}
                      onChange={(e) => setNewMemoryContent(e.target.value)}
                      className="h-8 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100"
                    />

                    {memories.length > 0 ? (
                      <div className="space-y-1.5 pt-2">
                        {memories.map((m) => (
                          <div key={m.id} className="p-2 rounded-lg bg-[#18181e] border border-white/[0.06] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <Badge className="bg-white/[0.06] text-zinc-300 border-white/[0.08] text-[9px] uppercase">
                                {m.category}
                              </Badge>
                              <span className="font-semibold text-zinc-200">{m.key}:</span>
                              <span className="text-zinc-400 truncate">{m.content}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteMemory(m.id)}
                              className="h-6 w-6 p-0 text-zinc-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 italic text-center py-2">
                        No custom project memory rules registered yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Task Scheduler Tab */}
            {activeTab === 'scheduler' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Background Task Scheduler
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Deferred commands and timers triggered by the agent or user (e.g. "ping google.com after 10 min").
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadScheduledTasks}
                    disabled={loadingTasks}
                    className="h-8 text-xs gap-1.5 border-white/[0.1] bg-white/[0.04] text-zinc-200"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', loadingTasks && 'animate-spin')} />
                    <span>Refresh</span>
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {scheduledTasks.length === 0 ? (
                    <div className="p-8 rounded-xl border border-white/[0.06] bg-[#141418] text-center space-y-2">
                      <Clock className="w-6 h-6 text-zinc-600 mx-auto" />
                      <div className="text-xs font-medium text-zinc-400">No scheduled tasks active</div>
                      <div className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                        Ask the AI in chat to schedule anything: e.g. "Run ping google.com and tell me the result in 10 minutes".
                      </div>
                    </div>
                  ) : (
                    scheduledTasks.map((t) => {
                      const isPending = t.status === 'pending'
                      const isRunning = t.status === 'running'
                      const isDone = t.status === 'completed'
                      const isFailed = t.status === 'failed'

                      const statusColor = isRunning
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : isPending
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : isDone
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'

                      return (
                        <div
                          key={t.id}
                          className="p-4 rounded-xl border border-white/[0.06] bg-[#141418] space-y-2 hover:border-white/[0.12] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={cn('text-[10px] uppercase font-mono px-1.5 py-0', statusColor)}>
                                {t.status}
                              </Badge>
                              <span className="font-semibold text-xs text-zinc-200">{t.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelTask(t.id)}
                                  className="h-7 px-2 text-[11px] text-amber-400 hover:bg-amber-500/10"
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTask(t.id)}
                                className="h-7 px-2 text-[11px] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {t.command && (
                            <div className="p-2 rounded-lg bg-[#09090b] font-mono text-[11px] text-zinc-300 border border-white/[0.04]">
                              $ {t.command}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Scheduled for: {new Date(t.scheduledAt).toLocaleTimeString()} ({t.delaySeconds}s delay)</span>
                            {t.completedAt && (
                              <span>Finished at: {new Date(t.completedAt).toLocaleTimeString()}</span>
                            )}
                          </div>

                          {t.result && (
                            <div className="max-h-24 overflow-y-auto p-2 rounded-lg bg-[#09090b] font-mono text-[10px] text-zinc-400 border border-white/[0.04] whitespace-pre-wrap">
                              {t.result}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* 4. Terminal & Shell Tab */}
            {activeTab === 'shell' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    Terminal & Process Execution
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Configure execution environment, default shell, and process completion waiting.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-white/[0.06] bg-[#141418] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">Wait Until Process Completes</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        When enabled, the AI runner awaits long-running commands (e.g. npm install, build scripts, tests) to finish completely rather than aborting after 60s.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.terminalWaitUntilComplete ?? true}
                      onCheckedChange={(val) => handleSaveSettingsField({ terminalWaitUntilComplete: val })}
                    />
                  </div>

                  <div className="border-t border-white/[0.06] pt-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1.5">Default Shell</label>
                      <select
                        value={localSettings.defaultShell}
                        onChange={(e) => handleSaveSettingsField({ defaultShell: e.target.value as any })}
                        className="w-full h-8.5 rounded-lg border border-white/[0.1] bg-[#18181e] px-2.5 text-xs text-zinc-100 outline-none hover:border-white/[0.2] transition-colors"
                      >
                        <option value="bash">Bash / Zsh (Recommended on macOS/Linux)</option>
                        <option value="powershell">PowerShell (Recommended on Windows)</option>
                        <option value="cmd">Command Prompt (CMD)</option>
                        <option value="wsl">Windows Subsystem for Linux (WSL)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-zinc-300 block mb-1.5">Fallback Command Timeout (ms)</label>
                      <Input
                        type="number"
                        value={localSettings.terminalTimeoutMs}
                        onChange={(e) => handleSaveSettingsField({ terminalTimeoutMs: parseInt(e.target.value) || 60000 })}
                        className="h-8.5 text-xs bg-[#18181e] border-white/[0.1] text-zinc-100 max-w-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Tool Safety & Approvals Tab */}
            {activeTab === 'safety' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Tool Safety & Approvals
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Manage permissions for file modifications and terminal command execution.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-white/[0.06] bg-[#141418] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">Auto-approve Terminal Commands</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        When enabled, safe dev commands (tests, builds, lints) execute immediately without asking for user confirmation.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoApproveTerminal}
                      onCheckedChange={(val) => handleSaveSettingsField({ autoApproveTerminal: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">Auto-approve File Modifications</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 max-w-lg">
                        When disabled, the agent pauses and asks for confirmation before creating or editing files.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoApproveFileWrite}
                      onCheckedChange={(val) => handleSaveSettingsField({ autoApproveFileWrite: val })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. Prompts Tab */}
            {activeTab === 'prompts' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <MessageSquareCode className="w-4 h-4 text-blue-400" />
                    Custom System Prompts
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Define the core instructions and agent behavior for general chats vs local project repositories.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">General Chat System Prompt</label>
                    <textarea
                      rows={4}
                      value={localSettings.chatSystemPrompt}
                      onChange={(e) => handleSaveSettingsField({ chatSystemPrompt: e.target.value })}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] p-3 text-xs text-zinc-100 resize-none font-mono focus:border-blue-500/50 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Autonomous Project System Prompt</label>
                    <textarea
                      rows={5}
                      value={localSettings.projectSystemPrompt}
                      onChange={(e) => handleSaveSettingsField({ projectSystemPrompt: e.target.value })}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] p-3 text-xs text-zinc-100 resize-none font-mono focus:border-blue-500/50 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-400" />
                    Appearance & Theme
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Choose interface style and inject custom runtime CSS.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-white/[0.06] bg-[#141418] space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {(['dark', 'light', 'system'] as const).map(th => (
                      <button
                        key={th}
                        onClick={() => handleSaveSettingsField({ theme: th })}
                        className={cn(
                          'p-3 rounded-xl border text-center capitalize text-xs font-medium transition-all cursor-pointer',
                          localSettings.theme === th
                            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 font-semibold shadow-xs'
                            : 'border-white/[0.06] hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>

                {localSettings.customCss !== undefined && (
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Runtime Custom CSS</label>
                    <textarea
                      rows={4}
                      placeholder=":root { --primary: #3b82f6; }"
                      value={localSettings.customCss || ''}
                      onChange={(e) => handleSaveSettingsField({ customCss: e.target.value })}
                      className="w-full rounded-xl border border-white/[0.1] bg-[#141418] p-3 text-xs text-zinc-100 resize-none font-mono focus:border-blue-500/50 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 8. Data & Storage Tab */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    Data & Local SQLite Storage
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Manage persistent SQLite database records and export JSON backups.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-zinc-100">Export All Data</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Save all chats, project sessions, canvases, and memories into a single JSON file.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const chats = await window.api.chats.getAll()
                      const projects = await window.api.projects.getAll()
                      const blob = new Blob([JSON.stringify({ chats, projects }, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `askmetobuildsomething_backup_${Date.now()}.json`
                      a.click()
                    }}
                    className="h-8 text-xs border-white/[0.1] bg-white/[0.04] text-zinc-200"
                  >
                    Export JSON
                  </Button>
                </div>
              </div>
            )}

            {/* 9. Updates Tab */}
            {activeTab === 'updates' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      App Updates
                      <Badge variant="outline" className="text-[10px] font-mono border-white/[0.1] text-zinc-400">
                        v{updateResult?.currentVersion || '1.0.4'}
                      </Badge>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Check and install automated updates directly from GitHub Releases.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdate || downloadingUpdate}
                    className="h-8 text-xs gap-1.5 border-white/[0.1] bg-white/[0.04] text-zinc-200"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', checkingUpdate && 'animate-spin')} />
                    {checkingUpdate ? 'Checking...' : 'Check for Updates'}
                  </Button>
                </div>

                <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-zinc-100">Auto-download Updates</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Automatically downloads new versions in background so you can restart with one click.
                    </div>
                  </div>
                  <Switch
                    checked={localSettings.autoDownloadUpdates || false}
                    onCheckedChange={(val) => handleSaveSettingsField({ autoDownloadUpdates: val })}
                  />
                </div>

                {checkingUpdate && (
                  <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141418] flex items-center gap-3 text-xs text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    Checking for latest releases on GitHub...
                  </div>
                )}

                {!checkingUpdate && updateResult && !updateResult.available && !updateResult.error && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      You are using the latest version
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-6">
                      v{updateResult.currentVersion} is the newest release.
                    </p>
                  </div>
                )}

                {!checkingUpdate && updateResult?.error && (
                  <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-medium text-rose-400">
                      <XCircle className="w-4 h-4" />
                      Check failed
                    </div>
                    <p className="text-[11px] text-zinc-400 pl-6">
                      {updateResult.error}
                    </p>
                  </div>
                )}

                {!checkingUpdate && updateResult?.available && updateResult.updateInfo && (
                  <div className="p-4.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-sm text-zinc-100">
                          Version {updateResult.updateInfo.version} Available
                        </span>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                        New Release
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                        Release Notes
                      </div>
                      <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-[#09090b] border border-white/[0.06] text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {updateResult.updateInfo.releaseNotes}
                      </div>
                    </div>

                    {downloadingUpdate && downloadProgress && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>Downloading update...</span>
                          <span className="font-mono">{downloadProgress.percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-200"
                            style={{ width: `${downloadProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {installMessage && (
                      <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {installMessage}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {!downloadedFilePath && (
                        <Button
                          size="sm"
                          onClick={handleDownloadAndInstall}
                          disabled={downloadingUpdate || installingUpdate}
                          className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {downloadingUpdate ? 'Downloading...' : installingUpdate ? 'Installing & Restarting...' : 'Update & Restart'}
                        </Button>
                      )}

                      {downloadedFilePath && !installingUpdate && (
                        <Button
                          size="sm"
                          onClick={handleInstallUpdate}
                          disabled={installingUpdate}
                          className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', installingUpdate && 'animate-spin')} />
                          Restart & Install Now
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.api.updater.openReleasePage(updateResult.updateInfo!.htmlUrl)}
                        className="h-8 text-xs gap-1.5 border-white/[0.1] bg-white/[0.04] text-zinc-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on GitHub
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
