import type { ProviderConfig } from '../../../shared/schemas'
import type {
  ILlmProviderAdapter,
  ProviderChatMessage,
  ProviderStreamChunk,
  ProviderStreamParams
} from './base'
import type { ToolCallRecord } from '../../../shared/types'

export class OpenAiCompatibleAdapter implements ILlmProviderAdapter {
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
        message: `Successfully connected! Found ${models.length} model(s).`,
        modelsCount: models.length
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to connect to provider'
      }
    }
  }

  async fetchModels(config: ProviderConfig): Promise<string[]> {
    const baseUrl = this.sanitizeBaseUrl(config.baseUrl)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Models endpoint returned status ${res.status}: ${errText}`)
    }

    const data = (await res.json()) as any
    if (Array.isArray(data?.data)) {
      return data.data.map((m: any) => m.id).filter(Boolean)
    }
    if (Array.isArray(data?.models)) {
      return data.models.map((m: any) => m.name || m.id).filter(Boolean)
    }
    return []
  }

  async *streamChat(params: ProviderStreamParams): AsyncGenerator<ProviderStreamChunk, void, unknown> {
    const baseUrl = this.sanitizeBaseUrl(params.config.baseUrl)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (params.config.apiKey) {
      headers['Authorization'] = `Bearer ${params.config.apiKey}`
    }

    const formattedMessages: any[] = []

    for (let i = 0; i < params.messages.length; i++) {
      const m = params.messages[i]

      if (m.role === 'tool') {
        formattedMessages.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''),
          tool_call_id: m.toolCallId || `call_legacy_${i}`
        })
        continue
      }

      if (m.toolCalls && m.toolCalls.length > 0) {
        formattedMessages.push({
          role: 'assistant',
          content: m.content || '',
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.toolName,
              arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {})
            }
          }))
        })

        // Check if the subsequent messages in params.messages already provide tool responses for each toolCall
        const existingToolCallIds = new Set<string>()
        for (let j = i + 1; j < params.messages.length; j++) {
          if (params.messages[j].role === 'tool' && params.messages[j].toolCallId) {
            existingToolCallIds.add(params.messages[j].toolCallId!)
          } else {
            break // tool messages must immediately follow
          }
        }

        for (const tc of m.toolCalls) {
          if (!existingToolCallIds.has(tc.id)) {
            const resultText = tc.result !== undefined
              ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result))
              : (tc.error ? `Error: ${tc.error}` : 'Completed')
            formattedMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: resultText
            })
          }
        }
        continue
      }

      formattedMessages.push({
        role: m.role,
        content: m.content || ''
      })
    }

    const body: any = {
      model: params.model,
      messages: formattedMessages,
      stream: true
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} }
        }
      }))
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: params.signal
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`OpenAI Provider HTTP ${response.status}: ${errText}`)
    }

    if (!response.body) {
      throw new Error('Response body is empty')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let isThinking = false

    // Tool call accumulator
    const toolCallBuffers: Map<number, { id: string; name: string; args: string }> = new Map()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue
          if (trimmed === 'data: [DONE]') {
            if (isThinking) {
              isThinking = false
              yield { type: 'text', text: '</think>' }
            }
            if (toolCallBuffers.size > 0) {
              for (const [, tc] of toolCallBuffers.entries()) {
                let parsedArgs: any = {}
                try {
                  parsedArgs = JSON.parse(tc.args || '{}')
                } catch {
                  parsedArgs = { raw: tc.args }
                }

                const toolCall: ToolCallRecord = {
                  id: tc.id,
                  toolName: tc.name.trim() as any,
                  args: parsedArgs,
                  status: 'pending'
                }
                yield { type: 'tool_call', toolCall }
              }
              toolCallBuffers.clear()
            }
            yield { type: 'finish', reason: 'done' }
            continue
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6)
            try {
              const data = JSON.parse(jsonStr)
              const choice = data.choices?.[0]
              if (!choice) continue

              const delta = choice.delta
              if (delta?.reasoning_content) {
                if (!isThinking) {
                  isThinking = true
                  yield { type: 'text', text: '<think>' }
                }
                yield { type: 'text', text: delta.reasoning_content }
              }

              if (delta?.content) {
                if (isThinking) {
                  isThinking = false
                  yield { type: 'text', text: '</think>' }
                }
                yield { type: 'text', text: delta.content }
              }

              if (Array.isArray(delta?.tool_calls)) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0
                  if (!toolCallBuffers.has(idx)) {
                    toolCallBuffers.set(idx, {
                      id: tc.id || `call_${Date.now()}_${idx}`,
                      name: '',
                      args: ''
                    })
                  }
                  const current = toolCallBuffers.get(idx)!
                  if (tc.id) current.id = tc.id
                  if (tc.function?.name) {
                    const chunkName = tc.function.name.trim()
                    if (!current.name) {
                      current.name = chunkName
                    } else if (current.name === chunkName) {
                      // Provider repeats full function name across multiple delta chunks
                    } else if (chunkName.startsWith(current.name)) {
                      current.name = chunkName
                    } else if (!current.name.endsWith(chunkName)) {
                      current.name += chunkName
                    }
                  }
                  if (tc.function?.arguments) current.args += tc.function.arguments
                }
              }

              if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
                for (const [, tc] of toolCallBuffers.entries()) {
                  let parsedArgs: any = {}
                  try {
                    parsedArgs = JSON.parse(tc.args || '{}')
                  } catch {
                    parsedArgs = { raw: tc.args }
                  }

                  const toolCall: ToolCallRecord = {
                    id: tc.id,
                    toolName: tc.name.trim() as any,
                    args: parsedArgs,
                    status: 'pending'
                  }
                  yield { type: 'tool_call', toolCall }
                }
                toolCallBuffers.clear()
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
