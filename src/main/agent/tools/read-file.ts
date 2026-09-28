import fs from 'node:fs/promises'
import path from 'node:path'
import { ReadFileArgsSchema, type ReadFileArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

import { DocumentConverter } from '../doc-converter'

export const readFileTool: AgentTool<ReadFileArgs> = {
  name: 'read_file',
  description: 'Read the contents of a file from the project directory. Supports code, text, PDF, DOCX, PPTX, XLSX, and office documents (auto-converted to clean, token-saving Markdown).',
  parameters: ReadFileArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path to read, relative to the project root or absolute'
      }
    },
    required: ['path']
  },
  allowedModes: ['project'],
  async execute(args: ReadFileArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot read file: No project folder selected')
    }

    const resolvedProject = path.resolve(ctx.projectFolder)
    const fullPath = path.isAbsolute(args.path)
      ? path.resolve(args.path)
      : path.resolve(resolvedProject, args.path)

    if (!fullPath.startsWith(resolvedProject)) {
      throw new Error(`Access denied: Path "${args.path}" escapes project boundary`)
    }

    try {
      if (DocumentConverter.isConvertibleDocument(fullPath)) {
        const docResult = await DocumentConverter.convertToMarkdown(fullPath)
        const lines = docResult.markdown.split(/\r?\n/).length
        return {
          path: args.path,
          fullPath,
          content: docResult.markdown,
          lines,
          size: docResult.originalSize,
          convertedSize: docResult.convertedLength,
          isDocument: true,
          tokenSavingsRatio: docResult.tokenSavingsRatio,
          success: true
        }
      }

      const content = await fs.readFile(fullPath, 'utf-8')
      const maxChars = 50000
      const isTruncated = content.length > maxChars
      const finalContent = isTruncated
        ? `${content.slice(0, maxChars)}\n\n... [File truncated: showing first ${maxChars} of ${content.length} characters to save context tokens]`
        : content

      const lines = finalContent.split(/\r?\n/).length
      const stats = await fs.stat(fullPath)
      return {
        path: args.path,
        fullPath,
        content: finalContent,
        lines,
        size: stats.size,
        truncated: isTruncated,
        success: true
      }
    } catch (err: any) {
      throw new Error(`Failed to read file ${args.path}: ${err.message}`)
    }
  }
}
