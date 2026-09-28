import type {
  SendPromptPayload,
  AgentStreamEvent,
  Message,
  ToolCallRecord,
  CanvasDocument,
  MessagePart
} from '../../shared/types'
import { dbQueries } from '../db/queries'
import { ProviderAdapterFactory } from './providers/factory'
import type { ProviderChatMessage } from './providers/base'
import { ToolRegistry } from './tools/registry'
import type { AgentToolContext } from './tools/types'
import type { QuestionnairePayload } from '../../shared/schemas'
import { parseThinkingAndContent } from '../../shared/thinking'

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

    let fullAssistantText = ''
    const completedToolCalls: ToolCallRecord[] = []
    const chronologicalParts: MessagePart[] = []

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

      // Set concise initial thread title immediately without firing a colliding concurrent API stream
      if (history.length <= 1) {
        let cleanTitle = payload.prompt.trim().split(/\s+/).slice(0, 5).join(' ').slice(0, 35)
        cleanTitle = cleanTitle.replace(/^["'`]|["'`]$/g, '').replace(/\.$/, '').trim()
        if (cleanTitle) {
          if (payload.mode === 'chat') {
            await dbQueries.saveChat({ id: payload.targetId, title: cleanTitle })
          } else {
            await dbQueries.saveProjectSession({ id: payload.targetId, title: cleanTitle })
          }
          const titleEv: AgentStreamEvent = { type: 'title_generated', targetId: payload.targetId, title: cleanTitle }
          if (onEvent) onEvent(titleEv)
        }
      }

      const basePrompt = payload.systemPrompt || (
        payload.mode === 'project' ? settings.projectSystemPrompt : settings.chatSystemPrompt
      )

      let memoryContext = ''
      try {
        let projectId: string | undefined
        if (payload.mode === 'project') {
          const sessions = await dbQueries.getProjectSessions(payload.targetId)
          if (sessions && sessions[0]) projectId = sessions[0].projectId
        }
        if (projectId) {
          const memories = await dbQueries.getProjectMemories(projectId)
          if (memories.length > 0) {
            memoryContext = `\n\nPERSISTENT PROJECT MEMORY & ARCHITECTURAL RULES:\n` +
              memories.map(m => `- [${m.category.toUpperCase()}] ${m.key}: ${m.content}`).join('\n')
          }
        }
      } catch {}

      const instructions = payload.mode === 'chat'
        ? `
You are in conversational Chat Mode.
- Answer user questions directly with helpful explanations and clean, copyable markdown code blocks.
- When the user asks for code, write the complete code directly in your markdown response using standard markdown code fences with the language tag.
- Use "web_search" when the user asks for real-time information, current facts, up-to-date documentation, package releases, news, or when you need external web references.
- Use "read_url" to crawl and deep-dive into full webpage contents, documentation pages, or articles found via web search or provided directly by the user.
- Use "customize_app" when the user asks to customize, restyle, retheme, recolor, change fonts, or adjust the app UI appearance or system instructions. Write valid CSS targeting variables or classes to style the app live in production.
- Use "schedule_task" when the user asks to wait, delay, or schedule a command, reminder, or prompt to execute in the background (e.g. "ping google.com and tell me after 10 min").
- ONLY call the "ask_user" tool when the user asks to interview them, asks for questions, or types "/grill-me".
- QUESTIONING RULE (/grill-me): You must ask EXACTLY ONE question at a time using 'ask_user'. NEVER ask multiple questions at once. After receiving the user's answer, decide whether to ask the next single question or proceed to providing code/solution.
- ONLY call the "make_canvas" tool when the user explicitly asks to create an editable canvas, document, or spec, or types "/canvas".
- COMMAND PARITY:
  - If user types "/summary": Provide an executive recap of the conversation, decisions made, and notes.
  - If user types "/compact": Review the thread, summarize older points into a compact state, and acknowledge context compaction.
  - If user types "/extend": Propose 3 high-value next features or extensions based on the discussion.
- Do NOT attempt to use terminal or file tools in Chat mode (they are only available in Project mode).
`
        : `
You are an autonomous senior software engineering agent operating in a continuous, self-verifying loop in the project repository: ${payload.projectFolder || 'current project'}.

AUTONOMOUS EXECUTION PRINCIPLES:
1. WORK CONTINUOUSLY UNTIL FULLY COMPLETE: Do not stop prematurely or hand back an incomplete task. If a task requires multiple steps, research, edits, and tests, keep working uninterrupted until the entire job is done.
2. CODEBASE EXPLORATION: Use "list_dir" to understand folder structures and "find_files" to locate files. Use "search_code" (grep) to locate functions, types, and symbol definitions across the project.
3. CONTEXT GATHERING: Use "read_file" to read relevant files and understand existing patterns. You can call multiple read or search tools in a single turn to gather context quickly.
4. TARGETED EDITS: Use "edit_file" with old_str/new_str for surgical edits or full content replacements. Use "create_file" for new modules.
5. SELF-VERIFICATION & COMPLETE EXECUTION: Always test and verify your changes using "use_terminal" (e.g. running test runners, compiler checks, or build commands). The terminal will wait until the command finishes completely. If a test fails, inspect the output, fix the code, and re-run until it passes.
6. TASK SCHEDULING: Use "schedule_task" if the user wants to run or check something after a delay (e.g. "ping google.com after 10 min").
7. CONCLUDE CLEANLY: Once changes are verified, provide a clear, concise summary of the changes made and the validation results.
- Use "ask_user" ONLY when user input is essential or when "/grill-me" is requested (ask ONE question at a time).
- Use "web_search" when researching external packages, docs, or web APIs, and use "read_url" to deep-dive into full documentation, tutorials, or GitHub issues from any found links.
- Use "customize_app" when the user asks to customize or retheme the app UI or system instructions.
- COMMAND PARITY:
  - If user types "/summary": Generate a comprehensive changelog and execution status report.
  - If user types "/extend": Inspect the codebase and propose the next 3 high-value features or refactors to build.
  - If user types "/compact": Acknowledge context compaction and summarize recent milestones.
  - If user types "/review": Perform a rigorous code review of modified files.
  - If user types "/test": Run the test suite and fix any broken tests autonomously.
`
      const systemPrompt = `${basePrompt}\n${instructions}${memoryContext}`

      const providerMessages: ProviderChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ]

      // Prune historical tool outputs older than the last 4 messages to save 80%+ tokens
      const historicalCutoff = Math.max(0, history.length - 4)

      for (let i = 0; i < history.length; i++) {
        const m = history[i]
        const isHistorical = settings.pruneHistoricalToolOutputs !== false && i < historicalCutoff

        if (m.role === 'assistant') {
          const thinkingPart = m.parts?.find(p => p.type === 'thinking') as { text: string } | undefined
          const parsed = parseThinkingAndContent(m.content || '')
          const thinking = thinkingPart?.text || parsed.thinking || undefined
          const cleanContent = parsed.content || ''

          providerMessages.push({
            role: 'assistant',
            content: cleanContent,
            reasoning_content: thinking,
            toolCalls: m.toolCalls && m.toolCalls.length > 0 ? m.toolCalls : undefined
          })

          if (m.toolCalls && m.toolCalls.length > 0) {
            for (const tc of m.toolCalls) {
              let toolResultContent = tc.result !== undefined
                ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result))
                : (tc.error ? `Error: ${tc.error}` : 'Completed')

              // Prune large historical tool outputs to conserve prompt context
              if (isHistorical && toolResultContent.length > 300) {
                if (tc.toolName === 'read_file') {
                  const lines = toolResultContent.split('\n').length
                  toolResultContent = `[read_file completed: ${lines} lines reviewed in earlier turn]`
                } else if (tc.toolName === 'use_terminal') {
                  const lines = toolResultContent.split('\n').length
                  toolResultContent = `[use_terminal completed: command succeeded (${lines} lines output)]`
                } else if (tc.toolName === 'list_dir' || tc.toolName === 'find_files' || tc.toolName === 'search_code') {
                  toolResultContent = `[Codebase exploration query completed previously]`
                } else if (tc.toolName === 'read_url' || tc.toolName === 'web_search') {
                  toolResultContent = `[Web content analyzed in earlier turn]`
                } else {
                  toolResultContent = toolResultContent.slice(0, 250) + '... [Historical output collapsed to save context tokens]'
                }
              }

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: toolResultContent
              })
            }
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
      // Infinite mode: run up to 500 iterations without interrupting until the AI is completely done
      const isInfinite = settings.infiniteLoop !== false
      const maxIterations = isInfinite ? 500 : (payload.mode === 'project' ? 35 : 12)

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

            if (chronologicalParts.length === 0 || chronologicalParts[chronologicalParts.length - 1].type !== 'text') {
              chronologicalParts.push({ type: 'text', text: chunk.text })
            } else {
              const last = chronologicalParts[chronologicalParts.length - 1] as { type: 'text'; text: string }
              last.text += chunk.text
            }

            const ev: AgentStreamEvent = { type: 'chunk', text: chunk.text }
            if (onEvent) onEvent(ev)
            yield ev
          } else if (chunk.type === 'tool_call') {
            // Support batch tool calls: capture all distinct tool calls emitted in this turn
            const alreadyAdded = pendingToolCallsInIteration.some(tc => tc.id === chunk.toolCall.id)
            if (!alreadyAdded) {
              pendingToolCallsInIteration.push(chunk.toolCall)
              completedToolCalls.push(chunk.toolCall)
              chronologicalParts.push({ type: 'tool_call', toolCall: chunk.toolCall })

              const ev: AgentStreamEvent = { type: 'tool_call_start', call: chunk.toolCall }
              if (onEvent) onEvent(ev)
              yield ev
            }
          }
        }

        // If there were tool calls, execute them
        if (pendingToolCallsInIteration.length > 0) {
          continueLoop = true

          const parsedIter = parseThinkingAndContent(iterationText)
          // In multi-step conversations, the assistant message that made the tool calls MUST precede the tool result messages
          providerMessages.push({
            role: 'assistant',
            content: parsedIter.content || '',
            reasoning_content: parsedIter.thinking || undefined,
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

              // Update in chronologicalParts
              for (const p of chronologicalParts) {
                if (p.type === 'tool_call' && p.toolCall.id === tc.id) {
                  p.toolCall.status = 'completed'
                  p.toolCall.result = result
                }
              }

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

              // Update in chronologicalParts
              for (const p of chronologicalParts) {
                if (p.type === 'tool_call' && p.toolCall.id === tc.id) {
                  p.toolCall.status = 'failed'
                  p.toolCall.error = toolErr.message
                }
              }

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

      // Resolve chronological parts: extract thinking and clean text into sequential order
      const resolvedParts: MessagePart[] = []
      for (const p of chronologicalParts) {
        if (p.type === 'text') {
          const { thinking, content } = parseThinkingAndContent(p.text)
          if (thinking) {
            resolvedParts.push({ type: 'thinking', text: thinking })
          }
          if (content) {
            resolvedParts.push({ type: 'text', text: content })
          }
        } else {
          resolvedParts.push(p)
        }
      }

      // Append Completed Work Summary and Next Steps if tools were executed
      const filesCreated = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'create_file' && tc.args?.path).map(tc => tc.args.path))]
      const filesEdited = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'edit_file' && tc.args?.path).map(tc => tc.args.path))]
      const commandsRun = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'use_terminal' && tc.args?.command).map(tc => tc.args.command))]
      const scheduledTasks = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'schedule_task' && tc.args?.description).map(tc => tc.args.description))]

      if ((filesCreated.length > 0 || filesEdited.length > 0 || commandsRun.length > 0 || scheduledTasks.length > 0) && !fullAssistantText.includes('### 📋 Completed Work Summary')) {
        let summaryCard = '\n\n---\n### 📋 Completed Work Summary\n'
        if (filesCreated.length > 0) {
          summaryCard += `* **Files Created:** ${filesCreated.map(f => `\`${f}\``).join(', ')}\n`
        }
        if (filesEdited.length > 0) {
          summaryCard += `* **Files Modified:** ${filesEdited.map(f => `\`${f}\``).join(', ')}\n`
        }
        if (commandsRun.length > 0) {
          summaryCard += `* **Commands Executed:** ${commandsRun.slice(-3).map(c => `\`${c}\``).join(', ')}\n`
        }
        if (scheduledTasks.length > 0) {
          summaryCard += `* **Scheduled Tasks:** ${scheduledTasks.map(t => `\`${t}\``).join(', ')}\n`
        }
        summaryCard += `\n**Suggested Next Steps:** \`/test\` · \`/review\` · \`/extend\` · \`/summary\`\n`

        fullAssistantText += summaryCard
        resolvedParts.push({ type: 'text', text: summaryCard })
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
        parts: resolvedParts.length > 0 ? resolvedParts : undefined,
        createdAt: Date.now()
      }
      await dbQueries.saveMessage(finalMessage)

      const doneEv: AgentStreamEvent = { type: 'done', finalMessage }
      if (onEvent) onEvent(doneEv)
      yield doneEv
    } catch (err: any) {
      if (fullAssistantText || completedToolCalls.length > 0) {
        try {
          const resolvedParts: MessagePart[] = []
          for (const p of chronologicalParts) {
            if (p.type === 'text') {
              const { thinking, content } = parseThinkingAndContent(p.text)
              if (thinking) resolvedParts.push({ type: 'thinking', text: thinking })
              if (content) resolvedParts.push({ type: 'text', text: content })
            } else {
              resolvedParts.push(p)
            }
          }
          const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          const partialMessage: Message = {
            id: assistantMessageId,
            chatId: payload.mode === 'chat' ? payload.targetId : undefined,
            projectSessionId: payload.mode === 'project' ? payload.targetId : undefined,
            role: 'assistant',
            content: fullAssistantText,
            toolCalls: completedToolCalls.length > 0 ? completedToolCalls : undefined,
            parts: resolvedParts.length > 0 ? resolvedParts : undefined,
            createdAt: Date.now()
          }
          await dbQueries.saveMessage(partialMessage)
        } catch {}
      }
      const errorEv: AgentStreamEvent = { type: 'error', error: err.message || 'Agent error occurred' }
      if (onEvent) onEvent(errorEv)
      yield errorEv
    } finally {
      this.activeAbortControllers.delete(payload.targetId)
    }
  }
}
