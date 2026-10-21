import { audit } from '../helpers/audit.ts'
import { originOf } from '../helpers/common.ts'
import { hasUserSession } from '../helpers/requester.ts'
import { KEY_EXPIRATIONS } from '../models/apiKeys.ts'
import { OAuthError } from '../models/oauth.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { KeyExpiration } from '../models/apiKeys.ts'

/**
 * OAuth Consent Routes
 *
 * What the consent screen (`/_authorize` in the frontend) asks: what a sign-in request is, and the
 * person's answer to it. The protocol's own endpoints are `controllers/oauth.ts`; this is the half a
 * signed-in browser drives.
 *
 * A signed-in SESSION, and nothing else — no route declares a token scope, so no personal access
 * token reaches these. Granting access is something a person does, in the wiki, looking at it.
 */

/** Whether this session's account may connect an AI assistant at all. */
function mayUseMcp(req: FastifyRequest): boolean {
  const permissions = req.session.permissions ?? []
  return permissions.includes('use:mcp') || permissions.includes('manage:system')
}

/** The answer for a request that cannot go on, as the screen needs it. */
function refusal(
  reply: FastifyReply,
  err: OAuthError,
  params: Record<string, any>,
  origin: string
) {
  if (!err.redirectable) {
    return reply.badRequest(err.message)
  }
  return {
    error: err.error,
    message: err.message,
    redirect: WIKI.models.oauth.redirectWith(
      String(params.redirect_uri),
      { error: err.error, error_description: err.message, state: params.state },
      origin
    )
  }
}

const requestProperties = {
  type: 'object',
  description: 'The authorization request, as `/_oauth/authorize` received it.',
  additionalProperties: { type: 'string', maxLength: 4096 }
}

async function routes(app: FastifyInstance) {
  /**
   * DESCRIBE A SIGN-IN REQUEST
   */
  app.get<{ Querystring: Record<string, string> }>(
    '/oauth/authorize',
    {
      schema: {
        summary: 'Describe an OAuth sign-in request',
        description:
          'What the consent screen shows: which client is asking, where it will send the browser back to, and the scopes it asked for (or the read-only default when it asked for none). Checked here exactly as `/_oauth/authorize` checks it. Needs a signed-in session; `mayUse` says whether this account holds `use:mcp`, without which it cannot grant anything.',
        tags: ['OAuth'],
        querystring: requestProperties
      }
    },
    async (req, reply) => {
      if (!hasUserSession(req)) {
        return reply.unauthorized('Sign in to answer this request.')
      }
      if (!WIKI.models.oauth.isAvailable()) {
        return reply.notFound('This wiki does not offer OAuth sign-in.')
      }
      const origin = originOf(req)
      try {
        const request = await WIKI.models.oauth.checkAuthorization(req.query, origin)
        const permissions = req.session.permissions ?? []
        return {
          client: { id: request.client.id, name: request.client.name },
          redirectHost: new URL(request.redirectUri).host || request.redirectUri,
          scopes: request.scopes,
          mayUse: mayUseMcp(req),
          isAdministrator: permissions.includes('manage:system'),
          expirations: Object.keys(KEY_EXPIRATIONS)
        }
      } catch (err: any) {
        if (err instanceof OAuthError) {
          return refusal(reply, err, req.query, origin)
        }
        throw err
      }
    }
  )

  /**
   * ANSWER A SIGN-IN REQUEST
   */
  app.post<{
    Body: {
      request: Record<string, string>
      approve: boolean
      scopes?: string[]
      expiration?: KeyExpiration
    }
  }>(
    '/oauth/authorize',
    {
      schema: {
        summary: 'Approve or deny an OAuth sign-in request',
        description:
          "Answers with where to send the browser: back to the client with a code, or with `access_denied`. An approval grants the scopes given — at least `mcp:read`, since the grant is for the MCP server alone — for the lifetime given, and is listed with the account's personal access tokens once the client has exchanged the code. Needs a signed-in session holding `use:mcp`.",
        tags: ['OAuth'],
        body: {
          type: 'object',
          required: ['request', 'approve'],
          properties: {
            request: requestProperties,
            approve: { type: 'boolean' },
            scopes: { type: 'array', maxItems: 20, items: { $ref: 'PersonalTokenScope#' } },
            expiration: { $ref: 'ApiKeyExpiration#' }
          }
        }
      }
    },
    async (req, reply) => {
      if (!hasUserSession(req)) {
        return reply.unauthorized('Sign in to answer this request.')
      }
      if (!WIKI.models.oauth.isAvailable()) {
        return reply.notFound('This wiki does not offer OAuth sign-in.')
      }
      const origin = originOf(req)
      const params = req.body.request
      let request
      try {
        request = await WIKI.models.oauth.checkAuthorization(params, origin)
      } catch (err: any) {
        if (err instanceof OAuthError) {
          return refusal(reply, err, params, origin)
        }
        throw err
      }
      if (!req.body.approve) {
        return {
          redirect: WIKI.models.oauth.redirectWith(
            request.redirectUri,
            { error: 'access_denied', state: request.state },
            origin
          )
        }
      }
      if (!mayUseMcp(req)) {
        return reply.forbidden(
          'You may not connect an AI assistant to this wiki: that takes the use:mcp permission.'
        )
      }
      const siteId = WIKI.sitesMappings[req.hostname] || WIKI.sitesMappings['*']
      const scopes = req.body.scopes ?? request.scopes
      const code = await WIKI.models.oauth.createCode({
        request,
        userId: req.session.user!.id,
        siteId,
        scopes,
        grantExpiration: req.body.expiration ?? '90d'
      })
      await audit(req, 'profile', 'grantOAuthAccess', {
        oauthClientId: request.client.id,
        clientName: request.client.name,
        scopes,
        expiration: req.body.expiration ?? '90d'
      })
      return {
        redirect: WIKI.models.oauth.redirectWith(
          request.redirectUri,
          { code, state: request.state },
          origin
        )
      }
    }
  )

  /**
   * LIST OAUTH CLIENTS
   */
  app.get(
    '/system/mcp/clients',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List the OAuth clients that have registered',
        description:
          'The MCP clients that registered themselves to sign in through OAuth, with how many grants each holds: those holding a grant first, then newest first, at most 50. One no grant ever named is purged a day after it registered.',
        tags: ['System'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                redirectUris: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string', format: 'date-time' },
                grants: { type: 'integer' }
              }
            }
          }
        }
      }
    },
    async () => WIKI.models.oauth.listClients()
  )

  /**
   * DELETE AN OAUTH CLIENT
   */
  app.delete<{ Params: { clientId: string } }>(
    '/system/mcp/clients/:clientId',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'Delete an OAuth client',
        description:
          'Removes the client, every grant made to it — whoever made them — and every code waiting to be exchanged. Its access tokens stop working on their next request.',
        tags: ['System'],
        params: {
          type: 'object',
          properties: { clientId: { type: 'string', format: 'uuid' } },
          required: ['clientId']
        }
      }
    },
    async (req, reply) => {
      const client = await WIKI.models.oauth.getClient(req.params.clientId)
      if (!client || !(await WIKI.models.oauth.deleteClient(client.id))) {
        return reply.notFound('This client does not exist.')
      }
      await audit(req, 'admin', 'deleteOAuthClient', {
        oauthClientId: client.id,
        clientName: client.name
      })
      return { ok: true, message: 'OAuth client deleted successfully.' }
    }
  )
}

export default routes
