import { ipcMain, type BrowserWindow } from 'electron'
import { dbQueries } from '../db/queries'
import { SchedulerManager } from '../scheduler/scheduler'
import type { ScheduledTask, ProjectMemory } from '../../shared/types'

export function registerSchedulerIpc(mainWindow: BrowserWindow) {
  // Listen for completed background tasks and notify renderer window
  SchedulerManager.onTaskCompleted((task: ScheduledTask) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scheduler:task_completed', task)
    }
  })

  ipcMain.handle('scheduler:getAll', async (_, targetId?: string) => {
    return await dbQueries.getScheduledTasks(targetId)
  })

  ipcMain.handle('scheduler:schedule', async (_, params) => {
    return await SchedulerManager.scheduleTask(params)
  })

  ipcMain.handle('scheduler:cancel', async (_, id: string) => {
    return await SchedulerManager.cancelTask(id)
  })

  ipcMain.handle('scheduler:delete', async (_, id: string) => {
    await SchedulerManager.cancelTask(id)
    await dbQueries.deleteScheduledTask(id)
    return true
  })

  // Project memories IPC
  ipcMain.handle('memory:getProjectMemories', async (_, projectId: string) => {
    return await dbQueries.getProjectMemories(projectId)
  })

  ipcMain.handle('memory:saveProjectMemory', async (_, memory: ProjectMemory) => {
    return await dbQueries.saveProjectMemory(memory)
  })

  ipcMain.handle('memory:deleteProjectMemory', async (_, id: string) => {
    await dbQueries.deleteProjectMemory(id)
    return true
  })
}
