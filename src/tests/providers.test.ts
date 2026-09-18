import { describe, it, expect } from 'bun:test'
import { OpenAiCompatibleAdapter } from '../main/agent/providers/openai'
import { AnthropicCompatibleAdapter } from '../main/agent/providers/anthropic'
import { ProviderAdapterFactory } from '../main/agent/providers/factory'

describe('Provider Adapters', () => {
  it('should resolve the correct adapter from the factory', () => {
    const openai = ProviderAdapterFactory.getAdapter('openai')
    expect(openai).toBeInstanceOf(OpenAiCompatibleAdapter)

    const anthropic = ProviderAdapterFactory.getAdapter('anthropic')
    expect(anthropic).toBeInstanceOf(AnthropicCompatibleAdapter)
  })

  it('should provide fallback Claude models when offline', async () => {
    const anthropic = new AnthropicCompatibleAdapter()
    const models = await anthropic.fetchModels({
      id: 'p_test',
      name: 'Anthropic',
      type: 'anthropic',
      baseUrl: 'https://invalid-host-for-testing-fallback.local/v1',
      apiKey: 'sk-ant-test',
      models: [],
      isDefault: true,
      createdAt: Date.now()
    })

    expect(models.length).toBeGreaterThan(0)
    expect(models).toContain('claude-3-7-sonnet-20250219')
    expect(models).toContain('claude-3-5-sonnet-20241022')
  })

  it('should sanitize base URLs correctly', async () => {
    const openai = new OpenAiCompatibleAdapter()
    // Test connection with unreachable URL will gracefully return success: false without unhandled crash
    const res = await openai.testConnection({
      id: 'p_test_oa',
      name: 'OpenAI Test',
      type: 'openai',
      baseUrl: 'http://127.0.0.1:59999/v1/',
      apiKey: 'test-key',
      models: [],
      isDefault: false,
      createdAt: Date.now()
    })

    expect(res.success).toBe(false)
    expect(res.message).toBeDefined()
  })

  it('should format tool calls correctly in OpenAiCompatibleAdapter', async () => {
    const adapter = new OpenAiCompatibleAdapter()
    let capturedBody: any = null

    // Mock global fetch
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: any, options: any) => {
      if (options?.body) {
        capturedBody = JSON.parse(options.body)
      }
      return new Response('data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }) as any

    try {
      const generator = adapter.streamChat({
        config: {
          id: 'p_mock',
          name: 'Mock',
          type: 'openai',
          baseUrl: 'http://localhost/v1',
          apiKey: 'mock-key',
          models: ['mock-model'],
          isDefault: true,
          createdAt: Date.now()
        },
        model: 'mock-model',
        messages: [
          { role: 'user', content: 'hello' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'call_123',
                toolName: 'make_canvas',
                args: { title: 'Test' },
                status: 'completed',
                result: { canvasId: 'c1' }
              }
            ]
          },
          { role: 'user', content: 'next question' }
        ]
      })

      for await (const _ of generator) {
        // drain
      }

      expect(capturedBody).toBeDefined()
      expect(capturedBody.messages.length).toBe(4)
      expect(capturedBody.messages[1].role).toBe('assistant')
      expect(capturedBody.messages[1].tool_calls).toBeDefined()
      expect(capturedBody.messages[2].role).toBe('tool')
      expect(capturedBody.messages[2].tool_call_id).toBe('call_123')
      expect(capturedBody.messages[3].role).toBe('user')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should not duplicate tool names when chunks repeat function name', async () => {
    const adapter = new OpenAiCompatibleAdapter()

    const sseChunks = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","function":{"name":"use_terminal","arguments":""}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"use_terminal","arguments":"{\\"co"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"use_terminal","arguments":"mmand\\": \\"ls\\"}"}}]}}]}\n\n',
      'data: {"choices":[{"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n'
    ].join('')

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      return new Response(sseChunks, {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }) as any

    try {
      const generator = adapter.streamChat({
        config: {
          id: 'p_test',
          name: 'Test',
          type: 'openai',
          baseUrl: 'http://localhost/v1',
          apiKey: 'key',
          models: ['m1'],
          isDefault: true,
          createdAt: Date.now()
        },
        model: 'm1',
        messages: [{ role: 'user', content: 'test' }]
      })

      const toolCalls: any[] = []
      for await (const chunk of generator) {
        if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall)
        }
      }

      expect(toolCalls.length).toBe(1)
      expect(toolCalls[0].toolName).toBe('use_terminal')
      expect(toolCalls[0].args).toEqual({ command: 'ls' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should preserve reasoning_content and strip think tags for DeepSeek models', async () => {
    const adapter = new OpenAiCompatibleAdapter()
    let capturedBody: any = null

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_url: any, options: any) => {
      if (options?.body) {
        capturedBody = JSON.parse(options.body)
      }
      return new Response('data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }) as any

    try {
      const generator = adapter.streamChat({
        config: {
          id: 'p_deepseek',
          name: 'DeepSeek',
          type: 'openai',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'sk-test',
          models: ['deepseek-reasoner'],
          isDefault: true,
          createdAt: Date.now()
        },
        model: 'deepseek-reasoner',
        messages: [
          { role: 'user', content: 'What is Python?' },
          {
            role: 'assistant',
            content: '<think>Deep analysis of Python language</think>Python is an interpreted language.',
            toolCalls: [
              {
                id: 'call_ask',
                toolName: 'ask_user',
                args: { question: 'Version?' },
                status: 'completed',
                result: 'v3.12'
              }
            ]
          }
        ]
      })

      for await (const _ of generator) {}

      expect(capturedBody).toBeDefined()
      const assistantMsg = capturedBody.messages.find((m: any) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      // reasoning_content must be extracted and preserved
      expect(assistantMsg.reasoning_content).toBe('Deep analysis of Python language')
      // content must be clean without <think> tags
      expect(assistantMsg.content).toBe('Python is an interpreted language.')
      expect(assistantMsg.tool_calls).toBeDefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should NOT include reasoning_content for official OpenAI (api.openai.com) to avoid 400 schema errors', async () => {
    const adapter = new OpenAiCompatibleAdapter()
    let capturedBody: any = null

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_url: any, options: any) => {
      if (options?.body) {
        capturedBody = JSON.parse(options.body)
      }
      return new Response('data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    }) as any

    try {
      const generator = adapter.streamChat({
        config: {
          id: 'p_openai',
          name: 'OpenAI Official',
          type: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test',
          models: ['gpt-4o'],
          isDefault: true,
          createdAt: Date.now()
        },
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'assistant',
            content: '<think>Some thought</think>Response',
            reasoning_content: 'Some thought'
          }
        ]
      })

      for await (const _ of generator) {}

      expect(capturedBody).toBeDefined()
      const assistantMsg = capturedBody.messages.find((m: any) => m.role === 'assistant')
      expect(assistantMsg).toBeDefined()
      // reasoning_content MUST NOT be sent to api.openai.com
      expect(assistantMsg.reasoning_content).toBeUndefined()
      expect(assistantMsg.content).toBe('Response')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
