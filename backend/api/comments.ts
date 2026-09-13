import { audit } from '../helpers/audit.ts'
import { maskSensitiveProps } from '../helpers/common.ts'
import { mayOnPage } from './pages.ts'
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from '../models/comments.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { CommentsProviderInput } from '../models/comments.ts'

const siteIdParam = {
  type: 'object',
  properties: {
    siteId: {
      type: 'string',
      format: 'uuid'
    }
  },
  required: ['siteId']
}

const pageIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    pageId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'pageId']
}

const commentIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    commentId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'commentId']
}

/**
 * A roughly-shaped email address, for the one a guest has to leave.
 *
 * Deliberately not a proof that the address exists — nothing here sends to it. It is what Akismet is
 * given and what a future moderation screen would show, and the check is here so that a required
 * field cannot be satisfied with a space.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Comments API Routes
 *
 * Two halves, and they answer to different permissions.
 *
 * **The configuration half** — `GET`/`PUT /sites/:siteId/comments` — is the admin area's Comments
 * screen: which provider this site uses and how it is configured. `manage:sites`, like every other
 * per-site configuration screen.
 *
 * **The comments themselves** are the built-in provider, and carry NO route-level `permissions`: what
 * governs them is `read:comments`, `write:comments` and `manage:comments`, which are PAGE rule
 * permissions and cannot be enforced by a hook that only reads the group-wide list. Every one of these
 * routes resolves the page first and asks `mayOnPage` about it — see `helpers/pageRules.ts` for how a
 * rule is chosen.
 */
async function routes(app: FastifyInstance) {
  /**
   * GET SITE COMMENTS CONFIGURATION
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/comments',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Get the comments configuration of a site',
        description:
          'The provider this site uses, plus one entry per provider that could be selected — the wiki’s own first, then every module installed in `modules/comments` — each with the values this site has configured for it.\n\nSensitive props are masked: the built-in provider’s Akismet key comes back as a fixed placeholder, and sending that placeholder back keeps the stored key.',
        tags: ['Comments'],
        params: siteIdParam,
        response: {
          200: {
            description: 'Comments configuration of the site',
            type: 'object',
            properties: {
              provider: {
                type: 'string',
                description:
                  'Key of the selected provider, or an empty string when this site has picked none. This is what is stored rather than what is in force: `isAllowed` is the other half.'
              },
              isAllowed: {
                type: 'boolean',
                description:
                  'Whether the site allows comments at all — the switch under General → Features. False makes the selection below have no effect, which is worth saying on the screen that edits it.'
              },
              providers: {
                type: 'array',
                items: { $ref: 'CommentsProvider#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      const providers = WIKI.models.comments.getSiteProviders(req.params.siteId)
      return {
        // -> What is STORED. The screen edits the selection whether or not the site-wide switch is
        //    on, and says so through `isAllowed` rather than by reporting nothing selected.
        provider: WIKI.models.comments.selectedProvider(req.params.siteId),
        isAllowed: WIKI.models.comments.isAllowed(req.params.siteId),
        // -> Masking is the last thing that happens on the way out, here and nowhere earlier: the
        //    model hands out the real values because that is what the spam check reads its key from
        providers: providers.map((provider) => ({
          ...provider,
          config: maskSensitiveProps(provider.props, provider.config)
        }))
      }
    }
  )

  /**
   * UPDATE SITE COMMENTS CONFIGURATION
   */
  app.put<{
    Params: { siteId: string }
    Body: { provider?: string; providers?: CommentsProviderInput[] }
  }>(
    '/sites/:siteId/comments',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Update the comments configuration of a site',
        description:
          'Selects the provider and writes whatever configuration came with it. The providers not mentioned keep what they had, so trying another one and coming back finds a form that is still filled in.\n\nEverything is validated before any of it is written, so a rejected request changes nothing. A saved change applies to the next page view, on every instance.',
        tags: ['Comments'],
        params: siteIdParam,
        body: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              maxLength: 255,
              description:
                'Key of the provider to use, or an empty string to turn comments off for this site.'
            },
            providers: {
              type: 'array',
              items: { $ref: 'CommentsProviderInput#' }
            }
          }
        },
        response: {
          200: {
            description: 'Comments configuration updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      if (
        req.body.provider !== undefined &&
        req.body.provider.length > 0 &&
        !WIKI.models.comments.getDefinition(req.body.provider)
      ) {
        return reply.badRequest(`There is no comments provider called "${req.body.provider}".`)
      }
      // -> Validated as a whole first: the screen saves every provider at once, and a partially
      //    applied configuration is worse than a refused one
      for (const patch of req.body.providers ?? []) {
        const invalid = WIKI.models.comments.validateProvider(patch)
        if (invalid) {
          return reply.badRequest(invalid)
        }
      }

      await WIKI.models.comments.updateSiteConfig(req.params.siteId, req.body)

      /*
        Which provider was selected and which fields were touched — never the values. An Akismet key
        is exactly the kind of thing `meta` must not carry, and the rest of it names an account at a
        third party rather than anything about this wiki.
      */
      await audit(req, 'admin', 'updateComments', {
        siteId: req.params.siteId,
        provider: req.body.provider,
        changedProviders: (req.body.providers ?? []).map((patch) => ({
          key: patch.key,
          changedFields: Object.keys(patch.config ?? {})
        }))
      })

      return { ok: true, message: 'Comments configuration updated successfully.' }
    }
  )

  /**
   * LIST COMMENTS OF A PAGE
   */
  /*
    No route-level `permissions`: `read:comments` is granted by a group's page RULES, which the hook
    in `index.ts` cannot see. Checked against this page below instead.
  */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/comments',
    {
      schema: {
        summary: 'List the comments of a page',
        description:
          'Every comment on the page, oldest first and flat — the one level of nesting is assembled by the client from `parentId`, which keeps a reply beside the comment it answers however old that comment is.\n\nOnly for a site using the built-in provider; a site whose discussions live at a third party answers 404 here. Needs `read:comments` on the page, which the guests group may hold.\n\n`mentions` resolves the handles written in these comments, so that a mention is drawn as a link to the right person without a lookup per `@`.',
        tags: ['Comments'],
        params: pageIdParam,
        response: {
          200: {
            description: 'The comments on this page',
            type: 'object',
            properties: {
              comments: {
                type: 'array',
                items: { $ref: 'Comment#' }
              },
              mentions: {
                type: 'array',
                items: { $ref: 'MentionTarget#' }
              },
              total: {
                type: 'integer',
                description:
                  'How many comments the page has. The same as the length of `comments` unless the page has more than the list caps at, which is the one case where the count beside the Talk tab must not be taken from the list.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const page = await requireBuiltInPage(req, reply)
      if (!page) {
        return reply
      }
      if (!mayOnPage(req, 'read:comments', page)) {
        return reply.forbidden('You are not allowed to read the comments of this page.')
      }
      const comments = await WIKI.models.comments.listForPage(page.id)
      const [mentions, total] = await Promise.all([
        WIKI.models.comments.resolveMentions(comments.map((c) => c.content)),
        WIKI.models.comments.countForPage(page.id)
      ])
      return { comments, mentions, total }
    }
  )

  /**
   * POST A COMMENT
   */
  // -> No route-level permissions: `write:comments` is a page rule. See the note above.
  app.post<{
    Params: { siteId: string; pageId: string }
    Body: { content: string; parentId?: string; authorName?: string; authorEmail?: string }
  }>(
    '/sites/:siteId/pages/:pageId/comments',
    {
      schema: {
        summary: 'Post a comment on a page',
        description:
          'Needs `write:comments` on the page. A rule may grant it to the guests group, in which case a name and an email address are required of whoever is posting — the email is stored but never served, and is what the spam check is given.\n\nThe site’s posting cooldown applies to everybody who is not a moderator, counted per account and per address for a guest; going over it answers 429 with `Retry-After`. With an Akismet key configured, a comment Akismet calls spam is refused.',
        tags: ['Comments'],
        params: pageIdParam,
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: COMMENT_MIN_LENGTH,
              maxLength: COMMENT_MAX_LENGTH,
              description: 'Markdown source. Raw HTML in it is escaped rather than rendered.'
            },
            parentId: {
              type: 'string',
              format: 'uuid',
              description:
                'The comment being answered. Replying to a reply attaches the answer to that reply’s own parent — the thread is one level deep.'
            },
            authorName: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description:
                'Required of a guest, ignored for a signed-in author (the account has one).'
            },
            authorEmail: {
              type: 'string',
              maxLength: 255,
              description: 'Required of a guest. Stored, never served.'
            }
          }
        },
        response: {
          201: {
            description: 'The comment as it was stored',
            $ref: 'Comment#'
          }
        }
      }
    },
    async (req, reply) => {
      const page = await requireBuiltInPage(req, reply)
      if (!page) {
        return reply
      }
      if (!page.allowComments) {
        return reply.forbidden('Comments are turned off for this page.')
      }
      if (!mayOnPage(req, 'write:comments', page)) {
        return reply.forbidden('You are not allowed to comment on this page.')
      }

      const user = req.session?.authenticated ? req.session.user : null
      let authorName = user?.name ?? ''
      let authorEmail = user?.email ?? ''
      if (!user) {
        /*
          A guest. Both fields are required here rather than left to the schema, because they are
          required only of a guest: a signed-in author has a name and an address on their account, and
          a form that asked them for both again would be asking them to type something the wiki
          already knows and would then have two answers for.
        */
        authorName = (req.body.authorName ?? '').trim()
        authorEmail = (req.body.authorEmail ?? '').trim()
        if (authorName.length < 1) {
          return reply.badRequest('A name is required to comment as a guest.')
        }
        if (!EMAIL_PATTERN.test(authorEmail)) {
          return reply.badRequest('A valid email address is required to comment as a guest.')
        }
      }

      const cooldown = await consumeCooldown(req, page)
      if (cooldown > 0) {
        reply.header('Retry-After', String(cooldown))
        return reply.tooManyRequests(
          `You are posting too quickly. Try again in ${cooldown} second(s).`
        )
      }

      const origin = `${req.protocol}://${req.hostname}`
      const isSpam = await WIKI.models.comments.isSpam(req.params.siteId, {
        content: req.body.content,
        authorName,
        authorEmail,
        authorIP: req.ip,
        userAgent: req.headers['user-agent'] ?? '',
        referrer: req.headers.referer ?? '',
        permalink: `${origin}/${page.path}`,
        isGuest: !user
      })
      if (isSpam) {
        /*
          Refused rather than held: there is no moderation queue yet, and a comment nobody can see
          and nobody is told about is worse than one that was turned away with a reason. `meta` on
          the row is where a queue would go when there is one.
        */
        return reply.badRequest('This comment was flagged as spam and was not posted.')
      }

      let comment
      try {
        comment = await WIKI.models.comments.create({
          pageId: page.id,
          parentId: req.body.parentId ?? null,
          content: req.body.content,
          authorId: user?.id ?? null,
          authorName,
          authorEmail: user ? '' : authorEmail,
          authorIP: req.ip
        })
      } catch (err: any) {
        return reply.badRequest(err.message)
      }

      await audit(req, 'comment', 'createComment', {
        commentId: comment.id,
        pageId: page.id,
        path: page.path,
        locale: page.locale,
        isReply: Boolean(comment.parentId),
        isGuest: comment.isGuest
      })

      reply.code(201)
      return comment
    }
  )

  /**
   * EDIT A COMMENT
   */
  // -> No route-level permissions: the two that matter here are page rules. See the note above.
  app.put<{ Params: { siteId: string; commentId: string }; Body: { content: string } }>(
    '/sites/:siteId/comments/:commentId',
    {
      schema: {
        summary: 'Edit a comment',
        description:
          'Whoever holds `manage:comments` on the page may edit any comment on it; everybody else may edit their own, and only while they still hold `write:comments` there.\n\nA guest cannot edit at all: there is no session that identifies them as the author, so `their own` has nothing to mean.',
        tags: ['Comments'],
        params: commentIdParam,
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: COMMENT_MIN_LENGTH,
              maxLength: COMMENT_MAX_LENGTH
            }
          }
        },
        response: {
          200: {
            description: 'The comment as it now stands',
            $ref: 'Comment#'
          }
        }
      }
    },
    async (req, reply) => {
      const comment = await requireWritableComment(req, reply)
      if (!comment) {
        return reply
      }
      const updated = await WIKI.models.comments.update(comment.id, req.body.content)
      if (!updated) {
        return reply.notFound('This comment does not exist.')
      }
      await audit(req, 'comment', 'updateComment', {
        commentId: comment.id,
        pageId: comment.pageId,
        path: comment.path,
        isOwn: comment.authorId === req.session?.user?.id
      })
      return updated
    }
  )

  /**
   * DELETE A COMMENT
   */
  // -> No route-level permissions: the two that matter here are page rules. See the note above.
  app.delete<{ Params: { siteId: string; commentId: string } }>(
    '/sites/:siteId/comments/:commentId',
    {
      schema: {
        summary: 'Delete a comment',
        description:
          'Same rule as editing: `manage:comments` on the page deletes any comment, `write:comments` deletes your own.\n\nThe replies underneath go with it. A reply exists to answer something, and left behind it is half of a conversation nobody can read.',
        tags: ['Comments'],
        params: commentIdParam,
        response: {
          200: {
            description: 'Comment deleted successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              deleted: {
                type: 'integer',
                description: 'How many comments went, the replies underneath included.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const comment = await requireWritableComment(req, reply)
      if (!comment) {
        return reply
      }
      const deleted = await WIKI.models.comments.remove(comment.id)
      await audit(req, 'comment', 'deleteComment', {
        commentId: comment.id,
        pageId: comment.pageId,
        path: comment.path,
        deleted,
        isOwn: comment.authorId === req.session?.user?.id
      })
      return { ok: true, deleted }
    }
  )

  /**
   * SEARCH MENTIONABLE USERS
   */
  app.get<{ Params: { siteId: string }; Querystring: { q?: string } }>(
    '/sites/:siteId/comments/mentions',
    {
      schema: {
        summary: 'Find users to mention in a comment',
        description:
          'What the `@` in a comment box completes against: users who have set a handle, matched on the handle or the display name.\n\nNeeds a signed-in session, and nothing else — a handle and a display name are what every comment already shows, but answering this to anybody at all would make it a way to enumerate the wiki’s users. A guest who knows a handle can still type it; it resolves when the comment is drawn.',
        tags: ['Comments'],
        params: siteIdParam,
        querystring: {
          type: 'object',
          properties: {
            q: {
              type: 'string',
              maxLength: 64,
              description: 'What has been typed after the `@`. Empty lists the first few handles.'
            }
          }
        },
        response: {
          200: {
            description: 'Users that can be mentioned',
            type: 'array',
            items: { $ref: 'MentionTarget#' }
          }
        }
      }
    },
    async (req, reply) => {
      if (!req.session?.authenticated) {
        return reply.unauthorized('You must be signed in to look up users to mention.')
      }
      return WIKI.models.comments.searchHandles(req.query.q ?? '')
    }
  )
}

/**
 * The page a request is about, once it is established that this site's comments are the wiki's own.
 *
 * Both questions answer 404 rather than anything more specific. A site using Disqus has no comments
 * here to have an opinion about, and a page id that is not on this site is not this caller's to be
 * told about.
 *
 * @returns The page, or null once it has sent the reply itself
 */
async function requireBuiltInPage(
  req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>,
  reply: FastifyReply
) {
  if (!WIKI.models.comments.usesBuiltIn(req.params.siteId)) {
    reply.notFound('This site does not use the built-in comments provider.')
    return null
  }
  const page = await WIKI.models.comments.pageRef(req.params.siteId, req.params.pageId)
  if (!page) {
    reply.notFound('This page does not exist.')
    return null
  }
  return page
}

/**
 * The comment a request is about, once it is established that the caller may change it.
 *
 * `manage:comments` on the page is the moderator's answer and covers anything on it. Otherwise it has
 * to be the caller's own comment AND they have to still hold `write:comments` there — a rule that was
 * taken away takes the editing of what was written under it with it.
 *
 * @returns The comment, or null once it has sent the reply itself
 */
async function requireWritableComment(
  req: FastifyRequest<{ Params: { siteId: string; commentId: string } }>,
  reply: FastifyReply
) {
  if (!WIKI.models.comments.usesBuiltIn(req.params.siteId)) {
    reply.notFound('This site does not use the built-in comments provider.')
    return null
  }
  const comment = await WIKI.models.comments.getWithPage(req.params.commentId, req.params.siteId)
  if (!comment) {
    reply.notFound('This comment does not exist.')
    return null
  }
  const page = { path: comment.path, locale: comment.locale, tags: comment.tags ?? [] }
  if (mayOnPage(req, 'manage:comments', page)) {
    return comment
  }
  const userId = req.session?.authenticated ? req.session.user?.id : null
  if (!userId || comment.authorId !== userId || !mayOnPage(req, 'write:comments', page)) {
    reply.forbidden('You are not allowed to modify this comment.')
    return null
  }
  return comment
}

/**
 * Count this post against the site's cooldown, and say how long is left of it.
 *
 * Per account, and per address for a guest — an office behind one address shares a counter only where
 * the wiki has no better way of telling two people apart, which is exactly the case the cooldown is
 * for. The counter is the same postgres-backed one the login limit uses, so two instances behind a
 * load balancer agree about it.
 *
 * Moderators are exempt, along with `manage:system` as everywhere: `manage:comments` on this page is
 * the permission to clean up after other people, and answering five threads in a row is what that
 * looks like.
 *
 * @returns Seconds the caller must wait, or 0 when the post may go ahead
 */
async function consumeCooldown(
  req: FastifyRequest<{ Params: { siteId: string; pageId: string } }>,
  page: { path: string; locale: string; tags: string[] }
): Promise<number> {
  const seconds = WIKI.models.comments.cooldownFor(req.params.siteId)
  if (seconds < 1 || mayOnPage(req, 'manage:comments', page)) {
    return 0
  }
  // -> The address is the fallback for a session with no user on it as well as for a guest: a key
  //    ending in `undefined` would be one counter shared by everybody it happened to
  const who = (req.session?.authenticated ? req.session.user?.id : null) ?? `ip:${req.ip}`
  const verdict = await WIKI.models.rateLimits.consume(`comment:${req.params.siteId}:${who}`, {
    /*
      One post per window, and a ban as long as the window. Two attempts inside the cooldown are one
      post and one refusal, and the refusal does not push the ban further out — a banned key stops
      counting, so the wait is measured from the last post that was actually accepted plus whatever
      the client spent retrying.
    */
    max: 1,
    windowSeconds: seconds,
    banSeconds: seconds
  })
  return verdict.allowed ? 0 : verdict.retryAfter
}

export default routes
