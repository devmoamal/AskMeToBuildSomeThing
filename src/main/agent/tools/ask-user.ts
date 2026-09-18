import { AskUserArgsSchema, type AskUserArgs, type QuestionnairePayload } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

export const askUserTool: AgentTool<AskUserArgs> = {
  name: 'ask_user',
  description: 'Interview the user by displaying an interactive multi-step questionnaire card in the chat. Use this whenever you need to clarify requirements, select architectural options, or confirm user preferences.',
  parameters: AskUserArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short headline or topic for the questionnaire (e.g. "Architecture & Design Choices")'
      },
      questions: {
        type: 'array',
        description: 'The list of questions to ask the user to clarify requirements or make decisions',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the question (e.g. "q1", "db_choice")'
            },
            question: {
              type: 'string',
              description: 'The question text to present to the user'
            },
            type: {
              type: 'string',
              enum: ['single_choice', 'multiple_choice', 'text'],
              description: 'Format of question: single_choice (radio), multiple_choice (checkboxes), or text (input)'
            },
            placeholder: {
              type: 'string',
              description: 'Optional placeholder for text inputs'
            },
            required: {
              type: 'boolean',
              default: true
            },
            options: {
              type: 'array',
              description: 'List of selectable choices for single_choice or multiple_choice questions',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Option key' },
                  label: { type: 'string', description: 'User-facing choice text' },
                  description: { type: 'string', description: 'Brief subtitle explaining what this option entails' }
                },
                required: ['id', 'label']
              }
            }
          },
          required: ['id', 'question', 'type']
        }
      }
    },
    required: ['title', 'questions']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: AskUserArgs, ctx: AgentToolContext, toolCallId: string) {
    if (!ctx.pauseForQuestionnaire) {
      throw new Error('Questionnaire interaction not supported in current context')
    }

    const payload: QuestionnairePayload = {
      id: `quest_${Date.now()}`,
      title: args.title,
      questions: args.questions
    }

    const answers = await ctx.pauseForQuestionnaire(payload, toolCallId)

    return {
      title: args.title,
      answers,
      submittedAt: Date.now(),
      success: true
    }
  }
}
