import fs from 'node:fs/promises'
import path from 'node:path'
import { ListDirArgsSchema, type ListDirArgs } from '../../../shared/schemas'
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

export interface DirEntryInfo {
  name: string
  relPath: string
  isDirectory: boolean
  size?: number
  children?: DirEntryInfo[]
}

async function readDirectoryRecursive(
  currentDir: string,
  baseDir: string,
  currentDepth: number,
  maxDepth: number
): Promise<DirEntryInfo[]> {
  if (currentDepth > maxDepth) return []

  try {
    const rawEntries = await fs.readdir(currentDir, { withFileTypes: true })
    const results: DirEntryInfo[] = []

    for (const ent of rawEntries) {
      if (IGNORED_NAMES.has(ent.name)) continue

      const fullPath = path.join(currentDir, ent.name)
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      const isDirectory = ent.isDirectory()

      if (isDirectory) {
        const children = currentDepth < maxDepth
          ? await readDirectoryRecursive(fullPath, baseDir, currentDepth + 1, maxDepth)
          : undefined

        results.push({
          name: ent.name,
          relPath,
          isDirectory: true,
          children
        })
      } else {
        try {
          const stats = await fs.stat(fullPath)
          results.push({
            name: ent.name,
            relPath,
            isDirectory: false,
            size: stats.size
          })
        } catch {
          results.push({
            name: ent.name,
            relPath,
            isDirectory: false
          })
        }
      }
    }

    return results
  } catch (err: any) {
    return []
  }
}

export const listDirTool: AgentTool<ListDirArgs> = {
  name: 'list_dir',
  description: 'List contents and files of a directory within the project folder. Allows recursive traversal to inspect project structure.',
  parameters: ListDirArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path relative to the project root (default is ".")'
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to recursively list subdirectories (default is false)'
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum depth for recursive listing (1-5, default is 2)'
      }
    }
  },
  allowedModes: ['project'],
  async execute(args: ListDirArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot list directory: No project folder selected')
    }

    const targetPath = args.path && args.path !== '.'
      ? (path.isAbsolute(args.path) ? args.path : path.resolve(ctx.projectFolder, args.path))
      : ctx.projectFolder

    const maxDepth = args.recursive ? (args.maxDepth || 2) : 1
    const entries = await readDirectoryRecursive(targetPath, ctx.projectFolder, 1, maxDepth)

    return {
      success: true,
      path: args.path || '.',
      totalEntries: entries.length,
      entries
    }
  }
}
