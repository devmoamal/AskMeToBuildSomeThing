import { eq, desc, asc, inArray } from 'drizzle-orm'
import { getDb } from './client'
import {
  providersTable,
  settingsTable,
  chatGroupsTable,
  chatsTable,
  projectsTable,
  projectSessionsTable,
  messagesTable,
  canvasesTable
} from './schema'
import type {
  ProviderConfig,
  AppSettings,
  ChatGroup,
  Chat,
  Project,
  ProjectSession,
  Message,
  CanvasDocument
} from '../../shared/types'
import { AppSettingsSchema } from '../../shared/schemas'

export const dbQueries = {
  // --- Providers ---
  async getProviders(): Promise<ProviderConfig[]> {
    const db = getDb()
    const rows = await db.select().from(providersTable).orderBy(desc(providersTable.createdAt))
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type as 'openai' | 'anthropic',
      baseUrl: r.baseUrl,
      apiKey: r.apiKey,
      models: JSON.parse(r.models || '[]'),
      defaultModel: r.defaultModel ?? undefined,
      isDefault: Boolean(r.isDefault),
      createdAt: r.createdAt
    }))
  },

  async getProviderById(id: string): Promise<ProviderConfig | null> {
    const db = getDb()
    const rows = await db.select().from(providersTable).where(eq(providersTable.id, id))
    if (!rows[0]) return null
    const r = rows[0]
    return {
      id: r.id,
      name: r.name,
      type: r.type as 'openai' | 'anthropic',
      baseUrl: r.baseUrl,
      apiKey: r.apiKey,
      models: JSON.parse(r.models || '[]'),
      defaultModel: r.defaultModel ?? undefined,
      isDefault: Boolean(r.isDefault),
      createdAt: r.createdAt
    }
  },

  async getDefaultProvider(): Promise<ProviderConfig | null> {
    const db = getDb()
    const rows = await db.select().from(providersTable).where(eq(providersTable.isDefault, true))
    if (rows[0]) {
      const r = rows[0]
      return {
        id: r.id,
        name: r.name,
        type: r.type as 'openai' | 'anthropic',
        baseUrl: r.baseUrl,
        apiKey: r.apiKey,
        models: JSON.parse(r.models || '[]'),
        defaultModel: r.defaultModel ?? undefined,
        isDefault: true,
        createdAt: r.createdAt
      }
    }
    const all = await this.getProviders()
    return all[0] || null
  },

  async saveProvider(provider: ProviderConfig): Promise<void> {
    const db = getDb()
    if (provider.isDefault) {
      await db.update(providersTable).set({ isDefault: false })
    }
    const existing = await this.getProviderById(provider.id)
    if (existing) {
      await db.update(providersTable)
        .set({
          name: provider.name,
          type: provider.type,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          models: JSON.stringify(provider.models),
          defaultModel: provider.defaultModel || null,
          isDefault: provider.isDefault
        })
        .where(eq(providersTable.id, provider.id))
    } else {
      await db.insert(providersTable).values({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        models: JSON.stringify(provider.models),
        defaultModel: provider.defaultModel || null,
        isDefault: provider.isDefault,
        createdAt: provider.createdAt || Date.now()
      })
    }
  },

  async deleteProvider(id: string): Promise<void> {
    const db = getDb()
    await db.delete(providersTable).where(eq(providersTable.id, id))
  },

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    const db = getDb()
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, 'app_settings'))
    if (!rows[0]) {
      const defaults = AppSettingsSchema.parse({})
      await db.insert(settingsTable).values({
        key: 'app_settings',
        value: JSON.stringify(defaults)
      })
      return defaults
    }
    try {
      return AppSettingsSchema.parse(JSON.parse(rows[0].value))
    } catch {
      return AppSettingsSchema.parse({})
    }
  },

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const db = getDb()
    const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, 'app_settings'))
    let current = AppSettingsSchema.parse({})
    if (rows[0]) {
      try {
        current = AppSettingsSchema.parse(JSON.parse(rows[0].value))
      } catch {}
    }
    const updated = AppSettingsSchema.parse({ ...current, ...settings })
    if (rows.length > 0) {
      await db.update(settingsTable)
        .set({ value: JSON.stringify(updated) })
        .where(eq(settingsTable.key, 'app_settings'))
    } else {
      await db.insert(settingsTable).values({
        key: 'app_settings',
        value: JSON.stringify(updated)
      })
    }
    return updated
  },

  // --- Chat Groups ---
  async getChatGroups(): Promise<ChatGroup[]> {
    const db = getDb()
    const rows = await db.select().from(chatGroupsTable).orderBy(asc(chatGroupsTable.orderIndex))
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      orderIndex: r.orderIndex,
      isCollapsed: Boolean(r.isCollapsed),
      createdAt: r.createdAt
    }))
  },

  async saveChatGroup(group: { id: string; name: string; orderIndex?: number; isCollapsed?: boolean }): Promise<void> {
    const db = getDb()
    const rows = await db.select().from(chatGroupsTable).where(eq(chatGroupsTable.id, group.id))
    if (rows[0]) {
      await db.update(chatGroupsTable)
        .set({
          name: group.name,
          orderIndex: group.orderIndex ?? rows[0].orderIndex,
          isCollapsed: group.isCollapsed ?? rows[0].isCollapsed
        })
        .where(eq(chatGroupsTable.id, group.id))
    } else {
      await db.insert(chatGroupsTable).values({
        id: group.id,
        name: group.name,
        orderIndex: group.orderIndex ?? 0,
        isCollapsed: group.isCollapsed ?? false,
        createdAt: Date.now()
      })
    }
  },

  async deleteChatGroup(id: string): Promise<void> {
    const db = getDb()
    await db.delete(chatGroupsTable).where(eq(chatGroupsTable.id, id))
  },

  // --- Chats ---
  async getChats(): Promise<Chat[]> {
    const db = getDb()
    const rows = await db.select().from(chatsTable).orderBy(desc(chatsTable.updatedAt))
    return rows.map(r => ({
      id: r.id,
      groupId: r.groupId,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  },

  async saveChat(chat: { id: string; title: string; groupId?: string | null }): Promise<Chat> {
    const db = getDb()
    const now = Date.now()
    const existing = await db.select().from(chatsTable).where(eq(chatsTable.id, chat.id))
    if (existing[0]) {
      await db.update(chatsTable)
        .set({
          title: chat.title,
          groupId: chat.groupId !== undefined ? chat.groupId : existing[0].groupId,
          updatedAt: now
        })
        .where(eq(chatsTable.id, chat.id))
      return {
        id: chat.id,
        title: chat.title,
        groupId: chat.groupId !== undefined ? chat.groupId : existing[0].groupId,
        createdAt: existing[0].createdAt,
        updatedAt: now
      }
    } else {
      await db.insert(chatsTable).values({
        id: chat.id,
        title: chat.title,
        groupId: chat.groupId || null,
        createdAt: now,
        updatedAt: now
      })
      return {
        id: chat.id,
        title: chat.title,
        groupId: chat.groupId || null,
        createdAt: now,
        updatedAt: now
      }
    }
  },

  async deleteChat(id: string): Promise<void> {
    const db = getDb()
    await db.delete(chatsTable).where(eq(chatsTable.id, id))
  },

  // --- Projects ---
  async getProjects(): Promise<Project[]> {
    const db = getDb()
    const rows = await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt))
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      folderPath: r.folderPath,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  },

  async saveProject(project: { id: string; name: string; folderPath: string }): Promise<Project> {
    const db = getDb()
    const now = Date.now()
    const existing = await db.select().from(projectsTable).where(eq(projectsTable.id, project.id))
    if (existing[0]) {
      await db.update(projectsTable)
        .set({
          name: project.name,
          folderPath: project.folderPath,
          updatedAt: now
        })
        .where(eq(projectsTable.id, project.id))
      return { ...project, createdAt: existing[0].createdAt, updatedAt: now }
    } else {
      await db.insert(projectsTable).values({
        id: project.id,
        name: project.name,
        folderPath: project.folderPath,
        createdAt: now,
        updatedAt: now
      })
      return { ...project, createdAt: now, updatedAt: now }
    }
  },

  async deleteProject(id: string): Promise<void> {
    const db = getDb()
    await db.delete(projectsTable).where(eq(projectsTable.id, id))
  },

  // --- Project Sessions ---
  async getProjectSessions(projectId: string): Promise<ProjectSession[]> {
    const db = getDb()
    const rows = await db.select().from(projectSessionsTable)
      .where(eq(projectSessionsTable.projectId, projectId))
      .orderBy(desc(projectSessionsTable.updatedAt))
    return rows.map(r => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  },

  async saveProjectSession(session: { id: string; projectId?: string; title: string }): Promise<ProjectSession> {
    const db = getDb()
    const now = Date.now()
    const existing = await db.select().from(projectSessionsTable).where(eq(projectSessionsTable.id, session.id))
    if (existing[0]) {
      await db.update(projectSessionsTable)
        .set({ title: session.title, updatedAt: now })
        .where(eq(projectSessionsTable.id, session.id))
      return {
        id: session.id,
        projectId: existing[0].projectId,
        title: session.title,
        createdAt: existing[0].createdAt,
        updatedAt: now
      }
    } else {
      if (!session.projectId) {
        throw new Error('projectId is required when creating a new session')
      }
      await db.insert(projectSessionsTable).values({
        id: session.id,
        projectId: session.projectId,
        title: session.title,
        createdAt: now,
        updatedAt: now
      })
      return {
        id: session.id,
        projectId: session.projectId,
        title: session.title,
        createdAt: now,
        updatedAt: now
      }
    }
  },

  async deleteProjectSession(id: string): Promise<void> {
    const db = getDb()
    await db.delete(projectSessionsTable).where(eq(projectSessionsTable.id, id))
  },

  // --- Messages ---
  async getMessages(targetId: string, isProjectSession = false): Promise<Message[]> {
    const db = getDb()
    const query = isProjectSession
      ? db.select().from(messagesTable).where(eq(messagesTable.projectSessionId, targetId)).orderBy(asc(messagesTable.createdAt))
      : db.select().from(messagesTable).where(eq(messagesTable.chatId, targetId)).orderBy(asc(messagesTable.createdAt))
    const rows = await query
    return rows.map(r => ({
      id: r.id,
      chatId: r.chatId || undefined,
      projectSessionId: r.projectSessionId || undefined,
      role: r.role as any,
      content: r.content,
      toolCalls: r.toolCalls ? JSON.parse(r.toolCalls) : undefined,
      parts: r.parts ? JSON.parse(r.parts) : undefined,
      createdAt: r.createdAt
    }))
  },

  async saveMessage(msg: Message): Promise<void> {
    const db = getDb()
    const existing = await db.select().from(messagesTable).where(eq(messagesTable.id, msg.id))
    if (existing[0]) {
      await db.update(messagesTable)
        .set({
          content: msg.content,
          toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          parts: msg.parts ? JSON.stringify(msg.parts) : null
        })
        .where(eq(messagesTable.id, msg.id))
    } else {
      await db.insert(messagesTable).values({
        id: msg.id,
        chatId: msg.chatId || null,
        projectSessionId: msg.projectSessionId || null,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        parts: msg.parts ? JSON.stringify(msg.parts) : null,
        createdAt: msg.createdAt || Date.now()
      })
    }
  },

  async deleteMessage(id: string): Promise<void> {
    const db = getDb()
    await db.delete(messagesTable).where(eq(messagesTable.id, id))
  },

  async rollbackToMessage({
    targetId,
    messageId,
    isProjectSession = false,
    deleteTargetMessage = false
  }: {
    targetId: string
    messageId: string
    isProjectSession?: boolean
    deleteTargetMessage?: boolean
  }): Promise<{ deletedMessageIds: string[]; remainingMessages: Message[] }> {
    const db = getDb()

    // 1. Fetch all messages in the thread ordered chronologically
    const allMessages = await dbQueries.getMessages(targetId, isProjectSession)
    const targetIndex = allMessages.findIndex(m => m.id === messageId)

    if (targetIndex === -1) {
      throw new Error(`Target message ${messageId} not found in thread ${targetId}`)
    }

    const targetMessage = allMessages[targetIndex]
    const messagesToDelete = deleteTargetMessage
      ? allMessages.slice(targetIndex)
      : allMessages.slice(targetIndex + 1)

    const deletedMessageIds = messagesToDelete.map(m => m.id)

    if (deletedMessageIds.length > 0) {
      // Delete messages
      await db.delete(messagesTable).where(inArray(messagesTable.id, deletedMessageIds))

      // Delete canvases created after or linked to deleted messages
      const allCanvases = await dbQueries.getCanvases(targetId, isProjectSession)
      const targetTime = targetMessage.createdAt
      const canvasesToDelete = allCanvases.filter(c =>
        (deleteTargetMessage ? c.createdAt >= targetTime : c.createdAt > targetTime) ||
        (c.messageId && deletedMessageIds.includes(c.messageId))
      )

      if (canvasesToDelete.length > 0) {
        await db.delete(canvasesTable).where(inArray(canvasesTable.id, canvasesToDelete.map(c => c.id)))
      }
    }

    const remaining = await dbQueries.getMessages(targetId, isProjectSession)
    return { deletedMessageIds, remainingMessages: remaining }
  },

  // --- Canvases ---
  async getCanvases(targetId: string, isProjectSession = false): Promise<CanvasDocument[]> {
    const db = getDb()
    const query = isProjectSession
      ? db.select().from(canvasesTable).where(eq(canvasesTable.projectSessionId, targetId)).orderBy(desc(canvasesTable.updatedAt))
      : db.select().from(canvasesTable).where(eq(canvasesTable.chatId, targetId)).orderBy(desc(canvasesTable.updatedAt))
    const rows = await query
    return rows.map(r => ({
      id: r.id,
      messageId: r.messageId || undefined,
      chatId: r.chatId || undefined,
      projectSessionId: r.projectSessionId || undefined,
      title: r.title,
      language: r.language,
      content: r.content,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  },

  async saveCanvas(canvas: {
    id: string
    chatId?: string
    projectSessionId?: string
    messageId?: string
    title: string
    language?: string
    content: string
  }): Promise<CanvasDocument> {
    const db = getDb()
    const now = Date.now()
    const existing = await db.select().from(canvasesTable).where(eq(canvasesTable.id, canvas.id))
    if (existing[0]) {
      const nextVersion = existing[0].version + 1
      await db.update(canvasesTable)
        .set({
          title: canvas.title,
          language: canvas.language || existing[0].language,
          content: canvas.content,
          version: nextVersion,
          updatedAt: now
        })
        .where(eq(canvasesTable.id, canvas.id))
      return {
        id: canvas.id,
        messageId: canvas.messageId || existing[0].messageId || undefined,
        chatId: canvas.chatId || existing[0].chatId || undefined,
        projectSessionId: canvas.projectSessionId || existing[0].projectSessionId || undefined,
        title: canvas.title,
        language: canvas.language || existing[0].language,
        content: canvas.content,
        version: nextVersion,
        createdAt: existing[0].createdAt,
        updatedAt: now
      }
    } else {
      await db.insert(canvasesTable).values({
        id: canvas.id,
        chatId: canvas.chatId || null,
        projectSessionId: canvas.projectSessionId || null,
        messageId: canvas.messageId || null,
        title: canvas.title,
        language: canvas.language || 'markdown',
        content: canvas.content,
        version: 1,
        createdAt: now,
        updatedAt: now
      })
      return {
        id: canvas.id,
        messageId: canvas.messageId,
        chatId: canvas.chatId,
        projectSessionId: canvas.projectSessionId,
        title: canvas.title,
        language: canvas.language || 'markdown',
        content: canvas.content,
        version: 1,
        createdAt: now,
        updatedAt: now
      }
    }
  }
}
