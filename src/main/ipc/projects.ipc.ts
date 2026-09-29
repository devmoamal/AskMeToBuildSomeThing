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

  ipcMain.handle('projects:readImageAsBase64', async (_, filePath: string) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    try {
      const buf = await fs.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      let mimeType = 'image/jpeg'
      if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'webp') mimeType = 'image/webp'
      else if (ext === 'gif') mimeType = 'image/gif'
      else if (ext === 'svg') mimeType = 'image/svg+xml'
      return {
        mediaType: mimeType,
        base64: buf.toString('base64'),
        dataUrl: `data:${mimeType};base64,${buf.toString('base64')}`
      }
    } catch (err: any) {
      throw new Error(`Failed to read image: ${err.message}`)
    }
  })

  ipcMain.handle('projects:readFile', async (_, filePath: string) => {
    const fs = await import('node:fs/promises')
    try {
      const { DocumentConverter } = await import('../agent/doc-converter')
      if (DocumentConverter.isConvertibleDocument(filePath)) {
        const docRes = await DocumentConverter.convertToMarkdown(filePath)
        return docRes.markdown
      }
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

  ipcMain.handle('projects:rollback', async (_, payload: { sessionId: string; messageId: string; deleteTargetMessage?: boolean }) => {
    return dbQueries.rollbackToMessage({
      targetId: payload.sessionId,
      messageId: payload.messageId,
      isProjectSession: true,
      deleteTargetMessage: payload.deleteTargetMessage
    })
  })

  ipcMain.handle('projects:saveFile', async (_, { filePath, content }: { filePath: string; content: string }) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true, filePath }
  })
}
