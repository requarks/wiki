import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * METRICS CONFIG - Used both ways: as the response, and as a partial update body
   */
  app.addSchema({
    $id: 'MetricsConfig',
    type: 'object',
    properties: {
      isEnabled: {
        type: 'boolean',
        description:
          'Whether the endpoint is served at all. While it is off nothing is registered at the path, so a wiki page there is served normally; turning it on is what makes the endpoint take that path over.'
      },
      path: {
        type: 'string',
        maxLength: 512,
        description:
          "The URL path the exposition is served at, e.g. `/metrics`. Normalized to a single leading slash and no trailing one. Cannot be a segment starting with `_` (the wiki's own namespace) or a reserved root file such as `robots.txt`."
      },
      allowAnonymousLocal: {
        type: 'boolean',
        description: 'Allow scraping without credentials from this machine — `127.0.0.0/8`, `::1`.'
      },
      allowAnonymousPrivate: {
        type: 'boolean',
        description:
          'Allow scraping without credentials from a private network — the RFC 1918 ranges, IPv6 unique local addresses, and link-local addresses.'
      },
      allowAnonymousExternal: {
        type: 'boolean',
        description:
          'Allow scraping without credentials from any other address, i.e. serve the metrics publicly.'
      },
      includeRuntime: {
        type: 'boolean',
        description:
          'The Node.js process this scrape reached: CPU, memory, garbage collection, event loop lag, handles. Per instance, not cluster-wide.'
      },
      includeWiki: {
        type: 'boolean',
        description:
          'The wiki itself: page, user, group, site, tag and asset totals, the job queue, pending suggested edits and scheduler health. Read from the database, so cluster-wide — and off by default, since each scrape of it runs about a dozen queries.'
      }
    }
  })
}
