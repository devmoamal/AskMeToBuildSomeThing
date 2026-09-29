import fs from 'node:fs/promises'
import path from 'node:path'
import { GetFileOutlineArgsSchema, type GetFileOutlineArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

interface SymbolItem {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'export' | 'method'
  name: string
  line: number
  signature?: string
}

function extractSymbols(content: string, ext: string): SymbolItem[] {
  const lines = content.split(/\r?\n/)
  const symbols: SymbolItem[] = []

  const isJsTs = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
  const isPython = ['.py'].includes(ext)
  const isRust = ['.rs'].includes(ext)
  const isGo = ['.go'].includes(ext)

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i].trim()
    if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) continue

    if (isJsTs) {
      // Exported functions or classes
      const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/)
      if (classMatch) {
        symbols.push({ type: 'class', name: classMatch[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }

      const interfaceMatch = line.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/)
      if (interfaceMatch) {
        symbols.push({ type: 'interface', name: interfaceMatch[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }

      const typeMatch = line.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)/)
      if (typeMatch) {
        symbols.push({ type: 'type', name: typeMatch[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }

      const fnMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/)
      if (fnMatch) {
        symbols.push({ type: 'function', name: fnMatch[1], line: lineNum, signature: `${fnMatch[1]}(${fnMatch[2].slice(0, 40)})` })
        continue
      }

      const constFnMatch = line.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|:)/)
      if (constFnMatch) {
        symbols.push({ type: 'function', name: constFnMatch[1], line: lineNum, signature: `${constFnMatch[1]}(${constFnMatch[2].slice(0, 40)})` })
        continue
      }

      const constMatch = line.match(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/)
      if (constMatch) {
        symbols.push({ type: 'const', name: constMatch[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
    } else if (isPython) {
      const pyClass = line.match(/^class\s+([A-Za-z0-9_]+)/)
      if (pyClass) {
        symbols.push({ type: 'class', name: pyClass[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
      const pyDef = line.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/)
      if (pyDef) {
        symbols.push({ type: 'function', name: pyDef[1], line: lineNum, signature: `${pyDef[1]}(${pyDef[2].slice(0, 40)})` })
        continue
      }
    } else if (isRust) {
      const rustStruct = line.match(/^(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z0-9_]+)/)
      if (rustStruct) {
        symbols.push({ type: 'class', name: rustStruct[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
      const rustFn = line.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/)
      if (rustFn) {
        symbols.push({ type: 'function', name: rustFn[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
    } else if (isGo) {
      const goType = line.match(/^type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/)
      if (goType) {
        symbols.push({ type: 'class', name: goType[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
      const goFn = line.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)/)
      if (goFn) {
        symbols.push({ type: 'function', name: goFn[1], line: lineNum, signature: line.slice(0, 80) })
        continue
      }
    }
  }

  return symbols
}

export const getFileOutlineTool: AgentTool<GetFileOutlineArgs> = {
  name: 'get_file_outline',
  description: 'Inspect the structural outline of a source code file (classes, functions, types, interfaces, exports) without reading its entire full content.',
  parameters: GetFileOutlineArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative or absolute path of the file to inspect'
      }
    },
    required: ['path']
  },
  allowedModes: ['project'],
  async execute(args: GetFileOutlineArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot inspect file outline: No project folder selected.')
    }

    const resolvedProject = path.resolve(ctx.projectFolder)
    const fullPath = path.isAbsolute(args.path)
      ? path.resolve(args.path)
      : path.resolve(resolvedProject, args.path)

    if (!fullPath.startsWith(resolvedProject)) {
      throw new Error(`Access denied: Path "${args.path}" escapes project boundary.`)
    }

    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      throw new Error(`Path "${args.path}" is a directory. Use list_dir instead.`)
    }

    const content = await fs.readFile(fullPath, 'utf-8')
    const ext = path.extname(fullPath).toLowerCase()
    const lines = content.split(/\r?\n/)
    const symbols = extractSymbols(content, ext)

    // Also extract top imports
    const importLines: string[] = []
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      const l = lines[i].trim()
      if (l.startsWith('import ') || l.startsWith('from ') || l.startsWith('const ') && l.includes('require(')) {
        importLines.push(l)
      }
    }

    return {
      path: path.relative(resolvedProject, fullPath) || args.path,
      totalLines: lines.length,
      sizeBytes: stat.size,
      importsSample: importLines.slice(0, 15),
      symbolsCount: symbols.length,
      symbols
    }
  }
}
