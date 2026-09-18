import type { AgentTool } from './types'
import { readFileTool } from './read-file'
import { createFileTool } from './create-file'
import { terminalTool } from './terminal'
import { canvasTool } from './canvas'
import { askUserTool } from './ask-user'

export const allTools: AgentTool[] = [
  readFileTool,
  createFileTool,
  terminalTool,
  canvasTool,
  askUserTool
]

export class ToolRegistry {
  static getToolsForMode(mode: 'chat' | 'project'): AgentTool[] {
    return allTools.filter(tool => tool.allowedModes.includes(mode))
  }

  static getToolByName(name: string): AgentTool | undefined {
    return allTools.find(tool => tool.name === name)
  }

  static getToolDeclarations(mode: 'chat' | 'project') {
    const tools = this.getToolsForMode(mode)
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.jsonSchema
    }))
  }
}
