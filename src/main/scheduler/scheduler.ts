import { dbQueries } from '../db/queries'
import { TerminalRunner } from '../terminal/runner'
import type { ScheduledTask, Message } from '../../shared/types'

export class SchedulerManager {
  private static activeTimers: Map<string, NodeJS.Timeout> = new Map()
  private static onTaskCompletedListeners: Array<(task: ScheduledTask) => void> = []

  static onTaskCompleted(listener: (task: ScheduledTask) => void) {
    this.onTaskCompletedListeners.push(listener)
    return () => {
      this.onTaskCompletedListeners = this.onTaskCompletedListeners.filter(l => l !== listener)
    }
  }

  static async init() {
    try {
      const allTasks = await dbQueries.getScheduledTasks()
      const pendingTasks = allTasks.filter(t => t.status === 'pending')

      for (const task of pendingTasks) {
        this.armTask(task)
      }
    } catch (err) {
      console.error('[SchedulerManager] Error initializing scheduled tasks:', err)
    }
  }

  static armTask(task: ScheduledTask) {
    // Clear existing timer if any
    if (this.activeTimers.has(task.id)) {
      clearTimeout(this.activeTimers.get(task.id)!)
      this.activeTimers.delete(task.id)
    }

    const now = Date.now()
    const delay = Math.max(0, task.scheduledAt - now)

    const timer = setTimeout(async () => {
      this.activeTimers.delete(task.id)
      await this.executeTask(task.id)
    }, delay)

    this.activeTimers.set(task.id, timer)
  }

  static async scheduleTask(params: {
    targetId: string
    mode: 'chat' | 'project'
    type: 'command' | 'prompt' | 'reminder'
    command?: string
    prompt?: string
    description: string
    delaySeconds: number
    projectFolder?: string
  }): Promise<ScheduledTask> {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const now = Date.now()
    const scheduledAt = now + (params.delaySeconds * 1000)

    const task: ScheduledTask = {
      id,
      targetId: params.targetId,
      mode: params.mode,
      type: params.type,
      command: params.command,
      prompt: params.prompt,
      description: params.description,
      delaySeconds: params.delaySeconds,
      scheduledAt,
      status: 'pending',
      createdAt: now
    }

    await dbQueries.saveScheduledTask(task)
    this.armTask(task)
    return task
  }

  static async cancelTask(id: string): Promise<boolean> {
    if (this.activeTimers.has(id)) {
      clearTimeout(this.activeTimers.get(id)!)
      this.activeTimers.delete(id)
    }

    await dbQueries.updateScheduledTask(id, {
      status: 'cancelled',
      completedAt: Date.now()
    })
    return true
  }

  static async executeTask(taskId: string) {
    try {
      const tasks = await dbQueries.getScheduledTasks()
      const task = tasks.find(t => t.id === taskId)
      if (!task || task.status === 'cancelled') return

      await dbQueries.updateScheduledTask(taskId, { status: 'running' })

      let taskResult = ''
      let taskError = ''

      if (task.type === 'command' && task.command) {
        // Resolve working directory if project session
        let cwd: string | undefined
        if (task.mode === 'project') {
          try {
            const projects = await dbQueries.getProjects()
            // Find project by targetId if targetId is projectSessionId
            const session = (await dbQueries.getProjectSessions(task.targetId))?.[0]
            if (session) {
              const proj = projects.find(p => p.id === session.projectId)
              if (proj) cwd = proj.folderPath
            }
          } catch {}
        }

        const runResult = await TerminalRunner.run({
          command: task.command,
          cwd,
          timeoutMs: 0 // Wait until completion as requested!
        })

        taskResult = (runResult.stdout + (runResult.stderr ? `\nSTDERR:\n${runResult.stderr}` : '')).trim()
        if (runResult.exitCode !== 0) {
          taskError = `Exit code ${runResult.exitCode}`
        }

        // Post completed execution message to chat/session
        const msgId = `msg_sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        const notificationContent = `⏰ **[Scheduled Task Completed]**: ${task.description}\n\n` +
          `**Command:** \`${task.command}\`\n\n` +
          '```bash\n' +
          (taskResult || '(No output returned)') +
          '\n```'

        try {
          const finishedMsg: Message = {
            id: msgId,
            chatId: task.mode === 'chat' ? task.targetId : undefined,
            projectSessionId: task.mode === 'project' ? task.targetId : undefined,
            role: 'assistant',
            content: notificationContent,
            createdAt: Date.now()
          }
          await dbQueries.saveMessage(finishedMsg)
        } catch (dbErr) {
          console.warn('[SchedulerManager] Could not attach message to target thread (session may not exist):', dbErr)
        }
      } else {
        // Reminder or prompt
        const msgId = `msg_sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        const notificationContent = `⏰ **[Scheduled Reminder Triggered]**: ${task.description}\n\n${task.prompt || ''}`

        try {
          const finishedMsg: Message = {
            id: msgId,
            chatId: task.mode === 'chat' ? task.targetId : undefined,
            projectSessionId: task.mode === 'project' ? task.targetId : undefined,
            role: 'assistant',
            content: notificationContent,
            createdAt: Date.now()
          }
          await dbQueries.saveMessage(finishedMsg)
        } catch (dbErr) {
          console.warn('[SchedulerManager] Could not attach reminder to target thread:', dbErr)
        }
        taskResult = 'Reminder fired successfully'
      }

      const updatedTask: ScheduledTask = {
        ...task,
        status: taskError ? 'failed' : 'completed',
        result: taskResult,
        error: taskError || undefined,
        completedAt: Date.now()
      }

      await dbQueries.saveScheduledTask(updatedTask)

      for (const listener of this.onTaskCompletedListeners) {
        try {
          listener(updatedTask)
        } catch (e) {
          console.error('[SchedulerManager] Error in listener:', e)
        }
      }
    } catch (err: any) {
      console.error(`[SchedulerManager] Error executing task ${taskId}:`, err)
      await dbQueries.updateScheduledTask(taskId, {
        status: 'failed',
        error: err.message,
        completedAt: Date.now()
      })
    }
  }
}
