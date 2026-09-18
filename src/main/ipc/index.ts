import type { BrowserWindow } from 'electron'
import { registerProvidersIpc } from './providers.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerChatsIpc } from './chats.ipc'
import { registerProjectsIpc } from './projects.ipc'
import { registerAgentIpc } from './agent.ipc'
import { registerTerminalIpc } from './terminal.ipc'
import { registerCanvasesIpc } from './canvases.ipc'

export function registerAllIpc(mainWindow: BrowserWindow) {
  registerProvidersIpc()
  registerSettingsIpc()
  registerChatsIpc()
  registerProjectsIpc()
  registerAgentIpc(mainWindow)
  registerTerminalIpc(mainWindow)
  registerCanvasesIpc()
}
