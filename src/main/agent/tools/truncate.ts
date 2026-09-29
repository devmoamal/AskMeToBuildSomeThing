import fs from 'node:fs/promises'
import path from 'node:path'

export interface TruncateOptions {
  maxLines?: number
  maxBytes?: number
  direction?: 'head' | 'tail'
  toolName?: string
  projectFolder?: string
}

export interface TruncateResult {
  content: string
  truncated: boolean
  outputPath?: string
  totalLines: number
  totalBytes: number
}

export const DEFAULT_MAX_LINES = 2000
export const DEFAULT_MAX_BYTES = 50 * 1024 // 50 KB

/**
 * TruncateService provides file-backed spillover for oversized tool outputs
 * (such as huge terminal outputs, file reads, or code search results),
 * preventing context window explosions while preserving the complete output on disk.
 */
export class TruncateService {
  private static getStorageDir(projectFolder?: string): string {
    if (projectFolder) {
      return path.join(projectFolder, '.data', 'tool_outputs')
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron')
      if (app && typeof app.getPath === 'function') {
        const userData = app.getPath('userData')
        return path.join(userData, 'tool_outputs')
      }
    } catch {
      // In test or non-electron environments
    }
    return path.join(process.cwd(), '.data', 'tool_outputs')
  }

  /**
   * Cleans up tool output log files older than 7 days
   */
  static async cleanup(projectFolder?: string): Promise<void> {
    try {
      const dir = this.getStorageDir(projectFolder)
      const exists = await fs.stat(dir).catch(() => null)
      if (!exists) return

      const files = await fs.readdir(dir)
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

      for (const file of files) {
        if (!file.startsWith('tool_')) continue
        const fullPath = path.join(dir, file)
        try {
          const stat = await fs.stat(fullPath)
          if (stat.mtimeMs < cutoff) {
            await fs.unlink(fullPath).catch(() => {})
          }
        } catch {}
      }
    } catch {}
  }

  /**
   * Truncates text exceeding maxLines or maxBytes, saving the complete text to disk
   */
  static async truncateOutput(
    text: string,
    options: TruncateOptions = {}
  ): Promise<TruncateResult> {
    if (!text || typeof text !== 'string') {
      return {
        content: text || '',
        truncated: false,
        totalLines: 0,
        totalBytes: 0
      }
    }

    const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
    const direction = options.direction ?? (options.toolName === 'use_terminal' ? 'tail' : 'head')

    const lines = text.split(/\r?\n/)
    const totalLines = lines.length
    const totalBytes = Buffer.byteLength(text, 'utf-8')

    // If within limits, return as-is
    if (totalLines <= maxLines && totalBytes <= maxBytes) {
      return {
        content: text,
        truncated: false,
        totalLines,
        totalBytes
      }
    }

    // Output exceeds limits -> write full output to disk
    const storageDir = this.getStorageDir(options.projectFolder)
    await fs.mkdir(storageDir, { recursive: true }).catch(() => {})

    const toolPrefix = options.toolName ? options.toolName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'output'
    const fileName = `tool_${toolPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.log`
    const outputPath = path.join(storageDir, fileName)

    try {
      await fs.writeFile(outputPath, text, 'utf-8')
    } catch (err) {
      console.error('Failed to write full tool output to disk:', err)
    }

    // Build bounded preview
    let previewLines: string[] = []
    let currentBytes = 0

    if (direction === 'tail') {
      // Pick from the end backwards (best for terminal errors)
      const selected: string[] = []
      for (let i = lines.length - 1; i >= 0 && selected.length < maxLines; i--) {
        const line = lines[i]
        const lineBytes = Buffer.byteLength(line, 'utf-8') + 1
        if (currentBytes + lineBytes > maxBytes) break
        currentBytes += lineBytes
        selected.push(line)
      }
      previewLines = selected.reverse()
    } else {
      // Pick from the beginning forwards
      for (let i = 0; i < lines.length && previewLines.length < maxLines; i++) {
        const line = lines[i]
        const lineBytes = Buffer.byteLength(line, 'utf-8') + 1
        if (currentBytes + lineBytes > maxBytes) break
        currentBytes += lineBytes
        previewLines.push(line)
      }
    }

    const displayedCount = previewLines.length
    const previewContent = previewLines.join('\n')
    const sizeKb = (totalBytes / 1024).toFixed(1)

    const notice = direction === 'tail'
      ? `\n\n[... Truncated ${totalLines - displayedCount} earlier lines. Showing last ${displayedCount} lines of ${totalLines} total (${sizeKb} KB). Full output preserved at: ${outputPath} . Use read_file to inspect earlier lines if needed.]`
      : `\n\n[... Truncated ${totalLines - displayedCount} subsequent lines. Showing first ${displayedCount} lines of ${totalLines} total (${sizeKb} KB). Full output preserved at: ${outputPath} . Use read_file to inspect remaining lines if needed.]`

    return {
      content: previewContent + notice,
      truncated: true,
      outputPath,
      totalLines,
      totalBytes
    }
  }
}
