import { describe, it, expect, beforeEach } from 'bun:test'
import { ToolRegistry } from '../main/agent/tools/registry'
import { dbQueries } from '../main/db/queries'
import { initializeDatabase } from '../main/db/client'
import { AppSettingsSchema } from '../shared/schemas'

describe('Session Task List / Todos (OpenCode todowrite parity)', () => {
  beforeEach(() => {
    initializeDatabase(':memory:')
  })

  it('should find manage_todos in ToolRegistry and validate schema', () => {
    const tool = ToolRegistry.getToolByName('manage_todos')
    expect(tool).toBeDefined()
    expect(tool?.allowedModes).toContain('chat')
    expect(tool?.allowedModes).toContain('project')
  })

  it('should save, list, and format session todos', async () => {
    const tool = ToolRegistry.getToolByName('manage_todos')!
    const targetId = 'sess_test_123'
    const defaultSettings = AppSettingsSchema.parse({})

    const updateRes = await tool.execute(
      {
        action: 'update',
        todos: [
          { content: 'Research repo structure', status: 'completed', priority: 'high' },
          { content: 'Implement new UI components', status: 'in_progress', priority: 'medium' },
          { content: 'Run test verification', status: 'pending', priority: 'low' }
        ]
      },
      {
        mode: 'project',
        projectSessionId: targetId,
        settings: defaultSettings
      },
      'call_todo_1'
    )

    expect(updateRes.success).toBe(true)
    expect(updateRes.count).toBe(3)
    expect(updateRes.summary).toContain('1/3 completed')
    expect(updateRes.summary).toContain('[x] Research repo structure')
    expect(updateRes.summary).toContain('[>] Implement new UI components')
    expect(updateRes.summary).toContain('[ ] Run test verification')

    // Test list action
    const listRes = await tool.execute(
      { action: 'list' },
      { mode: 'project', projectSessionId: targetId, settings: defaultSettings },
      'call_todo_2'
    )
    expect(listRes.todos).toHaveLength(3)

    // Test direct db update
    const firstTodo = listRes.todos[0]
    await dbQueries.updateTodoStatus(firstTodo.id, 'completed')
    const fetched = await dbQueries.getSessionTodos(targetId)
    expect(fetched[0].status).toBe('completed')
  })
})
