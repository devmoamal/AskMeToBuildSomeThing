import { describe, it, expect } from 'bun:test'
import { DocumentConverter } from '../main/agent/doc-converter'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

describe('DocumentConverter: PDF, Office, and Text to Markdown', () => {
  it('should identify convertible document extensions', () => {
    expect(DocumentConverter.isConvertibleDocument('slides.pptx')).toBe(true)
    expect(DocumentConverter.isConvertibleDocument('document.docx')).toBe(true)
    expect(DocumentConverter.isConvertibleDocument('paper.pdf')).toBe(true)
    expect(DocumentConverter.isConvertibleDocument('sheet.xlsx')).toBe(true)
    expect(DocumentConverter.isConvertibleDocument('code.ts')).toBe(false)
  })

  it('should convert plain text file without office parser', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-test-'))
    const filePath = path.join(tmpDir, 'test.txt')
    await fs.writeFile(filePath, 'Hello world text content', 'utf-8')

    const res = await DocumentConverter.convertToMarkdown(filePath)
    expect(res.isOfficeDoc).toBe(false)
    expect(res.markdown).toBe('Hello world text content')
    expect(res.truncated).toBe(false)

    await fs.rm(tmpDir, { recursive: true, force: true })
  })
})
