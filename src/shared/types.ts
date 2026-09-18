import type { ProviderConfig, AppSettings, QuestionnairePayload } from './schemas'

export type { ProviderConfig, AppSettings, QuestionnairePayload }

export type ChatGroup = {
  id: string
  name: string
  orderIndex: number
  isCollapsed: boolean
  createdAt: number
}

export type Chat = {
  id: string
  groupId: string | null
  title: string
  createdAt: number
  updatedAt: number
}

export type Project = {
  id: string
  name: string
  folderPath: string
  createdAt: number
  updatedAt: number
}

export type ProjectSession = {
  id: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
}

export type ToolCallStatus = 'pending' | 'requires_approval' | 'executing' | 'completed' | 'failed' | 'cancelled'

export type ToolCallRecord = {
  id: string
  toolName: 'read_file' | 'create_file' | 'use_terminal' | 'make_canvas' | 'ask_user'
  args: any
  status: ToolCallStatus
  result?: any
  error?: string
}

export type ToolResultRecord = {
  toolCallId: string
  toolName: string
  result?: any
  error?: string
}

export type Message = {
  id: string
  chatId?: string
  projectSessionId?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCallRecord[]
  createdAt: number
}

export type CanvasDocument = {
  id: string
  messageId?: string
  chatId?: string
  projectSessionId?: string
  title: string
  language: string
  content: string
  version: number
  createdAt: number
  updatedAt: number
}

export type AgentStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'tool_call_start'; call: ToolCallRecord }
  | { type: 'tool_call_stream'; id: string; chunk: string }
  | { type: 'tool_call_done'; id: string; result: any; status: ToolCallStatus }
  | { type: 'pause_for_user'; questionnaire: QuestionnairePayload; toolCallId: string }
  | { type: 'canvas_created'; canvas: CanvasDocument }
  | { type: 'title_generated'; targetId: string; title: string }
  | { type: 'error'; error: string }
  | { type: 'done'; finalMessage: Message }

export type SendPromptPayload = {
  mode: 'chat' | 'project'
  targetId: string // chatId or projectSessionId
  projectFolder?: string
  prompt: string
  providerId: string
  model: string
  systemPrompt?: string
}

export type ToolApprovalPayload = {
  toolCallId: string
  approved: boolean
}

export type UserResponsePayload = {
  toolCallId: string
  answers: Record<string, string | string[]>
}

export type TerminalOutputEvent = {
  sessionId: string
  data: string
}
