import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from './schema'

let rawDbInstance: DatabaseSync | null = null
let dbInstance: ReturnType<typeof createDrizzleProxy> | null = null

function getDatabasePath(): string {
  if (process.env.TEST_DB_PATH) {
    return process.env.TEST_DB_PATH
  }
  
  if (process.env.NODE_ENV === 'test') {
    return ':memory:'
  }

  try {
    // Attempt to resolve Electron app userData path if in Electron environment
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      const userDataDir = app.getPath('userData')
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true })
      }
      return path.join(userDataDir, 'askmetobuildsomething.sqlite')
    }
  } catch {
    // Not running inside Electron main process
  }

  const localDir = path.resolve(process.cwd(), '.data')
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true })
  }
  return path.join(localDir, 'askmetobuildsomething.sqlite')
}

export function initializeDatabase(customPath?: string) {
  const dbPath = customPath || getDatabasePath()
  const rawDb = new DatabaseSync(dbPath)
  rawDbInstance = rawDb

  // Enable WAL mode for performance and safety
  if (dbPath !== ':memory:') {
    rawDb.exec('PRAGMA journal_mode = WAL;')
    rawDb.exec('PRAGMA foreign_keys = ON;')
  }

  // Auto-create tables if they do not exist
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      models TEXT NOT NULL DEFAULT '[]',
      default_model TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_collapsed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      project_session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      parts TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (project_session_id) REFERENCES project_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      chat_id TEXT,
      project_session_id TEXT,
      title TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'markdown',
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (project_session_id) REFERENCES project_sessions(id) ON DELETE CASCADE
    );
  `)

  // Migration check: ensure messages table has correct snake_case columns & parts
  try {
    const tableInfo = rawDb.prepare("PRAGMA table_info('messages')").all() as Array<{ name: string }>
    const colNames = tableInfo.map(c => c.name)
    if (colNames.includes('chatId') && !colNames.includes('chat_id')) {
      rawDb.exec('ALTER TABLE messages RENAME COLUMN chatId TO chat_id;')
    }
    if (colNames.includes('projectSessionId') && !colNames.includes('project_session_id')) {
      rawDb.exec('ALTER TABLE messages RENAME COLUMN projectSessionId TO project_session_id;')
    }
    if (!colNames.includes('parts')) {
      rawDb.exec('ALTER TABLE messages ADD COLUMN parts TEXT;')
    }
  } catch (err) {
    console.error('Migration error for messages table:', err)
  }

  dbInstance = createDrizzleProxy(rawDb)
  return { db: dbInstance, rawDb }
}

function createDrizzleProxy(rawDb: DatabaseSync) {
  return drizzle(
    async (sql, params, method) => {
      try {
        if (method === 'all') {
          const stmt = rawDb.prepare(sql)
          const rows = stmt.all(...params)
          return { rows: rows.map(r => Object.values(r as Record<string, any>)) }
        } else if (method === 'get') {
          const stmt = rawDb.prepare(sql)
          const row = stmt.get(...params)
          return { rows: row ? Object.values(row as Record<string, any>) : [] }
        } else {
          const stmt = rawDb.prepare(sql)
          stmt.run(...params)
          return { rows: [] }
        }
      } catch (e: any) {
        console.error('Database query error on SQL:', sql, params, e)
        throw e
      }
    },
    { schema }
  )
}

export function getDb() {
  if (!dbInstance) {
    initializeDatabase()
  }
  return dbInstance!
}

export function getRawDb() {
  if (!rawDbInstance) {
    initializeDatabase()
  }
  return rawDbInstance!
}
