import { describe, it, expect } from 'bun:test'
import { MakeCanvasArgsSchema } from '../shared/schemas'
import { ToolRegistry } from '../main/agent/tools/registry'
import { initializeDatabase } from '../main/db/client'
import { dbQueries } from '../main/db/queries'

describe('Canvas Document Tool & Typeset Processing', () => {
  it('should validate canvas args with Zod schema', () => {
    const valid = MakeCanvasArgsSchema.parse({
      title: 'Database Design',
      language: 'markdown',
      content: '# DB Design\nTables and columns.'
    })
    expect(valid.title).toBe('Database Design')
    expect(valid.language).toBe('markdown')

    expect(() => MakeCanvasArgsSchema.parse({ title: '' })).toThrow()
  })

  it('should execute make_canvas tool and save to database', async () => {
    initializeDatabase(':memory:')
    const parentChat = await dbQueries.saveChat({ id: 'chat_c_test', title: 'Canvas Test Chat' })

    const canvasTool = ToolRegistry.getToolByName('make_canvas')!
    const result = await canvasTool.execute(
      {
        title: 'Project Roadmap',
        language: 'markdown',
        content: '## Phase 1\n- MVP with Electron and Vite\n- Tests passing'
      },
      {
        mode: 'chat',
        chatId: parentChat.id,
        settings: await dbQueries.getSettings()
      },
      'call_canvas_1'
    )

    expect(result.success).toBe(true)
    expect(result.canvasId).toBeDefined()
    expect(result.title).toBe('Project Roadmap')
    expect(result.version).toBe(1)

    const savedCanvases = await dbQueries.getCanvases(parentChat.id, false)
    expect(savedCanvases.length).toBe(1)
    expect(savedCanvases[0].title).toBe('Project Roadmap')
  })
})
