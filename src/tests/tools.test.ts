import { describe, it, expect } from 'bun:test'
import { ToolRegistry } from '../main/agent/tools/registry'
import { AppSettingsSchema } from '../shared/schemas'
import fs from 'node:fs/promises'
import path from 'node:path'

describe('Tool Registry and Scopes', () => {
  it('should restrict tools in chat mode to make_canvas, ask_user, and web_search', () => {
    const chatTools = ToolRegistry.getToolsForMode('chat')
    const toolNames = chatTools.map(t => t.name)
    expect(toolNames).toHaveLength(3)
    expect(toolNames).toContain('make_canvas')
    expect(toolNames).toContain('ask_user')
    expect(toolNames).toContain('web_search')
    expect(toolNames).not.toContain('read_file')
    expect(toolNames).not.toContain('create_file')
    expect(toolNames).not.toContain('use_terminal')
  })

  it('should allow all 7 tools in project mode', () => {
    const projectTools = ToolRegistry.getToolsForMode('project')
    const toolNames = projectTools.map(t => t.name)
    expect(toolNames).toHaveLength(7)
    expect(toolNames).toContain('read_file')
    expect(toolNames).toContain('create_file')
    expect(toolNames).toContain('edit_file')
    expect(toolNames).toContain('use_terminal')
    expect(toolNames).toContain('make_canvas')
    expect(toolNames).toContain('ask_user')
    expect(toolNames).toContain('web_search')
  })

  it('should execute create_file, edit_file and read_file with line diff tracking', async () => {
    const tempDir = path.resolve(process.cwd(), '.data/test_project')
    await fs.mkdir(tempDir, { recursive: true })

    const createFile = ToolRegistry.getToolByName('create_file')!
    const editFile = ToolRegistry.getToolByName('edit_file')!
    const readFile = ToolRegistry.getToolByName('read_file')!

    const defaultSettings = AppSettingsSchema.parse({ autoApproveFileWrite: true })

    const writeResult = await createFile.execute(
      { path: 'src/greeting.txt', content: 'Line 1\nLine 2\nLine 3' },
      {
        mode: 'project',
        projectFolder: tempDir,
        settings: defaultSettings
      },
      'call_1'
    )

    expect(writeResult.success).toBe(true)
    expect(writeResult.lines).toBe(3)

    // Edit file: replace Line 2 with Line 2 modified, and add Line 4 and Line 5
    const editResult = await editFile.execute(
      { path: 'src/greeting.txt', content: 'Line 1\nLine 2 modified\nLine 3\nLine 4\nLine 5' },
      {
        mode: 'project',
        projectFolder: tempDir,
        settings: defaultSettings
      },
      'call_edit'
    )

    expect(editResult.success).toBe(true)
    expect(editResult.lines).toBe(5)
    expect(editResult.addedLines).toBe(3)
    expect(editResult.removedLines).toBe(1)

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
    expect(readResult.content).toBe('Line 1\nLine 2 modified\nLine 3\nLine 4\nLine 5')

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
