import { describe, it, expect } from 'bun:test'
import { ToolRegistry } from '../main/agent/tools/registry'
import { AppSettingsSchema } from '../shared/schemas'
import fs from 'node:fs/promises'
import path from 'node:path'

describe('Tool Registry and Scopes', () => {
  it('should restrict tools in chat mode to only make_canvas and ask_user', () => {
    const chatTools = ToolRegistry.getToolsForMode('chat')
    const toolNames = chatTools.map(t => t.name)
    expect(toolNames).toHaveLength(2)
    expect(toolNames).toContain('make_canvas')
    expect(toolNames).toContain('ask_user')
    expect(toolNames).not.toContain('read_file')
    expect(toolNames).not.toContain('create_file')
    expect(toolNames).not.toContain('use_terminal')
  })

  it('should allow all 5 tools in project mode', () => {
    const projectTools = ToolRegistry.getToolsForMode('project')
    const toolNames = projectTools.map(t => t.name)
    expect(toolNames).toHaveLength(5)
    expect(toolNames).toContain('read_file')
    expect(toolNames).toContain('create_file')
    expect(toolNames).toContain('use_terminal')
    expect(toolNames).toContain('make_canvas')
    expect(toolNames).toContain('ask_user')
  })

  it('should execute create_file and read_file within project directory', async () => {
    const tempDir = path.resolve(process.cwd(), '.data/test_project')
    await fs.mkdir(tempDir, { recursive: true })

    const createFile = ToolRegistry.getToolByName('create_file')!
    const readFile = ToolRegistry.getToolByName('read_file')!

    const defaultSettings = AppSettingsSchema.parse({ autoApproveFileWrite: true })

    const writeResult = await createFile.execute(
      { path: 'src/greeting.txt', content: 'Hello AskMeToBuildSomeThing!' },
      {
        mode: 'project',
        projectFolder: tempDir,
        settings: defaultSettings
      },
      'call_1'
    )

    expect(writeResult.success).toBe(true)
    expect(writeResult.lines).toBe(1)

    const readResult = await readFile.execute(
      { path: 'src/greeting.txt' },
      {
        mode: 'project',
        projectFolder: tempDir,
        settings: defaultSettings
      },
      'call_2'
    )

    expect(readResult.success).toBe(true)
    expect(readResult.content).toBe('Hello AskMeToBuildSomeThing!')

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should require approval for terminal command when autoApprove is false', async () => {
    const terminalTool = ToolRegistry.getToolByName('use_terminal')!
    let approvalRequested = false

    const defaultSettings = AppSettingsSchema.parse({ autoApproveTerminal: false })

    const mockCtx = {
      mode: 'project' as const,
      projectFolder: process.cwd(),
      settings: defaultSettings,
      requireToolApproval: async (name: string, args: any) => {
        approvalRequested = true
        return false // Reject
      }
    }

    expect(terminalTool.execute({ command: 'echo should-fail' }, mockCtx, 'call_term')).rejects.toThrow('rejected by user')
    expect(approvalRequested).toBe(true)
  })
})
