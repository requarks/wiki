import { originOf } from '../helpers/common.ts'
import { withVia } from '../helpers/via.ts'
import { contextFor } from '../mcp/context.ts'
import {
  handleMessage,
  isRequest,
  JSONRPC_ERRORS,
  rpcError,
  SUPPORTED_PROTOCOL_VERSIONS
} from '../mcp/protocol.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { McpContext } from '../mcp/context.ts'
import type { JsonRpcMessage, JsonRpcResponse } from '../mcp/protocol.ts'

/**
 * The Model Context Protocol server, at `/_mcp`. See `dev/specs/mcp.md`.
 *
 * Streamable HTTP, stateless: every request is a JSON-RPC `POST` carrying its own credential and
 * answered on its own, as JSON rather than an SSE stream, so that any instance of an HA set answers
 * any request and no proxy has a long-lived connection to time out. There is no server-to-client
 * stream, so `GET` answers 405, and no session to end, so `DELETE` does too.
 *
 * A controller rather than an `api/` plugin, for the reasons `controllers/scim.ts` gives: errors are
 * JSON-RPC errors rather than the `/_api/` error shape, and the protocol describes itself
 * (`tools/list`) rather than through OpenAPI — nothing here is tagged, so it stays out of Swagger.
 *
 * Who a request acts as is the bearer token, verified by the one bearer hook in `index.ts`, and
 * NEVER the session cookie: a browser signed in to the wiki is not an agent's credential, so the
 * context the tools see is built from the token alone (`mcp/context.ts`).
 */

/**
 * The challenge a client is answered with when it brought no token: where the protected resource's
 * metadata is (RFC 9728), which is how an OAuth-capable client finds the authorization server.
 */
function wwwAuthenticate(req: FastifyRequest): string {
  return `Bearer resource_metadata="${originOf(req)}/.well-known/oauth-protected-resource/_mcp"`
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the access hook below for a request it lets through. */
    mcpContext?: McpContext
  }
}

/** A refusal at the HTTP level, as JSON-RPC: there is no request id to answer to yet. */
function refuse(reply: FastifyReply, statusCode: number, message: string) {
  return reply
    .code(statusCode)
    .type('application/json')
    .send(rpcError(null, JSONRPC_ERRORS.invalidRequest, message))
}

/** Whether a bearer token's owner may use the endpoint at all — `use:mcp`, at every call. */
function holdsUseMcp(req: FastifyRequest): boolean {
  const permissions = req.apiKey?.permissions ?? []
  return permissions.includes('use:mcp') || permissions.includes('manage:system')
}

async function routes(app: FastifyInstance) {
  /*
    Every failure on this prefix leaves as JSON-RPC, including the ones Fastify raises before a
    handler runs: a body that is not JSON is the protocol's parse error, not the API's 400 shape.
  */
  app.setErrorHandler((error: any, req, reply) => {
    const statusCode: number = error.statusCode ?? 500
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error instanceof SyntaxError) {
      return reply
        .code(400)
        .type('application/json')
        .send(rpcError(null, JSONRPC_ERRORS.parseError, 'The request body is not valid JSON.'))
    }
    if (statusCode >= 500) {
      WIKI.logger.warn(`MCP ${req.method} ${req.url} failed: ${error.message}`)
    }
    return refuse(reply, statusCode, statusCode >= 500 ? 'Internal server error.' : error.message)
  })

  app.setNotFoundHandler((req, reply) => refuse(reply, 404, 'No such MCP endpoint.'))

  // ----------------------------------------
  // Access
  // ----------------------------------------

  app.addHook('onRequest', async (req, reply) => {
    if (!WIKI.models.mcp.isEnabled()) {
      // -> 404 rather than 403, as SCIM does: with it off there is no endpoint here
      return refuse(reply, 404, 'The MCP server is not enabled on this wiki.')
    }

    /*
      Required by the MCP specification against DNS rebinding: a page on another origin that has
      resolved its own hostname to this server must not be able to drive it from a browser. A request
      with no Origin at all is not a browser's, and is what every MCP client sends.
    */
    const origin = req.headers.origin
    if (origin && origin !== originOf(req)) {
      return refuse(reply, 403, 'Requests from another origin are refused.')
    }

    const siteId = WIKI.sitesMappings[req.hostname] || WIKI.sitesMappings['*']
    if (!siteId || !WIKI.sites[siteId]) {
      return refuse(reply, 404, 'No site answers on this hostname.')
    }

    const protocolVersion = req.headers['mcp-protocol-version']
    if (
      typeof protocolVersion === 'string' &&
      !SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)
    ) {
      return refuse(
        reply,
        400,
        `Unsupported MCP protocol version ${protocolVersion}. Supported: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}.`
      )
    }

    /*
      The credential. `req.apiKey` is what the bearer hook verified — a token that failed verification
      never reaches here. A personal access token is the only kind accepted: a system API key acts for
      groups and is nobody, so there is no person to hold `use:mcp` and nobody to author a write.
    */
    const key = req.apiKey
    if (key) {
      if (key.kind !== 'personal') {
        return refuse(
          reply,
          403,
          'System API keys cannot be used here. Use a personal access token, created under Profile → Access Tokens.'
        )
      }
      if (!holdsUseMcp(req)) {
        return refuse(
          reply,
          403,
          'The owner of this token does not hold the use:mcp permission. An administrator grants it to a group.'
        )
      }
      if (!key.scopes?.some((scope) => scope.startsWith('mcp:'))) {
        return refuse(
          reply,
          403,
          'This personal access token does not have the mcp scope. Create one that does under Profile → Access Tokens.'
        )
      }
    } else if (!WIKI.models.mcp.getConfig().allowAnonymous) {
      return reply
        .header('WWW-Authenticate', wwwAuthenticate(req))
        .code(401)
        .type('application/json')
        .send(
          rpcError(
            null,
            JSONRPC_ERRORS.invalidRequest,
            'This endpoint requires a personal access token, sent as a bearer token.'
          )
        )
    }

    req.mcpContext = contextFor(req, siteId, originOf(req))
  })

  // ----------------------------------------
  // Endpoint
  // ----------------------------------------

  app.post('/', async (req, reply) => {
    const ctx = req.mcpContext!
    const body = req.body as JsonRpcMessage | JsonRpcMessage[] | undefined
    const isBatch = Array.isArray(body)
    const messages = isBatch ? body : [body as JsonRpcMessage]
    if (messages.length < 1 || messages.length > 50) {
      return reply
        .code(400)
        .type('application/json')
        .send(rpcError(null, JSONRPC_ERRORS.invalidRequest, 'Send between 1 and 50 messages.'))
    }

    /*
      The budget, per call rather than per HTTP request, so a batch costs what its requests would
      separately. Per owner — every token of one person shares it — or per address for anonymous.
      In memory and per instance on purpose: see `helpers/tokenBucket.ts`.
    */
    const budgetKey = ctx.user ? `user:${ctx.user.id}` : `ip:${req.ip}`
    for (const message of messages) {
      if (!isRequest(message)) {
        continue
      }
      const verdict = WIKI.models.mcp.consume(budgetKey)
      if (!verdict.allowed) {
        return reply
          .header('Retry-After', String(verdict.retryAfter))
          .code(429)
          .type('application/json')
          .send(
            rpcError(
              message.id ?? null,
              JSONRPC_ERRORS.invalidRequest,
              `Too many requests. Try again in ${verdict.retryAfter}s.`
            )
          )
      }
    }

    /*
      Everything a call leads to is done "via mcp" — the version a save records, the audit entry a
      route writes — including a REST route a tool calls in-process. See `helpers/via.ts`.
    */
    const responses: JsonRpcResponse[] = []
    for (const message of messages) {
      const response = await withVia('mcp', () => handleMessage(ctx, message))
      if (response) {
        responses.push(response)
      }
    }

    // -> Nothing but notifications (or responses from the client): accepted, nothing to say back
    if (responses.length < 1) {
      return reply.code(202).send()
    }
    reply.header('Cache-Control', 'no-store')
    return reply
      .code(200)
      .type('application/json')
      .send(isBatch ? responses : responses[0])
  })

  app.get('/', async (_req, reply) =>
    reply
      .header('Allow', 'POST')
      .code(405)
      .type('application/json')
      .send(
        rpcError(
          null,
          JSONRPC_ERRORS.invalidRequest,
          'This server does not offer a server-to-client stream.'
        )
      )
  )

  app.delete('/', async (_req, reply) =>
    reply
      .header('Allow', 'POST')
      .code(405)
      .type('application/json')
      .send(rpcError(null, JSONRPC_ERRORS.invalidRequest, 'This server keeps no sessions to end.'))
  )
}

export default routes
