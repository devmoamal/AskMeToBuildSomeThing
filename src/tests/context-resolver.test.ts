import { describe, it, expect, beforeEach } from 'bun:test'
import path from 'node:path'
import fs from 'node:fs/promises'
import { resolveMentionContext } from '../main/agent/context-resolver'
import { initializeDatabase } from '../main/db/client'
import { dbQueries } from '../main/db/queries'

describe('Context Resolver: @file, @git, @diff, @canvas Autocomplete Expansion', () => {
  const testDir = path.resolve(process.cwd(), '.data/test_context_resolver')

  beforeEach(async () => {
    initializeDatabase(':memory:')
    await fs.mkdir(testDir, { recursive: true })
  })

  it('should return unchanged prompt when no mentions exist', async () => {
    const res = await resolveMentionContext({
      prompt: 'Hello world, can you help me write code?'
    })

    expect(res.hasMentions).toBe(false)
    expect(res.resolvedMentions).toHaveLength(0)
    expect(res.enrichedPrompt).toBe('Hello world, can you help me write code?')
  })

  it('should resolve @file mention with existing file contents', async () => {
    const testFile = path.join(testDir, 'module.ts')
    await fs.writeFile(testFile, 'export const answer = 42\nexport function calc() { return answer }')

    const res = await resolveMentionContext({
      prompt: 'Please review @file:module.ts for correctness.',
      projectFolder: testDir
    })

    expect(res.hasMentions).toBe(true)
    expect(res.resolvedMentions).toHaveLength(1)
    expect(res.resolvedMentions[0].type).toBe('file')
    expect(res.resolvedMentions[0].target).toBe('module.ts')
    expect(res.resolvedMentions[0].content).toContain('export const answer = 42')
    expect(res.enrichedPrompt).toContain('<injected_context>')
    expect(res.enrichedPrompt).toContain('<context type="file" target="module.ts">')
  })

  it('should gracefully handle non-existent @file mention without crashing', async () => {
    const res = await resolveMentionContext({
      prompt: 'Look at @file:non_existent_file.xyz please',
      projectFolder: testDir
    })

    expect(res.hasMentions).toBe(true)
    expect(res.resolvedMentions).toHaveLength(1)
    expect(res.resolvedMentions[0].error).toBeDefined()
    expect(res.resolvedMentions[0].error).toContain('Could not read file')
    expect(res.enrichedPrompt).toContain('Notice:')
  })

  it('should resolve @git in a project folder', async () => {
    const res = await resolveMentionContext({
      prompt: 'Check @git to see what branch I am on.',
      projectFolder: process.cwd()
    })

    expect(res.hasMentions).toBe(true)
    const gitMention = res.resolvedMentions.find(m => m.type === 'git')
    expect(gitMention).toBeDefined()
    expect(gitMention?.content).toContain('Branch:')
  })

  it('should resolve @canvas for an active session with saved canvas', async () => {
    const sessionId = 'test_session_canvas'
    await dbQueries.saveChat({
      id: sessionId,
      title: 'Canvas Chat'
    })

    await dbQueries.saveCanvas({
      id: 'canvas_1',
      chatId: sessionId,
      title: 'Architecture Blueprint',
      language: 'markdown',
      content: '# System Architecture\n- Service A\n- Service B'
    })

    const res = await resolveMentionContext({
      prompt: 'Update @canvas with latest specs',
      targetId: sessionId
    })

    expect(res.hasMentions).toBe(true)
    const canvasMention = res.resolvedMentions.find(m => m.type === 'canvas')
    expect(canvasMention).toBeDefined()
    expect(canvasMention?.content).toContain('Architecture Blueprint')
    expect(canvasMention?.content).toContain('Service A')
  })

  it('should resolve multiple mentions in a single prompt', async () => {
    const fileA = path.join(testDir, 'first.txt')
    await fs.writeFile(fileA, 'First file text')

    const res = await resolveMentionContext({
      prompt: 'Compare @file:first.txt with @git status',
      projectFolder: testDir
    })

    expect(res.hasMentions).toBe(true)
    expect(res.resolvedMentions.length).toBeGreaterThanOrEqual(2)
  })
})
