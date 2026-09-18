import { ipcMain } from 'electron'
import { dbQueries } from '../db/queries'
import { ProviderAdapterFactory } from '../agent/providers/factory'
import type { ProviderConfig } from '../../shared/schemas'

export function registerProvidersIpc() {
  ipcMain.handle('providers:getAll', async () => {
    return dbQueries.getProviders()
  })

  ipcMain.handle('providers:getById', async (_, id: string) => {
    return dbQueries.getProviderById(id)
  })

  ipcMain.handle('providers:getDefault', async () => {
    return dbQueries.getDefaultProvider()
  })

  ipcMain.handle('providers:save', async (_, provider: ProviderConfig) => {
    return dbQueries.saveProvider(provider)
  })

  ipcMain.handle('providers:delete', async (_, id: string) => {
    return dbQueries.deleteProvider(id)
  })

  ipcMain.handle('providers:testConnection', async (_, config: ProviderConfig) => {
    return ProviderAdapterFactory.testConnection(config)
  })

  ipcMain.handle('providers:fetchModels', async (_, config: ProviderConfig) => {
    return ProviderAdapterFactory.fetchModels(config)
  })
}
