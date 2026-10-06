import { audit } from '../helpers/audit.ts'
import { maskSensitiveProps } from '../helpers/common.ts'
import { mayOnPage, unpublishedFor } from './pages.ts'
import {
  ANNOTATION_NOTE_MAX_LENGTH,
  ANNOTATIONS_MAX,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH
} from '../models/comments.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AnnotationInput, CommentsProviderInput } from '../models/comments.ts'
import type { RulePageRef } from '../helpers/pageRules.ts'

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

const annotationIdParam = {
  type: 'object',
  properties: {
    siteId: { type: 'string', format: 'uuid' },
    annotationId: { type: 'string', format: 'uuid' }
  },
  required: ['siteId', 'annotationId']
}

/**
 * A comment's own text, which may be empty only where annotations carry what it has to say.
 *
 * Checked in the handler rather than by the schema's `minLength`, since whether it applies depends on
 * the rest of the request — or, for an edit, on what the comment was posted with.
 */
function isTooShort(content: string): boolean {
  return content.trim().length < COMMENT_MIN_LENGTH
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
        // -> An annotation's note is drawn the way a comment is, mentions and all
        WIKI.models.comments.resolveMentions(
          comments.flatMap((c) => [c.content, ...c.annotations.map((a) => a.note)])
        ),
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
    Body: {
      content: string
      parentId?: string
      authorName?: string
      authorEmail?: string
      annotations?: AnnotationInput[]
    }
  }>(
    '/sites/:siteId/pages/:pageId/comments',
    {
      schema: {
        summary: 'Post a comment on a page',
        description:
          'Needs `write:comments` on the page. A rule may grant it to the guests group, in which case a name and an email address are required of whoever is posting — the email is stored but never served, and is what the spam check is given.\n\nA comment that starts a thread may carry `annotations`: passages of the article, each with a note about it. That needs a signed-in account — an annotation is resolved later by its author, and a guest has no session to be recognized by. With at least one annotation the comment’s own `content` may be empty.\n\nThe site’s posting cooldown applies to everybody who is not a moderator, counted per account and per address for a guest; going over it answers 429 with `Retry-After`. With an Akismet key configured, a comment Akismet calls spam is refused.',
        tags: ['Comments'],
        params: pageIdParam,
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              maxLength: COMMENT_MAX_LENGTH,
              description: `Markdown source. Raw HTML in it is escaped rather than rendered. At least ${COMMENT_MIN_LENGTH} characters, unless the comment carries annotations.`
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
            },
            annotations: {
              type: 'array',
              maxItems: ANNOTATIONS_MAX,
              description:
                'Passages of the article this comment is about, in the order they were picked. Not on a reply, and not from a guest.',
              items: {
                type: 'object',
                required: ['note', 'anchor'],
                additionalProperties: false,
                properties: {
                  note: { type: 'string', maxLength: ANNOTATION_NOTE_MAX_LENGTH },
                  anchor: { $ref: 'CommentAnchor#' }
                }
              }
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
      const annotations = req.body.annotations ?? []
      if (annotations.length > 0) {
        if (!user) {
          return reply.forbidden('Annotating a page needs an account.')
        }
        if (req.body.parentId) {
          return reply.badRequest(
            'A reply cannot annotate the page. Only a comment that starts a thread can.'
          )
        }
        if (annotations.some((annotation) => annotation.note.trim().length < 1)) {
          return reply.badRequest('Every annotation needs a note.')
        }
      } else if (isTooShort(req.body.content)) {
        return reply.badRequest('The comment is empty or too short.')
      }
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
      // -> Everything the post says, notes included: a comment whose text is empty and whose
      //    annotations are all links is exactly what the check is for
      const notes = annotations.map((annotation) => annotation.note.trim())
      const isSpam = await WIKI.models.comments.isSpam(req.params.siteId, {
        content: [req.body.content, ...notes].join('\n\n').trim(),
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
          authorIP: req.ip,
          annotations
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
        isGuest: comment.isGuest,
        annotations: comment.annotations.length
      })
      // -> The email is a guest's alone: an account's
      //    comment stores none, and `authorId` is what identifies it
      await WIKI.models.hooks.emit('comment:new', {
        id: comment.id,
        parentId: comment.parentId,
        pageId: page.id,
        path: page.path,
        locale: page.locale,
        siteId: req.params.siteId,
        authorId: comment.authorId,
        metadata: {
          authorName: comment.authorName,
          authorEmail: user ? null : authorEmail,
          authorIP: req.ip,
          isGuest: comment.isGuest,
          pageTitle: page.title
        },
        content: comment.content
      })
      await WIKI.models.notifications.emit('comment:new', {
        siteId: req.params.siteId,
        actorId: comment.authorId,
        data: {
          variant: 'new',
          page: WIKI.models.notifications.pageSnapshot(page),
          commentId: comment.id,
          parentId: comment.parentId,
          parentAuthorId: comment.parentId
            ? await WIKI.models.comments.authorOf(comment.parentId)
            : null,
          // -> A comment posted as annotations alone has no text of its own, and is quoted by its
          //    first note instead
          excerpt: WIKI.models.comments.excerptOf(
            isTooShort(comment.content) && notes.length > 0 ? notes[0]! : comment.content
          ),
          mentionHandles: WIKI.models.comments.mentionedHandles(
            [comment.content, ...notes].join('\n')
          ),
          // -> A guest's name is what they typed; an account's is looked up when the event is sent
          ...(comment.authorId ? {} : { actorName: comment.authorName })
        }
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
          'Whoever holds `manage:comments` on the page may edit any comment on it; everybody else may edit their own, and only while they still hold `write:comments` there.\n\nA guest cannot edit at all: there is no session that identifies them as the author, so `their own` has nothing to mean.\n\nOnly the comment’s own text changes here. Its annotations are edited one at a time, under `/annotations/:annotationId`, and while it has any the text may be empty.',
        tags: ['Comments'],
        params: commentIdParam,
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
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
      if (
        isTooShort(req.body.content) &&
        (await WIKI.models.comments.countAnnotations(comment.id)) < 1
      ) {
        return reply.badRequest('The comment is empty or too short.')
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
      // -> `actorId` beside `authorId`, since a moderator editing somebody else's comment is exactly
      //    the case a subscriber is likely to be watching for
      await WIKI.models.hooks.emit('comment:edit', {
        id: comment.id,
        parentId: comment.parentId,
        pageId: comment.pageId,
        path: comment.path,
        locale: comment.locale,
        siteId: req.params.siteId,
        authorId: comment.authorId,
        actorId: req.session?.user?.id ?? null,
        metadata: {
          authorName: updated.authorName,
          authorEmail: comment.authorEmail || null,
          authorIP: comment.authorIP || null,
          isGuest: updated.isGuest
        },
        content: updated.content
      })
      // -> Only the handles this edit added: re-saving a comment does not mention everybody in it again
      const before = new Set(WIKI.models.comments.mentionedHandles(comment.content))
      const added = WIKI.models.comments
        .mentionedHandles(updated.content)
        .filter((handle) => !before.has(handle))
      if (added.length > 0) {
        await WIKI.models.notifications.emit('comment:edit', {
          siteId: req.params.siteId,
          actorId: req.session?.user?.id ?? null,
          data: {
            variant: 'edited',
            page: WIKI.models.notifications.pageSnapshot({
              id: comment.pageId,
              title: comment.title,
              path: comment.path,
              locale: comment.locale,
              tags: comment.tags
            }),
            commentId: comment.id,
            excerpt: WIKI.models.comments.excerptOf(updated.content),
            mentionHandles: added
          }
        })
      }
      return updated
    }
  )

  /**
   * DELETE A COMMENT
   */
  // -> No route-level permissions: the two that matter here are page rules. See the note above.
  app.delete<{
    Params: { siteId: string; commentId: string }
    Querystring: { withReplies?: boolean }
  }>(
    '/sites/:siteId/comments/:commentId',
    {
      schema: {
        summary: 'Delete a comment',
        description:
          'Same rule as editing: `manage:comments` on the page deletes any comment, `write:comments` deletes your own.\n\nThe replies underneath stay — they are other people’s words. A comment that has any is kept as a placeholder for them (`isDeleted` in the list, with its content, author and annotations cleared), and one that has none is deleted outright. A placeholder goes on its own once the last reply under it is deleted.\n\n`withReplies` deletes the whole thread instead, replies included. That is a moderator’s call and needs `manage:comments` on the page — an author may take back their own words, not the answers to them. It is also the only way to delete a placeholder directly; without it a placeholder answers 404.',
        tags: ['Comments'],
        params: commentIdParam,
        querystring: {
          type: 'object',
          properties: {
            withReplies: {
              type: 'boolean',
              default: false,
              description:
                'Delete the replies under the comment too, rather than keeping them under a placeholder. Needs `manage:comments` on the page.'
            }
          }
        },
        response: {
          200: {
            description: 'Comment deleted successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              keptForReplies: {
                type: 'boolean',
                description:
                  'Whether the comment was kept as a placeholder, because it has replies, rather than deleted outright.'
              },
              repliesDeleted: {
                type: 'integer',
                description:
                  'How many replies went with it. Only ever more than 0 with `withReplies`.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const withReplies = req.query.withReplies === true
      const comment = await requireWritableComment(req, reply, { placeholder: withReplies })
      if (!comment) {
        return reply
      }
      if (
        withReplies &&
        !mayOnPage(req, 'manage:comments', {
          siteId: req.params.siteId,
          path: comment.path,
          locale: comment.locale,
          tags: comment.tags ?? []
        })
      ) {
        return reply.forbidden('Only a moderator may delete the replies to a comment.')
      }
      const { removed, keptForReplies, repliesDeleted } = await WIKI.models.comments.remove(
        comment.id,
        { withReplies }
      )
      if (!removed) {
        return reply.notFound('This comment does not exist.')
      }
      await audit(req, 'comment', 'deleteComment', {
        commentId: comment.id,
        pageId: comment.pageId,
        path: comment.path,
        keptForReplies,
        repliesDeleted,
        wasPlaceholder: Boolean(comment.deletedAt),
        isOwn: comment.authorId === req.session?.user?.id
      })
      await WIKI.models.hooks.emit('comment:delete', {
        id: comment.id,
        parentId: comment.parentId,
        pageId: comment.pageId,
        path: comment.path,
        locale: comment.locale,
        siteId: req.params.siteId,
        authorId: comment.authorId,
        actorId: req.session?.user?.id ?? null,
        keptForReplies,
        repliesDeleted,
        metadata: {
          authorEmail: comment.authorEmail || null,
          authorIP: comment.authorIP || null,
          isGuest: comment.authorId === null
        }
      })
      return { ok: true, keptForReplies, repliesDeleted }
    }
  )

  /**
   * EDIT AN ANNOTATION'S NOTE
   */
  // -> No route-level permissions: the two that matter here are page rules. See the note above.
  app.put<{ Params: { siteId: string; annotationId: string }; Body: { note: string } }>(
    '/sites/:siteId/annotations/:annotationId',
    {
      schema: {
        summary: 'Edit the note of an annotation',
        description:
          'The same rule as editing the comment it belongs to: `manage:comments` on the page edits any note, and the comment’s author edits their own while they still hold `write:comments` there. The passage it is about cannot change — an annotation on a different passage is a different annotation.',
        tags: ['Comments'],
        params: annotationIdParam,
        body: {
          type: 'object',
          required: ['note'],
          properties: {
            note: { type: 'string', maxLength: ANNOTATION_NOTE_MAX_LENGTH }
          }
        },
        response: {
          200: {
            description: 'The annotation as it now stands',
            $ref: 'CommentAnnotation#'
          }
        }
      }
    },
    async (req, reply) => {
      const annotation = await requireAnnotation(req, reply, 'edit')
      if (!annotation) {
        return reply
      }
      if (req.body.note.trim().length < 1) {
        return reply.badRequest('An annotation needs a note.')
      }
      const updated = await WIKI.models.comments.updateAnnotationNote(annotation.id, req.body.note)
      if (!updated) {
        return reply.notFound('This annotation does not exist.')
      }
      await audit(req, 'comment', 'updateAnnotation', {
        annotationId: annotation.id,
        commentId: annotation.commentId,
        pageId: annotation.pageId,
        path: annotation.path,
        isOwn: annotation.authorId === req.session?.user?.id
      })
      // -> As for an edited comment: only the handles this edit added
      const before = new Set(WIKI.models.comments.mentionedHandles(annotation.note))
      const added = WIKI.models.comments
        .mentionedHandles(updated.note)
        .filter((handle) => !before.has(handle))
      if (added.length > 0) {
        await WIKI.models.notifications.emit('comment:edit', {
          siteId: req.params.siteId,
          actorId: req.session?.user?.id ?? null,
          data: {
            variant: 'edited',
            page: WIKI.models.notifications.pageSnapshot({
              id: annotation.pageId,
              title: annotation.title,
              path: annotation.path,
              locale: annotation.locale,
              tags: annotation.tags
            }),
            commentId: annotation.commentId,
            excerpt: WIKI.models.comments.excerptOf(updated.note),
            mentionHandles: added
          }
        })
      }
      return updated
    }
  )

  /**
   * RESOLVE OR REOPEN AN ANNOTATION
   */
  // -> No route-level permissions: the three that matter here are page rules. See the note above.
  app.put<{ Params: { siteId: string; annotationId: string }; Body: { resolved: boolean } }>(
    '/sites/:siteId/annotations/:annotationId/resolved',
    {
      schema: {
        summary: 'Resolve or reopen an annotation',
        description:
          'Marks the passage as dealt with, or open again. A resolved annotation stays in its comment, drawn as done.\n\nThe comment’s author may (while they hold `write:comments` on the page), and so may whoever holds `review:pages` or `manage:comments` there — reviewing a page is acting on what was said about it.',
        tags: ['Comments'],
        params: annotationIdParam,
        body: {
          type: 'object',
          required: ['resolved'],
          properties: {
            resolved: { type: 'boolean' }
          }
        },
        response: {
          200: {
            description: 'The annotation as it now stands',
            $ref: 'CommentAnnotation#'
          }
        }
      }
    },
    async (req, reply) => {
      const annotation = await requireAnnotation(req, reply, 'resolve')
      if (!annotation) {
        return reply
      }
      const updated = await WIKI.models.comments.setAnnotationResolved(
        annotation.id,
        req.body.resolved,
        req.session?.user?.id ?? null
      )
      if (!updated) {
        return reply.notFound('This annotation does not exist.')
      }
      // -> Only a change of state is an action: resolving one that was already resolved is not
      if (Boolean(annotation.resolvedAt) !== req.body.resolved) {
        await audit(req, 'comment', req.body.resolved ? 'resolveAnnotation' : 'reopenAnnotation', {
          annotationId: annotation.id,
          commentId: annotation.commentId,
          pageId: annotation.pageId,
          path: annotation.path,
          isOwn: annotation.authorId === req.session?.user?.id
        })
      }
      return updated
    }
  )

  /**
   * DELETE AN ANNOTATION
   */
  // -> No route-level permissions: the three that matter here are page rules. See the note above.
  app.delete<{ Params: { siteId: string; annotationId: string } }>(
    '/sites/:siteId/annotations/:annotationId',
    {
      schema: {
        summary: 'Delete an annotation',
        description:
          'Takes one passage out of its comment. Whoever may resolve it may delete it: the comment’s author, and whoever holds `review:pages` or `manage:comments` on the page.\n\nA comment that was posted as annotations alone, with no text of its own, has nothing left to say once its last annotation goes — so it is deleted too, the way its author would delete it: its replies stay, under a placeholder. `commentDeleted` says when that happened.',
        tags: ['Comments'],
        params: annotationIdParam,
        response: {
          200: {
            description: 'Annotation deleted successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              commentDeleted: {
                type: 'boolean',
                description:
                  'Whether the comment went too, because this was its last annotation and it had no text of its own.'
              },
              keptForReplies: {
                type: 'boolean',
                description:
                  'Whether that comment was kept as a placeholder for its replies rather than deleted outright.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const annotation = await requireAnnotation(req, reply, 'resolve')
      if (!annotation) {
        return reply
      }
      // -> Read before, since the comment may not be there after: a webhook about its deletion
      //    carries what it was
      const comment = await WIKI.models.comments.getWithPage(
        annotation.commentId,
        req.params.siteId
      )
      const { removed, commentDeleted, keptForReplies } =
        await WIKI.models.comments.removeAnnotation(annotation.id)
      if (!removed) {
        return reply.notFound('This annotation does not exist.')
      }
      // -> One row for one act: the comment going is a consequence of this deletion, not a second
      //    thing the reader did, so it is recorded here rather than as a `deleteComment` beside it
      await audit(req, 'comment', 'deleteAnnotation', {
        annotationId: annotation.id,
        commentId: annotation.commentId,
        pageId: annotation.pageId,
        path: annotation.path,
        isOwn: annotation.authorId === req.session?.user?.id,
        commentDeleted,
        ...(commentDeleted && { keptForReplies })
      })
      // -> But a subscriber watching for comments that disappear is told, as for any other deletion
      if (commentDeleted && comment) {
        await WIKI.models.hooks.emit('comment:delete', {
          id: comment.id,
          parentId: comment.parentId,
          pageId: comment.pageId,
          path: comment.path,
          locale: comment.locale,
          siteId: req.params.siteId,
          authorId: comment.authorId,
          actorId: req.session?.user?.id ?? null,
          keptForReplies,
          repliesDeleted: 0,
          metadata: {
            authorEmail: comment.authorEmail || null,
            authorIP: comment.authorIP || null,
            isGuest: comment.authorId === null
          }
        })
      }
      return { ok: true, commentDeleted, keptForReplies }
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
  const row = await WIKI.models.comments.pageRef(req.params.siteId, req.params.pageId)
  if (!row) {
    reply.notFound('This page does not exist.')
    return null
  }
  // -> Carrying the site, since everything below asks a page rule about this page and a rule may be
  //    limited to particular sites
  const { isLive, ...ref } = { ...row, siteId: req.params.siteId }
  // -> A page that is not live is not there for its discussion either, on the page view's own terms
  const unpublished = unpublishedFor(req)
  if (!isLive && !(unpublished && unpublished(ref))) {
    reply.notFound('This page does not exist.')
    return null
  }
  return ref
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
  reply: FastifyReply,
  { placeholder = false }: { placeholder?: boolean } = {}
) {
  if (!WIKI.models.comments.usesBuiltIn(req.params.siteId)) {
    reply.notFound('This site does not use the built-in comments provider.')
    return null
  }
  const comment = await WIKI.models.comments.getWithPage(req.params.commentId, req.params.siteId)
  // -> A placeholder is what is left of a comment already deleted: nothing in it to edit, and only
  //    the thread under it to delete -- which the caller says it is asking about. It has no author,
  //    so only a moderator gets past the checks below either way.
  if (!comment || (comment.deletedAt && !placeholder)) {
    reply.notFound('This comment does not exist.')
    return null
  }
  const page = {
    siteId: req.params.siteId,
    path: comment.path,
    locale: comment.locale,
    tags: comment.tags ?? []
  }
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
 * The annotation a request is about, once it is established that the caller may do what they asked.
 *
 * Two levels, because the two acts are not the same kind of thing. Editing a note is rewriting what
 * somebody said, which is the comment's own rule: `manage:comments`, or the author while they still
 * hold `write:comments`. Resolving and deleting are acting on the remark rather than rewording it,
 * and `review:pages` is enough for that too — a reviewer is whoever the page's remarks are FOR.
 *
 * @returns The annotation, or null once it has sent the reply itself
 */
async function requireAnnotation(
  req: FastifyRequest<{ Params: { siteId: string; annotationId: string } }>,
  reply: FastifyReply,
  action: 'edit' | 'resolve'
) {
  if (!WIKI.models.comments.usesBuiltIn(req.params.siteId)) {
    reply.notFound('This site does not use the built-in comments provider.')
    return null
  }
  const annotation = await WIKI.models.comments.getAnnotationWithComment(
    req.params.annotationId,
    req.params.siteId
  )
  if (!annotation) {
    reply.notFound('This annotation does not exist.')
    return null
  }
  const page = {
    siteId: req.params.siteId,
    path: annotation.path,
    locale: annotation.locale,
    tags: annotation.tags ?? []
  }
  if (
    mayOnPage(req, 'manage:comments', page) ||
    (action === 'resolve' && mayOnPage(req, 'review:pages', page))
  ) {
    return annotation
  }
  const userId = req.session?.authenticated ? req.session.user?.id : null
  if (!userId || annotation.authorId !== userId || !mayOnPage(req, 'write:comments', page)) {
    reply.forbidden('You are not allowed to modify this annotation.')
    return null
  }
  return annotation
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
  page: RulePageRef
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
