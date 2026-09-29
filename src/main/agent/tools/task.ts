import { TaskArgsSchema, type TaskArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { dbQueries } from '../../db/queries'
import { ProviderAdapterFactory } from '../providers/factory'
import type { ProviderChatMessage } from '../providers/base'
import { ToolRegistry } from './registry'

export const taskTool: AgentTool<TaskArgs> = {
  name: 'task',
  description: 'Delegate a specialized task to a subagent (e.g., "explore" for codebase discovery, "review" for auditing diffs/security, or "general" for a multi-step task) and receive a structured result.',
  parameters: TaskArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      subagent_type: {
        type: 'string',
        enum: ['explore', 'review', 'general'],
        description: 'Specialized role for the subagent'
      },
      description: {
        type: 'string',
        description: 'Short 3-5 word title of the task'
      },
      prompt: {
        type: 'string',
        description: 'Specific detailed task instructions for the subagent'
      }
    },
    required: ['description', 'prompt']
  },
  allowedModes: ['project'],
  async execute(args: TaskArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot launch subagent task without an active project folder.')
    }

    const provider = await dbQueries.getDefaultProvider()
    if (!provider) {
      throw new Error('No AI provider available to execute subagent task.')
    }

    // Role-specific subagent system instructions and allowed tools
    let roleInstructions = ''
    let allowedToolNames: string[] = []

    if (args.subagent_type === 'explore') {
      roleInstructions = `You are an expert Codebase Explorer subagent.
Your goal is to inspect the project files, search for symbols, understand directory layout, and return a comprehensive answer.
RULES:
1. You are READ-ONLY. Do NOT attempt to edit or create files.
2. Search and read thoroughly.
3. Conclude with a clear, structured summary directly answering the prompt.`
      allowedToolNames = ['read_file', 'list_dir', 'find_files', 'search_code', 'get_file_outline', 'git_status', 'web_search', 'read_url']
    } else if (args.subagent_type === 'review') {
      roleInstructions = `You are a Senior Code Reviewer subagent.
Your goal is to audit changes, verify code quality, check for security risks, type errors, or architectural inconsistencies.
RULES:
1. You are READ-ONLY. Inspect git_status, read modified files, and verify correctness.
2. Point out exact line numbers and concrete recommendations.
3. Conclude with an objective PASS / CONCERNS / FAIL assessment.`
      allowedToolNames = ['read_file', 'git_status', 'search_code', 'get_file_outline']
    } else {
      roleInstructions = `You are an autonomous Senior Engineer subagent working on a delegated task.
Execute the required steps efficiently and report back your findings and completed actions.`
      allowedToolNames = ['read_file', 'create_file', 'edit_file', 'use_terminal', 'list_dir', 'find_files', 'search_code', 'get_file_outline', 'git_status']
    }

    const allTools = ToolRegistry.getToolsForMode('project')
    const subagentTools = allTools.filter(t => allowedToolNames.includes(t.name))
    const toolDeclarations = subagentTools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.jsonSchema
    }))

    const subagentMessages: ProviderChatMessage[] = [
      {
        role: 'system',
        content: `${roleInstructions}\nWorking directory: ${ctx.projectFolder}`
      },
      {
        role: 'user',
        content: `Delegated Task: ${args.description}\n\n${args.prompt}`
      }
    ]

    const adapter = ProviderAdapterFactory.getAdapter(provider.type)
    let subagentResultText = ''
    let iterations = 0
    const maxSubagentIterations = 10
    let continueLoop = true

    while (continueLoop && iterations < maxSubagentIterations) {
      iterations++
      continueLoop = false

      const stream = adapter.streamChat({
        config: provider,
        model: provider.defaultModel || 'default',
        messages: subagentMessages,
        tools: toolDeclarations
      })

      let iterationText = ''
      const pendingToolCalls: any[] = []

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          iterationText += chunk.text
          subagentResultText += chunk.text
        } else if (chunk.type === 'tool_call') {
          if (!pendingToolCalls.some(tc => tc.id === chunk.toolCall.id)) {
            pendingToolCalls.push(chunk.toolCall)
          }
        }
      }

      if (pendingToolCalls.length > 0) {
        continueLoop = true
        subagentMessages.push({
          role: 'assistant',
          content: iterationText,
          toolCalls: pendingToolCalls
        })

        for (const tc of pendingToolCalls) {
          const tool = subagentTools.find(t => t.name === tc.toolName)
          if (!tool) {
            subagentMessages.push({
              role: 'tool',
              toolCallId: tc.id,
              content: `Error: Tool ${tc.toolName} not allowed for ${args.subagent_type} subagent.`
            })
            continue
          }

          try {
            const rawResult = await tool.execute(tc.args, ctx, tc.id)
            const stringResult = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult)
            // Bound subagent tool output to 2000 chars to keep subagent loop lightweight
            const boundedResult = stringResult.length > 2500 ? `${stringResult.slice(0, 2500)}... [truncated]` : stringResult

            subagentMessages.push({
              role: 'tool',
              toolCallId: tc.id,
              content: boundedResult
            })
          } catch (err: any) {
            subagentMessages.push({
              role: 'tool',
              toolCallId: tc.id,
              content: `Error: ${err.message}`
            })
          }
        }
      }
    }

    return {
      subagent_type: args.subagent_type,
      description: args.description,
      state: 'completed',
      iterations,
      result: subagentResultText.trim() || 'Subagent completed execution.'
    }
  }
}
