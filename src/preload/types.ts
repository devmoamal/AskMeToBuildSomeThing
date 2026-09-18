import type {
  ProviderConfig,
  AppSettings,
  ChatGroup,
  Chat,
  Project,
  ProjectSession,
  Message,
  CanvasDocument,
  SendPromptPayload,
  AgentStreamEvent,
  UserResponsePayload,
  ToolApprovalPayload
} from '../shared/types'

export interface ElectronAPI {
  providers: {
    getAll: () => Promise<ProviderConfig[]>
    getById: (id: string) => Promise<ProviderConfig | null>
    getDefault: () => Promise<ProviderConfig | null>
    save: (provider: ProviderConfig) => Promise<void>
    delete: (id: string) => Promise<void>
    testConnection: (config: ProviderConfig) => Promise<{ success: boolean; message: string; modelsCount?: number }>
    fetchModels: (config: ProviderConfig) => Promise<string[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    save: (settings: Partial<AppSettings>) => Promise<AppSettings>
  }
  chats: {
    getAll: () => Promise<Chat[]>
    save: (chat: { id: string; title: string; groupId?: string | null }) => Promise<Chat>
    delete: (id: string) => Promise<void>
    getGroups: () => Promise<ChatGroup[]>
    saveGroup: (group: { id: string; name: string; orderIndex?: number; isCollapsed?: boolean }) => Promise<void>
    deleteGroup: (id: string) => Promise<void>
    getMessages: (chatId: string) => Promise<Message[]>
    getCanvases: (chatId: string) => Promise<CanvasDocument[]>
    rollback: (payload: { chatId: string; messageId: string; deleteTargetMessage?: boolean }) => Promise<{ deletedMessageIds: string[]; remainingMessages: Message[] }>
  }
  projects: {
    getAll: () => Promise<Project[]>
    save: (project: { id: string; name: string; folderPath: string }) => Promise<Project>
    delete: (id: string) => Promise<void>
    pickFolder: () => Promise<string | null>
    pickFile: () => Promise<string[] | null>
    pickImage: () => Promise<string[] | null>
    readFile: (filePath: string) => Promise<string>
    getSessions: (projectId: string) => Promise<ProjectSession[]>
    saveSession: (session: { id: string; projectId: string; title: string }) => Promise<ProjectSession>
    deleteSession: (id: string) => Promise<void>
    getMessages: (sessionId: string) => Promise<Message[]>
    getCanvases: (sessionId: string) => Promise<CanvasDocument[]>
    rollback: (payload: { sessionId: string; messageId: string; deleteTargetMessage?: boolean }) => Promise<{ deletedMessageIds: string[]; remainingMessages: Message[] }>
  }
  agent: {
    sendPrompt: (payload: SendPromptPayload) => Promise<void>
    submitUserResponse: (payload: UserResponsePayload) => Promise<boolean>
    approveTool: (payload: ToolApprovalPayload) => Promise<boolean>
    abort: (targetId: string) => Promise<boolean>
    onStreamEvent: (callback: (event: AgentStreamEvent) => void) => () => void
  }
  terminal: {
    runCommand: (options: { command: string; cwd?: string; shell?: string }) => Promise<{ exitCode: number; stdout: string; stderr: string }>
    onTerminalOutput: (callback: (chunk: string) => void) => () => void
  }
  canvases: {
    save: (canvas: { id: string; title: string; content: string; language?: string; chatId?: string; projectSessionId?: string }) => Promise<CanvasDocument>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
