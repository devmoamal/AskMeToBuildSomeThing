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
import { CompactionEngine, TokenEstimator } from './compaction'
import { InvalidArgumentsError } from './tools/errors'

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
          error: 'No AI provider configured. Please configure a provider in Settings or the Onboarding Wizard.',
          targetId: payload.targetId
        }
        if (onEvent) onEvent(errorEv)
        yield errorEv
        return
      }

      // Save user message
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const userParts: MessagePart[] = []
      if (payload.images && payload.images.length > 0) {
        for (const img of payload.images) {
          userParts.push({ type: 'image', mediaType: img.mediaType, base64: img.base64 })
        }
      }
      userParts.push({ type: 'text', text: payload.prompt })

      const userMessage: Message = {
        id: userMessageId,
        chatId: payload.mode === 'chat' ? payload.targetId : undefined,
        projectSessionId: payload.mode === 'project' ? payload.targetId : undefined,
        role: 'user',
        content: payload.prompt,
        images: payload.images,
        parts: userParts,
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
          const session = await dbQueries.getProjectSessionById(payload.targetId)
          if (session) {
            projectId = session.projectId
          } else if (payload.projectFolder) {
            const projects = await dbQueries.getProjects()
            const match = projects.find(p => p.folderPath === payload.projectFolder)
            if (match) projectId = match.id
          }
        }
        if (projectId) {
          const memories = await dbQueries.getProjectMemories(projectId)
          if (memories.length > 0) {
            memoryContext = `\n\nPERSISTENT PROJECT MEMORY & ARCHITECTURAL RULES:\n` +
              memories.map(m => `- [${m.category.toUpperCase()}] ${m.key}: ${m.content}`).join('\n')
          }
        }
      } catch {}

      const isPlanMode = payload.executionMode === 'plan' || payload.prompt.trim().startsWith('/plan')

      const projectInstructions = isPlanMode
        ? `
You are in PLAN MODE (Architect & Strategist) in the repository: ${payload.projectFolder || 'current project'}.
Your objective is to thoroughly investigate, analyze the codebase, and produce a bulletproof implementation plan.
RULES:
1. READ-ONLY EXPLORATION: Use "get_file_outline", "read_file", "search_code", "list_dir", and "git_status" to explore.
2. DO NOT make code edits or run destructive terminal commands in Plan Mode.
3. If requirements or architecture have ambiguities, use "ask_user" to interview the user.
4. When your research is complete, create an implementation spec/plan using "make_canvas" so the user can review and approve it before switching to Build mode.
`
        : `
You are an autonomous senior software engineering agent operating in a continuous, self-verifying loop in the project repository: ${payload.projectFolder || 'current project'}.

AUTONOMOUS EXECUTION PRINCIPLES:
1. WORK CONTINUOUSLY UNTIL FULLY COMPLETE: Do not stop prematurely or hand back an incomplete task. If a task requires multiple steps, research, edits, and tests, keep working uninterrupted until the entire job is done.
2. CODEBASE EXPLORATION & SYMBOL SEARCH: Use "search_symbols" to instantly find where functions, classes, and types are declared across the project. Use "get_file_outline" to inspect symbols in specific files. Use "list_dir" and "find_files" to explore structure.
3. SAFETY CHECKPOINTS & GIT AWARENESS: Before executing risky multi-file refactors, consider using "manage_checkpoints" ({ action: "create", description: "..." }) so the workspace can be restored at any point. Use "git_status" to inspect dirty files, branch, and diffs.
4. TARGETED EDITS: Use "edit_file" with old_str/new_str for surgical edits. Use "create_file" for new modules.
5. SELF-VERIFYING CODE HEALTH: Always run "check_diagnostics" after modifying source code to catch TypeScript/compiler errors, syntax issues, or broken imports immediately. Test execution with "use_terminal" (e.g. "bun test", "npm test"). If errors arise, fix them iteratively before reporting completion.
6. PERSISTENT MEMORY: Use "manage_memory" to record key architectural rules, technical constraints, or patterns for this project.
7. SUBAGENT DELEGATION: Use "task" to delegate independent exploratory work or code reviews to subagents.
8. TASK SCHEDULING: Use "schedule_task" if the user wants to run or check something after a delay.
9. CONCLUDE CLEANLY: Once changes are verified, provide a clear, concise summary of the changes made and the validation results.
- Use "ask_user" ONLY when user input is essential or when "/grill-me" is requested (ask ONE question at a time).
- Use "web_search" and "read_url" when researching external packages, docs, or web APIs.
- Use "customize_app" when the user asks to customize or retheme the app UI or system instructions.
- COMMAND PARITY:
  - If user types "/summary": Generate a comprehensive changelog and execution status report.
  - If user types "/extend": Inspect the codebase and propose the next 3 high-value features or refactors to build.
  - If user types "/compact": Review the thread, summarize older points into a compact state, and acknowledge context compaction.
  - If user types "/review": Perform a rigorous code review of modified files.
  - If user types "/test": Run the test suite and fix any broken tests autonomously.
  - If user types "/diagnostics": Run "check_diagnostics" and report any type/linter issues.
  - If user types "/checkpoint": Use "manage_checkpoints" to create, list, or restore safety snapshots.
  - If user types "/diff": Use "git_status" or "manage_checkpoints" to show active changes.
`

      const instructions = payload.mode === 'chat'
        ? `
You are in conversational Chat Mode.
- Answer user questions directly with helpful explanations and clean, copyable markdown code blocks.
- When the user asks for code, write the complete code directly in your markdown response using standard markdown code fences with the language tag.
- Use "web_search" when the user asks for real-time information, current facts, up-to-date documentation, package releases, news, or when you need external web references.
- Use "read_url" to crawl and deep-dive into full webpage contents, documentation pages, or articles found via web search or provided directly by the user.
- Use "customize_app" when the user asks to customize, restyle, retheme, recolor, change fonts, or adjust the app UI appearance or system instructions. Write valid CSS targeting variables or classes to style the app live in production.
- Use "schedule_task" when the user asks to wait, delay, or schedule a command, reminder, or prompt to execute in the background.
- ONLY call the "ask_user" tool when the user asks to interview them, asks for questions, or types "/grill-me".
- ONLY call the "make_canvas" tool when the user explicitly asks to create an editable canvas, document, or spec, or types "/canvas".
- Do NOT attempt to use terminal or file tools in Chat mode (they are only available in Project mode).
`
        : projectInstructions

      const systemPrompt = `${basePrompt}\n${instructions}${memoryContext}`

      const providerMessages: ProviderChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ]

      for (let i = 0; i < history.length; i++) {
        const m = history[i]
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
              const toolResultContent = tc.result !== undefined
                ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result))
                : (tc.error ? `Error: ${tc.error}` : 'Completed')

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: toolResultContent
              })
            }
          }
        } else {
          const isCurrentMsg = m.id === userMessageId
          providerMessages.push({
            role: m.role as any,
            content: m.content,
            images: isCurrentMsg ? payload.images : undefined
          })
        }
      }

      // --- Phase 1: Context Compaction Engine ---
      // 1. Passive Tool Result Pruning
      if (settings.pruneHistoricalToolOutputs !== false) {
        CompactionEngine.pruneHistoricalToolResults(
          providerMessages,
          settings.preserveRecentTokens || 10_000,
          30_000
        )
      }

      // 2. Estimate initial tokens
      let currentTokens = TokenEstimator.estimateMessages(providerMessages)
      const tokenEv: AgentStreamEvent = {
        type: 'token_usage',
        inputTokens: currentTokens,
        totalTokens: currentTokens,
        targetId: payload.targetId
      }
      if (onEvent) onEvent(tokenEv)
      yield tokenEv

      // 3. Active Compaction (if manually requested via /compact or tokens exceed threshold)
      const isManualCompact = payload.prompt.trim() === '/compact'
      const isAutoCompact = settings.autoCompactContext !== false && currentTokens > CompactionEngine.DEFAULT_MAX_CONTEXT_TOKENS

      if ((isManualCompact || isAutoCompact) && providerMessages.length > 5) {
        const { head, tail, priorSummary } = CompactionEngine.splitHeadAndTail(providerMessages)
        if (head.length > 1) {
          const serializedHead = head.map(m => CompactionEngine.serializeMessage(m)).join('\n\n')
          const summaryPrompt = CompactionEngine.buildCompactionPrompt(serializedHead, priorSummary)

          const adapter = ProviderAdapterFactory.getAdapter(provider.type)
          const summaryStream = adapter.streamChat({
            config: provider,
            model: payload.model || provider.defaultModel || 'default',
            messages: [
              {
                role: 'system',
                content: 'You are a context summarization engine. Produce a structured summary matching the template.'
              },
              { role: 'user', content: summaryPrompt }
            ]
          })

          let compactedSummary = ''
          for await (const chunk of summaryStream) {
            if (chunk.type === 'text') compactedSummary += chunk.text
          }

          if (compactedSummary.trim()) {
            // Replace head with the new anchor message
            providerMessages.splice(
              1, // keep system prompt
              head.length,
              {
                role: 'user',
                content: `[CONTEXT COMPACTION ANCHOR]\n\n${compactedSummary.trim()}`
              }
            )

            const compactEv: AgentStreamEvent = {
              type: 'compaction_done',
              summary: compactedSummary.trim(),
              targetId: payload.targetId
            }
            if (onEvent) onEvent(compactEv)
            yield compactEv

            // Update token usage estimate after compaction
            currentTokens = TokenEstimator.estimateMessages(providerMessages)
            const postTokenEv: AgentStreamEvent = {
              type: 'token_usage',
              inputTokens: currentTokens,
              totalTokens: currentTokens,
              targetId: payload.targetId
            }
            if (onEvent) onEvent(postTokenEv)
            yield postTokenEv
          }
        }
      }

      const availableTools = ToolRegistry.getToolsForMode(payload.mode)
      const toolDeclarations = ToolRegistry.getToolDeclarations(payload.mode)

      let continueLoop = true
      let iterationCount = 0
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

            const ev: AgentStreamEvent = { type: 'chunk', text: chunk.text, targetId: payload.targetId }
            if (onEvent) onEvent(ev)
            yield ev
          } else if (chunk.type === 'tool_call') {
            const alreadyAdded = pendingToolCallsInIteration.some(tc => tc.id === chunk.toolCall.id)
            if (!alreadyAdded) {
              pendingToolCallsInIteration.push(chunk.toolCall)
              completedToolCalls.push(chunk.toolCall)
              chronologicalParts.push({ type: 'tool_call', toolCall: chunk.toolCall })

              const ev: AgentStreamEvent = { type: 'tool_call_start', call: chunk.toolCall, targetId: payload.targetId }
              if (onEvent) onEvent(ev)
              yield ev
            }
          }
        }

        // If there were tool calls, execute them
        if (pendingToolCallsInIteration.length > 0) {
          continueLoop = true

          const parsedIter = parseThinkingAndContent(iterationText)
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
              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed', targetId: payload.targetId }
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
              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed', targetId: payload.targetId }
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
                const ev: AgentStreamEvent = { type: 'tool_call_stream', id: tc.id, chunk: subChunk, targetId: payload.targetId }
                if (onEvent) onEvent(ev)
              },
              pauseForQuestionnaire: async (qPayload: QuestionnairePayload, callId: string) => {
                const pauseEvent: AgentStreamEvent = {
                  type: 'pause_for_user',
                  questionnaire: qPayload,
                  toolCallId: callId,
                  targetId: payload.targetId
                }
                if (onEvent) onEvent(pauseEvent)
                return new Promise<Record<string, string | string[]>>((resolve, reject) => {
                  AgentRunner.activePauses.set(callId, { resolve, reject })
                })
              },
              requireToolApproval: async (tName: string, args: any) => {
                tc.status = 'requires_approval'
                const approvalEv: AgentStreamEvent = { type: 'tool_call_start', call: tc, targetId: payload.targetId }
                if (onEvent) onEvent(approvalEv)
                return new Promise<boolean>((resolve, reject) => {
                  AgentRunner.activeApprovals.set(tc.id, { resolve, reject })
                })
              }
            }

            try {
              tc.status = 'executing'
              // Execute through ToolRegistry with schema validation & managed disk spillover
              const execResult = await ToolRegistry.executeTool(tc.toolName, tc.args, toolContext, tc.id)
              tc.status = 'completed'
              tc.result = execResult.result

              // Update in chronologicalParts
              for (const p of chronologicalParts) {
                if (p.type === 'tool_call' && p.toolCall.id === tc.id) {
                  p.toolCall.status = 'completed'
                  p.toolCall.result = execResult.result
                }
              }

              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: execResult.result, status: 'completed', targetId: payload.targetId }
              if (onEvent) onEvent(ev)
              yield ev

              // If canvas was created, emit canvas event
              if (tc.toolName === 'make_canvas' && execResult.result?.canvasId) {
                const canvasDoc: CanvasDocument = {
                  id: execResult.result.canvasId,
                  messageId: tc.id,
                  chatId: toolContext.chatId,
                  projectSessionId: toolContext.projectSessionId,
                  title: execResult.result.title,
                  language: execResult.result.language,
                  content: execResult.result.content,
                  version: execResult.result.version || 1,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                }
                const canvasEv: AgentStreamEvent = { type: 'canvas_created', canvas: canvasDoc, targetId: payload.targetId }
                if (onEvent) onEvent(canvasEv)
                yield canvasEv
              }

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: typeof execResult.result === 'string' ? execResult.result : JSON.stringify(execResult.result)
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

              const ev: AgentStreamEvent = { type: 'tool_call_done', id: tc.id, result: null, status: 'failed', targetId: payload.targetId }
              if (onEvent) onEvent(ev)
              yield ev

              // Send self-healing feedback to model for InvalidArgumentsError or general execution error
              const modelFacingError = toolErr instanceof InvalidArgumentsError || toolErr.name === 'InvalidArgumentsError'
                ? toolErr.message
                : `Error: ${toolErr.message}`

              providerMessages.push({
                role: 'tool',
                toolCallId: tc.id,
                content: modelFacingError
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
      const memoriesSaved = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'manage_memory' && tc.args?.key).map(tc => tc.args.key))]
      const subagentsRun = [...new Set(completedToolCalls.filter(tc => tc.status === 'completed' && tc.toolName === 'task' && tc.args?.description).map(tc => tc.args.description))]

      if ((filesCreated.length > 0 || filesEdited.length > 0 || commandsRun.length > 0 || memoriesSaved.length > 0 || subagentsRun.length > 0) && !fullAssistantText.includes('### 📋 Completed Work Summary')) {
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
        if (memoriesSaved.length > 0) {
          summaryCard += `* **Memories Recorded:** ${memoriesSaved.map(m => `\`${m}\``).join(', ')}\n`
        }
        if (subagentsRun.length > 0) {
          summaryCard += `* **Subagents Executed:** ${subagentsRun.map(s => `\`${s}\``).join(', ')}\n`
        }
        summaryCard += `\n**Suggested Next Steps:** \`/test\` · \`/review\` · \`/extend\` · \`/summary\` · \`/compact\`\n`

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

      const doneEv: AgentStreamEvent = { type: 'done', finalMessage, targetId: payload.targetId }
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
      const errorEv: AgentStreamEvent = { type: 'error', error: err.message || 'Agent error occurred', targetId: payload.targetId }
      if (onEvent) onEvent(errorEv)
      yield errorEv
    } finally {
      this.activeAbortControllers.delete(payload.targetId)
    }
  }
}
