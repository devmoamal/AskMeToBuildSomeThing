import { ManageTodosArgsSchema, type ManageTodosArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { dbQueries } from '../../db/queries'
import type { SessionTodoItem } from '../../../shared/types'

export const manageTodosTool: AgentTool<ManageTodosArgs> = {
  name: 'manage_todos',
  description: 'Create, update, or inspect a structured real-time task checklist for the current session. Use this tool during multi-step work to plan implementation stages, track progress, and communicate active execution state to the user.',
  parameters: ManageTodosArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['update', 'list'],
        description: 'Action to perform: "update" to replace/sync the task checklist, or "list" to view current tasks'
      },
      todos: {
        type: 'array',
        description: 'List of tasks for this session with their current status ("pending", "in_progress", "completed", "cancelled")',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier for this task' },
            content: { type: 'string', description: 'Clear, actionable description of the task' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed', 'cancelled'],
              description: 'Current status'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Priority level'
            }
          },
          required: ['content', 'status']
        }
      }
    },
    required: ['action']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: ManageTodosArgs, ctx: AgentToolContext) {
    const targetId = ctx.projectSessionId || ctx.chatId
    if (!targetId) {
      throw new Error('Target session identifier is missing from tool execution context.')
    }

    if (args.action === 'list') {
      const items = await dbQueries.getSessionTodos(targetId)
      return {
        todos: items,
        count: items.length,
        summary: formatTodosMarkdown(items)
      }
    }

    const itemsToSave = args.todos || []
    const saved = await dbQueries.saveSessionTodos(targetId, itemsToSave)

    return {
      success: true,
      count: saved.length,
      todos: saved,
      summary: formatTodosMarkdown(saved)
    }
  }
}

function formatTodosMarkdown(todos: SessionTodoItem[]): string {
  if (todos.length === 0) return 'No tasks currently scheduled in this session.'
  const completed = todos.filter(t => t.status === 'completed').length
  const inProgress = todos.filter(t => t.status === 'in_progress').length
  const pending = todos.filter(t => t.status === 'pending').length

  const lines = [
    `Session Task Progress: ${completed}/${todos.length} completed (${Math.round((completed / todos.length) * 100)}%)`,
    ''
  ]

  for (const t of todos) {
    let mark = '[ ]'
    if (t.status === 'completed') mark = '[x]'
    else if (t.status === 'in_progress') mark = '[>]'
    else if (t.status === 'cancelled') mark = '[-]'

    lines.push(`${mark} ${t.content}${t.priority === 'high' ? ' (high priority)' : ''}`)
  }

  return lines.join('\n')
}
