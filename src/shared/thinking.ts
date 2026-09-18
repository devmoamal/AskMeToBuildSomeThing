/**
 * Extracts thinking/reasoning blocks (<think>...</think>) from message content
 * and separates reasoning from the visible response text.
 */
export function parseThinkingAndContent(rawText: string): {
  thinking: string
  content: string
  isThinkingActive: boolean
} {
  const thinkingParts: string[] = []
  let content = rawText || ''
  let isThinkingActive = false

  // 1. Extract closed <think>...</think> blocks
  const closedThinkRegex = /<think>([\s\S]*?)<\/think>/gi
  let match: RegExpExecArray | null
  while ((match = closedThinkRegex.exec(rawText || '')) !== null) {
    if (match[1].trim()) {
      thinkingParts.push(match[1].trim())
    }
  }
  content = content.replace(closedThinkRegex, '')

  // 2. Extract open streaming <think> block
  const openThinkIndex = content.toLowerCase().indexOf('<think>')
  if (openThinkIndex !== -1) {
    const trailingThinking = content.slice(openThinkIndex + 7).trim()
    if (trailingThinking) {
      thinkingParts.push(trailingThinking)
    }
    content = content.slice(0, openThinkIndex)
    isThinkingActive = true
  }

  // 3. Handle orphaned </think> tag (e.g. if provider emits </think> without <think>)
  const closeThinkIndex = content.toLowerCase().indexOf('</think>')
  if (closeThinkIndex !== -1) {
    const beforeClose = content.slice(0, closeThinkIndex).trim()
    if (beforeClose && thinkingParts.length === 0) {
      thinkingParts.push(beforeClose)
    }
    content = content.slice(closeThinkIndex + 8)
  }

  // 4. Strip any rogue or residual think tags
  content = content.replace(/<\/?think>/gi, '')

  return {
    thinking: thinkingParts.join('\n\n---\n\n').trim(),
    content: content.trim(),
    isThinkingActive
  }
}
