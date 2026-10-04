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

  // --- Real-time Workspace File Tree Explorer ---
  ipcMain.handle('projects:getDirectoryTree', async (_, folderPath: string) => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    const IGNORED = new Set([
      '.git',
      'node_modules',
      'dist',
      'dist-electron',
      'dist-release',
      '.data',
      '.turbo',
      '.next',
      '.nuxt',
      '.cache',
      'coverage',
      'build'
    ])

    async function buildTree(dir: string, currentDepth: number, maxDepth = 4): Promise<any[]> {
      if (currentDepth > maxDepth) return []
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const results: any[] = []

        for (const entry of entries) {
          if (IGNORED.has(entry.name)) continue
          const fullPath = path.join(dir, entry.name)
          const relPath = path.relative(folderPath, fullPath).replace(/\\/g, '/')
          const isDir = entry.isDirectory()

          if (isDir) {
            const children = currentDepth < maxDepth ? await buildTree(fullPath, currentDepth + 1, maxDepth) : []
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              isDirectory: true,
              children
            })
          } else {
            const ext = path.extname(entry.name).toLowerCase().replace('.', '')
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              isDirectory: false,
              extension: ext
            })
          }
        }

        // Sort: directories first, then alphabetical
        return results.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
      } catch (err) {
        return []
      }
    }

    return buildTree(folderPath, 0, 4)
  })

  // --- Real-time Git Status & Branch Tracking ---
  ipcMain.handle('projects:getGitStatus', async (_, folderPath: string) => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    try {
      const [statusRes, branchRes] = await Promise.all([
        execFileAsync('git', ['status', '--porcelain=v1'], { cwd: folderPath }).catch(() => ({ stdout: '' })),
        execFileAsync('git', ['branch', '--show-current'], { cwd: folderPath }).catch(() => ({ stdout: '' }))
      ])

      const branch = branchRes.stdout.trim() || 'unknown'
      const lines = statusRes.stdout.trim().split('\n').filter(Boolean)
      const files: Array<{ path: string; status: string; staged?: boolean }> = []

      for (const line of lines) {
        const x = line[0]
        const y = line[1]
        const filePath = line.substring(3).trim()
        let status = 'modified'
        const staged = x !== ' ' && x !== '?'

        if (x === '?' || y === '?') status = 'untracked'
        else if (x === 'A' || y === 'A') status = 'added'
        else if (x === 'D' || y === 'D') status = 'deleted'
        else if (x === 'R' || y === 'R') status = 'renamed'
        else status = 'modified'

        files.push({ path: filePath, status, staged })
      }

      return {
        branch,
        files,
        clean: files.length === 0
      }
    } catch {
      return {
        branch: 'unknown',
        files: [],
        clean: true
      }
    }
  })

  // --- Unified Git Diff Review ---
  ipcMain.handle('projects:getGitDiff', async (_, { folderPath, filePath }: { folderPath: string; filePath?: string }) => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)

    try {
      const args = ['diff', 'HEAD']
      if (filePath) args.push('--', filePath)
      const res = await execFileAsync('git', args, { cwd: folderPath, maxBuffer: 10 * 1024 * 1024 })
      return {
        diff: res.stdout,
        success: true
      }
    } catch {
      // Fallback to simple git diff without HEAD if initial commit doesn't exist
      try {
        const args = ['diff']
        if (filePath) args.push('--', filePath)
        const res = await execFileAsync('git', args, { cwd: folderPath, maxBuffer: 10 * 1024 * 1024 })
        return {
          diff: res.stdout,
          success: true
        }
      } catch (err: any) {
        return {
          diff: '',
          error: err.message || 'Failed to get git diff',
          success: false
        }
      }
    }
  })

  // --- Session Tasks / Todos IPC ---
  ipcMain.handle('todos:getBySession', async (_, sessionId: string) => {
    return dbQueries.getSessionTodos(sessionId)
  })

  ipcMain.handle('todos:save', async (_, { sessionId, todos }: { sessionId: string; todos: any[] }) => {
    return dbQueries.saveSessionTodos(sessionId, todos)
  })

  ipcMain.handle('todos:updateStatus', async (_, { id, status }: { id: string; status: any }) => {
    await dbQueries.updateTodoStatus(id, status)
    return { success: true }
  })
}

