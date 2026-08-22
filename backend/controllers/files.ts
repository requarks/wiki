import { INLINE_EXTS } from '../models/assets.ts'
import type { FastifyInstance } from 'fastify'

/**
 * How long a browser may keep a file before asking again.
 *
 * Short, and revalidated: unlike a thumbnail, what sits at a path is not fixed — deleting a file and
 * uploading another under the same name puts different bytes behind the same URL. `private`, because
 * the reply depends on who asked: a shared cache holding one reader's copy of a file the rules put
 * behind an account would hand it to the next reader along.
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
 * _files Routes
 *
 * How a page's content points at an uploaded file: `/_files/<folder>/<name.ext>`, which is the path
 * the file manager shows and what the editors write into a page.
 *
 * Addressed by path rather than by ID so that what an author reads in their own markdown is the file
 * they picked, and so that content carries nothing instance-specific. The cost is the other half of
 * that bargain: renaming or moving a file leaves the pages that pointed at it pointing at nothing.
 *
 * Public in the sense that `_site` and `_thumb` are — no session is required — but not unguarded:
 * assets are addressed by the same rules as the pages they sit among, so every request is judged
 * against `read:assets` for the path it asked for.
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
    if (
      !asset ||
      !WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), 'read:assets', {
        path: asset.folderPath ? `${asset.folderPath}/${asset.fileName}` : asset.fileName,
        locale: asset.locale
      })
    ) {
      return reply.notFound('File not found')
    }

    const download = Boolean(
      WIKI.config.security?.forceAssetDownload || !INLINE_EXTS.has(asset.fileExt)
    )

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
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send()
    }

    const content = await WIKI.models.assets.readContent(asset)
    if (!content) {
      // -> The path resolved to a row that is no longer there, so the resolution was a stale one
      WIKI.models.assets.forgetPath(site.id, asset.folderPath, asset.fileName)
      return reply.notFound('File not found')
    }

    if (download) {
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(asset.fileName)}"`
      )
    }
    // -> Set by hand because the body may be a stream, which Fastify would otherwise send chunked —
    //    and a download with no length is a download with no progress bar
    reply.header('Content-Length', content.size)
    return reply.type(asset.mimeType).send(content.body)
  })
}

export default routes
