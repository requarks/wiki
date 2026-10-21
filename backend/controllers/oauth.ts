import { originOf } from '../helpers/common.ts'
import { OAuthError } from '../models/oauth.ts'
import type { FastifyInstance, FastifyReply } from 'fastify'

/**
 * The OAuth 2.1 authorization server the MCP server's remote clients sign in through — the
 * connectors in claude.ai and ChatGPT, which cannot be handed a bearer token to paste. See
 * `models/oauth.ts` and `dev/specs/mcp.md` §4.3.
 *
 * Registered at the root, without a prefix, because two of its addresses are fixed by convention:
 * `/.well-known/oauth-authorization-server` (RFC 8414) and `/.well-known/oauth-protected-resource`
 * (RFC 9728), the latter also under the resource's own path. The rest is under `/_oauth`. The consent
 * screen is the frontend's (`/_authorize`), since it is a page a signed-in person reads and answers;
 * `/_oauth/authorize` checks the request and sends the browser there.
 *
 * Nothing here exists while the flow is unavailable — MCP off, the API off, or personal tokens off —
 * because it would hand out grants nothing could use.
 */

/** An error as RFC 6749 §5.2 shapes one. */
function sendError(reply: FastifyReply, err: OAuthError) {
  return reply
    .code(err.status)
    .header('Cache-Control', 'no-store')
    .type('application/json')
    .send({ error: err.error, error_description: err.message })
}

/**
 * An authorization request that cannot be sent back to the client — the client or its redirect URI
 * is what is wrong — answered to the person in the browser instead. Plain text: there is nothing to
 * do on this page but read why.
 */
function sendAuthorizeError(reply: FastifyReply, err: OAuthError) {
  return reply
    .code(400)
    .header('Cache-Control', 'no-store')
    .type('text/plain; charset=utf-8')
    .send(`This sign-in request cannot be completed: ${err.message}`)
}

async function routes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!WIKI.models.oauth.isAvailable()) {
      return reply
        .code(404)
        .type('application/json')
        .send({ error: 'not_found', error_description: 'This wiki does not offer OAuth sign-in.' })
    }
  })

  // ----------------------------------------
  // Discovery
  // ----------------------------------------

  app.get('/.well-known/oauth-authorization-server', async (req) =>
    WIKI.models.oauth.serverMetadata(originOf(req))
  )
  // -> Both spellings: RFC 9728 puts the resource's path after the well-known prefix, and a client
  //    that only knows the host asks without it
  app.get('/.well-known/oauth-protected-resource', async (req) =>
    WIKI.models.oauth.resourceMetadata(originOf(req))
  )
  app.get('/.well-known/oauth-protected-resource/_mcp', async (req) =>
    WIKI.models.oauth.resourceMetadata(originOf(req))
  )

  // ----------------------------------------
  // Dynamic client registration (RFC 7591)
  // ----------------------------------------

  app.post<{ Body: Record<string, any> }>('/_oauth/register', async (req, reply) => {
    /*
      Open, because that is how a connector introduces itself — and harmless on its own, since a
      client can do nothing until a person consents. Limited per address all the same, against the
      same postgres-backed counter the login limit uses, so that nobody fills the table on demand;
      a client no grant ever names is purged after a day.
    */
    const verdict = await WIKI.models.rateLimits.consume(`oauthRegister:${req.ip}`, {
      max: 20,
      windowSeconds: 3600,
      banSeconds: 3600
    })
    if (!verdict.allowed) {
      return reply
        .header('Retry-After', String(verdict.retryAfter))
        .code(429)
        .send({ error: 'too_many_requests', error_description: 'Too many registrations.' })
    }
    const body = req.body ?? {}
    try {
      const client = await WIKI.models.oauth.registerClient({
        name: typeof body.client_name === 'string' ? body.client_name : '',
        redirectUris: Array.isArray(body.redirect_uris)
          ? body.redirect_uris.filter((uri: unknown) => typeof uri === 'string')
          : []
      })
      // -> RFC 7591 §3.2.1: what was registered, with what the server decided in place of what was
      //    asked — a public client with PKCE, whatever authentication method the client named
      return reply
        .code(201)
        .header('Cache-Control', 'no-store')
        .send({
          client_id: client.id,
          client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
          client_name: client.name,
          redirect_uris: client.redirectUris,
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none'
        })
    } catch (err: any) {
      if (err instanceof OAuthError) {
        return sendError(reply, err)
      }
      throw err
    }
  })

  // ----------------------------------------
  // Authorization
  // ----------------------------------------

  app.get<{ Querystring: Record<string, any> }>('/_oauth/authorize', async (req, reply) => {
    const origin = originOf(req)
    try {
      await WIKI.models.oauth.checkAuthorization(req.query, origin)
    } catch (err: any) {
      if (!(err instanceof OAuthError)) {
        throw err
      }
      if (!err.redirectable) {
        return sendAuthorizeError(reply, err)
      }
      // -> The client and its address are real: tell it, the way RFC 6749 §4.1.2.1 says
      const client = await WIKI.models.oauth.getClient(String(req.query.client_id))
      const redirectUri =
        typeof req.query.redirect_uri === 'string' && req.query.redirect_uri
          ? req.query.redirect_uri
          : client!.redirectUris[0]!
      return reply.redirect(
        WIKI.models.oauth.redirectWith(
          redirectUri,
          { error: err.error, error_description: err.message, state: req.query.state },
          origin
        ),
        302
      )
    }
    // -> The consent screen, carrying the request: it asks the API to check it again before showing it
    const query = req.raw.url!.split('?')[1] ?? ''
    return reply.redirect(`/_authorize?${query}`, 302)
  })

  // ----------------------------------------
  // Tokens
  // ----------------------------------------

  app.post<{ Body: Record<string, any> }>('/_oauth/token', async (req, reply) => {
    // -> Form-encoded is what RFC 6749 specifies; JSON is accepted too, which some clients send
    const body = req.body ?? {}
    const clientId = typeof body.client_id === 'string' ? body.client_id : ''
    try {
      let tokens
      if (body.grant_type === 'authorization_code') {
        if (typeof body.code !== 'string' || typeof body.code_verifier !== 'string' || !clientId) {
          throw new OAuthError('invalid_request', 'code, code_verifier and client_id are required.')
        }
        if (
          body.resource !== undefined &&
          String(body.resource).replace(/\/+$/, '') !== WIKI.models.oauth.resourceFor(originOf(req))
        ) {
          throw new OAuthError('invalid_target', 'This server grants access to its /_mcp only.')
        }
        tokens = await WIKI.models.oauth.exchangeCode({
          code: body.code,
          clientId,
          redirectUri: typeof body.redirect_uri === 'string' ? body.redirect_uri : undefined,
          codeVerifier: body.code_verifier
        })
      } else if (body.grant_type === 'refresh_token') {
        if (typeof body.refresh_token !== 'string' || !clientId) {
          throw new OAuthError('invalid_request', 'refresh_token and client_id are required.')
        }
        tokens = await WIKI.models.oauth.refresh({ refreshToken: body.refresh_token, clientId })
      } else {
        throw new OAuthError(
          'unsupported_grant_type',
          'Only authorization_code and refresh_token are supported.'
        )
      }
      return reply.header('Cache-Control', 'no-store').header('Pragma', 'no-cache').send(tokens)
    } catch (err: any) {
      if (err instanceof OAuthError) {
        return sendError(reply, err)
      }
      throw err
    }
  })
}

export default routes
