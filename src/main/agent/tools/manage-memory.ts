import { ManageMemoryArgsSchema, type ManageMemoryArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { dbQueries } from '../../db/queries'

export const manageMemoryTool: AgentTool<ManageMemoryArgs> = {
  name: 'manage_memory',
  description: 'Store, list, or delete persistent architectural rules, conventions, and key decisions for the current project across sessions.',
  parameters: ManageMemoryArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['save', 'list', 'delete'],
        description: 'Action to perform: "save", "list", or "delete"'
      },
      key: {
        type: 'string',
        description: 'Unique memory identifier or title (e.g. "auth_design", "state_management")'
      },
      content: {
        type: 'string',
        description: 'The architectural rule or convention to remember'
      },
      category: {
        type: 'string',
        enum: ['architecture', 'decision', 'convention', 'dependency', 'general'],
        description: 'Category for this memory'
      },
      id: {
        type: 'string',
        description: 'Memory ID (for deletion)'
      }
    },
    required: ['action']
  },
  allowedModes: ['project'],
  async execute(args: ManageMemoryArgs, ctx: AgentToolContext) {
    let projectId: string | undefined
    if (ctx.projectSessionId) {
      const session = await dbQueries.getProjectSessionById(ctx.projectSessionId)
      if (session) projectId = session.projectId
    }
    if (!projectId && ctx.projectFolder) {
      const projects = await dbQueries.getProjects()
      const match = projects.find(p => p.folderPath === ctx.projectFolder)
      if (match) projectId = match.id
    }

    if (!projectId) {
      throw new Error('Could not identify the active project for this session.')
    }

    if (args.action === 'list') {
      const memories = await dbQueries.getProjectMemories(projectId)
      if (memories.length === 0) {
        return {
          memories: [],
          message: 'No persistent project memories recorded yet.'
        }
      }
      return {
        count: memories.length,
        memories: memories.map(m => ({
          id: m.id,
          key: m.key,
          category: m.category,
          content: m.content,
          updatedAt: new Date(m.updatedAt).toISOString()
        }))
      }
    }

    if (args.action === 'save') {
      if (!args.key || !args.content) {
        throw new Error('Both "key" and "content" are required to save a project memory.')
      }

      // Check if memory with key already exists to update it
      const existingList = await dbQueries.getProjectMemories(projectId)
      const existing = existingList.find(m => m.key.toLowerCase() === args.key!.toLowerCase())

      const memoryId = existing ? existing.id : `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const memory = await dbQueries.saveProjectMemory({
        id: memoryId,
        projectId,
        key: args.key,
        content: args.content,
        category: args.category || 'architecture',
        updatedAt: Date.now()
      })

      return {
        status: existing ? 'updated' : 'created',
        memory: {
          id: memory.id,
          key: memory.key,
          category: memory.category,
          content: memory.content
        },
        message: `Persistent project memory "${memory.key}" saved successfully.`
      }
    }

    if (args.action === 'delete') {
      if (!args.id && !args.key) {
        throw new Error('Either "id" or "key" must be provided to delete a project memory.')
      }

      let targetId = args.id
      if (!targetId && args.key) {
        const existingList = await dbQueries.getProjectMemories(projectId)
        const match = existingList.find(m => m.key.toLowerCase() === args.key!.toLowerCase())
        if (match) targetId = match.id
      }

      if (!targetId) {
        return {
          status: 'not_found',
          message: `Memory with key "${args.key}" not found.`
        }
      }

      await dbQueries.deleteProjectMemory(targetId)
      return {
        status: 'deleted',
        id: targetId,
        message: 'Persistent memory deleted successfully.'
      }
    }

    throw new Error(`Unknown action: ${args.action}`)
  }
}
