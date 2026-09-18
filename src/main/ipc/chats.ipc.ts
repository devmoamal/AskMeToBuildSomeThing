import { ipcMain } from 'electron'
import { dbQueries } from '../db/queries'

export function registerChatsIpc() {
  ipcMain.handle('chats:getAll', async () => {
    return dbQueries.getChats()
  })

  ipcMain.handle('chats:save', async (_, chat: { id: string; title: string; groupId?: string | null }) => {
    return dbQueries.saveChat(chat)
  })

  ipcMain.handle('chats:delete', async (_, id: string) => {
    return dbQueries.deleteChat(id)
  })

  ipcMain.handle('chats:getGroups', async () => {
    return dbQueries.getChatGroups()
  })

  ipcMain.handle('chats:saveGroup', async (_, group: { id: string; name: string; orderIndex?: number; isCollapsed?: boolean }) => {
    return dbQueries.saveChatGroup(group)
  })

  ipcMain.handle('chats:deleteGroup', async (_, id: string) => {
    return dbQueries.deleteChatGroup(id)
  })

  ipcMain.handle('chats:getMessages', async (_, chatId: string) => {
    return dbQueries.getMessages(chatId, false)
  })

  ipcMain.handle('chats:getCanvases', async (_, chatId: string) => {
    return dbQueries.getCanvases(chatId, false)
  })

  ipcMain.handle('chats:rollback', async (_, payload: { chatId: string; messageId: string; deleteTargetMessage?: boolean }) => {
    return dbQueries.rollbackToMessage({
      targetId: payload.chatId,
      messageId: payload.messageId,
      isProjectSession: false,
      deleteTargetMessage: payload.deleteTargetMessage
    })
  })
}
