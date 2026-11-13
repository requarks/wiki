import crypto from 'node:crypto'
import { validate as uuidValidate } from 'uuid'
import { mayReadAsset } from '../helpers/assetAccess.ts'
import type { FastifyInstance } from 'fastify'

/**
 * Asked again on every use, and answered with a 304 while the ETag still matches.
 *
 * Not long-lived: an asset keeps its ID when its bytes are replaced — the image editor writing over
 * the file, an import overwriting it — and its thumbnail is regenerated under the same URL, so a
 * redaction has to reach the next look at it. `private`, because the reply depends on who asked: a
 * shared cache holding one reader's copy would hand it to the next reader along.
 */
const THUMB_CACHE = 'private, no-cache'

/**
 * _thumb Routes
 *
 * No session is required, but every request is judged against `read:assets` on the file the
 * thumbnail was made from, exactly as `_files` judges the file itself (`mayReadAsset`): a thumbnail
 * is a shrunken copy of the file, and must not show what the file would refuse. Only assets that
 * have a preview answer here — everything else, including every non-image, is a 404 the file manager
 * draws a file type icon for.
 */
async function routes(app: FastifyInstance) {
  app.get<{ Params: { fileName: string } }>('/:fileName', async (req, reply) => {
    // -> `.webp` is part of the URL so that the extension matches what is served, but the ID is the
    //    only part that identifies anything
    const assetId = req.params.fileName.replace(/\.webp$/i, '')
    if (!uuidValidate(assetId)) {
      return reply.notFound('Thumbnail not found')
    }

    const thumb = await WIKI.models.assets.getThumbnail(assetId)
    // -> Not readable is answered as not there, so the URL cannot be used to probe for files. Checked
    //    before the ETag, so that a 304 is never an answer either.
    if (!thumb || !mayReadAsset(req, thumb.siteId, thumb)) {
      return reply.notFound('Thumbnail not found')
    }

    const etag = `"${crypto.createHash('sha1').update(thumb.preview).digest('hex')}"`
    reply.header('ETag', etag)
    reply.header('Cache-Control', THUMB_CACHE)
    reply.header('X-Content-Type-Options', 'nosniff')
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send()
    }

    return reply.type('image/webp').send(thumb.preview)
  })
}

export default routes
