import { Ajv } from 'ajv'
import ajvFormats from 'ajv-formats'
import { TOKEN_SCOPE_CATEGORIES } from '../../models/personalTokens.ts'
import { MCP_TOOL_GROUPS } from '../../models/mcp.ts'
import { holdsScope } from '../context.ts'
import { assetTools } from './assets.ts'
import { commentTools, suggestTools } from './contribute.ts'
import { destructiveTools } from './destructive.ts'
import { discoverTools } from './discover.ts'
import { editTools } from './edit.ts'
import { glossaryTools } from './glossary.ts'
import { historyTools } from './history.ts'
import { pageTools } from './pages.ts'
import type { ValidateFunction } from 'ajv'
import type { McpContext } from '../context.ts'
import type { McpTool } from '../tool.ts'
import type { TokenScope } from '../../models/personalTokens.ts'

const ALL_TOOLS: McpTool[] = [
  ...discoverTools,
  ...pageTools,
  ...historyTools,
  ...glossaryTools,
  ...commentTools,
  ...suggestTools,
  ...editTools,
  ...assetTools,
  ...destructiveTools
]

/*
  Checked once, at load, rather than left to review: a tool with no scope category, or one in a group
  the settings do not know, would be a tool no switch and no token could keep an agent away from.
  Throwing here stops the server booting with one.
*/
const byName = new Map<string, McpTool>()
for (const tool of ALL_TOOLS) {
  if (byName.has(tool.name)) {
    throw new Error(`MCP tool ${tool.name} is declared twice.`)
  }
  if (!TOKEN_SCOPE_CATEGORIES.includes(tool.category) || tool.category === ('mcp' as string)) {
    throw new Error(`MCP tool ${tool.name} declares no scope category a token can hold.`)
  }
  if (!MCP_TOOL_GROUPS.includes(tool.group)) {
    throw new Error(`MCP tool ${tool.name} is in no group the settings know.`)
  }
  byName.set(tool.name, tool)
}

/*
  Arguments are checked against the same JSON Schema `tools/list` publishes, so the schema is written
  once and means one thing. `useDefaults` fills in what a schema defaults, which is what lets a tool
  read `args.limit` without a fallback of its own; `removeAdditional` is off, so an argument nobody
  declared is an error the model is told about rather than something silently dropped.
*/
const ajv = new Ajv({ allErrors: false, useDefaults: true, strict: false })
// -> CJS, as in `index.ts`: the default import is `module.exports`, whose `.default` is the plugin
ajvFormats.default(ajv)
const validators = new Map<string, ValidateFunction>()

export function validateArguments(tool: McpTool, args: unknown): string | null {
  let validate = validators.get(tool.name)
  if (!validate) {
    validate = ajv.compile(tool.inputSchema)
    validators.set(tool.name, validate)
  }
  if (validate(args)) {
    return null
  }
  const error = validate.errors?.[0]
  const where = error?.instancePath ? `\`${error.instancePath.slice(1)}\`` : 'The arguments'
  return error ? `${where} ${error.message}.` : 'The arguments are not valid.'
}

/** The two scopes a tool needs: `mcp` and its category, both at its level. */
export function scopesFor(tool: McpTool): TokenScope[] {
  const level = tool.readOnly ? 'read' : 'write'
  return [`mcp:${level}`, `${tool.category}:${level}`] as TokenScope[]
}

/**
 * Whether this caller may call this tool at all: its group is switched on, and the caller holds both
 * scopes. What the call then touches is still a page rule's to decide, inside the tool.
 *
 * The same answer for `tools/list` and `tools/call`, so that a tool is never offered that will only
 * be refused — a client hands every listed tool to the model, which then tries it.
 */
export function mayCall(ctx: McpContext, tool: McpTool): boolean {
  return (
    WIKI.models.mcp.isGroupEnabled(tool.group) &&
    scopesFor(tool).every((scope) => holdsScope(ctx, scope)) &&
    (tool.isAvailable?.(ctx) ?? true)
  )
}

export function toolsFor(ctx: McpContext): McpTool[] {
  return ALL_TOOLS.filter((tool) => mayCall(ctx, tool))
}

export function findTool(name: string): McpTool | undefined {
  return byName.get(name)
}
