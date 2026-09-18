import { ipcMain, dialog } from 'electron'
import { dbQueries } from '../db/queries'

export function registerProjectsIpc() {
  ipcMain.handle('projects:getAll', async () => {
    return dbQueries.getProjects()
  })

  ipcMain.handle('projects:save', async (_, project: { id: string; name: string; folderPath: string }) => {
    return dbQueries.saveProject(project)
  })

  ipcMain.handle('projects:delete', async (_, id: string) => {
    return dbQueries.deleteProject(id)
  })

  ipcMain.handle('projects:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('projects:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths
    }
    return null
  })

  ipcMain.handle('projects:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths
    }
    return null
  })

  ipcMain.handle('projects:readFile', async (_, filePath: string) => {
    const fs = await import('node:fs/promises')
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch (err: any) {
      return `[Error reading file: ${err.message}]`
    }
  })

  ipcMain.handle('projects:getSessions', async (_, projectId: string) => {
    return dbQueries.getProjectSessions(projectId)
  })

  ipcMain.handle('projects:saveSession', async (_, session: { id: string; projectId: string; title: string }) => {
    return dbQueries.saveProjectSession(session)
  })

  ipcMain.handle('projects:deleteSession', async (_, id: string) => {
    return dbQueries.deleteProjectSession(id)
  })

  ipcMain.handle('projects:getMessages', async (_, sessionId: string) => {
    return dbQueries.getMessages(sessionId, true)
  })

  ipcMain.handle('projects:getCanvases', async (_, sessionId: string) => {
    return dbQueries.getCanvases(sessionId, true)
  })
}
