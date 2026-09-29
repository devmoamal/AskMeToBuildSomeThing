import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { checkDiagnosticsTool, parseTscOutput } from '../main/agent/tools/check-diagnostics'
import { searchSymbolsTool, extractSymbolsFromContent } from '../main/agent/tools/search-symbols'
import { manageCheckpointsTool } from '../main/agent/tools/manage-checkpoints'
import type { AgentToolContext } from '../main/agent/tools/types'

describe('Advanced Agent Tools (Diagnostics, Symbols, Checkpoints)', () => {
  let tempDir: string
  let mockCtx: AgentToolContext

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'adv_tools_test_'))
    mockCtx = {
      projectFolder: tempDir,
      mode: 'project',
      settings: {
        autoApproveDevelopmentTerminal: true,
        allowDangerousTerminalExecution: false
      } as any
    }
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
  })

  describe('check_diagnostics', () => {
    it('should accurately parse TypeScript compiler diagnostics', () => {
      const sampleTscOutput = `
src/main.ts(14,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts:88:12 - warning TS7006: Parameter 'x' implicitly has an 'any' type.
`
      const issues = parseTscOutput(sampleTscOutput)
      expect(issues).toHaveLength(2)

      expect(issues[0].filePath).toBe('src/main.ts')
      expect(issues[0].line).toBe(14)
      expect(issues[0].column).toBe(5)
      expect(issues[0].severity).toBe('error')
      expect(issues[0].code).toBe('TS2322')
      expect(issues[0].message).toBe("Type 'string' is not assignable to type 'number'.")

      expect(issues[1].filePath).toBe('src/utils.ts')
      expect(issues[1].line).toBe(88)
      expect(issues[1].column).toBe(12)
      expect(issues[1].severity).toBe('warning')
      expect(issues[1].code).toBe('TS7006')
    })

    it('should validate JSON syntax when checking a json file', async () => {
      const validJson = path.join(tempDir, 'valid.json')
      await fs.writeFile(validJson, '{"hello": "world"}', 'utf8')

      const res = await checkDiagnosticsTool.execute({ path: 'valid.json', checkType: 'syntax' }, mockCtx, 'call_1')
      expect(res).toContain('Valid JSON')

      const invalidJson = path.join(tempDir, 'invalid.json')
      await fs.writeFile(invalidJson, '{"broken": }', 'utf8')

      const resBad = await checkDiagnosticsTool.execute({ path: 'invalid.json', checkType: 'syntax' }, mockCtx, 'call_2')
      expect(resBad).toContain('Invalid JSON')
    })
  })

  describe('search_symbols', () => {
    it('should extract classes, interfaces, types, and functions from TypeScript content', () => {
      const code = `
export interface UserRecord {
  id: string
}

export type UserRole = 'admin' | 'guest'

export class AuthController {
  validate() {}
}

export function generateToken(user: UserRecord): string {
  return 'token'
}

export const verifyHash = async (hash: string) => {
  return true
}
`
      const symbols = extractSymbolsFromContent(code, 'src/auth.ts')
      expect(symbols).toHaveLength(5)

      const names = symbols.map(s => s.name)
      expect(names).toContain('UserRecord')
      expect(names).toContain('UserRole')
      expect(names).toContain('AuthController')
      expect(names).toContain('generateToken')
      expect(names).toContain('verifyHash')

      const kinds = symbols.map(s => s.kind)
      expect(kinds).toContain('interface')
      expect(kinds).toContain('type')
      expect(kinds).toContain('class')
      expect(kinds).toContain('function')
    })

    it('should find symbols across workspace files', async () => {
      const sampleFile = path.join(tempDir, 'sample.ts')
      await fs.writeFile(sampleFile, 'export class WorkspaceCartographer {\n  locate() {}\n}\n', 'utf8')

      const res = await searchSymbolsTool.execute({ query: 'WorkspaceCartographer', kind: 'all', maxResults: 30 }, mockCtx, 'call_sym_1')
      expect(res).toContain('WorkspaceCartographer')
      expect(res).toContain('class')
      expect(res).toContain('sample.ts')
    })
  })

  describe('manage_checkpoints', () => {
    it('should require a git repository to operate', async () => {
      // tempDir is not a git repo initially
      expect(
        manageCheckpointsTool.execute({ action: 'create', description: 'Initial' }, mockCtx, 'call_cp_1')
      ).rejects.toThrow('Workspace is not a Git repository')
    })
  })
})
