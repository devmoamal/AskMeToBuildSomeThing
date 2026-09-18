import { describe, it, expect } from 'bun:test'
import { WebSearchArgsSchema } from '../shared/schemas'
import { ToolRegistry } from '../main/agent/tools/registry'
import { parseDuckDuckGoHtml, searchDuckDuckGo } from '../main/agent/tools/web-search'
import { AppSettingsSchema } from '../shared/schemas'

describe('Web Search Tool & DuckDuckGo Parser', () => {
  it('should validate search args with Zod schema', () => {
    const valid = WebSearchArgsSchema.parse({ query: 'bun runtime' })
    expect(valid.query).toBe('bun runtime')
    expect(valid.numResults).toBe(5)

    const withLimit = WebSearchArgsSchema.parse({ query: 'vite react', numResults: 8 })
    expect(withLimit.numResults).toBe(8)

    expect(() => WebSearchArgsSchema.parse({ query: '' })).toThrow()
  })

  it('should correctly parse DuckDuckGo HTML response and extract real destination URLs', async () => {
    const mockHtml = `
      <div class="result results_links results_links_deep web-result ">
        <div class="links_main links_deep result__body">
          <h2 class="result__title">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbun.sh%2Fdocs&amp;rut=123">Bun &amp; JavaScript <b>Runtime</b></a>
          </h2>
          <div class="result__snippet">
            <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbun.sh%2Fdocs">Develop, test, run, and bundle &quot;JavaScript&quot; &amp; TypeScript projects.</a>
          </div>
        </div>
      </div>
      <div class="result results_links results_links_deep web-result ">
        <div class="links_main links_deep result__body">
          <h2 class="result__title">
            <a class="result__a" href="https://github.com/oven-sh/bun">Oven-sh / Bun Repository</a>
          </h2>
          <div class="result__snippet">
            <a class="result__snippet" href="https://github.com/oven-sh/bun">Incredibly fast JavaScript runtime, bundler, test runner.</a>
          </div>
        </div>
      </div>
    `

    const parsed = await parseDuckDuckGoHtml(mockHtml)
    expect(parsed).toHaveLength(2)

    expect(parsed[0].title).toBe('Bun & JavaScript Runtime')
    expect(parsed[0].url).toBe('https://bun.sh/docs')
    expect(parsed[0].snippet).toBe('Develop, test, run, and bundle "JavaScript" & TypeScript projects.')

    expect(parsed[1].title).toBe('Oven-sh / Bun Repository')
    expect(parsed[1].url).toBe('https://github.com/oven-sh/bun')
    expect(parsed[1].snippet).toBe('Incredibly fast JavaScript runtime, bundler, test runner.')
  })

  it('should find web_search tool in ToolRegistry and execute successfully', async () => {
    const searchTool = ToolRegistry.getToolByName('web_search')
    expect(searchTool).toBeDefined()
    expect(searchTool!.allowedModes).toContain('chat')
    expect(searchTool!.allowedModes).toContain('project')

    const mockCtx = {
      mode: 'chat' as const,
      settings: AppSettingsSchema.parse({})
    }

    const output = await searchTool!.execute({ query: 'electron js', numResults: 3 }, mockCtx, 'call_search_1')
    expect(output).toBeDefined()
    expect(output.query).toBe('electron js')
    expect(Array.isArray(output.results)).toBe(true)
  })
})
