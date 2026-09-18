import type { ProviderConfig } from '../../../shared/schemas'
import type {
  ILlmProviderAdapter,
  ProviderChatMessage,
  ProviderStreamChunk,
  ProviderStreamParams
} from './base'
import type { ToolCallRecord } from '../../../shared/types'

export class AnthropicCompatibleAdapter implements ILlmProviderAdapter {
  private sanitizeBaseUrl(baseUrl: string): string {
    let clean = baseUrl.trim()
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1)
    }
    return clean
  }

  async testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string; modelsCount?: number }> {
    try {
      const models = await this.fetchModels(config)
      return {
        success: true,
        message: `Connected successfully! Retrieved ${models.length} model(s).`,
        modelsCount: models.length
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to connect to Anthropic provider'
      }
    }
  }

  async fetchModels(config: ProviderConfig): Promise<string[]> {
    const baseUrl = this.sanitizeBaseUrl(config.baseUrl)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        signal: AbortSignal.timeout(6000)
      })

      if (res.ok) {
        const data = (await res.json()) as any
        if (Array.isArray(data?.data)) {
          return data.data.map((m: any) => m.id).filter(Boolean)
        }
      }
    } catch {
      // Fall through to standard Claude catalog
    }

    // Standard Claude models default catalog
    return [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
  }

  async *streamChat(params: ProviderStreamParams): AsyncGenerator<ProviderStreamChunk, void, unknown> {
    const baseUrl = this.sanitizeBaseUrl(params.config.baseUrl)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`

    const systemMessages = params.messages.filter(m => m.role === 'system')
    const systemPrompt = systemMessages.map(m => m.content).join('\n\n')

    const nonSystemMessages = params.messages.filter(m => m.role !== 'system')

    const formattedMessages: any[] = []

    for (let i = 0; i < nonSystemMessages.length; i++) {
      const m = nonSystemMessages[i]

      if (m.role === 'tool') {
        formattedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId || `tool_legacy_${i}`,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
            }
          ]
        })
        continue
      }

      if (m.toolCalls && m.toolCalls.length > 0) {
        const contents: any[] = []
        if (m.content) {
          contents.push({ type: 'text', text: m.content })
        }
        for (const tc of m.toolCalls) {
          contents.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.toolName,
            input: tc.args || {}
          })
        }
        formattedMessages.push({
          role: 'assistant',
          content: contents
        })

        // Check if subsequent messages respond to all tool calls
        const existingToolCallIds = new Set<string>()
        for (let j = i + 1; j < nonSystemMessages.length; j++) {
          if (nonSystemMessages[j].role === 'tool' && nonSystemMessages[j].toolCallId) {
            existingToolCallIds.add(nonSystemMessages[j].toolCallId!)
          } else {
            break
          }
        }

        const missingToolCalls = m.toolCalls.filter(tc => !existingToolCallIds.has(tc.id))
        if (missingToolCalls.length > 0) {
          formattedMessages.push({
            role: 'user',
            content: missingToolCalls.map(tc => ({
              type: 'tool_result',
              tool_use_id: tc.id,
              content: tc.result !== undefined
                ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result))
                : (tc.error ? `Error: ${tc.error}` : 'Completed')
            }))
          })
        }
        continue
      }

      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ''
      })
    }

    const body: any = {
      model: params.model,
      max_tokens: 4096,
      messages: formattedMessages,
      stream: true
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters || { type: 'object', properties: {} }
      }))
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
      signal: params.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Anthropic Provider HTTP ${response.status}: ${errText}`)
    }

    if (!response.body) {
      throw new Error('Response body is empty')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    let currentToolUse: { id: string; name: string; inputBuffer: string } | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6)
          if (jsonStr === '[DONE]') continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'tool_use') {
                currentToolUse = {
                  id: event.content_block.id || `tool_${Date.now()}`,
                  name: event.content_block.name,
                  inputBuffer: ''
                }
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                yield { type: 'text', text: event.delta.text }
              } else if (event.delta?.type === 'input_json_delta') {
                if (currentToolUse) {
                  currentToolUse.inputBuffer += event.delta.partial_json
                }
              }
            } else if (event.type === 'content_block_stop') {
              if (currentToolUse) {
                let parsedArgs: any = {}
                try {
                  parsedArgs = JSON.parse(currentToolUse.inputBuffer || '{}')
                } catch {
                  parsedArgs = { raw: currentToolUse.inputBuffer }
                }

                const toolCall: ToolCallRecord = {
                  id: currentToolUse.id,
                  toolName: currentToolUse.name as any,
                  args: parsedArgs,
                  status: 'pending'
                }
                yield { type: 'tool_call', toolCall }
                currentToolUse = null
              }
            } else if (event.type === 'message_stop') {
              yield { type: 'finish', reason: 'stop' }
            }
          } catch {
            // Ignore malformed chunk
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
