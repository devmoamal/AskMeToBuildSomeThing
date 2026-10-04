import type { AgentTool, AgentToolContext } from './types'
import { readFileTool } from './read-file'
import { createFileTool } from './create-file'
import { editFileTool } from './edit-file'
import { terminalTool } from './terminal'
import { canvasTool } from './canvas'
import { askUserTool } from './ask-user'
import { webSearchTool } from './web-search'
import { readUrlTool } from './read-url'
import { listDirTool } from './list-dir'
import { findFilesTool } from './find-files'
import { searchCodeTool } from './search-code'
import { customizeAppTool } from './customize-app'
import { scheduleTaskTool } from './schedule-task'
import { manageMemoryTool } from './manage-memory'
import { getFileOutlineTool } from './get-file-outline'
import { gitStatusTool } from './git-status'
import { taskTool } from './task'
import { checkDiagnosticsTool } from './check-diagnostics'
import { searchSymbolsTool } from './search-symbols'
import { manageCheckpointsTool } from './manage-checkpoints'
import { manageTodosTool } from './manage-todos'
import { InvalidArgumentsError } from './errors'
import { TruncateService } from './truncate'

export const allTools: AgentTool[] = [
  readFileTool,
  createFileTool,
  editFileTool,
  terminalTool,
  listDirTool,
  findFilesTool,
  searchCodeTool,
  searchSymbolsTool,
  getFileOutlineTool,
  gitStatusTool,
  checkDiagnosticsTool,
  manageCheckpointsTool,
  manageMemoryTool,
  taskTool,
  canvasTool,
  askUserTool,
  webSearchTool,
  readUrlTool,
  customizeAppTool,
  scheduleTaskTool,
  manageTodosTool
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

  /**
   * Executes a tool with automatic schema validation and managed output truncation
   */
  static async executeTool(
    toolName: string,
    rawArgs: any,
    ctx: AgentToolContext,
    toolCallId: string
  ): Promise<{ result: any; truncated: boolean; outputPath?: string }> {
    const tool = this.getToolByName(toolName)
    if (!tool) {
      throw new Error(`Tool "${toolName}" is not recognized or installed.`)
    }

    if (!tool.allowedModes.includes(ctx.mode)) {
      throw new Error(`Tool "${toolName}" is restricted and cannot be used in ${ctx.mode} mode.`)
    }

    // 1. Schema Validation & Self-Healing
    let validatedArgs = rawArgs
    if (tool.parameters) {
      const parsed = tool.parameters.safeParse(rawArgs)
      if (!parsed.success) {
        throw InvalidArgumentsError.fromZodError(toolName, parsed.error)
      }
      validatedArgs = parsed.data
    }

    // 2. Execution
    const rawResult = await tool.execute(validatedArgs, ctx, toolCallId)

    // 3. Managed Truncation / Disk Spillover
    if (typeof rawResult === 'string') {
      const truncated = await TruncateService.truncateOutput(rawResult, {
        toolName,
        projectFolder: ctx.projectFolder
      })
      return {
        result: truncated.content,
        truncated: truncated.truncated,
        outputPath: truncated.outputPath
      }
    } else if (rawResult && typeof rawResult === 'object') {
      const jsonStr = JSON.stringify(rawResult, null, 2)
      if (jsonStr.length > 50 * 1024 || jsonStr.split('\n').length > 2000) {
        const truncated = await TruncateService.truncateOutput(jsonStr, {
          toolName,
          projectFolder: ctx.projectFolder
        })
        return {
          result: truncated.content,
          truncated: truncated.truncated,
          outputPath: truncated.outputPath
        }
      }
    }

    return {
      result: rawResult,
      truncated: false
    }
  }
}
