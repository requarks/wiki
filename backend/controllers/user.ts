import { validate as uuidValidate } from 'uuid'
import crypto from 'node:crypto'
import type { FastifyInstance } from 'fastify'

/**
 * An avatar changes whenever its owner uploads a new one, and the URL never carries a version — so it
 * is always revalidated, and the ETag turns that into an empty 304 rather than a re-download.
 */
const AVATAR_CACHE = 'private, no-cache'

/**
 * _user Routes
 *
 * Public, like `_site` and `_icons`: avatars appear next to page authors and in user pickers, so a
 * reader who can see a page can see them. Only what a user chose to upload is served, under a URL that
 * has to be known — nothing here enumerates users.
 */
async function routes(app: FastifyInstance) {
  /**
   * USER AVATAR
   *
   * `current` resolves to the logged in user, as it does for a site's own assets — a page showing its
   * own avatar then needs no user ID to build the URL with.
   */
  app.get<{ Params: { userId: string } }>('/:userId/avatar', async (req, reply) => {
    let userId: string | null = null
    if (req.params.userId === 'current') {
      userId = req.session?.authenticated ? (req.session.user?.id ?? null) : null
    } else if (uuidValidate(req.params.userId)) {
      userId = req.params.userId
    }
    if (!userId) {
      return reply.notFound('User not found')
    }

    const avatar = await WIKI.models.users.getAvatar(userId)
    if (!avatar) {
      return reply.notFound('This user has no avatar')
    }

    const etag = `"${crypto.createHash('sha1').update(avatar.data).digest('hex')}"`
    reply.header('ETag', etag)
    reply.header('Cache-Control', AVATAR_CACHE)
    // -> The bytes came from a user, so the browser must take the type at its word rather than looking
    //    for something more interesting in them
    reply.header('X-Content-Type-Options', 'nosniff')
    if (req.headers['if-none-match'] === etag) {
      return reply.code(304).send()
    }

    return reply.type(avatar.mime).send(avatar.data)
  })
}

export default routes
