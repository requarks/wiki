import type { FastifyInstance } from 'fastify'
import { CORS_MODES } from '../../helpers/security.ts'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * SECURITY CONFIG - Used both ways: as the response, and as a partial update body
   */
  app.addSchema({
    $id: 'SecurityConfig',
    type: 'object',
    properties: {
      corsMode: {
        type: 'string',
        enum: CORS_MODES,
        description:
          '`OFF` sends no CORS headers at all, i.e. same-origin only. `REFLECT` echoes the request origin back.'
      },
      corsConfig: {
        type: 'string',
        maxLength: 8192,
        description:
          'Hostnames, one per line or comma-separated, for `HOSTNAMES` mode; a regular expression for `REGEX` mode. Ignored otherwise.'
      },
      enforceCsp: {
        type: 'boolean'
      },
      cspDirectives: {
        type: 'string',
        maxLength: 8192,
        description: "Directives separated by `;`, e.g. `default-src 'self'; img-src * data:`."
      },
      enforceHsts: {
        type: 'boolean'
      },
      hstsDuration: {
        type: 'integer',
        minimum: 0,
        description: 'Seconds. Must be greater than zero when HSTS is enforced.'
      },
      disallowIframe: {
        type: 'boolean',
        description: '`X-Frame-Options: DENY` when on, `SAMEORIGIN` when off.'
      },
      enforceSameOriginReferrerPolicy: {
        type: 'boolean',
        description: '`Referrer-Policy: same-origin` when on, `no-referrer` when off.'
      },
      disallowOpenRedirect: {
        type: 'boolean',
        description: 'Stored, but nothing redirects on user input yet.'
      },
      forceAssetDownload: {
        type: 'boolean',
        description: 'Stored, but asset serving is not implemented yet.'
      },
      trustProxy: {
        type: 'boolean',
        description: 'Whether to trust `X-Forwarded-*` headers.'
      },
      uploadMaxFileSize: {
        type: 'integer',
        minimum: 1,
        description: 'Bytes. Stored, but there is no upload endpoint yet.'
      },
      uploadMaxFiles: {
        type: 'integer',
        minimum: 1,
        description: 'Stored, but there is no upload endpoint yet.'
      },
      uploadScanSVG: {
        type: 'boolean',
        description: 'Stored, but there is no upload endpoint yet.'
      },
      authRateLimitEnabled: {
        type: 'boolean',
        description:
          'Whether the authentication endpoints — signing in, second factors, password changes from the login screen, passkey ceremonies and page unlocks — refuse a client that has attempted too often. Counted per client address, in the database, so the limit holds across instances.'
      },
      authRateLimitMax: {
        type: 'integer',
        minimum: 1,
        description: 'Attempts allowed within the window. The one that exceeds it earns the ban.'
      },
      authRateLimitWindow: {
        type: 'string',
        maxLength: 16,
        description: 'How long attempts are counted over, as a duration — e.g. `5m`, `2h`, `1d`.'
      },
      authRateLimitBan: {
        type: 'string',
        maxLength: 16,
        description:
          'How long a client is refused for once it goes over, as a duration — e.g. `15m`, `1h`. Attempts made while banned do not extend it.'
      }
    }
  })
}
