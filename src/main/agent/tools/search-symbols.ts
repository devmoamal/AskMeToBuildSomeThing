import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import type { AgentTool, AgentToolContext } from './types'

export const searchSymbolsSchema = z.object({
  query: z.string().describe('Symbol name or pattern to search for (e.g. "SchedulerManager", "parseOutput", "UserConfig")'),
  kind: z.enum(['all', 'function', 'class', 'interface', 'type', 'variable', 'constant']).optional().default('all').describe('Filter by symbol kind (default: "all")'),
  extension: z.string().optional().describe('Optional file extension filter, e.g. "ts", "tsx", "py", "rs", "go"'),
  maxResults: z.number().optional().default(30).describe('Maximum number of results to return (default: 30)')
})

export type SearchSymbolsArgs = z.infer<typeof searchSymbolsSchema>

export interface DiscoveredSymbol {
  name: string
  kind: string
  file: string
  line: number
  preview: string
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'dist-release',
  '.data',
  'build',
  '.next',
  '.turbo',
  'coverage',
  'vendor'
])

const DEFAULT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.swift', '.kt'
])

export function extractSymbolsFromContent(content: string, relPath: string): DiscoveredSymbol[] {
  const symbols: DiscoveredSymbol[] = []
  const lines = content.split('\n')
  const ext = path.extname(relPath).toLowerCase()

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('#')) {
      continue
    }

    // TypeScript / JavaScript
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      // Classes
      const classMatch = trimmed.match(/(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/)
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: 'class', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Interfaces
      const ifaceMatch = trimmed.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/)
      if (ifaceMatch) {
        symbols.push({ name: ifaceMatch[1], kind: 'interface', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Type aliases
      const typeMatch = trimmed.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*[<=]/)
      if (typeMatch) {
        symbols.push({ name: typeMatch[1], kind: 'type', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Enums
      const enumMatch = trimmed.match(/(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/)
      if (enumMatch) {
        symbols.push({ name: enumMatch[1], kind: 'enum', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Functions (named)
      const funcMatch = trimmed.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/)
      if (funcMatch) {
        symbols.push({ name: funcMatch[1], kind: 'function', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Arrow functions / const functions
      const arrowMatch = trimmed.match(/(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/)
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], kind: 'function', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }

      // Constants / Variables (exported)
      const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/)
      if (constMatch) {
        symbols.push({ name: constMatch[1], kind: 'constant', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
    }

    // Python
    if (ext === '.py') {
      const pyFunc = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/)
      if (pyFunc) {
        symbols.push({ name: pyFunc[1], kind: 'function', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
      const pyClass = trimmed.match(/^class\s+([A-Za-z0-9_]+)/)
      if (pyClass) {
        symbols.push({ name: pyClass[1], kind: 'class', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
    }

    // Go
    if (ext === '.go') {
      const goFunc = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/)
      if (goFunc) {
        symbols.push({ name: goFunc[1], kind: 'function', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
      const goType = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/)
      if (goType) {
        symbols.push({ name: goType[1], kind: 'type', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
    }

    // Rust
    if (ext === '.rs') {
      const rsFunc = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/)
      if (rsFunc) {
        symbols.push({ name: rsFunc[1], kind: 'function', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
      const rsType = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/)
      if (rsType) {
        symbols.push({ name: rsType[1], kind: 'class', file: relPath, line: lineNum, preview: trimmed.slice(0, 120) })
        continue
      }
    }
  }

  return symbols
}

export const searchSymbolsTool: AgentTool<SearchSymbolsArgs> = {
  name: 'search_symbols',
  description: 'Searches for declared code symbols (functions, classes, interfaces, types, constants) across the entire codebase by name and kind.',
  allowedModes: ['project'],
  parameters: searchSymbolsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Symbol name or pattern to search for (e.g. "SchedulerManager", "parseOutput")'
      },
      kind: {
        type: 'string',
        enum: ['all', 'function', 'class', 'interface', 'type', 'variable', 'constant'],
        description: 'Filter by symbol kind (default: "all")'
      },
      extension: {
        type: 'string',
        description: 'Optional file extension filter, e.g. "ts", "tsx", "py", "rs", "go"'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 30)'
      }
    },
    required: ['query']
  },
  async execute(args: SearchSymbolsArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('search_symbols requires an active project folder.')
    }

    const query = args.query.trim().toLowerCase()
    const targetKind = args.kind || 'all'
    const targetExt = args.extension ? `.${args.extension.replace(/^\./, '').toLowerCase()}` : null
    const maxResults = args.maxResults || 30

    const matchedSymbols: DiscoveredSymbol[] = []

    function walkDir(dir: string) {
      if (matchedSymbols.length >= maxResults) return

      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        if (matchedSymbols.length >= maxResults) break

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            walkDir(path.join(dir, entry.name))
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (targetExt ? ext === targetExt : DEFAULT_EXTENSIONS.has(ext)) {
            const fullPath = path.join(dir, entry.name)
            try {
              const stat = fs.statSync(fullPath)
              if (stat.size > 800_000) continue // Skip huge generated files

              const content = fs.readFileSync(fullPath, 'utf8')
              const relPath = path.relative(ctx.projectFolder!, fullPath).replace(/\\/g, '/')
              const symbols = extractSymbolsFromContent(content, relPath)

              for (const sym of symbols) {
                if (targetKind !== 'all' && sym.kind !== targetKind) {
                  continue
                }

                if (sym.name.toLowerCase().includes(query)) {
                  matchedSymbols.push(sym)
                  if (matchedSymbols.length >= maxResults) break
                }
              }
            } catch {}
          }
        }
      }
    }

    walkDir(ctx.projectFolder)

    if (matchedSymbols.length === 0) {
      return `No symbols found matching query "${args.query}"${targetKind !== 'all' ? ` of kind "${targetKind}"` : ''}.`
    }

    const rows = matchedSymbols.map(s => {
      return `| \`${s.kind}\` | **\`${s.name}\`** | \`${s.file}:${s.line}\` | \`${s.preview.replace(/\|/g, '\\|')}\` |`
    }).join('\n')

    return `### Found ${matchedSymbols.length} Symbol(s) matching "${args.query}":\n\n` +
      `| Kind | Symbol | Location | Declaration |\n` +
      `|---|---|---|---|\n` +
      rows
  }
}
