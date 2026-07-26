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
      disallowFloc: {
        type: 'boolean',
        description: 'Sends `Permissions-Policy: interest-cohort=()`.'
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
      authJwtAudience: {
        type: 'string',
        maxLength: 255,
        description:
          'Audience claim of issued tokens. Changing it invalidates every API key already issued.'
      },
      authJwtExpiration: {
        type: 'string',
        maxLength: 16,
        description: 'Duration, e.g. `30m`.'
      },
      authJwtRenewablePeriod: {
        type: 'string',
        maxLength: 16,
        description: 'Duration, e.g. `14d`.'
      }
    }
  })
}
