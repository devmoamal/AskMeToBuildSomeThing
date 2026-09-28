import fs from 'node:fs/promises'
import path from 'node:path'
import { parseOffice } from 'officeparser'

export interface DocumentConversionResult {
  filePath: string
  fileName: string
  extension: string
  markdown: string
  isOfficeDoc: boolean
  originalSize: number
  convertedLength: number
  truncated: boolean
  tokenSavingsRatio?: number
}

const OFFICE_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.doc',
  '.pptx',
  '.ppt',
  '.xlsx',
  '.xls',
  '.odt',
  '.odp',
  '.ods',
  '.rtf',
  '.epub',
  '.csv'
])

export class DocumentConverter {
  static isConvertibleDocument(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return OFFICE_EXTENSIONS.has(ext)
  }

  static async convertToMarkdown(
    filePath: string,
    options: { maxChars?: number } = {}
  ): Promise<DocumentConversionResult> {
    const maxChars = options.maxChars || 30000
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath)
    const stats = await fs.stat(filePath)
    const originalSize = stats.size

    // Non-office plain text or code files
    if (!OFFICE_EXTENSIONS.has(ext)) {
      const rawText = await fs.readFile(filePath, 'utf-8')
      const isTruncated = rawText.length > maxChars
      const finalMd = isTruncated
        ? `${rawText.slice(0, maxChars)}\n\n... [Content truncated: showing first ${maxChars} of ${rawText.length} characters]`
        : rawText

      return {
        filePath,
        fileName,
        extension: ext,
        markdown: finalMd,
        isOfficeDoc: false,
        originalSize,
        convertedLength: finalMd.length,
        truncated: isTruncated
      }
    }

    // Office / PDF document conversion to dense, token-saving Markdown
    try {
      const buffer = await fs.readFile(filePath)
      let fileTypeHint: any = ext.replace(/^\./, '')
      if (fileTypeHint === 'doc') fileTypeHint = 'docx'
      if (fileTypeHint === 'ppt') fileTypeHint = 'pptx'
      if (fileTypeHint === 'xls') fileTypeHint = 'xlsx'

      const ast = await parseOffice(buffer, { fileType: fileTypeHint })
      const mdResult = await ast.to('md')
      const rawVal = mdResult?.value
      let markdownText = typeof rawVal === 'string' ? rawVal : (rawVal ? String(rawVal) : '')

      // Clean up excess whitespace and repetitive blank lines
      markdownText = markdownText
        .replace(/\r?\n\s*\r?\n\s*\r?\n+/g, '\n\n')
        .replace(/\{#[^}]+\}/g, '') // remove redundant header anchors like {#title}
        .trim()

      if (!markdownText) {
        // Fallback to text if markdown generator produced empty content
        const textResult = await ast.to('text')
        const rawText = textResult?.value
        markdownText = (typeof rawText === 'string' ? rawText : (rawText ? String(rawText) : '')).trim()
      }

      const isTruncated = markdownText.length > maxChars
      const finalMd = isTruncated
        ? `${markdownText.slice(0, maxChars)}\n\n... [Document truncated: showing first ${maxChars} of ${markdownText.length} characters]`
        : markdownText

      const convertedLength = finalMd.length
      const tokenSavings = originalSize > 0 ? Math.max(0, 1 - (convertedLength / originalSize)) : 0

      // Add clean document metadata header for the LLM
      const formattedMarkdown = `### 📄 Document: ${fileName} (${ext.toUpperCase().replace('.', '')})\n` +
        `> **Converted to dense Markdown** | Original: ${(originalSize / 1024).toFixed(1)} KB | Text: ${(convertedLength / 1024).toFixed(1)} KB\n\n` +
        finalMd

      return {
        filePath,
        fileName,
        extension: ext,
        markdown: formattedMarkdown,
        isOfficeDoc: true,
        originalSize,
        convertedLength,
        truncated: isTruncated,
        tokenSavingsRatio: Math.round(tokenSavings * 100)
      }
    } catch (err: any) {
      // Graceful fallback for password protected or corrupt files
      return {
        filePath,
        fileName,
        extension: ext,
        markdown: `[Error converting ${fileName} (${ext}): ${err.message || 'Parsing failed'}]`,
        isOfficeDoc: true,
        originalSize,
        convertedLength: 0,
        truncated: false
      }
    }
  }
}
