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
  parts: text('parts'), // JSON array of MessagePart
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

export const scheduledTasksTable = sqliteTable('scheduled_tasks', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull(),
  mode: text('mode').notNull().default('chat'), // 'chat' | 'project'
  type: text('type').notNull().default('command'), // 'command' | 'prompt' | 'reminder'
  command: text('command'),
  prompt: text('prompt'),
  description: text('description').notNull(),
  delaySeconds: integer('delay_seconds').notNull().default(0),
  scheduledAt: integer('scheduled_at').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result: text('result'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at')
})

export const projectMemoriesTable = sqliteTable('project_memories', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  key: text('key').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull().default('architecture'),
  updatedAt: integer('updated_at').notNull()
})

export const sessionTodosTable = sqliteTable('session_todos', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: text('priority').notNull().default('medium'), // 'high' | 'medium' | 'low'
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})
