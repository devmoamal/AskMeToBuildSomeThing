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

    const resolvedProject = path.resolve(ctx.projectFolder)
    const fullPath = path.isAbsolute(args.path)
      ? path.resolve(args.path)
      : path.resolve(resolvedProject, args.path)

    if (!fullPath.startsWith(resolvedProject)) {
      throw new Error(`Access denied: Path "${args.path}" escapes project boundary`)
    }

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
      // 1. Direct exact match
      if (originalContent.includes(args.old_str)) {
        finalContent = originalContent.replace(args.old_str, args.new_str)
      } else {
        // 2. Line-ending normalized match (\r\n vs \n)
        const normContent = originalContent.replace(/\r\n/g, '\n')
        const normOld = args.old_str.replace(/\r\n/g, '\n')
        const normNew = args.new_str.replace(/\r\n/g, '\n')

        if (normContent.includes(normOld)) {
          const replaced = normContent.replace(normOld, normNew)
          finalContent = originalContent.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced
        } else {
          // 3. Trimmed line-by-line whitespace-tolerant match
          const contentLines = normContent.split('\n')
          const oldLines = normOld.split('\n')
          const trimmedOldLines = oldLines.map(l => l.trim())
          let matchIndex = -1

          for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
            let matches = true
            for (let j = 0; j < oldLines.length; j++) {
              if (contentLines[i + j].trim() !== trimmedOldLines[j]) {
                matches = false
                break
              }
            }
            if (matches) {
              matchIndex = i
              break
            }
          }

          if (matchIndex !== -1) {
            const before = contentLines.slice(0, matchIndex)
            const after = contentLines.slice(matchIndex + oldLines.length)
            const newLines = normNew.split('\n')
            const merged = [...before, ...newLines, ...after].join('\n')
            finalContent = originalContent.includes('\r\n') ? merged.replace(/\n/g, '\r\n') : merged
          } else {
            throw new Error(`Target text (old_str) was not found in ${args.path} (tried exact, newline, and indentation-tolerant matching)`)
          }
        }
      }
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
