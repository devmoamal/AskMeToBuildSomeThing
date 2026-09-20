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

  it('should allow all 10 tools in project mode', () => {
    const projectTools = ToolRegistry.getToolsForMode('project')
    const toolNames = projectTools.map(t => t.name)
    expect(toolNames).toHaveLength(10)
    expect(toolNames).toContain('read_file')
    expect(toolNames).toContain('create_file')
    expect(toolNames).toContain('edit_file')
    expect(toolNames).toContain('use_terminal')
    expect(toolNames).toContain('list_dir')
    expect(toolNames).toContain('find_files')
    expect(toolNames).toContain('search_code')
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

  it('should execute list_dir, find_files, and search_code exploration tools', async () => {
    const tempDir = path.resolve(process.cwd(), '.data/test_exploration')
    await fs.mkdir(path.join(tempDir, 'sub'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'file1.ts'), 'export const hello = "world";\n', 'utf-8')
    await fs.writeFile(path.join(tempDir, 'sub', 'file2.js'), 'console.log("agentic loop active");\n', 'utf-8')

    const listDir = ToolRegistry.getToolByName('list_dir')!
    const findFiles = ToolRegistry.getToolByName('find_files')!
    const searchCode = ToolRegistry.getToolByName('search_code')!

    const defaultSettings = AppSettingsSchema.parse({})
    const ctx = {
      mode: 'project' as const,
      projectFolder: tempDir,
      settings: defaultSettings
    }

    // 1. Test list_dir
    const listResult = await listDir.execute({ maxDepth: 2 }, ctx, 'call_list')
    expect(listResult.success).toBe(true)
    expect(listResult.entries.length).toBeGreaterThanOrEqual(2)

    // 2. Test find_files
    const findResult = await findFiles.execute({ pattern: 'file2' }, ctx, 'call_find')
    expect(findResult.success).toBe(true)
    expect(findResult.matchCount).toBe(1)
    expect(findResult.matches[0].name).toBe('file2.js')

    // 3. Test search_code
    const searchResult = await searchCode.execute({ query: 'agentic loop' }, ctx, 'call_search')
    expect(searchResult.success).toBe(true)
    expect(searchResult.totalMatches).toBe(1)
    expect(searchResult.matches[0].content).toContain('agentic loop active')

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should auto-approve safe development terminal commands even when autoApproveTerminal is false', async () => {
    const terminalTool = ToolRegistry.getToolByName('use_terminal')!
    let approvalRequested = false

    const defaultSettings = AppSettingsSchema.parse({ autoApproveTerminal: false })

    const mockCtx = {
      mode: 'project' as const,
      projectFolder: process.cwd(),
      settings: defaultSettings,
      requireToolApproval: async () => {
        approvalRequested = true
        return true
      }
    }

    const res = await terminalTool.execute({ command: 'git status' }, mockCtx, 'call_safe')
    expect(res.success).toBe(true)
    expect(approvalRequested).toBe(false)
  })

  it('should require approval for dangerous terminal command when autoApprove is false', async () => {
    const terminalTool = ToolRegistry.getToolByName('use_terminal')!
    let approvalRequested = false

    const defaultSettings = AppSettingsSchema.parse({ autoApproveTerminal: false })

    const mockCtx = {
      mode: 'project' as const,
      projectFolder: process.cwd(),
      settings: defaultSettings,
      requireToolApproval: async () => {
        approvalRequested = true
        return false // Reject
      }
    }

    expect(terminalTool.execute({ command: 'rm -rf /' }, mockCtx, 'call_term')).rejects.toThrow('rejected by user')
    expect(approvalRequested).toBe(true)
  })
})
