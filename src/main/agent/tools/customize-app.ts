import { CustomizeAppArgsSchema, type CustomizeAppArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { dbQueries } from '../../db/queries'

export const customizeAppTool: AgentTool<CustomizeAppArgs> = {
  name: 'customize_app',
  description: 'Customize the desktop app appearance (colors, theme, CSS styling, fonts, layouts) and assistant behavior in production runtime. Use this tool whenever the user prompts to customize, restyle, retheme, recolor, change fonts, or adjust the app UI or settings.',
  parameters: CustomizeAppArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      customCss: {
        type: 'string',
        description: 'CSS rules to inject into the live app at runtime. You can style CSS variables (e.g. :root { --primary: #..., --background: #..., --foreground: #... }), custom fonts, sidebar styles, layout tweaks, or component styles.'
      },
      explanation: {
        type: 'string',
        description: 'Clear, concise explanation of the customizations made to the app.'
      },
      chatSystemPrompt: {
        type: 'string',
        description: 'Optional custom system prompt / personality for the assistant in No Project mode.'
      },
      projectSystemPrompt: {
        type: 'string',
        description: 'Optional custom system prompt / personality for the assistant in Project mode.'
      }
    },
    required: ['explanation']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: CustomizeAppArgs, _ctx: AgentToolContext) {
    const updates: Record<string, any> = {}

    if (args.customCss !== undefined) {
      updates.customCss = args.customCss
    }
    if (args.chatSystemPrompt) {
      updates.chatSystemPrompt = args.chatSystemPrompt
    }
    if (args.projectSystemPrompt) {
      updates.projectSystemPrompt = args.projectSystemPrompt
    }

    const newSettings = await dbQueries.saveSettings(updates)

    return {
      success: true,
      explanation: args.explanation,
      customCssApplied: Boolean(args.customCss),
      settings: newSettings
    }
  }
}
