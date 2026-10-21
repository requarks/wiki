import type { McpContext } from './context.ts'
import type { McpToolGroup } from '../models/mcp.ts'
import type { TokenScopeCategory } from '../models/personalTokens.ts'

/** A block of a tool's answer in words or JSON — what nearly every tool answers with. */
export interface TextContent {
  type: 'text'
  text: string
}

/** An image, base64-encoded, for `get_asset` on a picture a model can look at. */
export interface ImageContent {
  type: 'image'
  data: string
  mimeType: string
}

/** What `tools/call` answers with. */
export interface ToolResult {
  content: Array<TextContent | ImageContent>
  /** A failure the model should read and act on, as opposed to a protocol error. */
  isError?: boolean
}

/**
 * A refusal or a failure the agent can do something about: no such page, not allowed, a stale
 * version. Reported as the tool's result with `isError` set, which is what the MCP specification asks
 * for — the model reads it and tries something else — rather than as a JSON-RPC error, which a client
 * treats as the call never having happened.
 */
export class ToolError extends Error {}

/** A JSON Schema for a tool's arguments, as `tools/list` publishes it and Ajv checks it. */
export type InputSchema = {
  type: 'object'
  properties: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
}

export interface McpTool<Args = any> {
  /** What the model calls it by: snake_case, unique across every group. */
  name: string
  /** What a client shows a person. */
  title: string
  /** What the model reads to decide whether and how to call it — written for a model. */
  description: string
  /** The administrator's switch it answers to. */
  group: McpToolGroup
  /**
   * The token scope category it needs, on top of `mcp`. The same category the `/_api` route doing the
   * same thing declares, so that a token reaches the same things on both surfaces.
   */
  category: Exclude<TokenScopeCategory, 'mcp'>
  /**
   * Whether the tool only reads. Decides the scope LEVEL it needs — `read` of `mcp` and of its
   * category, or `write` of both — the way a route's method decides one, and is the `readOnlyHint`
   * it is annotated with. One fact, declared once.
   */
  readOnly: boolean
  destructive?: boolean
  idempotent?: boolean
  /**
   * Whether the tool makes sense on this site at all — the glossary switched off, comments handled by
   * a third party. Not listed where it says no, so a model is not offered a tool that can only fail.
   */
  isAvailable?(ctx: McpContext): boolean
  inputSchema: InputSchema
  run(ctx: McpContext, args: Args): Promise<ToolResult>
}

/** A result made of JSON — what most tools answer with, since a model reads it reliably. */
export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

/** A result made of several blocks, each JSON or already text. */
export function blocksResult(...blocks: unknown[]): ToolResult {
  return {
    content: blocks.map((block) => ({
      type: 'text',
      text: typeof block === 'string' ? block : JSON.stringify(block, null, 2)
    }))
  }
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}
