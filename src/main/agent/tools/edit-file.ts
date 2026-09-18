import fs from 'node:fs/promises'
import path from 'node:path'
import { EditFileArgsSchema, type EditFileArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

function computeLineDiff(oldContent: string, newContent: string) {
  const oldLines = oldContent ? oldContent.split(/\r?\n/) : []
  const newLines = newContent ? newContent.split(/\r?\n/) : []

  const m = oldLines.length
  const n = newLines.length

  if (m === 0) return { addedLines: n, removedLines: 0 }
  if (n === 0) return { addedLines: 0, removedLines: m }

  if (m * n > 2000000) {
    // Fast approximation for huge files
    const delta = n - m
    return {
      addedLines: delta > 0 ? delta : 0,
      removedLines: delta < 0 ? Math.abs(delta) : 0
    }
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const common = dp[m][n]
  return {
    addedLines: n - common,
    removedLines: m - common
  }
}

export const editFileTool: AgentTool<EditFileArgs> = {
  name: 'edit_file',
  description: 'Edit an existing file in the project. Provide either the updated full content or old_str to be replaced with new_str. Calculates and reports exact added (+) and deleted (-) lines.',
  parameters: EditFileArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative or absolute path of the file to edit'
      },
      content: {
        type: 'string',
        description: 'The updated full content of the file (preferred for multiple or full edits)'
      },
      old_str: {
        type: 'string',
        description: 'The specific snippet or text to find and replace'
      },
      new_str: {
        type: 'string',
        description: 'The replacement text for old_str'
      }
    },
    required: ['path']
  },
  allowedModes: ['project'],
  async execute(args: EditFileArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot edit file: No project folder selected')
    }

    const fullPath = path.isAbsolute(args.path)
      ? args.path
      : path.resolve(ctx.projectFolder, args.path)

    let originalContent = ''
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8')
    } catch {
      originalContent = ''
    }

    let finalContent = ''
    if (args.content !== undefined) {
      finalContent = args.content
    } else if (args.old_str !== undefined && args.new_str !== undefined) {
      if (!originalContent.includes(args.old_str)) {
        throw new Error(`Target text (old_str) was not found in ${args.path}`)
      }
      finalContent = originalContent.replace(args.old_str, args.new_str)
    } else {
      throw new Error('Either "content" or both "old_str" and "new_str" must be provided to edit_file')
    }

    // Require approval if configured
    if (!ctx.settings.autoApproveFileWrite && ctx.requireToolApproval) {
      const approved = await ctx.requireToolApproval('edit_file', {
        path: args.path,
        content: finalContent
      })
      if (!approved) {
        throw new Error(`File edit for ${args.path} was rejected by user.`)
      }
    }

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, finalContent, 'utf-8')

      const { addedLines, removedLines } = computeLineDiff(originalContent, finalContent)
      const stats = await fs.stat(fullPath)
      const lines = finalContent.split(/\r?\n/).length

      return {
        path: args.path,
        fullPath,
        lines,
        addedLines,
        removedLines,
        size: stats.size,
        content: finalContent,
        success: true
      }
    } catch (err: any) {
      throw new Error(`Failed to edit file ${args.path}: ${err.message}`)
    }
  }
}
