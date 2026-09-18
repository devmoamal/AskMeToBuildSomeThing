import type { ProviderConfig } from '../../../shared/schemas'
import type { ToolCallRecord } from '../../../shared/types'

export interface ProviderChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCallRecord[]
  reasoning_content?: string
}

export interface ProviderStreamParams {
  config: ProviderConfig
  model: string
  messages: ProviderChatMessage[]
  tools?: Array<{
    name: string
    description: string
    parameters: any
  }>
  signal?: AbortSignal
}

export type ProviderStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: ToolCallRecord }
  | { type: 'usage'; promptTokens?: number; completionTokens?: number }
  | { type: 'finish'; reason: string }

export interface ILlmProviderAdapter {
  testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string; modelsCount?: number }>
  fetchModels(config: ProviderConfig): Promise<string[]>
  streamChat(params: ProviderStreamParams): AsyncGenerator<ProviderStreamChunk, void, unknown>
}
