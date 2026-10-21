import { ToolError } from './tool.ts'
import type { McpContext } from './context.ts'

/**
 * Call one of the wiki's own REST routes in-process, as the caller.
 *
 * For the actions whose rules live in their route rather than in a model — posting a comment
 * (cooldown, spam check, webhooks, notifications), submitting a suggestion, writing a glossary term —
 * so that an assistant goes through exactly the checks a script with the same token would, rather
 * than through a second copy of them that drifts. A token reaches the same things on both surfaces
 * by construction.
 *
 * The request is the caller's, as far as the route can tell: the same bearer token (or none, for an
 * anonymous caller — the guests group, as on `/_api`), the same host, so the same site, and the same
 * client address, so a cooldown or an audit entry names the right one. Never the session cookie,
 * which `/_mcp` does not read. And it runs inside the caller's `withVia('mcp')` scope, so whatever it
 * records is marked as done through MCP.
 *
 * @param path Below `/_api/`, e.g. `sites/<id>/glossary`
 * @returns The parsed response body
 * @throws ToolError with the route's own message for any refusal — what it says is written for
 *         whoever asked, which is the agent
 */
export async function callApi(
  ctx: McpContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  {
    body,
    raw,
    query
  }: {
    body?: unknown
    /** A body that is not JSON — an upload's bytes — with the type to send it as. */
    raw?: { data: Buffer; contentType: string }
    query?: Record<string, string | number | boolean>
  } = {}
): Promise<any> {
  const response = await WIKI.app.inject({
    method,
    url: `/_api/${path}`,
    query: query
      ? Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))
      : undefined,
    headers: {
      host: ctx.req.host,
      ...(ctx.req.headers.authorization ? { authorization: ctx.req.headers.authorization } : {}),
      ...(ctx.req.headers['user-agent'] ? { 'user-agent': ctx.req.headers['user-agent'] } : {}),
      ...(raw
        ? { 'content-type': raw.contentType }
        : body === undefined
          ? {}
          : { 'content-type': 'application/json' })
    },
    payload: raw ? raw.data : body === undefined ? undefined : JSON.stringify(body),
    remoteAddress: ctx.req.ip
  })
  let parsed: any = null
  try {
    parsed = response.body ? JSON.parse(response.body) : null
  } catch {
    parsed = null
  }
  if (response.statusCode >= 400) {
    const retryAfter = response.headers['retry-after']
    throw new ToolError(
      `${parsed?.message || `The wiki answered ${response.statusCode}.`}${retryAfter ? ` Retry after ${retryAfter}s.` : ''}`
    )
  }
  return parsed
}
