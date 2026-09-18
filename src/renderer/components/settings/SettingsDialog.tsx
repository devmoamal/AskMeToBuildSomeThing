import React, { useState } from 'react'
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
  Save
} from 'lucide-react'
import type { ProviderConfig, AppSettings } from '../../../shared/types'
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
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  providers,
  settings,
  onSaveProvider,
  onDeleteProvider,
  onSaveSettings,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'safety' | 'shell' | 'prompts' | 'appearance' | 'data'>('providers')

  // Provider Form State
  const [editingProvider, setEditingProvider] = useState<Partial<ProviderConfig> | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Local settings state
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(settings)

  React.useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[620px] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base font-semibold">Settings & Configuration</DialogTitle>
          </div>
        </DialogHeader>

        {/* Content with Left Nav & Right Pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Settings Tabs Sidebar */}
          <nav className="w-48 border-r border-border bg-muted/20 p-2 space-y-1 shrink-0 select-none">
            <button
              onClick={() => setActiveTab('providers')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'providers' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Server className="w-4 h-4" />
              <span>Providers & Models</span>
            </button>

            <button
              onClick={() => setActiveTab('safety')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'safety' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Shield className="w-4 h-4" />
              <span>Tool Safety & Approvals</span>
            </button>

            <button
              onClick={() => setActiveTab('shell')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'shell' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Terminal className="w-4 h-4" />
              <span>Terminal & Shell</span>
            </button>

            <button
              onClick={() => setActiveTab('prompts')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'prompts' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <MessageSquareCode className="w-4 h-4" />
              <span>System Prompts</span>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'appearance' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Palette className="w-4 h-4" />
              <span>Appearance</span>
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left',
                activeTab === 'data' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Database className="w-4 h-4" />
              <span>Data & History</span>
            </button>
          </nav>

          {/* Tab Pane */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* 1. Providers Tab */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">AI Model Providers</h3>
                    <p className="text-xs text-muted-foreground">
                      Configure OpenAI-compatible or Anthropic-compatible endpoints.
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
                      className="text-xs gap-1 h-8"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Provider</span>
                    </Button>
                  )}
                </div>

                {/* Edit / Add Provider Form */}
                {editingProvider ? (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="font-semibold text-xs text-primary">
                      {editingProvider.id ? 'Edit Provider' : 'Add New Provider'}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">Provider Name</label>
                        <Input
                          placeholder="e.g. OpenAI / Anthropic / Ollama"
                          value={editingProvider.name || ''}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, name: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">Type</label>
                        <select
                          value={editingProvider.type || 'openai'}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, type: e.target.value as any }))}
                          className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
                        >
                          <option value="openai">OpenAI Compatible (OpenAI, Ollama, OpenRouter, Groq)</option>
                          <option value="anthropic">Anthropic Compatible (Claude API)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">Base URL</label>
                      <Input
                        placeholder="https://api.openai.com/v1"
                        value={editingProvider.baseUrl || ''}
                        onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, baseUrl: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">API Key</label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={editingProvider.apiKey || ''}
                        onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, apiKey: e.target.value }))}
                        className="h-8 text-xs"
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
                        className="h-8 text-xs gap-1.5"
                      >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                        <span>Test & Fetch Models</span>
                      </Button>

                      {testResult && (
                        <div className={cn('text-xs flex items-center gap-1', testResult.success ? 'text-green-400' : 'text-red-400')}>
                          {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Default model picker */}
                    {editingProvider.models && editingProvider.models.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">Default Model</label>
                        <select
                          value={editingProvider.defaultModel || editingProvider.models[0]}
                          onChange={(e) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, defaultModel: e.target.value }))}
                          className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
                        >
                          {editingProvider.models.map((m: string) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Set Default Switch */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-foreground">Make this the default active provider</span>
                      <Switch
                        checked={Boolean(editingProvider.isDefault)}
                        onCheckedChange={(val) => setEditingProvider((p: Partial<ProviderConfig> | null) => ({ ...p, isDefault: val }))}
                      />
                    </div>

                    {/* Form actions */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                      <Button variant="ghost" size="sm" onClick={() => setEditingProvider(null)} className="h-8 text-xs">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveProvider} className="h-8 text-xs gap-1">
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Provider</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {providers.map(prov => (
                      <div
                        key={prov.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/60"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs">{prov.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase py-0">
                              {prov.type}
                            </Badge>
                            {prov.isDefault && (
                              <Badge className="text-[10px] bg-primary text-primary-foreground py-0">
                                Default
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-md">
                            {prov.baseUrl} • {prov.models.length} model(s)
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingProvider(prov)}
                            className="h-7 text-xs px-2.5"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete provider "${prov.name}"?`)) {
                                onDeleteProvider(prov.id)
                              }
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {providers.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                        No providers configured. Click &quot;Add Provider&quot; above to connect an LLM.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. Safety Tab */}
            {activeTab === 'safety' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Tool Safety & Approvals</h3>
                  <p className="text-xs text-muted-foreground">
                    Control whether dangerous agent tools require explicit confirmation before running.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-foreground">Auto-approve Terminal Commands</div>
                      <div className="text-[11px] text-muted-foreground">
                        When disabled, the agent pauses and asks you to confirm every terminal execution.
                      </div>
                    </div>
                    <Switch
                      checked={localSettings.autoApproveTerminal}
                      onCheckedChange={(val) => handleSaveSettingsField({ autoApproveTerminal: val })}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-4">
                    <div>
                      <div className="font-medium text-xs text-foreground">Auto-approve File Modifications</div>
                      <div className="text-[11px] text-muted-foreground">
                        When disabled, the agent asks for confirmation before creating or overwriting project files.
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

            {/* 3. Shell & Terminal Tab */}
            {activeTab === 'shell' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Terminal & Shell Configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure your execution environment for terminal tasks in Project mode.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Default Shell</label>
                    <select
                      value={localSettings.defaultShell}
                      onChange={(e) => handleSaveSettingsField({ defaultShell: e.target.value as any })}
                      className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
                    >
                      <option value="powershell">PowerShell (Recommended on Windows)</option>
                      <option value="cmd">Command Prompt (CMD)</option>
                      <option value="bash">Git Bash</option>
                      <option value="wsl">Windows Subsystem for Linux (WSL)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Command Timeout (ms)</label>
                    <Input
                      type="number"
                      value={localSettings.terminalTimeoutMs}
                      onChange={(e) => handleSaveSettingsField({ terminalTimeoutMs: parseInt(e.target.value) || 60000 })}
                      className="h-8 text-xs max-w-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Prompts Tab */}
            {activeTab === 'prompts' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Custom System Prompts</h3>
                  <p className="text-xs text-muted-foreground">
                    Customize base system instructions for general Chats vs Projects.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Chats System Prompt</label>
                    <textarea
                      rows={4}
                      value={localSettings.chatSystemPrompt}
                      onChange={(e) => handleSaveSettingsField({ chatSystemPrompt: e.target.value })}
                      className="w-full rounded-md border border-input bg-background/50 p-2.5 text-xs text-foreground resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Projects System Prompt</label>
                    <textarea
                      rows={5}
                      value={localSettings.projectSystemPrompt}
                      onChange={(e) => handleSaveSettingsField({ projectSystemPrompt: e.target.value })}
                      className="w-full rounded-md border border-input bg-background/50 p-2.5 text-xs text-foreground resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Appearance & Theme</h3>
                  <p className="text-xs text-muted-foreground">
                    Customize the interface theme styling.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {(['dark', 'light', 'system'] as const).map(th => (
                      <button
                        key={th}
                        onClick={() => handleSaveSettingsField({ theme: th })}
                        className={cn(
                          'p-3 rounded-lg border text-center capitalize text-xs font-medium transition-all cursor-pointer',
                          localSettings.theme === th
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {th}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. Data Tab */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Data & Local Storage</h3>
                  <p className="text-xs text-muted-foreground">
                    SQLite database storage management.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-foreground">Export App Data</div>
                      <div className="text-[11px] text-muted-foreground">
                        Save all your conversations, projects, and canvases to JSON.
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
                      className="h-8 text-xs"
                    >
                      Export JSON
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
