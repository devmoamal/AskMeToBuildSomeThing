import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'
import type { AgentTool, AgentToolContext } from './types'
import { TerminalRunner } from '../../terminal/runner'

export const manageCheckpointsSchema = z.object({
  action: z.enum(['create', 'list', 'restore', 'diff']).describe('Action: "create" (saves snapshot), "list" (shows snapshots), "restore" (reverts workspace to snapshot), "diff" (shows diff since snapshot)'),
  description: z.string().optional().describe('Description of the checkpoint when creating (e.g. "Before database refactor")'),
  checkpointId: z.string().optional().describe('Target checkpoint ID when restoring or viewing diff')
})

export type ManageCheckpointsArgs = z.infer<typeof manageCheckpointsSchema>

export interface CheckpointMetadata {
  id: string
  timestamp: number
  commitHash: string
  description: string
}

function getCheckpointsFilePath(projectFolder: string): string {
  const dataDir = path.join(projectFolder, '.data')
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
    } catch {}
  }
  return path.join(dataDir, 'checkpoints.json')
}

function loadCheckpoints(projectFolder: string): CheckpointMetadata[] {
  try {
    const file = getCheckpointsFilePath(projectFolder)
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    }
  } catch {}
  return []
}

function saveCheckpoints(projectFolder: string, checkpoints: CheckpointMetadata[]) {
  try {
    const file = getCheckpointsFilePath(projectFolder)
    fs.writeFileSync(file, JSON.stringify(checkpoints, null, 2), 'utf8')
  } catch {}
}

export const manageCheckpointsTool: AgentTool<ManageCheckpointsArgs> = {
  name: 'manage_checkpoints',
  description: 'Git-backed workspace checkpointing and time-travel undo. Create safety snapshots before risky modifications, view diffs, or restore the workspace to a previous checkpoint.',
  allowedModes: ['project'],
  parameters: manageCheckpointsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'restore', 'diff'],
        description: 'Action: "create", "list", "restore", or "diff"'
      },
      description: {
        type: 'string',
        description: 'Description of the checkpoint when creating'
      },
      checkpointId: {
        type: 'string',
        description: 'Target checkpoint ID for restore or diff'
      }
    },
    required: ['action']
  },
  async execute(args: ManageCheckpointsArgs, ctx: AgentToolContext) {
    if (!ctx.projectFolder) {
      throw new Error('manage_checkpoints requires an active project folder.')
    }

    const isGit = fs.existsSync(path.join(ctx.projectFolder, '.git'))
    if (!isGit) {
      throw new Error('Workspace is not a Git repository. Initialize git with "git init" to use checkpoints.')
    }

    const checkpoints = loadCheckpoints(ctx.projectFolder)

    // 1. CREATE CHECKPOINT
    if (args.action === 'create') {
      const description = args.description?.trim() || `Snapshot at ${new Date().toLocaleTimeString()}`
      const checkpointId = `cp_${Date.now()}`

      // Create a commit hash of current dirty state without affecting working tree
      const stashCreateRes = await TerminalRunner.run({
        command: `git stash create "Checkpoint ${checkpointId}"`,
        cwd: ctx.projectFolder
      })

      let commitHash = stashCreateRes.stdout.trim()

      // If working tree is completely clean, stash create returns empty string; use HEAD
      if (!commitHash) {
        const headRes = await TerminalRunner.run({
          command: 'git rev-parse HEAD',
          cwd: ctx.projectFolder
        })
        commitHash = headRes.stdout.trim()
      }

      if (!commitHash) {
        throw new Error('Failed to resolve git snapshot commit hash.')
      }

      // Persist git ref to prevent GC
      await TerminalRunner.run({
        command: `git update-ref refs/checkpoints/${checkpointId} ${commitHash}`,
        cwd: ctx.projectFolder
      })

      const newRecord: CheckpointMetadata = {
        id: checkpointId,
        timestamp: Date.now(),
        commitHash,
        description
      }

      checkpoints.unshift(newRecord)
      saveCheckpoints(ctx.projectFolder, checkpoints.slice(0, 50))

      return `✓ Checkpoint created: **\`${checkpointId}\`**\n` +
        `- **Description**: ${description}\n` +
        `- **Commit Hash**: \`${commitHash.slice(0, 8)}\`\n` +
        `- You can restore back to this state at any time with \`manage_checkpoints({ action: "restore", checkpointId: "${checkpointId}" })\`.`
    }

    // 2. LIST CHECKPOINTS
    if (args.action === 'list') {
      if (checkpoints.length === 0) {
        return 'No checkpoints found for this project. Create one using `manage_checkpoints({ action: "create", description: "..." })`.'
      }

      const rows = checkpoints.map((cp, idx) => {
        const dateStr = new Date(cp.timestamp).toLocaleString()
        return `| \`${cp.id}\` | ${dateStr} | \`${cp.commitHash.slice(0, 8)}\` | ${cp.description} |`
      }).join('\n')

      return `### Workspace Checkpoints (${checkpoints.length}):\n\n` +
        `| Checkpoint ID | Timestamp | Commit | Description |\n` +
        `|---|---|---|---|\n` +
        rows
    }

    // 3. DIFF CHECKPOINT
    if (args.action === 'diff') {
      const targetId = args.checkpointId || checkpoints[0]?.id
      if (!targetId) {
        throw new Error('Please specify a checkpointId to inspect diff.')
      }

      const cp = checkpoints.find(c => c.id === targetId)
      if (!cp) {
        throw new Error(`Checkpoint "${targetId}" not found.`)
      }

      const diffRes = await TerminalRunner.run({
        command: `git diff ${cp.commitHash}`,
        cwd: ctx.projectFolder
      })

      const diff = diffRes.stdout.trim()
      if (!diff) {
        return `✓ No changes between workspace and checkpoint \`${targetId}\`. Workspace is identical.`
      }

      const truncatedDiff = diff.length > 4000 ? `${diff.slice(0, 4000)}\n\n[Diff truncated, showing first 4000 characters]` : diff
      return `### Diff since Checkpoint \`${targetId}\` (${cp.description}):\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``
    }

    // 4. RESTORE CHECKPOINT
    if (args.action === 'restore') {
      const targetId = args.checkpointId || checkpoints[0]?.id
      if (!targetId) {
        throw new Error('Please specify a checkpointId to restore.')
      }

      const cp = checkpoints.find(c => c.id === targetId)
      if (!cp) {
        throw new Error(`Checkpoint "${targetId}" not found.`)
      }

      // Restore files from snapshot commit
      const restoreRes = await TerminalRunner.run({
        command: `git checkout ${cp.commitHash} -- .`,
        cwd: ctx.projectFolder
      })

      if (restoreRes.exitCode !== 0) {
        throw new Error(`Failed to restore workspace to checkpoint: ${restoreRes.stderr || restoreRes.stdout}`)
      }

      return `✓ Workspace successfully restored to checkpoint **\`${targetId}\`** (${cp.description}). All tracked files match snapshot state.`
    }

    throw new Error(`Unknown action: ${args.action}`)
  }
}
