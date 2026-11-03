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
        description:
          "Whether every asset but an image is sent as a download (`Content-Disposition: attachment`) rather than opened in the browser. Either way every asset is served under a sandboxing Content-Security-Policy, PDFs excepted, so that one opened in place runs nothing in the wiki's origin."
      },
      trustProxy: {
        type: 'boolean',
        description: 'Whether to trust `X-Forwarded-*` headers.'
      },
      privateFetchAllowList: {
        type: 'array',
        maxItems: 100,
        items: { type: 'string', maxLength: 64 },
        description:
          'Non-public addresses the wiki may still reach when it downloads a URL it was handed — an identity provider’s picture, an image the HedgeDoc import copies — as single addresses or CIDR subnets (`10.0.0.5`, `10.0.0.0/24`, `fd00::/8`). EMPTY — the default — allows none: only the public internet is reached, since such a URL comes from a claim or content somebody else controls. Applies at once.'
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
        description:
          'Whether an uploaded SVG is sanitized before it is stored: scripts, event handlers, embedded HTML and script links are taken out, and only elements and attributes that draw are kept. Applies to every asset upload, the images added to live notes and the logo, favicon and login background of a site included — and to a file renamed to `.svg`, and to one imported from a storage target or a backup.'
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
