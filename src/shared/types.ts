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
  toolName:
    | 'read_file'
    | 'create_file'
    | 'edit_file'
    | 'use_terminal'
    | 'list_dir'
    | 'find_files'
    | 'search_code'
    | 'make_canvas'
    | 'ask_user'
    | 'web_search'
    | 'read_url'
    | 'customize_app'
    | 'schedule_task'
    | (string & {})
  args: any
  status: ToolCallStatus
  result?: any
  error?: string
}

export type ScheduledTask = {
  id: string
  targetId: string // chatId or projectSessionId
  mode: 'chat' | 'project'
  type: 'command' | 'prompt' | 'reminder'
  command?: string
  prompt?: string
  description: string
  delaySeconds: number
  scheduledAt: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: string
  error?: string
  createdAt: number
  completedAt?: number
}

export type ProjectMemory = {
  id: string
  projectId: string
  key: string
  content: string
  category: 'architecture' | 'decision' | 'gotcha' | 'preference' | 'convention' | 'dependency' | 'general'
  updatedAt: number
}

export type WebSearchResult = {
  title: string
  url: string
  snippet: string
}

export type WebSearchOutput = {
  query: string
  results: WebSearchResult[]
  totalResults: number
}

export type ReadUrlOutput = {
  url: string
  title?: string
  description?: string
  content: string
  truncated: boolean
  internalLinks?: string[]
  byteSize: number
}


export type ToolResultRecord = {
  toolCallId: string
  toolName: string
  result?: any
  error?: string
}

export type MessagePart =
  | { type: 'thinking'; text: string; isGenerating?: boolean }
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: ToolCallRecord }
  | { type: 'image'; mediaType: string; base64: string }

export type Message = {
  id: string
  chatId?: string
  projectSessionId?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: Array<{ mediaType: string; base64: string }>
  toolCalls?: ToolCallRecord[]
  parts?: MessagePart[]
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
  | { type: 'chunk'; text: string; targetId: string }
  | { type: 'tool_call_start'; call: ToolCallRecord; targetId: string }
  | { type: 'tool_call_stream'; id: string; chunk: string; targetId: string }
  | { type: 'tool_call_done'; id: string; result: any; status: ToolCallStatus; targetId: string }
  | { type: 'pause_for_user'; questionnaire: QuestionnairePayload; toolCallId: string; targetId: string }
  | { type: 'canvas_created'; canvas: CanvasDocument; targetId: string }
  | { type: 'title_generated'; targetId: string; title: string }
  | { type: 'compaction_done'; summary: string; targetId: string }
  | { type: 'token_usage'; inputTokens: number; totalTokens: number; targetId: string }
  | { type: 'error'; error: string; targetId: string }
  | { type: 'done'; finalMessage: Message; targetId: string }

export type SendPromptPayload = {
  mode: 'chat' | 'project'
  executionMode?: 'plan' | 'build'
  targetId: string // chatId or projectSessionId
  projectFolder?: string
  prompt: string
  providerId: string
  model: string
  systemPrompt?: string
  images?: Array<{ mediaType: string; base64: string }>
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

export type UpdateInfo = {
  version: string
  releaseName: string
  releaseNotes: string
  publishedAt: string
  downloadUrl: string
  assetName: string
  assetSize: number
  htmlUrl: string
  isOta?: boolean
}

export type UpdateProgress = {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type UpdateCheckResult = {
  available: boolean
  currentVersion: string
  updateInfo?: UpdateInfo
  error?: string
}
