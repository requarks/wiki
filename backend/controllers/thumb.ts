import crypto from 'node:crypto'
import { validate as uuidValidate } from 'uuid'
import type { FastifyInstance } from 'fastify'

/**
 * A thumbnail is generated once, at upload time, and an asset that changes gets a new ID — so the
 * bytes behind a given URL never change.
 */
const THUMB_CACHE = 'public, max-age=31536000, immutable'

/**
 * _thumb Routes
 *
 * Public, like `_site` and `_user`: a thumbnail is a shrunken copy of an asset already served on the
 * pages that embed it, and the URL has to be known to be asked for. Only assets that have a preview
 * answer here — everything else, including every non-image, is a 404 the file manager draws a file
 * type icon for.
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { fileName: string } }>('/:fileName', async (req, reply) => {
    // -> `.webp` is part of the URL so that the extension matches what is served, but the ID is the
    //    only part that identifies anything
    const assetId = req.params.fileName.replace(/\.webp$/i, '')
    if (!uuidValidate(assetId)) {
      return reply.notFound('Thumbnail not found')
    }

    const preview = await WIKI.models.assets.getThumbnail(assetId)
    if (!preview) {
      return reply.notFound('Thumbnail not found')
    }

    const etag = `"${crypto.createHash('sha1').update(preview).digest('hex')}"`
    reply.header('ETag', etag)
    reply.header('Cache-Control', THUMB_CACHE)
    reply.header('X-Content-Type-Options', 'nosniff')
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send()
    }

    return reply.type('image/webp').send(preview)
  })
}

export default routes
