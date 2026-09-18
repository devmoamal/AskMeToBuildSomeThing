import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const providersTable = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'openai' | 'anthropic'
  baseUrl: text('base_url').notNull(),
  apiKey: text('api_key').notNull(),
  models: text('models').notNull().default('[]'), // JSON string array
  defaultModel: text('default_model'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull()
})

export const settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull() // JSON string
})

export const chatGroupsTable = sqliteTable('chat_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  isCollapsed: integer('is_collapsed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull()
})

export const chatsTable = sqliteTable('chats', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => chatGroupsTable.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const projectsTable = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  folderPath: text('folder_path').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const projectSessionsTable = sqliteTable('project_sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

export const messagesTable = sqliteTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').references(() => chatsTable.id, { onDelete: 'cascade' }),
  projectSessionId: text('project_session_id').references(() => projectSessionsTable.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  toolCalls: text('tool_calls'), // JSON array of ToolCallRecord
  createdAt: integer('created_at').notNull()
})

export const canvasesTable = sqliteTable('canvases', {
  id: text('id').primaryKey(),
  messageId: text('message_id'),
  chatId: text('chat_id').references(() => chatsTable.id, { onDelete: 'cascade' }),
  projectSessionId: text('project_session_id').references(() => projectSessionsTable.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  language: text('language').notNull().default('markdown'),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})
