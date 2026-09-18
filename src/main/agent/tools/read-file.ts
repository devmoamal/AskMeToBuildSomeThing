import fs from 'node:fs/promises'
import path from 'node:path'
import { ReadFileArgsSchema, type ReadFileArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

export const readFileTool: AgentTool<ReadFileArgs> = {
  name: 'read_file',
  description: 'Read the contents of a file from the project directory. Provide a path relative to the project root or absolute path.',
  parameters: ReadFileArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to read, relative to the project root or absolute'
      }
    },
    required: ['path']
  },
  allowedModes: ['project'],
  async execute(args: ReadFileArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot read file: No project folder selected')
    }

    const fullPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(ctx.projectFolder, args.path)

    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      const lines = content.split(/\r?\n/).length
      const stats = await fs.stat(fullPath)
      return {
        path: args.path,
        fullPath,
        content,
        lines,
        size: stats.size,
        success: true
      }
    } catch (err: any) {
      throw new Error(`Failed to read file ${args.path}: ${err.message}`)
    }
  }
}
