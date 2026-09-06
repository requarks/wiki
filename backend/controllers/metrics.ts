import type { FastifyReply, FastifyRequest } from 'fastify'

import { METRICS_PERMISSION } from '../models/metrics.ts'

/**
 * The Prometheus metrics endpoint.
 *
 * A hook rather than a route, because the path is a setting and a route table is fixed at boot. It
 * is registered on the root instance in `index.ts` and does nothing at all unless metrics are turned
 * on and the path matches — which is what lets a page live at `/metrics` while the endpoint is off,
 * and is why the check has to come BEFORE the SEO hook: that one would otherwise redirect the scrape
 * to the site's locale prefix, or strip a page extension off it.
 *
 * Authentication is either-or. An address in a class the operator opened scrapes anonymously; every
 * other address has to carry `read:metrics`, as a bearer API key (verified by the hook above this
 * one, which lets the metrics path through for exactly this reason) or as the session cookie of a
 * logged-in browser. `manage:system` bypasses it, as it does everywhere.
 */
export async function metricsHook(req: FastifyRequest, reply: FastifyReply) {
  // -> This runs ahead of every request the wiki serves, so the disabled case — which is most wikis,
  //    always — costs one property read and nothing else
  if (!WIKI.models.metrics.isEnabled()) {
    return
  }
  if (!WIKI.models.metrics.matches(req.raw.url!.split('?')[0]!)) {
    return
  }

  // -> A scrape reads; nothing here answers a POST, and saying so is more useful than a 404 at a
  //    path that plainly exists
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return reply.methodNotAllowed()
  }

  if (!WIKI.models.metrics.allowsAnonymous(req.ip)) {
    const permissions = req.apiKey
      ? req.apiKey.permissions
      : req.session?.authenticated
        ? req.session.permissions
        : null
    const isAllowed =
      permissions?.includes(METRICS_PERMISSION) || permissions?.includes('manage:system')
    if (!isAllowed) {
      /*
        401 rather than 403 even for a caller who is authenticated but unentitled: the answer a
        scraper needs is "send a credential", and the two cases are not worth distinguishing to
        somebody the endpoint is not open to anyway.
      */
      return reply
        .header('WWW-Authenticate', 'Bearer realm="metrics"')
        .unauthorized('This endpoint requires the read:metrics permission.')
    }
  }

  try {
    const { contentType, body } = await WIKI.models.metrics.render()
    // -> Never held: a scrape a minute old is worse than no scrape, and Prometheus asks again anyway
    return reply.header('Cache-Control', 'no-store').type(contentType).send(body)
  } catch (err: any) {
    WIKI.logger.warn(`Failed to collect metrics: ${err.message}`)
    return reply.internalServerError('Failed to collect metrics.')
  }
}
