import fs from 'node:fs/promises'
import path from 'node:path'
import { FindFilesArgsSchema, type FindFilesArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'dist-release',
  '.DS_Store',
  'Thumbs.db',
  '.turbo',
  '.cache'
])

export interface FileMatch {
  name: string
  relPath: string
  size: number
}

async function searchFilesRecursive(
  currentDir: string,
  baseDir: string,
  filterFn: (name: string, relPath: string) => boolean,
  results: FileMatch[],
  maxMatches: number = 100
): Promise<void> {
  if (results.length >= maxMatches) return

  try {
    const rawEntries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const ent of rawEntries) {
      if (IGNORED_NAMES.has(ent.name)) continue
      if (results.length >= maxMatches) return

      const fullPath = path.join(currentDir, ent.name)
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')

      if (ent.isDirectory()) {
        await searchFilesRecursive(fullPath, baseDir, filterFn, results, maxMatches)
      } else {
        if (filterFn(ent.name, relPath)) {
          try {
            const stats = await fs.stat(fullPath)
            results.push({
              name: ent.name,
              relPath,
              size: stats.size
            })
          } catch {
            results.push({
              name: ent.name,
              relPath,
              size: 0
            })
          }
        }
      }
    }
  } catch {
    // Ignore unreadable directory
  }
}

export const findFilesTool: AgentTool<FindFilesArgs> = {
  name: 'find_files',
  description: 'Search for files matching a filename pattern or extension in the project folder (e.g. "*.ts", "config", "auth").',
  parameters: FindFilesArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Filename pattern, extension (e.g. ".tsx", "*.json"), or substring to search for'
      },
      path: {
        type: 'string',
        description: 'Optional subfolder path to narrow search scope (default: project root)'
      }
    },
    required: ['pattern']
  },
  allowedModes: ['project'],
  async execute(args: FindFilesArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot find files: No project folder selected')
    }

    const startDir = args.path
      ? (path.isAbsolute(args.path) ? args.path : path.resolve(ctx.projectFolder, args.path))
      : ctx.projectFolder

    const pattern = args.pattern.trim().toLowerCase()
    const isExtension = pattern.startsWith('.')
    const isWildcard = pattern.includes('*')

    let filterFn: (name: string, relPath: string) => boolean

    if (isExtension) {
      filterFn = (name) => name.toLowerCase().endsWith(pattern)
    } else if (isWildcard) {
      // Convert simple glob pattern to regex
      const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      const regex = new RegExp(regexStr, 'i')
      filterFn = (name) => regex.test(name)
    } else {
      // Substring match
      filterFn = (name, relPath) => name.toLowerCase().includes(pattern) || relPath.toLowerCase().includes(pattern)
    }

    const results: FileMatch[] = []
    await searchFilesRecursive(startDir, ctx.projectFolder, filterFn, results)

    return {
      success: true,
      pattern: args.pattern,
      scope: args.path || '.',
      matchCount: results.length,
      matches: results
    }
  }
}
