import { generateHash } from '../helpers/common.ts'
import type { FastifyInstance, FastifyReply } from 'fastify'

/** Ceiling on how many icons one batch request may ask for. */
const MAX_ICONS_PER_REQUEST = 128

/** An icon never changes under a given name, so the answer can be cached as hard as HTTP allows. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/** Long enough that a page's icons are asked for once, short enough to pick up new sets. */
const BATCH_CACHE = 'public, max-age=604800'

/** A batch that came back incomplete is worth asking about again soon. */
const INCOMPLETE_CACHE = 'public, max-age=60'

/**
 * Answer with a body only when the client does not already have it.
 *
 * Icons are immutable and served for a year, so this only matters for the client that arrives without
 * a warm HTTP cache but with a stale one — cheap enough to be worth the few lines.
 */
function sendCacheable(
  reply: FastifyReply,
  ifNoneMatch: string | undefined,
  body: string,
  { contentType, cacheControl }: { contentType: string; cacheControl: string }
): FastifyReply {
  const etag = `"${generateHash(body)}"`
  reply.header('ETag', etag)
  reply.header('Cache-Control', cacheControl)
  if (ifNoneMatch === etag) {
    return reply.code(304).send()
  }
  return reply.type(contentType).send(body)
}

/**
 * _icons Routes
 *
 * Implements the part of the Iconify API protocol the frontend uses, so that `iconify-icon` and any
 * other Iconify client can be pointed at this wiki instead of a third-party host: content references
 * `mdi:account-edit`, the browser asks this route for it, and nothing about which icons a reader looks
 * at leaves the instance.
 *
 * Public on purpose — icons are page furniture, and a reader who can see a page can see its icons.
 * The routes only serve what the wiki holds or can fill in for an enabled set, and filling is bounded
 * by the model's upstream budget.
 */
async function routes(app: FastifyInstance) {
  /**
   * BATCH ICON DATA — what `iconify-icon` requests, one call per set per page
   */
  app.get<{ Params: { prefix: string }; Querystring: { icons?: string } }>(
    '/:prefix.json',
    async (req, reply) => {
      const prefix = req.params.prefix.toLowerCase()
      const names = (req.query.icons ?? '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_ICONS_PER_REQUEST)
      if (names.length < 1) {
        return reply.badRequest('No icons requested.')
      }

      const set = await WIKI.models.icons.getSet(prefix)
      if (!set) {
        return reply.notFound('Icon set not found.')
      }

      const resolved = await WIKI.models.icons.resolveIcons(prefix, names)
      const payload = {
        prefix,
        icons: resolved.icons,
        ...(resolved.notFound.length > 0 && { not_found: resolved.notFound })
      }

      return sendCacheable(reply, req.headers['if-none-match'], JSON.stringify(payload), {
        contentType: 'application/json; charset=utf-8',
        cacheControl: resolved.notFound.length > 0 ? INCOMPLETE_CACHE : BATCH_CACHE
      })
    }
  )

  /**
   * SINGLE ICON AS SVG — for `<img>` and CSS, where a URL is all that fits
   */
  app.get<{ Params: { prefix: string; name: string } }>(
    '/:prefix/:name.svg',
    async (req, reply) => {
      const svg = await WIKI.models.icons.getIconSvg(
        req.params.prefix.toLowerCase(),
        req.params.name.toLowerCase()
      )
      if (!svg) {
        return reply.notFound('Icon not found.')
      }

      // -> The markup comes from a third party and is served from our own origin, so it is locked down
      //    for the case where it is opened as a document rather than drawn as an image
      reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      reply.header('X-Content-Type-Options', 'nosniff')

      return sendCacheable(reply, req.headers['if-none-match'], svg, {
        contentType: 'image/svg+xml; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE
      })
    }
  )
}

export default routes
