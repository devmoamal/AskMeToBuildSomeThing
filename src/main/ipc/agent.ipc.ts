import { ipcMain, type BrowserWindow } from 'electron'
import { AgentRunner } from '../agent/runner'
import type { SendPromptPayload, UserResponsePayload, ToolApprovalPayload } from '../../shared/types'

export function registerAgentIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('agent:sendPrompt', async (_, payload: SendPromptPayload) => {
    // Run the generator and broadcast events to the renderer window
    (async () => {
      try {
        const stream = AgentRunner.run(payload, (event) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('agent:streamEvent', event)
          }
        })
        for await (const _ of stream) {
          // Event emission handled by the callback
        }
      } catch (err: any) {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('agent:streamEvent', {
            type: 'error',
            error: err.message || 'Unknown streaming failure'
          })
        }
      }
    })()
  })

  ipcMain.handle('agent:submitUserResponse', async (_, payload: UserResponsePayload) => {
    return AgentRunner.submitUserResponse(payload.toolCallId, payload.answers)
  })

  ipcMain.handle('agent:approveTool', async (_, payload: ToolApprovalPayload) => {
    return AgentRunner.approveTool(payload.toolCallId, payload.approved)
  })

  ipcMain.handle('agent:abort', async (_, targetId: string) => {
    return AgentRunner.abort(targetId)
  })
}
