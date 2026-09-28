import { ScheduleTaskArgsSchema, type ScheduleTaskArgs } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'
import { SchedulerManager } from '../../scheduler/scheduler'

export const scheduleTaskTool: AgentTool<ScheduleTaskArgs> = {
  name: 'schedule_task',
  description: 'Schedule a shell command, reminder, or prompt to execute in the background after a specified delay (in seconds). The task persists across sessions and will execute automatically when the timer expires, logging results directly into the conversation.',
  parameters: ScheduleTaskArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to run (e.g. "ping -c 4 google.com" or "npm run build")'
      },
      delaySeconds: {
        type: 'number',
        description: 'Number of seconds from now to wait before executing (e.g. 600 for 10 minutes, 60 for 1 minute)'
      },
      description: {
        type: 'string',
        description: 'Clear description of the scheduled task'
      },
      type: {
        type: 'string',
        enum: ['command', 'prompt', 'reminder'],
        description: 'Type of task to run: "command" for shell execution, "reminder" for timer notification'
      },
      prompt: {
        type: 'string',
        description: 'Optional reminder message or prompt text'
      }
    },
    required: ['delaySeconds', 'description']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: ScheduleTaskArgs, ctx: AgentToolContext) {
    const targetId = ctx.chatId || ctx.projectSessionId
    if (!targetId) {
      throw new Error('Cannot schedule task: Missing active chat or project session ID')
    }

    const task = await SchedulerManager.scheduleTask({
      targetId,
      mode: ctx.mode,
      type: args.type || (args.command ? 'command' : 'reminder'),
      command: args.command,
      prompt: args.prompt,
      description: args.description,
      delaySeconds: args.delaySeconds,
      projectFolder: ctx.projectFolder
    })

    const executionTimeStr = new Date(task.scheduledAt).toLocaleTimeString()
    const minutes = (args.delaySeconds / 60).toFixed(1).replace(/\.0$/, '')

    return {
      success: true,
      taskId: task.id,
      scheduledAt: task.scheduledAt,
      delaySeconds: args.delaySeconds,
      description: args.description,
      command: args.command,
      message: `Task "${args.description}" successfully scheduled. It will execute in ~${minutes} minute(s) at ${executionTimeStr}. You do not need to wait; output will be posted automatically.`
    }
  }
}
