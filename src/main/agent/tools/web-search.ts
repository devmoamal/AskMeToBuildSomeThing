import { WebSearchArgsSchema, type WebSearchArgs } from '../../../shared/schemas'
import type { WebSearchOutput, WebSearchResult } from '../../../shared/types'
import type { AgentTool, AgentToolContext } from './types'

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
}

function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractRealUrl(href: string): string {
  if (!href) return ''
  try {
    const uddgMatch = href.match(/[?&]uddg=([^&]+)/)
    if (uddgMatch && uddgMatch[1]) {
      return decodeURIComponent(uddgMatch[1])
    }
    if (href.startsWith('//')) {
      return 'https:' + href
    }
    return href
  } catch {
    return href
  }
}

export async function parseDuckDuckGoHtml(html: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = []
  // 1. Try standard HTML block split
  const blocks = html.split(/<div class="[^"]*result\s+results_links/i)

  if (blocks.length > 1) {
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]
      const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      if (!titleMatch) continue

      const url = extractRealUrl(titleMatch[1])
      const title = stripHtmlTags(titleMatch[2])

      const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]) : ''

      if (url && title) {
        results.push({
          title,
          url,
          snippet
        })
      }
    }
    if (results.length > 0) return results
  }

  // 2. Try DuckDuckGo Lite layout: <a class="result-link" href="...">...</a> and <td class="result-snippet">...</td>
  const liteLinks = Array.from(html.matchAll(/<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi))
  const liteSnippets = Array.from(html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi))

  for (let i = 0; i < liteLinks.length; i++) {
    const linkMatch = liteLinks[i]
    const url = extractRealUrl(linkMatch[1])
    const title = stripHtmlTags(linkMatch[2])
    const snippet = liteSnippets[i] ? stripHtmlTags(liteSnippets[i][1]) : ''

    if (url && title) {
      results.push({
        title,
        url,
        snippet
      })
    }
  }

  return results
}

export async function fetchDuckDuckGoInstantAnswer(query: string): Promise<WebSearchResult[]> {
  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'AskMeToBuildSomeThing/1.0 (Desktop Assistant)'
      }
    })
    if (!res.ok) return []
    const data = await res.json() as any
    const results: WebSearchResult[] = []

    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText
      })
    }

    if (Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL && topic.Text) {
          const title = topic.Text.split(' - ')[0] || topic.Text
          results.push({
            title: title.slice(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text
          })
        }
      }
    }

    return results
  } catch {
    return []
  }
}

export async function searchDuckDuckGo(query: string, numResults: number = 5): Promise<WebSearchResult[]> {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://html.duckduckgo.com/'
  }

  // Tier 1: DuckDuckGo HTML POST / GET
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `q=${encodeURIComponent(query)}`
    })

    if (res.ok) {
      const html = await res.text()
      const scraped = await parseDuckDuckGoHtml(html)
      if (scraped.length > 0) {
        return scraped.slice(0, numResults)
      }
    }
  } catch {}

  // Tier 2: DuckDuckGo Lite POST
  try {
    const res = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `q=${encodeURIComponent(query)}`
    })

    if (res.ok) {
      const html = await res.text()
      const scraped = await parseDuckDuckGoHtml(html)
      if (scraped.length > 0) {
        return scraped.slice(0, numResults)
      }
    }
  } catch {}

  // Tier 3: DuckDuckGo Instant Answer API fallback
  const fallback = await fetchDuckDuckGoInstantAnswer(query)
  return fallback.slice(0, numResults)
}

export const webSearchTool: AgentTool<WebSearchArgs, WebSearchOutput> = {
  name: 'web_search',
  description: 'Search the live web using DuckDuckGo to find real-time information, documentation, package releases, error fixes, or external resources.',
  parameters: WebSearchArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to look up on the web'
      },
      numResults: {
        type: 'number',
        description: 'Number of search results to return (1-10, default 5)',
        default: 5
      }
    },
    required: ['query']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: WebSearchArgs, ctx: AgentToolContext, toolCallId: string): Promise<WebSearchOutput> {
    const limit = args.numResults || 5
    const results = await searchDuckDuckGo(args.query, limit)

    return {
      query: args.query,
      results,
      totalResults: results.length
    }
  }
}
