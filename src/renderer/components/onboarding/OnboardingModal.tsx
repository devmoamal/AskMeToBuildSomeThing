import React, { useState } from 'react'
import { Sparkles, Server, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import type { ProviderConfig } from '../../../shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: (provider: ProviderConfig) => Promise<void>
}

const PRESETS = [
  { name: 'OpenAI', type: 'openai' as const, baseUrl: 'https://api.openai.com/v1', keyPlaceholder: 'sk-proj-...' },
  { name: 'Anthropic', type: 'anthropic' as const, baseUrl: 'https://api.anthropic.com/v1', keyPlaceholder: 'sk-ant-...' },
  { name: 'Ollama (Local)', type: 'openai' as const, baseUrl: 'http://127.0.0.1:11434/v1', keyPlaceholder: 'None required' },
  { name: 'OpenRouter', type: 'openai' as const, baseUrl: 'https://openrouter.ai/api/v1', keyPlaceholder: 'sk-or-...' },
  { name: 'Groq', type: 'openai' as const, baseUrl: 'https://api.groq.com/openai/v1', keyPlaceholder: 'gsk_...' }
]

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  if (!isOpen) return null

  const [name, setName] = useState('OpenAI')
  const [type, setType] = useState<'openai' | 'anthropic'>('openai')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [defaultModel, setDefaultModel] = useState('')

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name)
    setType(preset.type)
    setBaseUrl(preset.baseUrl)
    setTestResult(null)
    setModels([])
  }

  const handleTestAndFetch = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ success: false, message: 'Please enter a valid Base URL.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    const tempConfig: ProviderConfig = {
      id: `prov_${Date.now()}`,
      name: name.trim() || 'Provider',
      type,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: [],
      isDefault: true,
      createdAt: Date.now()
    }

    try {
      const res = await window.api.providers.testConnection(tempConfig)
      if (res.success) {
        const fetched = await window.api.providers.fetchModels(tempConfig)
        setModels(fetched)
        setDefaultModel(fetched[0] || 'default')
        setTestResult({
          success: true,
          message: `Connected! Found ${fetched.length} model(s).`
        })
      } else {
        setTestResult(res)
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleFinish = async () => {
    if (!name.trim() || !baseUrl.trim()) return

    setIsSaving(true)
    try {
      const config: ProviderConfig = {
        id: `prov_${Date.now()}`,
        name: name.trim(),
        type,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        models: models.length > 0 ? models : [defaultModel || 'gpt-4o'],
        defaultModel: defaultModel || models[0] || 'gpt-4o',
        isDefault: true,
        createdAt: Date.now()
      }

      await onComplete(config)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in-0 select-none">
      <div className="w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Title */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Welcome to AskMeToBuildSomeThing</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            To start using the app, configure at least one AI provider with your API key or local endpoint.
          </p>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Quick Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer',
                  name === p.name
                    ? 'bg-primary/20 border-primary text-primary font-medium'
                    : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Provider Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="OpenAI"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Provider Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
              >
                <option value="openai">OpenAI Compatible</option>
                <option value="anthropic">Anthropic Compatible</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">API Key</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... (Leave empty for local Ollama)"
              className="h-8 text-xs"
            />
          </div>

          {/* Test connection & Fetch models */}
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
              <span>Test Connection & Fetch Models</span>
            </Button>

            {testResult && (
              <div className={cn('text-xs flex items-center gap-1', testResult.success ? 'text-green-400' : 'text-red-400')}>
                {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span className="truncate max-w-[220px]">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Model picker */}
          {models.length > 0 && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Select Default Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Complete Setup button */}
        <div className="pt-2">
          <Button
            size="lg"
            disabled={isSaving || !name.trim() || !baseUrl.trim()}
            onClick={handleFinish}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white gap-2 font-medium"
          >
            <span>{isSaving ? 'Initializing...' : 'Save & Launch Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
