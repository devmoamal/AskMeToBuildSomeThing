import type {
  SendPromptPayload,
  AgentStreamEvent,
  Message,
  ToolCallRecord,
  CanvasDocument
} from '../../shared/types'
import { dbQueries } from '../db/queries'
import { ProviderAdapterFactory } from './providers/factory'
import type { ProviderChatMessage } from './providers/base'
import { ToolRegistry } from './tools/registry'
import type { AgentToolContext } from './tools/types'
import type { QuestionnairePayload } from '../../shared/schemas'

export class AgentRunner {
  private static activePauses: Map<string, {
    resolve: (answers: Record<string, string | string[]>) => void
    reject: (err: any) => void
  }> = new Map()

  private static activeApprovals: Map<string, {
    resolve: (approved: boolean) => void
    reject: (err: any) => void
  }> = new Map()

  private static activeAbortControllers: Map<string, AbortController> = new Map()

  static submitUserResponse(toolCallId: string, answers: Record<string, string | string[]>) {
    const pause = this.activePauses.get(toolCallId)
    if (pause) {
      pause.resolve(answers)
      this.activePauses.delete(toolCallId)
      return true
    }
    return false
  }

  static approveTool(toolCallId: string, approved: boolean) {
    const approval = this.activeApprovals.get(toolCallId)
    if (approval) {
      approval.resolve(approved)
      this.activeApprovals.delete(toolCallId)
      return true
    }
    return false
  }

  static abort(targetId: string) {
    const controller = this.activeAbortControllers.get(targetId)
    if (controller) {
      controller.abort()
      this.activeAbortControllers.delete(targetId)
      return true
    }
    return false
  }

  static async *run(
    payload: SendPromptPayload,
    onEvent?: (event: AgentStreamEvent) => void
  ): AsyncGenerator<AgentStreamEvent, void, unknown> {
    const abortController = new AbortController()
    this.activeAbortControllers.set(payload.targetId, abortController)

    try {
      const settings = await dbQueries.getSettings()
      let provider = await dbQueries.getProviderById(payload.providerId)
      if (!provider) {
        provider = await dbQueries.getDefaultProvider()
      }
      if (!provider) {
        const errorEv: AgentStreamEvent = {
          type: 'error',
          error: 'No AI provider configured. Please configure a provider in Settings or the Onboarding Wizard.'
        }
        if (onEvent) onEvent(errorEv)
        yield errorEv
        return
      }

      // Save user message
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const userMessage: Message = {
        id: userMessageId,
        chatId: payload.mode === 'chat' ? payload.targetId : undefined,
        projectSessionId: payload.mode === 'project' ? payload.targetId : undefined,
        role: 'user',
        content: payload.prompt,
        createdAt: Date.now()
      }
      await dbQueries.saveMessage(userMessage)

      // Fetch message history
      const history = await dbQueries.getMessages(payload.targetId, payload.mode === 'project')

      // Generate AI Title asynchronously for the first message in a chat or session
      if (history.length <= 1) {
        ;(async () => {
          try {
            const adapter = ProviderAdapterFactory.getAdapter(provider.type)
            const titlePrompt = `Generate a very short, concise title (2 to 5 words maximum, plain text, no quotes, no markdown, no ending period, title case) that summarizes this prompt:\n\n${payload.prompt.slice(0, 300)}`
            const titleStream = adapter.streamChat({
              config: provider,
              model: payload.model || provider.defaultModel || 'default',
              messages: [
                { role: 'system', content: 'You are a concise conversation title generator. Output ONLY the short title.' },
                { role: 'user', content: titlePrompt }
              ],
              tools: []
            })
            let generated = ''
            for await (const chunk of titleStream) {
              if (chunk.type === 'text') generated += chunk.text
            }
            let cleanTitle = generated.trim().replace(/^["'`]|["'`]$/g, '').replace(/\.$/, '').trim()
            if (!cleanTitle || cleanTitle.length > 50 || cleanTitle.includes('\n')) {
              cleanTitle = payload.prompt.trim().split(/\s+/).slice(0, 5).join(' ').slice(0, 35)
            }
            if (cleanTitle) {
              if (payload.mode === 'chat') {
                await dbQueries.saveChat({ id: payload.targetId, title: cleanTitle })
              } else {
                await dbQueries.saveProjectSession({ id: payload.targetId, title: cleanTitle })
              }
              const titleEv: AgentStreamEvent = { type: 'title_generated', targetId: payload.targetId, title: cleanTitle }
              if (onEvent) onEvent(titleEv)
            }
          } catch {
            const fallbackTitle = payload.prompt.trim().split(/\s+/).slice(0, 5).join(' ').slice(0, 35)
            if (fallbackTitle) {
              if (payload.mode === 'chat') {
                await dbQueries.saveChat({ id: payload.targetId, title: fallbackTitle })
              } else {
                await dbQueries.saveProjectSession({ id: payload.targetId, title: fallbackTitle })
              }
              const titleEv: AgentStreamEvent = { type: 'title_generated', targetId: payload.targetId, title: fallbackTitle }
              if (onEvent) onEvent(titleEv)
            }
          }
        })()
      }

      const basePrompt = payload.systemPrompt || (
        payload.mode === 'project' ? settings.projectSystemPrompt : settings.chatSystemPrompt
      )

      const instructions = payload.mode === 'chat'
        ? `
You are in conversational Chat Mode.
- Answer user questions directly with helpful explanations and clean, copyable markdown code blocks.
- When the user asks for code (e.g. "create me a guessing game in python"), write the complete code directly in your markdown response using standard markdown code fences with the language tag.
- ONLY call the "ask_user" tool when the user asks to interview them, asks for questions, or types "/grill-me".
- ONLY call the "make_canvas" tool when the user explicitly asks to create an editable canvas, document, or spec, or types "/canvas".
- Do NOT attempt to use terminal or file tools in Chat mode (they are only available in Project mode).
`
        : `
You are in Project Mode working within the project repository: ${payload.projectFolder || 'current project'}.
- Use "read_file" to inspect existing code and configuration.
- Use "create_file" to write or modify project files.
- Use "use_terminal" to run test, build, or dev commands.
- Use "ask_user" when user types "/grill-me" or asks to clarify requirements.
- Use "make_canvas" when user requests a standalone canvas document.
`
      const systemPrompt = `${basePrompt}\n${instructions}`

      const providerMessages: ProviderChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ]

      for (const m of history) {
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          providerMessages.push({
            role: 'assistant',
            content: m.content || '',
            toolCalls: m.toolCalls
          })
          for (const tc of m.toolCalls) {
            const toolResultContent = tc.result !== undefined
              ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result))
              : (tc.error ? `Error: ${tc.error}` : 'Completed')
            providerMessages.push({
              role: 'tool',
              toolCallId: tc.id,
              content: toolResultContent
            })
          }
        } else {
          providerMessages.push({
            role: m.role as any,
            content: m.content
          })
        }
      }

      const availableTools = ToolRegistry.getToolsForMode(payload.mode)
      const toolDeclarations = ToolRegistry.getToolDeclarations(payload.mode)

      let continueLoop = true
      let iterationCount = 0
      const maxIterations = 8

      let fullAssistantText = ''
      const completedToolCalls: ToolCallRecord[] = []

      while (continueLoop && iterationCount < maxIterations) {
        iterationCount++
        continueLoop = false

        const adapter = ProviderAdapterFactory.getAdapter(provider.type)
        const stream = adapter.streamChat({
          config: provider,
          model: payload.model || provider.defaultModel || 'default',
          messages: providerMessages,
          tools: toolDeclarations,
          signal: abortController.signal
        })

        const pendingToolCallsInIteration: ToolCallRecord[] = []
        let iterationText = ''

        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            throw new Error('Agent execution was aborted by user.')
          }

          if (chunk.type === 'text') {
            iterationText += chunk.text
            fullAssistantText += chunk.text
            const ev: AgentStreamEvent = { type: 'chunk', text: chunk.text }
            if (onEvent) onEvent(ev)
            yield ev
          } else if (chunk.type === 'tool_call') {
            pendingToolCallsInIteration.push(chunk.toolCall)
            completedToolCalls.push(chunk.toolCall)

            const ev: AgentStreamEvent = { type: 'tool_call_start', call: chunk.toolCall }
            if (onEvent) onEvent(ev)
            yield ev
          }
        }

        // If there were tool calls, execute them
        if (pendingToolCallsInIteration.length > 0) {
          continueLoop = true

          // In multi-step conversations, the assistant message that made the tool calls MUST precede the tool result messages
          providerMessages.push({
            role: 'assistant',
            content: iterationText,
            toolCalls: pendingToolCallsInIteration
          })

          for (const tc of pendingToolCallsInIteration) {
            const tool = ToolRegistry.getToolByName(tc.toolName)
            if (!tool) {
              tc.status = 'failed'
              tc.error = `Tool ${tc.toolName} not recognized`
              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed' }
              if (onEvent) onEvent(ev)
              yield ev
              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: `Error: Tool ${tc.toolName} not recognized`
              })
              continue
            }

            // Check tool scope
            if (!tool.allowedModes.includes(payload.mode)) {
              tc.status = 'failed'
              tc.error = `Tool ${tc.toolName} is restricted and cannot be used in ${payload.mode} mode`
              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed' }
              if (onEvent) onEvent(ev)
              yield ev
              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: `Error: Tool ${tc.toolName} cannot be used in ${payload.mode} mode`
              })
              continue
            }

            const toolContext: AgentToolContext = {
              mode: payload.mode,
              projectFolder: payload.projectFolder,
              chatId: payload.mode === 'chat' ? payload.targetId : undefined,
              projectSessionId: payload.mode === 'project' ? payload.targetId : undefined,
              settings,
              onStream: (subChunk) => {
                const ev: AgentStreamEvent = { type: 'tool_call_stream', id: tc.id, chunk: subChunk }
                if (onEvent) onEvent(ev)
              },
              pauseForQuestionnaire: async (qPayload: QuestionnairePayload, callId: string) => {
                const pauseEvent: AgentStreamEvent = {
                  type: 'pause_for_user',
                  questionnaire: qPayload,
                  toolCallId: callId
                }
                if (onEvent) onEvent(pauseEvent)
                return new Promise<Record<string, string | string[]>>((resolve, reject) => {
                  AgentRunner.activePauses.set(callId, { resolve, reject })
                })
              },
              requireToolApproval: async (tName: string, args: any) => {
                tc.status = 'requires_approval'
                const approvalEv: AgentStreamEvent = { type: 'tool_call_start', call: tc }
                if (onEvent) onEvent(approvalEv)
                return new Promise<boolean>((resolve, reject) => {
                  AgentRunner.activeApprovals.set(tc.id, { resolve, reject })
                })
              }
            }

            try {
              tc.status = 'executing'
              const result = await tool.execute(tc.args, toolContext, tc.id)
              tc.status = 'completed'
              tc.result = result

              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result, status: 'completed' }
              if (onEvent) onEvent(ev)
              yield ev

              // If canvas was created, emit canvas event
              if (tc.toolName === 'make_canvas' && result?.canvasId) {
                const canvasDoc: CanvasDocument = {
                  id: result.canvasId,
                  messageId: tc.id,
                  chatId: toolContext.chatId,
                  projectSessionId: toolContext.projectSessionId,
                  title: result.title,
                  language: result.language,
                  content: result.content,
                  version: result.version || 1,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
                const canvasEv: AgentStreamEvent = { type: 'canvas_created', canvas: canvasDoc }
                if (onEvent) onEvent(canvasEv)
                yield canvasEv
              }

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
              })
            } catch (toolErr: any) {
              tc.status = 'failed'
              tc.error = toolErr.message
              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed' }
              if (onEvent) onEvent(ev)
              yield ev

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: `Error: ${toolErr.message}`
              })
            }
          }
        }
      }

      // Save final assistant message
      const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const finalMessage: Message = {
        id: assistantMessageId,
        chatId: payload.mode === 'chat' ? payload.targetId : undefined,
        projectSessionId: payload.mode === 'project' ? payload.targetId : undefined,
        role: 'assistant',
        content: fullAssistantText,
        toolCalls: completedToolCalls.length > 0 ? completedToolCalls : undefined,
        createdAt: Date.now()
      }
      await dbQueries.saveMessage(finalMessage)

      const doneEv: AgentStreamEvent = { type: 'done', finalMessage }
      if (onEvent) onEvent(doneEv)
      yield doneEv
    } catch (err: any) {
      const errorEv: AgentStreamEvent = { type: 'error', error: err.message || 'Agent error occurred' }
      if (onEvent) onEvent(errorEv)
      yield errorEv
    } finally {
      this.activeAbortControllers.delete(payload.targetId)
    }
  }
}
