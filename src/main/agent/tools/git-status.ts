import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { GitStatusArgsSchema, type GitStatusArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

const execAsync = promisify(exec)

export const gitStatusTool: AgentTool<GitStatusArgs> = {
  name: 'git_status',
  description: 'Inspect the Git repository status (active branch, dirty/untracked files, recent commits, and optional diff) for the project.',
  parameters: GitStatusArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      showDiff: {
        type: 'boolean',
        description: 'Whether to include a compact git diff of changes'
      },
      path: {
        type: 'string',
        description: 'Optional path or file to filter git status'
      }
    }
  },
  allowedModes: ['project'],
  async execute(args: GitStatusArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('Cannot run git_status: No project folder selected.')
    }

    const cwd = ctx.projectFolder

    // Verify git repo
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd })
    } catch {
      return {
        isGitRepo: false,
        message: 'The current project folder is not a Git repository.'
      }
    }

    // Get current branch
    let branch = 'unknown'
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd })
      branch = stdout.trim() || 'HEAD (detached)'
    } catch {}

    // Get porcelain status
    const statusCmd = args.path
      ? `git status --porcelain=v1 -- ${JSON.stringify(args.path)}`
      : 'git status --porcelain=v1'
    const { stdout: statusOutput } = await execAsync(statusCmd, { cwd }).catch(() => ({ stdout: '' }))

    const lines = statusOutput.trim().split(/\r?\n/).filter(Boolean)
    const staged: string[] = []
    const unstaged: string[] = []
    const untracked: string[] = []

    for (const line of lines) {
      const indexStatus = line[0]
      const workTreeStatus = line[1]
      const file = line.slice(3).trim()

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(file)
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(`${indexStatus} ${file}`)
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstaged.push(`${workTreeStatus} ${file}`)
        }
      }
    }

    // Get recent commits
    let recentCommits: string[] = []
    try {
      const { stdout } = await execAsync('git log -n 5 --oneline', { cwd })
      recentCommits = stdout.trim().split(/\r?\n/).filter(Boolean)
    } catch {}

    let diffPreview: string | undefined
    if (args.showDiff) {
      try {
        const { stdout } = await execAsync('git diff --stat', { cwd })
        diffPreview = stdout.trim()
      } catch {}
    }

    return {
      isGitRepo: true,
      branch,
      clean: lines.length === 0,
      stagedCount: staged.length,
      unstagedCount: unstaged.length,
      untrackedCount: untracked.length,
      stagedFiles: staged.slice(0, 20),
      unstagedFiles: unstaged.slice(0, 20),
      untrackedFiles: untracked.slice(0, 20),
      recentCommits,
      diffSummary: diffPreview
    }
  }
}
