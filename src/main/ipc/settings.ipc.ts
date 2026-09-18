import { ipcMain } from 'electron'
import { dbQueries } from '../db/queries'
import type { AppSettings } from '../../shared/schemas'

export function registerSettingsIpc() {
  ipcMain.handle('settings:get', async () => {
    return dbQueries.getSettings()
  })

  ipcMain.handle('settings:save', async (_, settings: Partial<AppSettings>) => {
    return dbQueries.saveSettings(settings)
  })
}
