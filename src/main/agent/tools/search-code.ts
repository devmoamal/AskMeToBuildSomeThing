import fs from 'node:fs/promises'
import path from 'node:path'
import { SearchCodeArgsSchema, type SearchCodeArgs } from '../../../shared/schemas'
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

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.exe', '.dll', '.dylib', '.so', '.dmg', '.iso', '.zip', '.tar', '.gz',
  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.mov', '.sqlite',
  '.sqlite-shm', '.sqlite-wal', '.db'
])

export interface CodeMatch {
  file: string
  line: number
  content: string
}

async function searchInFilesRecursive(
  currentDir: string,
  baseDir: string,
  regex: RegExp,
  matches: CodeMatch[],
  maxResults: number
): Promise<void> {
  if (matches.length >= maxResults) return

  try {
    const rawEntries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const ent of rawEntries) {
      if (IGNORED_NAMES.has(ent.name)) continue
      if (matches.length >= maxResults) return

      const fullPath = path.join(currentDir, ent.name)

      if (ent.isDirectory()) {
        await searchInFilesRecursive(fullPath, baseDir, regex, matches, maxResults)
      } else {
        const ext = path.extname(ent.name).toLowerCase()
        if (BINARY_EXTENSIONS.has(ext)) continue

        try {
          const stats = await fs.stat(fullPath)
          // Skip files larger than 1MB to avoid memory bloat
          if (stats.size > 1024 * 1024) continue

          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split(/\r?\n/)
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              matches.push({
                file: relPath,
                line: i + 1,
                content: lines[i].trim()
              })

              if (matches.length >= maxResults) return
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

export const searchCodeTool: AgentTool<SearchCodeArgs> = {
  name: 'search_code',
  description: 'Search for text, symbol names, function declarations, or regex patterns across project files (grep).',
  parameters: SearchCodeArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The text or pattern to search for across project files'
      },
      path: {
        type: 'string',
        description: 'Optional subfolder path to limit search scope (default: project root)'
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Whether search is case-sensitive (default is false)'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of line matches to return (default: 30)'
      }
    },
    required: ['query']
  },
  allowedModes: ['project'],
  async execute(args: SearchCodeArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot search code: No project folder selected')
    }

    const startDir = args.path
      ? (path.isAbsolute(args.path) ? args.path : path.resolve(ctx.projectFolder, args.path))
      : ctx.projectFolder

    const maxResults = args.maxResults || 30
    const flags = args.caseSensitive ? 'g' : 'gi'

    let regex: RegExp
    try {
      // Treat special regex characters safely if user passes raw text, or use regex
      const escaped = args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(escaped, flags)
    } catch {
      regex = new RegExp(args.query, flags)
    }

    const matches: CodeMatch[] = []
    await searchInFilesRecursive(startDir, ctx.projectFolder, regex, matches, maxResults)

    return {
      success: true,
      query: args.query,
      scope: args.path || '.',
      totalMatches: matches.length,
      matches
    }
  }
}
