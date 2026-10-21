import { pageUrl } from './context.ts'
import { activeLocales, loadReadablePage, primaryLocale, readableText } from './content.ts'
import { errorResult, ToolError } from './tool.ts'
import { findTool, mayCall, toolsFor, validateArguments } from './tools/index.ts'
import type { McpContext } from './context.ts'
import type { ToolResult } from './tool.ts'

/**
 * The Model Context Protocol, the subset a stateless server needs: JSON-RPC 2.0 framing, `initialize`,
 * `ping`, `tools/*` and `resources/*`.
 *
 * Written by hand rather than with `@modelcontextprotocol/sdk`, which would bring `zod` and an HTTP
 * stack of its own into a Fastify backend for what is a dispatch table — see `dev/specs/mcp.md` §3.1.
 * Nothing here is stateful: there is no session, every request is answered from what it carries, so
 * any instance of an HA set can answer any request.
 */

/**
 * The protocol revisions this server speaks, newest first. A client asking for one of them gets it;
 * a client asking for anything else is answered with the newest, as the specification's version
 * negotiation says, and decides for itself whether it can carry on.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']

export const JSONRPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603
} as const

export interface JsonRpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: any
  result?: unknown
  error?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** A refusal at the protocol level — a malformed request, an unknown method or tool. */
class RpcError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

/** Whether a message is a request, i.e. expects an answer. Notifications and responses do not. */
export function isRequest(message: JsonRpcMessage): boolean {
  return typeof message?.method === 'string' && message.id !== undefined && message.id !== null
}

/**
 * Answer one message.
 *
 * @returns The response, or null for a notification (or a response from the client), which gets none
 */
export async function handleMessage(
  ctx: McpContext,
  message: JsonRpcMessage
): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
    return rpcError(null, JSONRPC_ERRORS.invalidRequest, 'Not a JSON-RPC 2.0 message.')
  }
  if (!isRequest(message)) {
    // -> `notifications/initialized` and `notifications/cancelled` among them. A stateless server has
    //    nothing to update for either, and a cancellation arrives after the answer has gone anyway.
    return null
  }
  const id = message.id as string | number
  try {
    const result = await dispatch(ctx, message.method!, message.params ?? {})
    return { jsonrpc: '2.0', id, result }
  } catch (err: any) {
    if (err instanceof RpcError) {
      return rpcError(id, err.code, err.message)
    }
    WIKI.logger.warn(`MCP ${message.method} failed: ${err.message}`)
    return rpcError(id, JSONRPC_ERRORS.internalError, 'Internal error.')
  }
}

export function rpcError(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

async function dispatch(ctx: McpContext, method: string, params: any): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return await initialize(ctx, params)
    case 'ping':
      return {}
    case 'tools/list':
      return {
        tools: toolsFor(ctx).map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: {
            title: tool.title,
            readOnlyHint: tool.readOnly,
            destructiveHint: tool.destructive ?? false,
            idempotentHint: tool.idempotent ?? false,
            // -> Everything a tool reaches is this wiki: nothing here fetches from the open web
            openWorldHint: false
          }
        }))
      }
    case 'tools/call':
      return callTool(ctx, params)
    case 'resources/list':
      // -> A wiki is too many pages to enumerate; they are reached through the template below
      return { resources: [] }
    case 'resources/templates/list':
      return {
        resourceTemplates: mayReadPages(ctx)
          ? [
              {
                uriTemplate: 'wiki://{locale}/{+path}',
                name: 'page',
                title: 'Wiki page',
                description:
                  'A page of this wiki, as markdown — the same content `get_page` returns, whole.',
                mimeType: 'text/markdown'
              }
            ]
          : []
      }
    case 'resources/read':
      return readResource(ctx, params)
    default:
      throw new RpcError(JSONRPC_ERRORS.methodNotFound, `Method not found: ${method}`)
  }
}

async function initialize(ctx: McpContext, params: any) {
  const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
  const site = WIKI.sites[ctx.siteId]
  return {
    protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
      ? requested
      : SUPPORTED_PROTOCOL_VERSIONS[0],
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false }
    },
    serverInfo: {
      name: 'wiki-js',
      title: site?.config?.title || 'Wiki.js',
      version: WIKI.version
    },
    instructions: await instructionsFor(ctx)
  }
}

/**
 * What a client puts in front of the model before anything else: what this wiki is, and how to use
 * it well. Written for a model. Only what the caller can act on — a read-only token is not told how
 * to write.
 */
async function instructionsFor(ctx: McpContext): Promise<string> {
  const site = WIKI.sites[ctx.siteId]
  const title = site?.config?.title || 'this wiki'
  const description = site?.config?.description
  const locales = activeLocales(ctx)
  const can = (name: string) => {
    const tool = findTool(name)
    return Boolean(tool && mayCall(ctx, tool))
  }
  const reading: string[] = []
  if (can('search_pages') && can('get_page')) {
    reading.push(
      'Find pages with search_pages; open the promising ones with get_page instead of answering from search snippets.'
    )
  }
  if (can('get_page')) {
    reading.push(
      'For a long page, read its outline first and ask get_page for one section.',
      'Cite every page you rely on by its url, so the person can check it. Mention when a page was last updated if its age matters.'
    )
  }
  if (can('lookup_term')) {
    reading.push('If an internal name or acronym is unclear, look it up with lookup_term.')
  }
  if (locales.length > 1) {
    reading.push(
      `The wiki is written in several locales (${locales.join(', ')}; primary ${primaryLocale(ctx)}). Search covers all of them unless you narrow it; a page lists its translations.`
    )
  }
  reading.push(
    ctx.user
      ? `You are acting as ${ctx.user.name || ctx.user.email}, and see exactly what they may see.`
      : 'You are reading as an anonymous visitor, and see only what the public may see.'
  )
  const contributing: string[] = []
  if (can('update_page') || can('create_page')) {
    contributing.push(
      'When you learn something the wiki should know — how something actually works, a fix, a decision — write it down for the next person and the next assistant, where the person you are working for would want it.',
      'Search before creating: update the page that covers the topic rather than starting another. Read a page with get_page before changing it, and pass its versionId.',
      'Change only what is wrong or missing, with find-and-replace edits rather than rewriting the page, and give a one-sentence reason saying why.',
      'Fix the broken links a write reports.'
    )
  }
  if (can('suggest_edit')) {
    contributing.push(
      'Where you may not edit a page, or a person should look first, suggest the change with suggest_edit.'
    )
  }
  if (can('post_comment')) {
    contributing.push(
      'Where you cannot fix a problem, flag it with post_comment, quoting the passage it is about.'
    )
  }
  if (can('define_term')) {
    contributing.push('Define internal terms the glossary is missing with define_term.')
  }
  const lines = [
    `This server is ${title}, a Wiki.js wiki at ${ctx.origin}${description ? ` — ${description}` : ''}.`,
    "It holds this organisation's own documentation: when a question may be about its systems, processes, conventions or vocabulary, search here before answering from general knowledge.",
    '',
    'Reading:',
    ...reading.map((line) => `- ${line}`)
  ]
  if (contributing.length > 0) {
    lines.push('', 'Contributing:', ...contributing.map((line) => `- ${line}`))
  }
  const guidelines = await guidelinesFor(ctx)
  if (guidelines) {
    lines.push(
      '',
      `This wiki's own guidelines for assistants (${guidelines.url}):`,
      '',
      guidelines.text
    )
  }
  return lines.join('\n')
}

/** How much of the guidelines page goes into the instructions; the rest is a `get_page` away. */
const GUIDELINES_MAX_CHARS = 6000

/**
 * The site's agent guidelines page, as this caller may read it — or null when there is none, or it
 * is not theirs to read. An ordinary page, written and improved like any other, which is the point:
 * where new pages go and how they are written is the wiki's to say, and it changes.
 */
async function guidelinesFor(ctx: McpContext): Promise<{ url: string; text: string } | null> {
  const path = WIKI.models.mcp.guidelinesPathFor(ctx.siteId)
  if (!path) {
    return null
  }
  const locale = primaryLocale(ctx)
  const id = await WIKI.models.pages.idAtPath(ctx.siteId, locale, path)
  if (!id) {
    return null
  }
  try {
    const page = await loadReadablePage(ctx, id, { withContent: true })
    if (page.isLocked) {
      return null
    }
    const { text } = await readableText(page)
    const url = pageUrl(ctx, page.locale, page.path)
    return {
      url,
      text:
        text.length > GUIDELINES_MAX_CHARS
          ? `${text.slice(0, GUIDELINES_MAX_CHARS)}\n\n[Cut short. Read the whole page with get_page.]`
          : text
    }
  } catch {
    return null
  }
}

/** Whether the caller may read pages at all — what the resource template stands on. */
function mayReadPages(ctx: McpContext): boolean {
  const getPage = findTool('get_page')
  return Boolean(getPage && mayCall(ctx, getPage))
}

async function callTool(ctx: McpContext, params: any): Promise<ToolResult> {
  const name = params?.name
  const tool = typeof name === 'string' ? findTool(name) : undefined
  /*
    One answer for a tool that does not exist and one this caller may not call: either way it is not
    in their `tools/list`, which is the list they were given.
  */
  if (!tool || !mayCall(ctx, tool)) {
    throw new RpcError(JSONRPC_ERRORS.invalidParams, `Unknown tool: ${String(name)}`)
  }
  const args = params.arguments ?? {}
  const invalid = validateArguments(tool, args)
  if (invalid) {
    throw new RpcError(JSONRPC_ERRORS.invalidParams, invalid)
  }
  try {
    return capResult(await tool.run(ctx, args))
  } catch (err: any) {
    if (err instanceof ToolError) {
      return errorResult(err.message)
    }
    // -> A model error carrying a status (a `CustomError`) has a message written for a person
    if (err?.statusCode && err.statusCode < 500) {
      return errorResult(err.message)
    }
    throw err
  }
}

/**
 * The backstop on result size. The tools that can answer at length cut their own text and say how to
 * ask for the rest; this catches whatever did not, so that no one answer can fill a context window.
 */
function capResult(result: ToolResult): ToolResult {
  const cap = WIKI.models.mcp.getConfig().maxResultChars
  return {
    ...result,
    content: result.content.map((block) =>
      block.type === 'text' && block.text.length > cap
        ? {
            ...block,
            text: `${block.text.slice(0, cap)}\n\n[Cut at ${cap} characters. Ask for less, or page through it.]`
          }
        : block
    )
  }
}

/** `wiki://{locale}/{path}`, read as `get_page` would read it, whole. */
async function readResource(ctx: McpContext, params: any) {
  const uri = typeof params?.uri === 'string' ? params.uri : ''
  const match = /^wiki:\/\/([^/]+)\/(.*)$/.exec(uri)
  if (!match || !mayReadPages(ctx)) {
    throw new RpcError(JSONRPC_ERRORS.invalidParams, `Unknown resource: ${uri}`)
  }
  const result = await callTool(ctx, {
    name: 'get_page',
    arguments: { locale: match[1], path: decodeURIComponent(match[2]!) }
  })
  if (result.isError) {
    const first = result.content[0]
    throw new RpcError(
      JSONRPC_ERRORS.invalidParams,
      first?.type === 'text' ? first.text : 'Not found.'
    )
  }
  const blockText = (index: number) => {
    const block = result.content[index]
    return block?.type === 'text' ? block.text : ''
  }
  const text = blockText(1)
  const meta = JSON.parse(blockText(0))
  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: `# ${meta.title}\n\n${meta.url ?? pageUrl(ctx, match[1]!, match[2]!)}\n\n${text}`
      }
    ]
  }
}
