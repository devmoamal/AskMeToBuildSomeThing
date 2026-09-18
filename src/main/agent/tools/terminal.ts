import path from 'node:path'
import { TerminalArgsSchema, type TerminalArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { TerminalRunner } from '../../terminal/runner'

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

    // Check approval if auto-approve is false
    if (!ctx.settings.autoApproveTerminal && ctx.requireToolApproval) {
      const approved = await ctx.requireToolApproval('use_terminal', { command: args.command, cwd: workingDir })
      if (!approved) {
        throw new Error(`Command "${args.command}" was rejected by user.`)
      }
    }

    const result = await TerminalRunner.run({
      command: args.command,
      cwd: workingDir,
      shell: ctx.settings.defaultShell,
      timeoutMs: ctx.settings.terminalTimeoutMs,
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
