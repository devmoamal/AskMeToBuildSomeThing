import { ipcMain } from 'electron'
import { dbQueries } from '../db/queries'

export function registerCanvasesIpc() {
  ipcMain.handle('canvases:save', async (_, canvas: {
    id: string
    title: string
    content: string
    language?: string
    chatId?: string
    projectSessionId?: string
  }) => {
    return dbQueries.saveCanvas(canvas)
  })
}
