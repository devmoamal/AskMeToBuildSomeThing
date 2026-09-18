import { AskUserArgsSchema, type AskUserArgs, type QuestionnairePayload, type QuestionnaireQuestion } from '../../../shared/schemas'
import type { AgentTool, AgentToolContext } from './types'

export const askUserTool: AgentTool<AskUserArgs> = {
  name: 'ask_user',
  description: 'Ask the user EXACTLY ONE question to clarify requirements, choose an architectural path, or get a decision. NEVER ask multiple questions at once. When the user answers, you will receive their response and can then ask the next question if needed.',
  parameters: AskUserArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The EXACT ONE question to ask the user right now. Do not ask multiple questions.'
      },
      type: {
        type: 'string',
        enum: ['single_choice', 'multiple_choice', 'text'],
        description: 'Format of question: single_choice (pick one or write custom), multiple_choice (pick multiple or write custom), or text (open text input)'
      },
      options: {
        type: 'array',
        description: 'Selectable choices for single_choice or multiple_choice. The user can also write their own answer.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Option key (e.g. "opt_1")' },
            label: { type: 'string', description: 'User-facing choice text' },
            description: { type: 'string', description: 'Brief explanation of this choice' }
          },
          required: ['id', 'label']
        }
      },
      placeholder: {
        type: 'string',
        description: 'Optional placeholder for text inputs'
      },
      title: {
        type: 'string',
        description: 'Optional short topic title for this question'
      }
    },
    required: ['question']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: AskUserArgs, ctx: AgentToolContext, toolCallId: string) {
    if (!ctx.pauseForQuestionnaire) {
      throw new Error('Questionnaire interaction not supported in current context')
    }

    let singleQuestion: QuestionnaireQuestion

    if (args.question) {
      singleQuestion = {
        id: 'q1',
        question: args.question,
        type: args.type || 'single_choice',
        options: args.options || [],
        placeholder: args.placeholder,
        required: true
      }
    } else if (args.questions && args.questions.length > 0) {
      // If legacy array was sent, enforce exactly ONE question at a time
      singleQuestion = args.questions[0]
    } else {
      singleQuestion = {
        id: 'q1',
        question: 'Please clarify your requirement:',
        type: 'text',
        required: true
      }
    }

    const payload: QuestionnairePayload = {
      id: `quest_${Date.now()}`,
      title: args.title || 'Question',
      questions: [singleQuestion]
    }

    const answers = await ctx.pauseForQuestionnaire(payload, toolCallId)
    const answerVal = answers[singleQuestion.id] ?? Object.values(answers)[0] ?? ''

    return {
      question: singleQuestion.question,
      answer: answerVal,
      submittedAt: Date.now(),
      success: true
    }
  }
}
