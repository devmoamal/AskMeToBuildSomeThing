import fs from 'node:fs/promises'
import path from 'node:path'
import { CreateFileArgsSchema, type CreateFileArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

export const createFileTool: AgentTool<CreateFileArgs> = {
  name: 'create_file',
  description: 'Create or update a file in the project directory. Automatically creates parent directories if needed.',
  parameters: CreateFileArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The relative or absolute file path to create or overwrite in the project'
      },
      content: {
        type: 'string',
        description: 'The full text or source code content to write into the file'
      }
    },
    required: ['path', 'content']
  },
  allowedModes: ['project'],
  async execute(args: CreateFileArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot create file: No project folder selected')
    }

    const fullPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(ctx.projectFolder, args.path)

    // Check approval if auto-approve is false
    if (!ctx.settings.autoApproveFileWrite && ctx.requireToolApproval) {
      const approved = await ctx.requireToolApproval('create_file', { path: args.path, content: args.content })
      if (!approved) {
        throw new Error(`File write for ${args.path} was rejected by user.`)
      }
    }

    try {
      let existed = false
      try {
        await fs.access(fullPath)
        existed = true
      } catch {}

      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, args.content, 'utf-8')

      const lines = args.content.split(/\r?\n/).length
      const stats = await fs.stat(fullPath)

      return {
        path: args.path,
        fullPath,
        lines,
        size: stats.size,
        overwritten: existed,
        success: true
      }
    } catch (err: any) {
      throw new Error(`Failed to create file ${args.path}: ${err.message}`)
    }
  }
}
