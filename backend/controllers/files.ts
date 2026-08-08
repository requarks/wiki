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
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { '*': string } }>('/*', async (req, reply) => {
    const site = await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
    if (!site) {
      return reply.notFound('Site not found')
    }

    const asset = await WIKI.models.assets.getAssetByPath(site.id, req.params['*'] ?? '')
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

    const content = await WIKI.models.assets.getContent(asset.id)
    if (!content) {
      return reply.notFound('File not found')
    }

    if (WIKI.config.security?.forceAssetDownload || !INLINE_EXTS.has(asset.fileExt)) {
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(asset.fileName)}"`
      )
    }
    return reply.type(content.mimeType).send(content.data)
  })
}

export default routes
