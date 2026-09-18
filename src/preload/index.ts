import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from './types'
import type {
  ProviderConfig,
  AppSettings,
  SendPromptPayload,
  AgentStreamEvent,
  UserResponsePayload,
  ToolApprovalPayload
} from '../shared/types'

const api: ElectronAPI = {
  providers: {
    getAll: () => ipcRenderer.invoke('providers:getAll'),
    getById: (id: string) => ipcRenderer.invoke('providers:getById', id),
    getDefault: () => ipcRenderer.invoke('providers:getDefault'),
    save: (provider: ProviderConfig) => ipcRenderer.invoke('providers:save', provider),
    delete: (id: string) => ipcRenderer.invoke('providers:delete', id),
    testConnection: (config: ProviderConfig) => ipcRenderer.invoke('providers:testConnection', config),
    fetchModels: (config: ProviderConfig) => ipcRenderer.invoke('providers:fetchModels', config)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:save', settings)
  },
  chats: {
    getAll: () => ipcRenderer.invoke('chats:getAll'),
    save: (chat) => ipcRenderer.invoke('chats:save', chat),
    delete: (id: string) => ipcRenderer.invoke('chats:delete', id),
    getGroups: () => ipcRenderer.invoke('chats:getGroups'),
    saveGroup: (group) => ipcRenderer.invoke('chats:saveGroup', group),
    deleteGroup: (id: string) => ipcRenderer.invoke('chats:deleteGroup', id),
    getMessages: (chatId: string) => ipcRenderer.invoke('chats:getMessages', chatId),
    getCanvases: (chatId: string) => ipcRenderer.invoke('chats:getCanvases', chatId),
    rollback: (payload) => ipcRenderer.invoke('chats:rollback', payload)
  },
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    save: (project) => ipcRenderer.invoke('projects:save', project),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    pickFolder: () => ipcRenderer.invoke('projects:pickFolder'),
    pickFile: () => ipcRenderer.invoke('projects:pickFile'),
    pickImage: () => ipcRenderer.invoke('projects:pickImage'),
    readFile: (filePath: string) => ipcRenderer.invoke('projects:readFile', filePath),
    getSessions: (projectId: string) => ipcRenderer.invoke('projects:getSessions', projectId),
    saveSession: (session) => ipcRenderer.invoke('projects:saveSession', session),
    deleteSession: (id: string) => ipcRenderer.invoke('projects:deleteSession', id),
    getMessages: (sessionId: string) => ipcRenderer.invoke('projects:getMessages', sessionId),
    getCanvases: (sessionId: string) => ipcRenderer.invoke('projects:getCanvases', sessionId),
    rollback: (payload) => ipcRenderer.invoke('projects:rollback', payload)
  },
  agent: {
    sendPrompt: (payload: SendPromptPayload) => ipcRenderer.invoke('agent:sendPrompt', payload),
    submitUserResponse: (payload: UserResponsePayload) => ipcRenderer.invoke('agent:submitUserResponse', payload),
    approveTool: (payload: ToolApprovalPayload) => ipcRenderer.invoke('agent:approveTool', payload),
    abort: (targetId: string) => ipcRenderer.invoke('agent:abort', targetId),
    onStreamEvent: (callback: (event: AgentStreamEvent) => void) => {
      const listener = (_: any, event: AgentStreamEvent) => callback(event)
      ipcRenderer.on('agent:streamEvent', listener)
      return () => {
        ipcRenderer.removeListener('agent:streamEvent', listener)
      }
    }
  },
  terminal: {
    runCommand: (options) => ipcRenderer.invoke('terminal:runCommand', options),
    onTerminalOutput: (callback: (chunk: string) => void) => {
      const listener = (_: any, chunk: string) => callback(chunk)
      ipcRenderer.on('terminal:output', listener)
      return () => {
        ipcRenderer.removeListener('terminal:output', listener)
      }
    }
  },
  canvases: {
    save: (canvas) => ipcRenderer.invoke('canvases:save', canvas)
  }
}

contextBridge.exposeInMainWorld('api', api)
