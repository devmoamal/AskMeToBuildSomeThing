import type { AgentTool } from './types'
import { readFileTool } from './read-file'
import { createFileTool } from './create-file'
import { editFileTool } from './edit-file'
import { terminalTool } from './terminal'
import { canvasTool } from './canvas'
import { askUserTool } from './ask-user'
import { webSearchTool } from './web-search'
import { listDirTool } from './list-dir'
import { findFilesTool } from './find-files'
import { searchCodeTool } from './search-code'

export const allTools: AgentTool[] = [
  readFileTool,
  createFileTool,
  editFileTool,
  terminalTool,
  listDirTool,
  findFilesTool,
  searchCodeTool,
  canvasTool,
  askUserTool,
  webSearchTool
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
