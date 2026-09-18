import type { ProviderConfig } from '../../../shared/schemas'
import type { ILlmProviderAdapter } from './base'
import { OpenAiCompatibleAdapter } from './openai'
import { AnthropicCompatibleAdapter } from './anthropic'

export class ProviderAdapterFactory {
  private static openai = new OpenAiCompatibleAdapter()
  private static anthropic = new AnthropicCompatibleAdapter()

  static getAdapter(type: 'openai' | 'anthropic'): ILlmProviderAdapter {
    switch (type) {
      case 'anthropic':
        return this.anthropic
      case 'openai':
      default:
        return this.openai
    }
  }

  static async testConnection(config: ProviderConfig) {
    const adapter = this.getAdapter(config.type)
    return adapter.testConnection(config)
  }

  static async fetchModels(config: ProviderConfig) {
    const adapter = this.getAdapter(config.type)
    return adapter.fetchModels(config)
  }
}
