import type { ProviderConfig } from '../../../shared/schemas'
import type {
  ILlmProviderAdapter,
  ProviderChatMessage,
  ProviderStreamChunk,
  ProviderStreamParams
} from './base'
import type { ToolCallRecord } from '../../../shared/types'
import { parseThinkingAndContent } from '../../../shared/thinking'

async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delayMs = 750): Promise<Response> {
  let lastError: any = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)
      if ((response.status === 429 || (response.status >= 502 && response.status <= 504)) && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)))
        continue
      }
      return response
    } catch (err: any) {
      lastError = err
      if (options.signal?.aborted) {
        throw err
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)))
        continue
      }
      throw new Error(`Failed to connect to AI provider (${url}): ${err.message || 'Network error'}`)
    }
  }
  throw lastError || new Error(`Request to ${url} failed after retries`)
}

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

    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000)
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

    const isOfficialOpenAI = params.config.baseUrl?.toLowerCase().includes('api.openai.com')
    const isDeepSeekOrReasoning = !isOfficialOpenAI && (
      params.model?.toLowerCase().includes('deepseek') ||
      params.model?.toLowerCase().includes('reasoner') ||
      params.model?.toLowerCase().includes('r1') ||
      params.config.baseUrl?.toLowerCase().includes('deepseek') ||
      params.config.name?.toLowerCase().includes('deepseek')
    )

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

      if (m.role === 'assistant') {
        let thinking = m.reasoning_content
        let textContent = m.content || ''

        // Fallback: If thinking was embedded as <think> in content
        if (!thinking && textContent.includes('<think>')) {
          const parsed = parseThinkingAndContent(textContent)
          thinking = parsed.thinking || undefined
          textContent = parsed.content || ''
        } else if (textContent.includes('<think>')) {
          // If reasoning_content was already provided but content still has <think> tags, strip them from content
          const parsed = parseThinkingAndContent(textContent)
          textContent = parsed.content || ''
        }

        const msgObj: any = {
          role: 'assistant',
          content: textContent
        }

        if (m.toolCalls && m.toolCalls.length > 0) {
          msgObj.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.toolName,
              arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {})
            }
          }))
        }

        // DeepSeek reasoning_content support:
        // When using DeepSeek or OpenAI-compatible reasoning endpoints with thinking mode,
        // previous reasoning_content MUST be passed back to the API on assistant messages.
        // For official OpenAI (api.openai.com), extra parameters cause a 400 schema error, so omit.
        if (!isOfficialOpenAI) {
          if (thinking) {
            msgObj.reasoning_content = thinking
          } else if (isDeepSeekOrReasoning && m.toolCalls && m.toolCalls.length > 0) {
            // Even if empty, passing empty string avoids "The reasoning_content in the thinking mode must be passed back to the API"
            msgObj.reasoning_content = ''
          }
        }

        formattedMessages.push(msgObj)

        if (m.toolCalls && m.toolCalls.length > 0) {
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
      body.parallel_tool_calls = false
    }

    const response = await fetchWithRetry(url, {
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
        let readResult: { done: boolean; value?: Uint8Array }
        try {
          readResult = await reader.read()
        } catch (streamErr: any) {
          if (params.signal?.aborted) return
          if (toolCallBuffers.size > 0) {
            for (const [, tc] of toolCallBuffers.entries()) {
              let parsedArgs: any = {}
              try { parsedArgs = JSON.parse(tc.args || '{}') } catch { parsedArgs = { raw: tc.args } }
              yield {
                type: 'tool_call',
                toolCall: {
                  id: tc.id,
                  toolName: tc.name.trim() as any,
                  args: parsedArgs,
                  status: 'pending'
                }
              }
            }
            toolCallBuffers.clear()
            yield { type: 'finish', reason: 'done' }
            return
          }
          throw new Error(`Connection interrupted: ${streamErr.message || 'Stream dropped'}`)
        }

        const { done, value } = readResult
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
