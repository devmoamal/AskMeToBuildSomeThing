import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { ReadUrlArgsSchema, type ReadUrlArgs } from '../../../shared/schemas'
import type { ReadUrlOutput } from '../../../shared/types'
import type { AgentTool, AgentToolContext } from './types'

export interface ParsedWebpage {
  title?: string
  description?: string
  markdown: string
  internalLinks: string[]
}

/**
 * Clean HTML and convert to structured Markdown and links completely locally
 */
export function parseHtmlLocally(html: string, baseUrl: string): ParsedWebpage {
  const $ = cheerio.load(html)

  // Extract meta title and description
  const title = (
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    $('h1').first().text().trim()
  ).replace(/\s+/g, ' ').trim()

  const description = (
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content')
  )?.trim()

  // Collect internal links on the same host for deep-dive discovery
  const internalLinks: string[] = []
  const seenLinks = new Set<string>()

  let baseHostname = ''
  try {
    baseHostname = new URL(baseUrl).hostname
  } catch {}

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim()
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
      return
    }

    try {
      const resolved = new URL(rawHref, baseUrl).toString()
      const resolvedUrl = new URL(resolved)

      // Keep links on the same hostname, strip hash
      resolvedUrl.hash = ''
      const cleanUrl = resolvedUrl.toString()

      if (resolvedUrl.hostname === baseHostname && !seenLinks.has(cleanUrl) && cleanUrl !== baseUrl) {
        seenLinks.add(cleanUrl)
        internalLinks.push(cleanUrl)
      }
    } catch {}
  })

  // Strip boilerplate, navigational, and non-content elements
  $(
    'script, style, nav, footer, header, svg, noscript, iframe, form, aside, ' +
    'dialog, [aria-hidden="true"], .nav, .menu, .footer, .header, .cookie-banner, .advertisement'
  ).remove()

  // Prefer main content container if available
  const contentElement = $('main, article, [role="main"], #content, .content, .post, .markdown-body').first()
  const contentHtml = contentElement.length > 0 ? contentElement.html() : $('body').html()

  if (!contentHtml) {
    return {
      title,
      description,
      markdown: '',
      internalLinks: internalLinks.slice(0, 15)
    }
  }

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  })
  turndown.use(gfm)

  let markdown = turndown.turndown(contentHtml)
  // Collapse excessive consecutive blank lines
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim()

  return {
    title: title || undefined,
    description: description || undefined,
    markdown,
    internalLinks: internalLinks.slice(0, 15)
  }
}

/**
 * 100% Self-Hosted Web Crawler & Scraper.
 * Runs completely locally inside the application using native HTTP fetch and Cheerio.
 * Zero third-party cloud services or proxies.
 */
export async function crawlWebpage(url: string, maxChars: number = 15000): Promise<ReadUrlOutput> {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  }

  // Check if user configured a local self-hosted crawler instance (e.g. Crawl4AI on localhost:11235)
  const localCrawlerUrl = process.env.LOCAL_CRAWLER_URL

  if (localCrawlerUrl) {
    try {
      const res = await fetch(`${localCrawlerUrl.replace(/\/$/, '')}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(10000)
      })

      if (res.ok) {
        const data = await res.json() as any
        const md = data.markdown || data.content || ''
        if (md) {
          const isTruncated = md.length > maxChars
          const finalContent = isTruncated
            ? `${md.slice(0, maxChars)}\n\n... [Content truncated: showing first ${maxChars} of ${md.length} characters]`
            : md

          return {
            url,
            title: data.title,
            description: data.description,
            content: finalContent,
            truncated: isTruncated,
            internalLinks: data.internalLinks || [],
            byteSize: Buffer.byteLength(finalContent, 'utf8')
          }
        }
      }
    } catch {
      // Fall through to in-app local crawler
    }
  }

  // Built-in Local Scraper (Native Fetch + Cheerio + Turndown)
  const res = await fetch(url, {
    headers: commonHeaders,
    redirect: 'follow',
    signal: AbortSignal.timeout(10000)
  })

  if (!res.ok) {
    throw new Error(`Failed to crawl webpage: HTTP ${res.status} ${res.statusText}`)
  }

  const contentType = res.headers.get('content-type') || ''
  const rawBody = await res.text()

  // Handle plain text / json directly
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    const isTruncated = rawBody.length > maxChars
    const content = isTruncated ? `${rawBody.slice(0, maxChars)}\n\n... [Content truncated]` : rawBody
    return {
      url,
      content,
      truncated: isTruncated,
      byteSize: Buffer.byteLength(content, 'utf8')
    }
  }

  // Local HTML Parsing & Markdown generation
  const parsed = parseHtmlLocally(rawBody, url)
  let content = parsed.markdown

  // If page had internal links, append a compact subpage directory for deep diving
  if (parsed.internalLinks.length > 0) {
    const linksSection = `\n\n---\n### Site Subpages Found (${parsed.internalLinks.length})\n` +
      parsed.internalLinks.map(l => `- ${l}`).join('\n')
    content += linksSection
  }

  const isTruncated = content.length > maxChars
  if (isTruncated) {
    content = `${content.slice(0, maxChars)}\n\n... [Content truncated: showing first ${maxChars} of ${parsed.markdown.length} characters]`
  }

  return {
    url,
    title: parsed.title,
    description: parsed.description,
    content,
    truncated: isTruncated,
    internalLinks: parsed.internalLinks,
    byteSize: Buffer.byteLength(content, 'utf8')
  }
}

export const readUrlTool: AgentTool<ReadUrlArgs, ReadUrlOutput> = {
  name: 'read_url',
  description: 'Self-hosted site crawler and page reader. Directly crawls any website or documentation URL, extracts clean markdown, and discovers subpages for deep diving. Runs 100% locally with zero third-party services.',
  parameters: ReadUrlArgsSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The HTTP or HTTPS URL of the webpage or documentation to crawl'
      },
      maxChars: {
        type: 'number',
        description: 'Maximum characters of text to return (default 15000)',
        default: 15000
      }
    },
    required: ['url']
  },
  allowedModes: ['chat', 'project'],
  async execute(args: ReadUrlArgs, ctx: AgentToolContext, toolCallId: string): Promise<ReadUrlOutput> {
    return await crawlWebpage(args.url, args.maxChars || 15000)
  }
}
