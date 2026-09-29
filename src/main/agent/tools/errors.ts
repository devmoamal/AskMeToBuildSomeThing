import { z } from 'zod'

/**
 * Raised when the LLM calls a tool with arguments that fail the parameter
 * schema. Its message produces model-facing prose that tells the model
 * exactly how to correct the input.
 */
export class InvalidArgumentsError extends Error {
  constructor(
    public readonly tool: string,
    public readonly detail: string
  ) {
    super(
      `The "${tool}" tool was called with invalid arguments: ${detail}.\nPlease rewrite the input so it strictly satisfies the expected schema.`
    )
    this.name = 'InvalidArgumentsError'
  }

  static fromZodError(toolName: string, error: z.ZodError): InvalidArgumentsError {
    const issues = error.issues.map(issue => {
      const path = issue.path.join('.') || 'root'
      return `"${path}": ${issue.message}`
    }).join('; ')
    return new InvalidArgumentsError(toolName, issues)
  }
}
