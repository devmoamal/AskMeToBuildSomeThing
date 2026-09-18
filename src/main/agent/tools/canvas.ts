import { MakeCanvasArgsSchema, type MakeCanvasArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { dbQueries } from '../../db/queries'

export const canvasTool: AgentTool<MakeCanvasArgs> = {
  name: 'make_canvas',
  description: 'Create or update an interactive in-chat markdown canvas document for plans, code, guides, or notes.',
  parameters: MakeCanvasArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Descriptive title of the document or code artifact'
      },
      language: {
        type: 'string',
        description: 'Programming or markup language (e.g. typescript, javascript, python, html, css, markdown)',
        default: 'markdown'
      },
      content: {
        type: 'string',
        description: 'The complete markdown text or source code for the canvas document'
      }
    },
    required: ['title', 'content']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: MakeCanvasArgs, ctx: AgentToolContext, toolCallId: string) {
    const canvasId = `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const saved = await dbQueries.saveCanvas({
      id: canvasId,
      chatId: ctx.chatId,
      projectSessionId: ctx.projectSessionId,
      messageId: toolCallId,
      title: args.title,
      language: args.language || 'markdown',
      content: args.content
    })

    return {
      canvasId: saved.id,
      title: saved.title,
      language: saved.language,
      content: saved.content,
      version: saved.version,
      success: true
    }
  }
}
