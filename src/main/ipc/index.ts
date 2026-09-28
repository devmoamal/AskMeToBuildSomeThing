import type { BrowserWindow } from 'electron'
import { registerProvidersIpc } from './providers.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerChatsIpc } from './chats.ipc'
import { registerProjectsIpc } from './projects.ipc'
import { registerAgentIpc } from './agent.ipc'
import { registerTerminalIpc } from './terminal.ipc'
import { registerCanvasesIpc } from './canvases.ipc'
import { registerUpdaterIpc } from './updater.ipc'
import { registerSchedulerIpc } from './scheduler.ipc'

let isRegistered = false

export function registerAllIpc(mainWindow: BrowserWindow) {
  if (isRegistered) {
    return
  }
  isRegistered = true

  registerProvidersIpc()
  registerSettingsIpc()
  registerChatsIpc()
  registerProjectsIpc()
  registerAgentIpc(mainWindow)
  registerTerminalIpc(mainWindow)
  registerCanvasesIpc()
  registerUpdaterIpc(mainWindow)
  registerSchedulerIpc(mainWindow)
}
