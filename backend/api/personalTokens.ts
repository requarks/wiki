import { audit } from '../helpers/audit.ts'
import { hasUserSession } from '../helpers/requester.ts'
import { systemUserGuard } from '../helpers/userGuards.ts'
import { PersonalTokenError } from '../models/personalTokens.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { KeyExpiration } from '../models/apiKeys.ts'

/**
 * The signed-in user managing their own tokens, or a refusal.
 *
 * A session and nothing else — not `requestUserId`, and none of these routes declares a `scope`. A
 * token that could mint, list or delete tokens would be a token that outlives being revoked, which is
 * the one thing revoking it is for.
 */
function sessionOwner(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!hasUserSession(req)) {
    reply.unauthorized('Personal access tokens are managed from a signed-in session.')
    return null
  }
  return req.session.user!.id
}

const okResponse = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    message: { type: 'string' }
  }
}

const tokenIdParam = {
  type: 'string',
  format: 'uuid'
}

/**
 * Personal Access Token Routes
 *
 * The owner's half under `/users/profile/tokens`, beside the rest of the profile, and the
 * administrator's half under `/users/:userId/tokens`, beside the rest of a user. See
 * `models/personalTokens.ts` for what a token is.
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST OWN TOKENS
   */
  app.get(
    '/users/profile/tokens',
    {
      schema: {
        summary: "List the logged in user's personal access tokens",
        description:
          'Newest first, expired ones included so that their owner can see why one stopped working. Listed even while personal access tokens are turned off on this wiki, so that they can still be deleted.\n\n`isApiEnabled` says whether the API is on at all: off, every token is refused along with everything else that authenticates with a bearer token, and the profile says so rather than leave a user wondering why a token they just made does not work.\n\nNeeds a signed-in session: no personal access token can manage tokens.',
        tags: ['Personal Access Tokens'],
        response: {
          200: {
            type: 'object',
            properties: {
              isApiEnabled: { type: 'boolean' },
              mcp: {
                type: 'object',
                description:
                  "What the profile's Connect an AI Assistant card needs: whether the MCP server is on, whether this user may use it (`use:mcp`), and whether their tokens would carry `manage:system` — above every page rule — into an assistant.",
                properties: {
                  isEnabled: { type: 'boolean' },
                  mayUse: { type: 'boolean' },
                  isAdministrator: { type: 'boolean' }
                }
              },
              tokens: {
                type: 'array',
                items: { $ref: 'PersonalToken#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = sessionOwner(req, reply)
      if (!userId) {
        return reply
      }
      const permissions = req.session.permissions ?? []
      const isAdministrator = permissions.includes('manage:system')
      return {
        isApiEnabled: WIKI.config.api.isEnabled === true,
        mcp: {
          isEnabled: WIKI.models.mcp.isEnabled(),
          mayUse: isAdministrator || permissions.includes('use:mcp'),
          isAdministrator
        },
        tokens: await WIKI.models.personalTokens.listForUser(userId)
      }
    }
  )

  /**
   * CREATE OWN TOKEN
   */
  app.post<{ Body: { name: string; expiration: KeyExpiration; scopes: string[] } }>(
    '/users/profile/tokens',
    {
      schema: {
        summary: 'Create a personal access token',
        description:
          'The response carries the token, which is the only time it can be read: only its last characters are stored. Sent as a bearer token, it acts as the user who created it — their groups, their page rules, their name on whatever it writes — on the routes its scopes reach, and on no others.\n\nRefused while personal access tokens are turned off on this wiki (Administration → Authentication). Needs a signed-in session: no personal access token can create another.',
        tags: ['Personal Access Tokens'],
        body: {
          type: 'object',
          required: ['name', 'expiration', 'scopes'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'What the token is for.'
            },
            expiration: { $ref: 'ApiKeyExpiration#' },
            scopes: {
              type: 'array',
              minItems: 1,
              uniqueItems: true,
              items: { $ref: 'PersonalTokenScope#' }
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' },
              id: { type: 'string', format: 'uuid' },
              token: {
                type: 'string',
                description: 'The token. Shown once and never again.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionOwner(req, reply)
      if (!userId) {
        return reply
      }
      if (!WIKI.models.authentication.arePersonalTokensAllowed()) {
        return reply.forbidden('Personal access tokens are disabled on this wiki.')
      }
      if (!/^[^<>"]+$/.test(req.body.name)) {
        return reply.badRequest('Token name contains invalid characters.')
      }

      let created
      try {
        created = await WIKI.models.personalTokens.create({
          userId,
          name: req.body.name,
          expiration: req.body.expiration,
          scopes: req.body.scopes
        })
      } catch (err: any) {
        if (err instanceof PersonalTokenError) {
          return reply.badRequest(err.message)
        }
        throw err
      }

      // -> Never the token: it exists once, in the response below, and this log is not a second copy
      await audit(req, 'profile', 'createAccessToken', {
        patId: created.id,
        name: req.body.name,
        scopes: req.body.scopes,
        expiration: req.body.expiration
      })

      return {
        ok: true,
        message: 'Personal access token created successfully.',
        id: created.id,
        token: created.token
      }
    }
  )

  /**
   * DELETE OWN TOKEN
   */
  app.delete<{ Params: { tokenId: string } }>(
    '/users/profile/tokens/:tokenId',
    {
      schema: {
        summary: 'Delete a personal access token',
        description:
          'The token stops working on its next request. Allowed while personal access tokens are turned off, so that a user can clean up.\n\nNeeds a signed-in session: no personal access token can delete one.',
        tags: ['Personal Access Tokens'],
        params: {
          type: 'object',
          properties: { tokenId: tokenIdParam },
          required: ['tokenId']
        },
        response: {
          200: okResponse
        }
      }
    },
    async (req, reply) => {
      const userId = sessionOwner(req, reply)
      if (!userId) {
        return reply
      }
      const name = await WIKI.models.personalTokens.remove(userId, req.params.tokenId)
      if (name === null) {
        return reply.notFound('This personal access token does not exist.')
      }

      await audit(req, 'profile', 'deleteAccessToken', { patId: req.params.tokenId, name })

      return {
        ok: true,
        message: 'Personal access token deleted successfully.'
      }
    }
  )

  /**
   * LIST A USER'S TOKENS
   */
  app.get<{ Params: { userId: string } }>(
    '/users/:userId/tokens',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: "List a user's personal access tokens",
        description:
          'What the user sees under their own profile: names, scopes, expiry and when each was last used. Never the tokens themselves, which are not stored.',
        tags: ['Personal Access Tokens'],
        params: {
          type: 'object',
          properties: { userId: { type: 'string', format: 'uuid' } },
          required: ['userId']
        },
        response: {
          200: {
            type: 'array',
            items: { $ref: 'PersonalToken#' }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }
      return WIKI.models.personalTokens.listForUser(user.id)
    }
  )

  /**
   * DELETE A USER'S TOKEN
   */
  app.delete<{ Params: { userId: string; tokenId: string } }>(
    '/users/:userId/tokens/:tokenId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: "Delete a user's personal access token",
        description:
          'For a token that has leaked, or that belongs to somebody who has left. It stops working on its next request. Deactivating the account stops every token of it at once, without deleting them.\n\nA user who belongs to a group holding `manage:system` is protected: only a caller who holds `manage:system` may delete one of their tokens.',
        tags: ['Personal Access Tokens'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            tokenId: tokenIdParam
          },
          required: ['userId', 'tokenId']
        },
        response: {
          200: okResponse
        }
      }
    },
    async (req, reply) => {
      const systemUserRefusal = await systemUserGuard(req, req.params.userId)
      if (systemUserRefusal) {
        throw systemUserRefusal
      }

      const name = await WIKI.models.personalTokens.remove(req.params.userId, req.params.tokenId)
      if (name === null) {
        return reply.notFound('This personal access token does not exist.')
      }

      await audit(req, 'admin', 'deleteUserAccessToken', {
        userId: req.params.userId,
        patId: req.params.tokenId,
        name
      })

      return {
        ok: true,
        message: 'Personal access token deleted successfully.'
      }
    }
  )
}

export default routes
