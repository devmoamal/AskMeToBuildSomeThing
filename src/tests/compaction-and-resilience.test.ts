import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TruncateService } from '../main/agent/tools/truncate'
import { InvalidArgumentsError } from '../main/agent/tools/errors'
import { CompactionEngine, TokenEstimator } from '../main/agent/compaction'
import { ToolRegistry } from '../main/agent/tools/registry'
import { AppSettingsSchema } from '../shared/schemas'
import type { ProviderChatMessage } from '../main/agent/providers/base'
import { dbQueries } from '../main/db/queries'

describe('Phase 1: Tool Output Spillover and Truncation', () => {
  const testDir = path.resolve(process.cwd(), '.data/test_truncate_project')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should not truncate output within line and byte limits', async () => {
    const text = 'Line 1\nLine 2\nLine 3'
    const result = await TruncateService.truncateOutput(text, {
      maxLines: 10,
      maxBytes: 1000,
      projectFolder: testDir
    })
    expect(result.truncated).toBe(false)
    expect(result.content).toBe(text)
    expect(result.totalLines).toBe(3)
    expect(result.outputPath).toBeUndefined()
  })

  it('should truncate output exceeding maxLines and save full log to disk (head mode)', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Output line ${i + 1}`)
    const text = lines.join('\n')

    const result = await TruncateService.truncateOutput(text, {
      maxLines: 10,
      maxBytes: 100000,
      direction: 'head',
      toolName: 'read_file',
      projectFolder: testDir
    })

    expect(result.truncated).toBe(true)
    expect(result.totalLines).toBe(50)
    expect(result.outputPath).toBeDefined()
    expect(result.content).toContain('Showing first 10 lines of 50 total')
    expect(result.content).toContain('Output line 1')
    expect(result.content).toContain('Output line 10')
    expect(result.content).not.toContain('Output line 40')

    // Verify file written to disk
    const savedFileContent = await fs.readFile(result.outputPath!, 'utf-8')
    expect(savedFileContent).toBe(text)
  })

  it('should truncate output exceeding maxLines in tail mode for terminal outputs', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Terminal step ${i + 1}`)
    const text = lines.join('\n')

    const result = await TruncateService.truncateOutput(text, {
      maxLines: 5,
      maxBytes: 100000,
      direction: 'tail',
      toolName: 'use_terminal',
      projectFolder: testDir
    })

    expect(result.truncated).toBe(true)
    expect(result.content).toContain('Showing last 5 lines of 100 total')
    expect(result.content).toContain('Terminal step 100')
    expect(result.content).toContain('Terminal step 96')
    expect(result.content).not.toContain('Terminal step 1\n')
  })
})

describe('Phase 1: InvalidArgumentsError & Schema Healing', () => {
  it('should throw an actionable InvalidArgumentsError when tool parameters fail validation', async () => {
    const settings = AppSettingsSchema.parse({})
    let threw = false

    try {
      // edit_file requires 'path'
      await ToolRegistry.executeTool(
        'edit_file',
        { content: 'some new text without path' },
        {
          mode: 'project',
          projectFolder: process.cwd(),
          settings
        },
        'test_call'
      )
    } catch (err: any) {
      threw = true
      expect(err).toBeInstanceOf(InvalidArgumentsError)
      expect(err.message).toContain('The "edit_file" tool was called with invalid arguments')
      expect(err.message).toContain('Please rewrite the input so it strictly satisfies the expected schema')
    }

    expect(threw).toBe(true)
  })
})

describe('Phase 1: CompactionEngine and Token Management', () => {
  it('should accurately estimate tokens using character heuristic', () => {
    const sample = 'Hello world! This is a test for token estimation.'
    const tokens = TokenEstimator.estimateText(sample)
    expect(tokens).toBeGreaterThan(10)
    expect(tokens).toBeLessThan(25)
  })

  it('should passively prune historical tool results while protecting recent tail turns', () => {
    const messages: ProviderChatMessage[] = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'Explore codebase' },
      { role: 'assistant', content: 'Running list_dir' },
      // Large old tool result (exceeds 200 chars)
      { role: 'tool', toolCallId: 't1', content: 'File 1\n'.repeat(100) },
      { role: 'assistant', content: 'Running second search' },
      // Protected tail message
      { role: 'user', content: 'Now edit file greeting.ts' },
      { role: 'assistant', content: 'Editing...' },
      { role: 'tool', toolCallId: 't2', content: 'File edited successfully.' }
    ]

    // Set threshold low for testing
    const modified = CompactionEngine.pruneHistoricalToolResults(messages, 50, 100)
    expect(modified).toBe(true)
    // Old tool output was replaced with a tombstone
    expect(messages[3].content).toContain('[Tool result cleared:')
    // Recent tool output in the tail was preserved
    expect(messages[7].content).toBe('File edited successfully.')
  })

  it('should format structured compaction prompt and update instructions', () => {
    const prompt = CompactionEngine.buildCompactionPrompt('User: build something\nAssistant: building...')
    expect(prompt).toContain('## Objective')
    expect(prompt).toContain('## Important Details')
    expect(prompt).toContain('## Work State')
    expect(prompt).toContain('## Next Move')
    expect(prompt).toContain('## Relevant Files')

    const updatePrompt = CompactionEngine.buildCompactionPrompt('User: next step', 'Prior summary info')
    expect(updatePrompt).toContain('<prior-summary>')
    expect(updatePrompt).toContain('Prior summary info')
    expect(updatePrompt).toContain('The <conversation> is more recent than the <prior-summary>')
  })
})

describe('Phase 2: Codebase Cartographer Tools', () => {
  const testDir = path.resolve(process.cwd(), '.data/test_cartographer')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should extract classes, functions, and interfaces using get_file_outline', async () => {
    const tsCode = `
import { z } from 'zod'
import path from 'path'

export interface UserConfig {
  id: string
  name: string
}

export type Status = 'active' | 'inactive'

export class DatabaseManager {
  connect() {}
  disconnect() {}
}

export async function initializeDatabase(options: UserConfig) {
  return true
}

export const helperFunction = (val: string) => {
  return val.toUpperCase()
}
`
    const filePath = path.join(testDir, 'sample.ts')
    await fs.writeFile(filePath, tsCode, 'utf-8')

    const outlineTool = ToolRegistry.getToolByName('get_file_outline')!
    const settings = AppSettingsSchema.parse({})

    const outlineResult = await outlineTool.execute(
      { path: 'sample.ts' },
      {
        mode: 'project',
        projectFolder: testDir,
        settings
      },
      'call_outline'
    )

    expect(outlineResult.totalLines).toBeGreaterThan(15)
    expect(outlineResult.symbolsCount).toBeGreaterThanOrEqual(4)

    const symbolNames = outlineResult.symbols.map((s: any) => s.name)
    expect(symbolNames).toContain('UserConfig')
    expect(symbolNames).toContain('Status')
    expect(symbolNames).toContain('DatabaseManager')
    expect(symbolNames).toContain('initializeDatabase')
    expect(symbolNames).toContain('helperFunction')
  })

  it('should inspect git repository status using git_status tool', async () => {
    const gitTool = ToolRegistry.getToolByName('git_status')!
    const settings = AppSettingsSchema.parse({})

    const statusResult = await gitTool.execute(
      { showDiff: true },
      {
        mode: 'project',
        projectFolder: process.cwd(),
        settings
      },
      'call_git'
    )

    expect(statusResult.isGitRepo).toBe(true)
    expect(typeof statusResult.branch).toBe('string')
    expect(statusResult.branch.length).toBeGreaterThan(0)
    expect(Array.isArray(statusResult.recentCommits)).toBe(true)
  })

  it('should save, list, and delete project memories using manage_memory tool', async () => {
    const memoryTool = ToolRegistry.getToolByName('manage_memory')!
    const settings = AppSettingsSchema.parse({})

    // Create a dummy project in DB to test against
    const project = await dbQueries.saveProject({
      id: 'proj_mem_test_1',
      name: 'Memory Test Project',
      folderPath: testDir
    })
    const session = await dbQueries.saveProjectSession({
      id: 'sess_mem_test_1',
      projectId: project.id,
      title: 'Memory Test Session'
    })

    const ctx = {
      mode: 'project' as const,
      projectFolder: testDir,
      projectSessionId: session.id,
      settings
    }

    // 1. Save memory
    const saveRes = await memoryTool.execute(
      {
        action: 'save',
        key: 'testing_framework',
        content: 'We use Bun test for all unit testing.',
        category: 'convention'
      },
      ctx,
      'call_mem_1'
    )
    expect(saveRes.status).toBe('created')
    expect(saveRes.memory.key).toBe('testing_framework')

    // 2. List memories
    const listRes = await memoryTool.execute(
      { action: 'list' },
      ctx,
      'call_mem_2'
    )
    expect(listRes.count).toBeGreaterThanOrEqual(1)
    const found = listRes.memories.find((m: any) => m.key === 'testing_framework')
    expect(found).toBeDefined()
    expect(found.content).toBe('We use Bun test for all unit testing.')

    // 3. Delete memory
    const delRes = await memoryTool.execute(
      { action: 'delete', key: 'testing_framework' },
      ctx,
      'call_mem_3'
    )
    expect(delRes.status).toBe('deleted')
  })
})
