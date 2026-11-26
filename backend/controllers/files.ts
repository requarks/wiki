import { mayReadAsset } from '../helpers/assetAccess.ts'
import { attachmentDisposition } from '../helpers/common.ts'
import { deliveryOf } from '../models/assets.ts'
import type { ContentRange } from '../models/assets.ts'
import type { FastifyInstance } from 'fastify'

/**
 * How long a browser may keep a file before asking again.
 *
 * Short, and revalidated: what sits at a path is not fixed — deleting a file and uploading another
 * under the same name puts different bytes behind the same URL. `private`, because the reply depends
 * on who asked: a shared cache holding one reader's copy of a file the rules put behind an account
 * would hand it to the next reader along.
 */
const FILE_CACHE = 'private, max-age=600, must-revalidate'

/**
 * How long a browser may keep a redirect to a signed URL.
 *
 * Half of the link's own lifetime, so that a cached redirect cannot outlive the URL it points at — a
 * reader holding one of those has a broken image until their cache gives it up, and no way to force
 * the issue. Never longer than an ordinary file would have been cached for anyway.
 */
function directAccessCacheSeconds(expiresInSeconds: number): number {
  return Math.max(1, Math.min(600, Math.floor(expiresInSeconds / 2)))
}

/**
 * The types a `Range` request is honoured for: audio and video, the files a browser seeks in. A
 * structured-syntax suffix (`video/lottie+json`) is data rather than media, and gets compressed.
 */
const SEEKABLE_TYPE = /^(audio|video)\/[^+;]+$/i

/**
 * The part of a file a `Range` header asks for (RFC 9110, section 14.1.2).
 *
 * Only a single range of bytes is honoured. Anything else — another unit, several ranges, a header
 * that does not parse — is answered with the whole file, which the RFC allows a server to do with
 * any range it chooses to ignore, and which is what every browser can take.
 *
 * @returns The range, clamped to the file; null to send all of it; false when the range starts past
 *   the end of the file, which is answered 416
 */
function parseRange(header: string, size: number): ContentRange | null | false {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (!match[1] && !match[2])) {
    return null
  }
  if (!match[1]) {
    // -> A suffix: the last N bytes of the file, or all of it when it is shorter than that
    const length = Number(match[2])
    if (length === 0 || size === 0) {
      return false
    }
    return { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : Infinity
  if (end < start) {
    return null
  }
  if (start >= size) {
    return false
  }
  return { start, end: Math.min(end, size - 1) }
}

/**
 * _files Routes
 *
 * How a page's content points at an uploaded file: `/_files/<folder>/<name.ext>`, which is the path
 * the file manager shows and what the editors write into a page.
 *
 * Addressed by path rather than by ID so that what an author reads in their own markdown is the file
 * they picked, and so that content carries nothing instance-specific. The cost is the other half of
 * that bargain: renaming or moving a file leaves the pages that pointed at it pointing at nothing.
 *
 * Public in the sense that `_site` is — no session is required — but not unguarded: assets are
 * addressed by the same rules as the pages they sit among, so every request is judged against
 * `read:assets` for the path it asked for (`mayReadAsset`, which `_thumb` asks too).
 *
 * Every image on every page comes through here, so neither half of the lookup normally reaches the
 * database: the path resolves out of memory and the bytes stream off the local disk cache. See the
 * assets model for what that caches and when it lets go of it.
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { '*': string } }>('/*', async (req, reply) => {
    const site = await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
    if (!site) {
      return reply.notFound('Site not found')
    }

    const asset = await WIKI.models.assets.resolveAssetPath(site.id, req.params['*'] ?? '')
    // -> Not readable is answered as not there, so the URL cannot be used to probe for files
    if (!asset || !mayReadAsset(req, site.id, asset)) {
      return reply.notFound('File not found')
    }

    const { download, csp } = deliveryOf(asset)

    /*
    Hand the reader straight to the store where the site has said to, which is the whole point of
    keeping content in one: the bytes never touch this server. Resolved before the ETag below,
    because the two are answers to different questions — an ETag says "you already have the bytes",
    and there are no bytes here to have.
    */
    const directUrl = await WIKI.models.storage.directAccessUrlFor(
      { ...asset, siteId: site.id },
      { contentType: asset.mimeType, ...(download ? { downloadAs: asset.fileName } : {}) }
    )
    if (directUrl) {
      // -> Cacheable, but for less than the link lives: a redirect kept past its URL's expiry is a
      //    reader stuck on a dead link until their cache lets go of it. Half is the simple safe
      //    fraction, and it still takes most of a page's images off this server on a reload.
      reply.header(
        'Cache-Control',
        `private, max-age=${directAccessCacheSeconds(directUrl.expiresInSeconds)}`
      )
      return reply.redirect(directUrl.url, 302)
    }

    /*
    The ID and the timestamp together, because either one alone lies: a file replaced at the same
    path is a different asset under the same URL, and one edited in place keeps its ID.
    */
    const etag = `"${asset.id}-${asset.updatedAt.getTime()}"`
    reply.header('ETag', etag)
    reply.header('Cache-Control', FILE_CACHE)
    // -> The bytes came from a user, so the browser must take the type at its word rather than
    //    looking for something more interesting in them
    reply.header('X-Content-Type-Options', 'nosniff')
    // -> A live note's SVG included, which anybody holding the note's key can add
    if (csp) {
      reply.header('Content-Security-Policy', csp)
    }
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send()
    }

    /*
    Ranges are what let a browser seek in a video or an audio file: without them it can only play
    from the start, and jumping ahead means waiting for everything before that point to download.
    Only offered for media, which is where they matter and which is never compressed — a range
    counts the bytes as stored, and cannot be applied to a compressed copy of a file. An `If-Range`
    that no longer names this file asks for the whole of it instead.
    */
    const seekable = SEEKABLE_TYPE.test(asset.mimeType)
    if (seekable) {
    reply.header('Accept-Ranges', 'bytes')
    }
    const ifRange = req.headers['if-range']
    const rangeHeader = seekable && (!ifRange || ifRange === etag) ? req.headers.range : undefined

    const content = await WIKI.models.assets.readContent(
      asset,
      rangeHeader ? (size) => parseRange(rangeHeader, size) : undefined
    )
    if (!content) {
      // -> The path resolved to a row that is no longer there, so the resolution was a stale one
      WIKI.models.assets.forgetPath(site.id, asset.folderPath, asset.fileName)
      return reply.notFound('File not found')
    }

    if (content.range === false) {
      reply.header('Content-Range', `bytes */${content.size}`)
      return reply.code(416).send()
    }

    if (download) {
      reply.header('Content-Disposition', attachmentDisposition(asset.fileName))
    }
    if (content.range) {
      reply.code(206)
      reply.header(
        'Content-Range',
        `bytes ${content.range.start}-${content.range.end}/${content.size}`
      )
    }
    // -> Set by hand because the body may be a stream, which Fastify would otherwise send chunked —
    //    and a download with no length is a download with no progress bar
    reply.header(
      'Content-Length',
      content.range ? content.range.end - content.range.start + 1 : content.size
    )
    return reply.type(asset.mimeType).send(content.body)
  })
}

export default routes
