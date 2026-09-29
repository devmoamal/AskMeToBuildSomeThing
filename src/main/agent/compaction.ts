import type { ProviderChatMessage } from './providers/base'
import type { Message, ToolCallRecord } from '../../shared/types'
import { parseThinkingAndContent } from '../../shared/thinking'

export interface CompactionConfig {
  /** Maximum context tokens before active compaction is triggered (default: 80,000) */
  maxContextTokens?: number
  /** Minimum tokens to preserve in recent active tail turns (default: 8,000) */
  preserveRecentTokens?: number
  /** Token threshold to start passive pruning of historical tool outputs (default: 35,000) */
  pruneThresholdTokens?: number
}

export const SUMMARY_TEMPLATE = `Output exactly the Markdown structure shown inside <template> and keep the section order unchanged. Do not include the <template> tags in your response.
<template>
## Objective
- [one or two brief sentences describing what the user is trying to accomplish]

## Important Details
- [constraints/preferences, architecture decisions, important facts/assumptions, or "(none)"]

## Work State
### Completed
- [finished work, verified facts, or code changes made; otherwise "(none)"]

### Active
- [current work, partial changes, or active debugging state; otherwise "(none)"]

### Blocked
- [blockers, failing commands, or unknowns; otherwise "(none)"]

## Next Move
1. [immediate concrete action, or "(none)"]
2. [subsequent action if known, or "(none)"]

## Relevant Files
- [file or directory path: why it matters, or "(none)"]
</template>

Rules:
- Keep every section, even when empty.
- Use terse bullets, not prose paragraphs.
- Preserve exact file paths, symbols, commands, error strings, URLs, and identifiers when known.
- Do not mention the summary process or that context was compacted.`

export const SUMMARY_UPDATE_INSTRUCTIONS = `The <prior-summary> summarizes everything that happened before the current <conversation>. Construct a new summary that combines both. The <prior-summary> is discarded after this: anything you do not carry into the new summary is lost.

When combining:
- Carry forward objectives, constraints, user directives, decisions, and parallel workstreams from the <prior-summary> even when the current <conversation> does not mention them. Drop only what is finished and no longer needed.
- The <conversation> is more recent than the <prior-summary>. Where they conflict, the conversation wins: state the corrected fact and drop the old claim.
- Add new progress, decisions, constraints, and context from the conversation.
- Move completed work from "Active" to "Completed".
- If a blocker has been resolved, update the summary to reflect that while keeping any details still needed to continue the work.
- Update "Objective" and "Next Move" to reflect the current work state.`

export class TokenEstimator {
  /**
   * Fast, accurate estimation of token counts (~3.8 characters per token for code/English)
   */
  static estimateText(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 3.8)
  }

  static estimateMessage(msg: ProviderChatMessage): number {
    let chars = 0
    if (msg.content) chars += msg.content.length
    if (msg.reasoning_content) chars += msg.reasoning_content.length
    if (msg.toolCalls) chars += JSON.stringify(msg.toolCalls).length
    return Math.ceil(chars / 3.8)
  }

  static estimateMessages(messages: ProviderChatMessage[]): number {
    return messages.reduce((sum, m) => sum + this.estimateMessage(m), 0)
  }
}

export class CompactionEngine {
  static readonly DEFAULT_MAX_CONTEXT_TOKENS = 75_000
  static readonly DEFAULT_PRESERVE_RECENT_TOKENS = 10_000
  static readonly DEFAULT_PRUNE_THRESHOLD = 30_000

  /**
   * Phase 1: Passive Tool Pruning
   * When history token size crosses the threshold, tombstone older tool results
   * down to brief notes while preserving the recent active tail.
   * Returns true if any pruning was performed.
   */
  static pruneHistoricalToolResults(
    messages: ProviderChatMessage[],
    preserveTailTokens = this.DEFAULT_PRESERVE_RECENT_TOKENS,
    thresholdTokens = this.DEFAULT_PRUNE_THRESHOLD
  ): boolean {
    const totalTokens = TokenEstimator.estimateMessages(messages)
    if (totalTokens < thresholdTokens) {
      return false
    }

    // Identify which messages are in the recent protected tail
    let accumulatedTailTokens = 0
    let tailCutoffIndex = messages.length

    for (let i = messages.length - 1; i >= 0; i--) {
      accumulatedTailTokens += TokenEstimator.estimateMessage(messages[i])
      if (accumulatedTailTokens >= preserveTailTokens) {
        tailCutoffIndex = i + 1
        break
      }
    }

    let modified = false

    // Prune tool messages in the historical region (before tailCutoffIndex)
    for (let i = 0; i < tailCutoffIndex; i++) {
      const msg = messages[i]
      if (msg.role === 'tool' && msg.content && msg.content.length > 200) {
        const lines = msg.content.split('\n').length
        msg.content = `[Tool result cleared: ${lines} lines output reviewed in earlier turn]`
        modified = true
      }
    }

    return modified
  }

  /**
   * Serializes a ProviderChatMessage or historical Message for the compaction prompt
   */
  static serializeMessage(msg: Message | ProviderChatMessage): string {
    if (msg.role === 'user') {
      return `[User]: ${msg.content}`
    }
    if (msg.role === 'assistant') {
      const parts: string[] = []
      const parsed = parseThinkingAndContent(msg.content || '')
      if (parsed.thinking) {
        parts.push(`[Assistant Thinking]: ${parsed.thinking.slice(0, 300)}...`)
      }
      if (parsed.content) {
        parts.push(`[Assistant]: ${parsed.content}`)
      }
      if ('toolCalls' in msg && msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls as ToolCallRecord[]) {
          const input = typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args)
          parts.push(`[Assistant Tool Call]: ${tc.toolName}(${input})`)
          if (tc.result !== undefined) {
            const res = typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)
            const preview = res.length > 400 ? `${res.slice(0, 400)}... [truncated]` : res
            parts.push(`[Tool Result]: ${preview}`)
          } else if (tc.error) {
            parts.push(`[Tool Error]: ${tc.error}`)
          }
        }
      }
      return parts.join('\n')
    }
    if (msg.role === 'tool') {
      const preview = msg.content.length > 400 ? `${msg.content.slice(0, 400)}... [truncated]` : msg.content
      return `[Tool Result]: ${preview}`
    }
    return `[${msg.role}]: ${msg.content}`
  }

  /**
   * Builds the prompt to send to the summarizer
   */
  static buildCompactionPrompt(conversationText: string, priorSummary?: string): string {
    const wrappedConversation = `Here is the conversation history to compact:\n\n<conversation>\n${conversationText}\n</conversation>`
    if (!priorSummary) {
      return [
        wrappedConversation,
        'Create a new anchored summary from the conversation history in the <conversation> tags above so another coding agent can seamlessly continue the work.',
        SUMMARY_TEMPLATE
      ].join('\n\n')
    }

    return [
      wrappedConversation,
      `Here is the previous summary from before the conversation above:\n\n<prior-summary>\n${priorSummary}\n</prior-summary>`,
      SUMMARY_UPDATE_INSTRUCTIONS,
      SUMMARY_TEMPLATE
    ].join('\n\n')
  }

  /**
   * Extracts head (to compact) and tail (to keep live) from provider messages
   */
  static splitHeadAndTail(
    messages: ProviderChatMessage[],
    preserveTokens = this.DEFAULT_PRESERVE_RECENT_TOKENS
  ): { head: ProviderChatMessage[]; tail: ProviderChatMessage[]; priorSummary?: string } {
    if (messages.length <= 4) {
      return { head: [], tail: messages }
    }

    // Check if an existing summary anchor exists
    let priorSummary: string | undefined
    let startIndex = 0

    // Skip system prompt at index 0
    if (messages[0]?.role === 'system') {
      startIndex = 1
    }

    const firstMsg = messages[startIndex]
    if (firstMsg && firstMsg.content && firstMsg.content.includes('## Objective') && firstMsg.content.includes('## Work State')) {
      priorSummary = firstMsg.content
      startIndex++
    }

    let tailTokens = 0
    let splitIdx = messages.length

    for (let i = messages.length - 1; i >= startIndex; i--) {
      tailTokens += TokenEstimator.estimateMessage(messages[i])
      if (tailTokens >= preserveTokens) {
        splitIdx = Math.max(startIndex, i + 1)
        break
      }
    }

    const head = messages.slice(startIndex, splitIdx)
    const tail = messages.slice(splitIdx)

    return { head, tail, priorSummary }
  }
}
