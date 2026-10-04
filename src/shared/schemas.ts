import { z } from 'zod'

export const ProviderTypeSchema = z.enum(['openai', 'anthropic'])
export type ProviderType = z.infer<typeof ProviderTypeSchema>

export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  type: ProviderTypeSchema,
  baseUrl: z.string().url('Must be a valid URL'),
  apiKey: z.string(),
  models: z.array(z.string()).default([]),
  defaultModel: z.string().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.number().default(() => Date.now())
})
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

export const AppSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  defaultShell: z.enum(['powershell', 'cmd', 'bash', 'wsl']).default('powershell'),
  autoApproveTerminal: z.boolean().default(false),
  autoApproveFileWrite: z.boolean().default(false),
  autoDownloadUpdates: z.boolean().default(false),
  terminalTimeoutMs: z.number().default(60000),
  terminalWaitUntilComplete: z.boolean().default(true),
  infiniteLoop: z.boolean().default(true),
  autoCompactContext: z.boolean().default(true),
  pruneHistoricalToolOutputs: z.boolean().default(true),
  preserveRecentTokens: z.number().default(10000),
  customCss: z.string().default(''),
  chatSystemPrompt: z.string().default(
    'You are AskMeToBuildSomeThing, a friendly AI collaborator. In general chats, you help brainstorm, write markdown canvas notes, customize the app appearance and settings, and interview the user with questionnaires when you need choices.'
  ),
  projectSystemPrompt: z.string().default(
    'You are AskMeToBuildSomeThing, an autonomous agentic software engineer working on a local codebase. You have tools to read files, create/edit files, run terminal commands, create canvas documents, customize the app, and ask the user questions when clarification is required. Always think methodically and produce clean, production-grade solutions.'
  )
})
export type AppSettings = z.infer<typeof AppSettingsSchema>

export const QuestionnaireOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional()
})
export type QuestionnaireOption = z.infer<typeof QuestionnaireOptionSchema>

export const QuestionnaireQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  type: z.enum(['single_choice', 'multiple_choice', 'text']),
  options: z.array(QuestionnaireOptionSchema).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(true)
})
export type QuestionnaireQuestion = z.infer<typeof QuestionnaireQuestionSchema>

export const QuestionnairePayloadSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  questions: z.array(QuestionnaireQuestionSchema)
})
export type QuestionnairePayload = z.infer<typeof QuestionnairePayloadSchema>

// Tools schemas
export const ReadFileArgsSchema = z.object({
  path: z.string().min(1, 'Path is required')
})
export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>

export const CreateFileArgsSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string()
})
export type CreateFileArgs = z.infer<typeof CreateFileArgsSchema>

export const EditFileArgsSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  content: z.string().optional(),
  old_str: z.string().optional(),
  new_str: z.string().optional()
})
export type EditFileArgs = z.infer<typeof EditFileArgsSchema>

export const TerminalArgsSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  cwd: z.string().optional(),
  timeoutMs: z.number().optional().describe('Optional timeout in ms. Set to 0 to wait indefinitely until the command finishes.')
})
export type TerminalArgs = z.infer<typeof TerminalArgsSchema>

export const ScheduleTaskArgsSchema = z.object({
  command: z.string().optional().describe('Shell command to execute when scheduled time triggers (e.g. "ping -c 4 google.com")'),
  prompt: z.string().optional().describe('Optional instruction or query for the AI when the task fires'),
  description: z.string().min(1, 'Brief human-readable summary of what this task does'),
  delaySeconds: z.number().min(1).describe('Number of seconds from now to wait before executing (e.g. 600 for 10 minutes)'),
  type: z.enum(['command', 'prompt', 'reminder']).default('command')
})
export type ScheduleTaskArgs = z.infer<typeof ScheduleTaskArgsSchema>

export const MakeCanvasArgsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  language: z.string().default('markdown'),
  content: z.string()
})
export type MakeCanvasArgs = z.infer<typeof MakeCanvasArgsSchema>

export const AskUserArgsSchema = z.object({
  question: z.string().optional(),
  type: z.enum(['single_choice', 'multiple_choice', 'text']).default('single_choice'),
  options: z.array(QuestionnaireOptionSchema).optional(),
  placeholder: z.string().optional(),
  title: z.string().optional(),
  questions: z.array(QuestionnaireQuestionSchema).optional()
})
export type AskUserArgs = z.infer<typeof AskUserArgsSchema>

export const WebSearchArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  numResults: z.number().int().min(1).max(10).default(5)
})
export type WebSearchArgs = z.infer<typeof WebSearchArgsSchema>

export const ReadUrlArgsSchema = z.object({
  url: z.string().url('Must be a valid HTTP or HTTPS URL'),
  maxChars: z.number().int().min(500).max(50000).default(15000)
})
export type ReadUrlArgs = z.infer<typeof ReadUrlArgsSchema>

export const ListDirArgsSchema = z.object({
  path: z.string().default('.'),
  recursive: z.boolean().default(false),
  maxDepth: z.number().int().min(1).max(5).default(2)
})
export type ListDirArgs = z.infer<typeof ListDirArgsSchema>

export const SearchCodeArgsSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  path: z.string().optional(),
  caseSensitive: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(100).default(30)
})
export type SearchCodeArgs = z.infer<typeof SearchCodeArgsSchema>

export const FindFilesArgsSchema = z.object({
  pattern: z.string().min(1, 'Search pattern or extension is required'),
  path: z.string().optional()
})
export type FindFilesArgs = z.infer<typeof FindFilesArgsSchema>

export const CustomizeAppArgsSchema = z.object({
  customCss: z.string().optional().describe('CSS rules to inject into the app at runtime. You can style CSS variables (e.g. :root { --primary: #..., --background: #..., --foreground: #... }), custom fonts, sidebar styles, layout tweaks, or component styles.'),
  explanation: z.string().describe('Clear, concise explanation of the customizations made to the app.'),
  chatSystemPrompt: z.string().optional().describe('Optional custom system prompt / personality for the assistant in No Project mode.'),
  projectSystemPrompt: z.string().optional().describe('Optional custom system prompt / personality for the assistant in Project mode.')
})
export type CustomizeAppArgs = z.infer<typeof CustomizeAppArgsSchema>

export const ManageMemoryArgsSchema = z.object({
  action: z.enum(['save', 'list', 'delete']).describe('The action to perform: save a memory, list all memories, or delete by id or key'),
  key: z.string().optional().describe('Memory identifier or title (e.g. "auth_pattern", "db_orm_rules")'),
  content: z.string().optional().describe('Detailed content, rule, or architectural fact to remember across sessions'),
  category: z.enum(['architecture', 'decision', 'convention', 'dependency', 'general']).default('architecture').describe('Category classification for this memory'),
  id: z.string().optional().describe('Memory ID (required for deleting a specific memory)')
})
export type ManageMemoryArgs = z.infer<typeof ManageMemoryArgsSchema>

export const GetFileOutlineArgsSchema = z.object({
  path: z.string().min(1, 'Path is required').describe('Relative or absolute file path to inspect (TypeScript, JavaScript, Python, Rust, Go, etc.)')
})
export type GetFileOutlineArgs = z.infer<typeof GetFileOutlineArgsSchema>

export const GitStatusArgsSchema = z.object({
  showDiff: z.boolean().default(false).describe('Whether to include a compact git diff of unstaged and staged changes'),
  path: z.string().optional().describe('Optional path or file to filter git status/diff')
})
export type GitStatusArgs = z.infer<typeof GitStatusArgsSchema>

export const TaskArgsSchema = z.object({
  subagent_type: z.enum(['explore', 'review', 'general']).default('general').describe('Specialized agent role: "explore" for codebase discovery/grep, "review" for code audit/diff checking, "general" for independent task execution'),
  description: z.string().min(1, 'Description is required').describe('Short 3-5 word title describing the delegated task'),
  prompt: z.string().min(1, 'Prompt is required').describe('Specific detailed instructions for the subagent to execute')
})
export type TaskArgs = z.infer<typeof TaskArgsSchema>

export const TodoItemSchema = z.object({
  id: z.string().optional().describe('Unique identifier for this task (if updating existing)'),
  content: z.string().min(1, 'Task content is required').describe('Clear, actionable task description'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending').describe('Current status of the task'),
  priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Priority level')
})

export const ManageTodosArgsSchema = z.object({
  action: z.enum(['update', 'list']).default('update').describe('Action to perform: "update" to replace/sync the task checklist, or "list" to view current tasks'),
  todos: z.array(TodoItemSchema).optional().describe('List of tasks for this session. When updating, provide the complete updated list of tasks so the status of each item is accurately reflected.')
})
export type ManageTodosArgs = z.infer<typeof ManageTodosArgsSchema>

