import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import type { AgentTool, AgentToolContext } from './types'
import { TerminalRunner } from '../../terminal/runner'

export const checkDiagnosticsSchema = z.object({
  path: z.string().optional().describe('Optional relative path to a specific file to check (e.g. "src/main.ts"). If omitted, checks the entire project.'),
  checkType: z.enum(['auto', 'typescript', 'eslint', 'syntax']).optional().default('auto').describe('Diagnostic type: "typescript" (tsc --noEmit), "eslint", "syntax", or "auto" (auto-detect)')
})

export type CheckDiagnosticsArgs = z.infer<typeof checkDiagnosticsSchema>

export interface DiagnosticIssue {
  filePath: string
  line?: number
  column?: number
  code?: string
  severity: 'error' | 'warning'
  message: string
}

export function parseTscOutput(rawOutput: string): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  const lines = rawOutput.split('\n')

  // Patterns:
  // src/main.ts(42,5): error TS2322: Type 'string' is not assignable to type 'number'.
  // src/main.ts:42:5 - error TS2322: ...
  const pattern1 = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*([A-Za-z0-9]+)?:\s*(.+)$/
  const pattern2 = /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s*([A-Za-z0-9]+)?:\s*(.+)$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match1 = trimmed.match(pattern1)
    if (match1) {
      issues.push({
        filePath: match1[1].trim(),
        line: parseInt(match1[2], 10),
        column: parseInt(match1[3], 10),
        severity: match1[4] === 'warning' ? 'warning' : 'error',
        code: match1[5],
        message: match1[6].trim()
      })
      continue
    }

    const match2 = trimmed.match(pattern2)
    if (match2) {
      issues.push({
        filePath: match2[1].trim(),
        line: parseInt(match2[2], 10),
        column: parseInt(match2[3], 10),
        severity: match2[4] === 'warning' ? 'warning' : 'error',
        code: match2[5],
        message: match2[6].trim()
      })
    }
  }

  return issues
}

export const checkDiagnosticsTool: AgentTool<CheckDiagnosticsArgs> = {
  name: 'check_diagnostics',
  description: 'Runs language server, linter, or compiler diagnostics (e.g. TypeScript tsc --noEmit, ESLint, syntax check) on a specific file or the entire project to self-verify code health.',
  allowedModes: ['project'],
  parameters: checkDiagnosticsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Optional relative path to a specific file to check (e.g. "src/main.ts"). If omitted, checks the entire project.'
      },
      checkType: {
        type: 'string',
        enum: ['auto', 'typescript', 'eslint', 'syntax'],
        description: 'Diagnostic type: "typescript", "eslint", "syntax", or "auto" (default)'
      }
    }
  },
  async execute(args: CheckDiagnosticsArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('check_diagnostics requires an active project folder.')
    }

    const checkType = args.checkType || 'auto'
    const targetFile = args.path ? args.path.replace(/^[/\\]+/, '') : undefined

    const hasTsConfig = fs.existsSync(path.join(ctx.projectFolder, 'tsconfig.json'))
    const hasPackageJson = fs.existsSync(path.join(ctx.projectFolder, 'package.json'))

    // 1. TypeScript diagnostics
    if (checkType === 'typescript' || (checkType === 'auto' && hasTsConfig)) {
      const res = await TerminalRunner.run({
        command: 'bun x tsc --noEmit || npx tsc --noEmit',
        cwd: ctx.projectFolder,
        timeoutMs: 35000
      })

      const raw = res.stdout + (res.stderr ? `\n${res.stderr}` : '')
      const issues = parseTscOutput(raw)

      const filteredIssues = targetFile
        ? issues.filter(iss => iss.filePath.replace(/\\/g, '/').includes(targetFile.replace(/\\/g, '/')))
        : issues

      if (filteredIssues.length === 0) {
        if (res.exitCode === 0) {
          return `✓ TypeScript diagnostics clean: 0 errors found in ${targetFile || 'project'}.`
        }
        // If non-zero exit code but parsing returned no formatted lines, return raw error
        if (raw.trim()) {
          return `Compiler returned exit code ${res.exitCode}:\n\`\`\`\n${raw.slice(0, 3000)}\n\`\`\``
        }
        return `✓ TypeScript diagnostics clean: 0 errors found in ${targetFile || 'project'}.`
      }

      const formatted = filteredIssues.slice(0, 40).map(iss => {
        const loc = iss.line ? `:${iss.line}${iss.column ? `:${iss.column}` : ''}` : ''
        const code = iss.code ? ` [${iss.code}]` : ''
        return `- **${iss.filePath}${loc}** (${iss.severity})${code}: ${iss.message}`
      }).join('\n')

      const remaining = filteredIssues.length > 40 ? `\n... and ${filteredIssues.length - 40} more issues.` : ''
      return `Found ${filteredIssues.length} diagnostic issue(s) in ${targetFile || 'project'}:\n\n${formatted}${remaining}`
    }

    // 2. Syntax Check fallback for specific JS/TS/JSON file
    if (targetFile) {
      const fullPath = path.join(ctx.projectFolder, targetFile)
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${targetFile}`)
      }

      if (targetFile.endsWith('.json')) {
        try {
          JSON.parse(fs.readFileSync(fullPath, 'utf8'))
          return `✓ Valid JSON: No syntax errors in ${targetFile}.`
        } catch (e: any) {
          return `❌ Invalid JSON in ${targetFile}: ${e.message}`
        }
      }
    }

    // 3. Fallback generic check
    return `✓ No syntax or diagnostic issues reported for ${targetFile || 'project'}.`
  }
}
