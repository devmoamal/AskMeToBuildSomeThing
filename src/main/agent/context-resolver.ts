import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { DocumentConverter } from './doc-converter'
import { dbQueries } from '../db/queries'

const pExecFile = promisify(execFile)

export interface ResolvedMention {
  type: 'file' | 'git' | 'diff' | 'canvas'
  target: string
  content: string
  error?: string
}

export interface MentionResolutionResult {
  hasMentions: boolean
  resolvedMentions: ResolvedMention[]
  contextBlock: string
  enrichedPrompt: string
}

/**
 * Resolves context tokens (@file:..., @git, @diff, @canvas) embedded in user prompts,
 * automatically injecting the requested file contents, working tree diffs, or active canvas.
 */
export async function resolveMentionContext(options: {
  prompt: string
  projectFolder?: string
  targetId?: string
}): Promise<MentionResolutionResult> {
  const { prompt, projectFolder, targetId } = options
  const resolvedMentions: ResolvedMention[] = []

  // 1. Resolve @file:<path>
  const fileRegex = /@file:([^\s,;]+)/g
  const fileMatches = Array.from(prompt.matchAll(fileRegex))
  const seenFiles = new Set<string>()

  for (const match of fileMatches) {
    const rawFilePath = match[1]
    if (seenFiles.has(rawFilePath)) continue
    seenFiles.add(rawFilePath)

    const targetPath = projectFolder && !path.isAbsolute(rawFilePath)
      ? path.resolve(projectFolder, rawFilePath)
      : path.resolve(rawFilePath)

    try {
      const stats = await fs.stat(targetPath)
      if (stats.isDirectory()) {
        resolvedMentions.push({
          type: 'file',
          target: rawFilePath,
          content: `Directory at ${rawFilePath}`,
          error: 'Specified path is a directory, not a file.'
        })
        continue
      }

      if (DocumentConverter.isConvertibleDocument(targetPath)) {
        const conv = await DocumentConverter.convertToMarkdown(targetPath, { maxChars: 25000 })
        resolvedMentions.push({
          type: 'file',
          target: rawFilePath,
          content: conv.markdown
        })
      } else {
        const rawContent = await fs.readFile(targetPath, 'utf-8')
        const maxLen = 30000
        const isTruncated = rawContent.length > maxLen
        const safeContent = isTruncated
          ? `${rawContent.slice(0, maxLen)}\n\n... [File content truncated: showing first ${maxLen} of ${rawContent.length} characters]`
          : rawContent

        resolvedMentions.push({
          type: 'file',
          target: rawFilePath,
          content: safeContent
        })
      }
    } catch (err: any) {
      resolvedMentions.push({
        type: 'file',
        target: rawFilePath,
        content: '',
        error: `Could not read file "${rawFilePath}": ${err?.message || 'File not found'}`
      })
    }
  }

  // 2. Resolve @git
  if (/(?:^|\s)@git(?:\s|$)/.test(prompt)) {
    if (projectFolder) {
      try {
        const { stdout: branchOut } = await pExecFile('git', ['branch', '--show-current'], { cwd: projectFolder, timeout: 5000 })
        const { stdout: statusOut } = await pExecFile('git', ['status', '-s'], { cwd: projectFolder, timeout: 5000 })
        const branch = branchOut.trim() || 'HEAD'
        const statusText = statusOut.trim() || '(working tree clean)'

        resolvedMentions.push({
          type: 'git',
          target: '@git',
          content: `Branch: ${branch}\n\nWorking Tree Status:\n${statusText}`
        })
      } catch (err: any) {
        resolvedMentions.push({
          type: 'git',
          target: '@git',
          content: '',
          error: `Git command failed in repository: ${err?.message || 'Not a git repository'}`
        })
      }
    } else {
      resolvedMentions.push({
        type: 'git',
        target: '@git',
        content: '',
        error: 'No project folder active for @git context.'
      })
    }
  }

  // 3. Resolve @diff
  if (/(?:^|\s)@diff(?:\s|$)/.test(prompt)) {
    if (projectFolder) {
      try {
        const { stdout: diffOut } = await pExecFile('git', ['diff', 'HEAD'], { cwd: projectFolder, timeout: 5000 })
        const rawDiff = diffOut.trim()
        if (rawDiff) {
          const maxDiffLen = 20000
          const safeDiff = rawDiff.length > maxDiffLen
            ? `${rawDiff.slice(0, maxDiffLen)}\n\n... [Diff truncated: showing first ${maxDiffLen} characters]`
            : rawDiff
          resolvedMentions.push({
            type: 'diff',
            target: '@diff',
            content: safeDiff
          })
        } else {
          resolvedMentions.push({
            type: 'diff',
            target: '@diff',
            content: 'No uncommitted working tree changes detected (git diff is empty).'
          })
        }
      } catch (err: any) {
        resolvedMentions.push({
          type: 'diff',
          target: '@diff',
          content: '',
          error: `Failed to inspect git diff: ${err?.message || 'Git diff unavailable'}`
        })
      }
    } else {
      resolvedMentions.push({
        type: 'diff',
        target: '@diff',
        content: '',
        error: 'No project folder active for @diff context.'
      })
    }
  }

  // 4. Resolve @canvas
  if (/(?:^|\s)@canvas(?:\s|$)/.test(prompt)) {
    if (targetId) {
      try {
        const canvases = await dbQueries.getCanvases(targetId)
        if (canvases.length > 0) {
          const latestCanvas = canvases[canvases.length - 1]
          resolvedMentions.push({
            type: 'canvas',
            target: latestCanvas.title || '@canvas',
            content: `Canvas Title: ${latestCanvas.title}\nLanguage: ${latestCanvas.language || 'markdown'}\n\n${latestCanvas.content}`
          })
        } else {
          resolvedMentions.push({
            type: 'canvas',
            target: '@canvas',
            content: 'No active canvas document exists for this session.'
          })
        }
      } catch (err: any) {
        resolvedMentions.push({
          type: 'canvas',
          target: '@canvas',
          content: '',
          error: `Could not load canvas: ${err?.message || 'Database error'}`
        })
      }
    } else {
      resolvedMentions.push({
        type: 'canvas',
        target: '@canvas',
        content: '',
        error: 'No active session target for @canvas.'
      })
    }
  }

  if (resolvedMentions.length === 0) {
    return {
      hasMentions: false,
      resolvedMentions: [],
      contextBlock: '',
      enrichedPrompt: prompt
    }
  }

  const contextSnippets = resolvedMentions.map(m => {
    if (m.error) {
      return `<context type="${m.type}" target="${m.target}">\n[Notice: ${m.error}]\n</context>`
    }
    return `<context type="${m.type}" target="${m.target}">\n${m.content}\n</context>`
  })

  const contextBlock = `<injected_context>\n${contextSnippets.join('\n\n')}\n</injected_context>`
  const enrichedPrompt = `${prompt}\n\n${contextBlock}`

  return {
    hasMentions: true,
    resolvedMentions,
    contextBlock,
    enrichedPrompt
  }
}
