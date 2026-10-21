import type { FastifyInstance } from 'fastify'
import { TOKEN_SCOPES } from '../../models/personalTokens.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * PERSONAL TOKEN SCOPE - One category of the API, at one level
   */
  app.addSchema({
    $id: 'PersonalTokenScope',
    type: 'string',
    enum: TOKEN_SCOPES,
    description:
      'A category of the API and how far into it the token reaches. `write` includes `read`. Each route that a personal access token may call says which scope reaches it; every other route — the administration area, and the account’s own passwords, 2FA, passkeys and tokens — refuses personal tokens whatever their scopes.'
  })

  /**
   * PERSONAL TOKEN - Metadata only; the token itself exists once, in the create response
   */
  app.addSchema({
    $id: 'PersonalToken',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      name: {
        type: 'string'
      },
      keyShort: {
        type: 'string',
        description: 'Last characters of the token, to tell tokens apart. The token is not stored.'
      },
      scopes: {
        type: 'array',
        items: { $ref: 'PersonalTokenScope#' }
      },
      expiration: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      },
      lastUsedAt: {
        type: ['string', 'null'],
        format: 'date-time',
        description:
          'RFC 3339 Date Time. Approximate — recorded at most every few minutes — and null for a token never used.'
      },
      isInvalidated: {
        type: 'boolean',
        description:
          'Issued before the signing certificates were last regenerated, so its signature no longer verifies. Nothing about the token itself explains it, hence the flag.'
      },
      client: {
        type: ['object', 'null'],
        description:
          'The MCP client this was granted to through OAuth — a connection made on a consent screen rather than a token made by hand. Null for a token made here. Its access tokens are accepted by `/_mcp` only, and deleting it disconnects the client.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' }
        }
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'RFC 3339 Date Time'
      }
    }
  })
}
