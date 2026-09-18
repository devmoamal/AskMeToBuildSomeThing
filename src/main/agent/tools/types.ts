import { z } from 'zod'
import type { AppSettings } from '../../../shared/schemas'
import type { QuestionnairePayload } from '../../../shared/schemas'

export interface AgentToolContext {
  mode: 'chat' | 'project'
  projectFolder?: string
  chatId?: string
  projectSessionId?: string
  settings: AppSettings
  onStream?: (chunk: string) => void
  pauseForQuestionnaire?: (payload: QuestionnairePayload, toolCallId: string) => Promise<Record<string, string | string[]>>
  requireToolApproval?: (toolName: string, args: any) => Promise<boolean>
}

export interface AgentTool<TArgs = any, TResult = any> {
  name: string
  description: string
  parameters: z.ZodSchema<TArgs>
  jsonSchema: Record<string, any>
  allowedModes: ('chat' | 'project')[]
  execute: (args: TArgs, ctx: AgentToolContext, toolCallId: string) => Promise<TResult>
}
