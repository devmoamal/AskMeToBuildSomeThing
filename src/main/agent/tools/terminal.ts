import path from 'node:path'
import { TerminalArgsSchema, type TerminalArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { TerminalRunner } from '../../terminal/runner'

const SAFE_PATTERNS = [
  /^bun\s+(test|run\s+build|build|check|pm|--version|-v)/i,
  /^npm\s+(test|run\s+build|run\s+test|run\s+lint|run\s+check|list|--version|-v)/i,
  /^yarn\s+(test|build|lint|--version|-v)/i,
  /^pnpm\s+(test|build|lint|--version|-v)/i,
  /^tsc(\s+.*)?$/i,
  /^vite\s+build/i,
  /^git\s+(status|diff|log|branch|show)/i,
  /^(ls|dir|pwd|echo|which|cat|head|tail|grep|find)(\s+.*)?$/i
]

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+\/s/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fd/i,
  /git\s+push.*--force/i
]

export function isSafeDevelopmentCommand(command: string): boolean {
  const trimmed = command.trim()
  if (DANGEROUS_PATTERNS.some(p => p.test(trimmed))) return false
  return SAFE_PATTERNS.some(p => p.test(trimmed))
}

export const terminalTool: AgentTool<TerminalArgs> = {
  name: 'use_terminal',
  description: 'Execute a terminal command in the project folder with live output streaming.',
  parameters: TerminalArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute in the project environment'
      },
      cwd: {
        type: 'string',
        description: 'Optional sub-directory relative to the project root to run the command in'
      },
      timeoutMs: {
        type: 'number',
        description: 'Optional execution timeout in ms. Set to 0 to wait indefinitely until the command exits completely.'
      }
    },
    required: ['command']
  },
  allowedModes: ['project'],
  async execute(args: TerminalArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot run terminal: No project folder selected')
    }

    const workingDir = args.cwd
      ? (path.isAbsolute(args.cwd) ? args.cwd : path.resolve(ctx.projectFolder, args.cwd))
      : ctx.projectFolder

    // Check approval: Auto-approve safe dev commands (tests, builds, lints) or when autoApproveTerminal is enabled
    const isSafe = isSafeDevelopmentCommand(args.command)
    if (!ctx.settings.autoApproveTerminal && !isSafe && ctx.requireToolApproval) {
      const approved = await ctx.requireToolApproval('use_terminal', { command: args.command, cwd: workingDir })
      if (!approved) {
        throw new Error(`Command "${args.command}" was rejected by user.`)
      }
    }

    const resolvedTimeout = args.timeoutMs !== undefined
      ? args.timeoutMs
      : (ctx.settings.terminalWaitUntilComplete ? 0 : ctx.settings.terminalTimeoutMs)

    const result = await TerminalRunner.run({
      command: args.command,
      cwd: workingDir,
      shell: ctx.settings.defaultShell,
      timeoutMs: resolvedTimeout,
      onOutput: (chunk) => {
        if (ctx.onStream) {
          ctx.onStream(chunk)
        }
      }
    })

    return {
      command: args.command,
      cwd: workingDir,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      success: result.exitCode === 0
    }
  }
}
