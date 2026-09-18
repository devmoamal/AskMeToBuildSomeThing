import { describe, it, expect } from 'bun:test'
import { TerminalRunner } from '../main/terminal/runner'

describe('Terminal Runner', () => {
  it('should execute command and capture stdout with streaming', async () => {
    const chunks: string[] = []
    const res = await TerminalRunner.run({
      command: 'echo "Hello Terminal"',
      shell: 'powershell',
      onOutput: (c) => chunks.push(c)
    })

    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain('Hello Terminal')
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should handle non-zero exit codes', async () => {
    const res = await TerminalRunner.run({
      command: 'exit 42',
      shell: 'powershell'
    })

    expect(res.exitCode).toBe(42)
  })
})
