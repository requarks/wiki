import { CustomError } from '../helpers/common.ts'
import { actorFrom, mayBypassPassword, unlockedFor } from './pages.ts'
import type { ApprovalPageRef, ApprovalRulePatch } from '../models/approvals.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * The page a suggestion is about, with the source it would be edited from.
 *
 * Loaded the way the public page route loads it — an anonymous reader sees published pages only, and a
 * password still has to have been entered — so eligibility to suggest an edit never becomes a way to
 * read something that was not readable. The source itself is fetched regardless of who is asking,
 * because the caller has to be able to edit what they are looking at; the routes below only hand it
 * over once a rule says this actor may suggest edits to this page.
 */
async function loadSuggestablePage(req: FastifyRequest, siteId: string, pageId: string) {
  const actor = actorFrom(req)
  return WIKI.models.pages.getPage({
    siteId,
    id: pageId,
    withContent: true,
    publicOnly: !actor,
    unlocked: (id: string) => unlockedFor(req, id),
    withPassword: mayBypassPassword(req)
  })
}

/**
 * Who is reviewing, as the rules see them: the groups on their session, plus whether they hold
 * `manage:system` — which sees every queue, here as everywhere else.
 */
function reviewerFor(req: FastifyRequest): { groupIds: string[]; isAdmin: boolean } {
  return {
    groupIds: WIKI.models.approvals.getActorGroupIds(req),
    isAdmin: Boolean(req.session?.permissions?.includes('manage:system'))
  }
}

/**
 * Everything a rule has to satisfy beyond what the JSON Schema already enforces.
 *
 * All of it comes down to the same thing: a rule that cannot match a page, or that nobody is on either
 * side of, is a rule that does nothing, and storing one silently is worse than refusing it.
 *
 * @returns A `CustomError` to throw, or null when the rule is usable
 */
function validateRule({
  name,
  match,
  path,
  submitterGroups,
  reviewerGroups
}: {
  name: string
  match: string
  path: string
  submitterGroups: string[]
  reviewerGroups: string[]
}): CustomError | null {
  if (!name || name.trim().length < 1) {
    return new CustomError('approvalRuleEmptyName', 'A rule name is required.')
  }
  if (!path || path.trim().length < 1) {
    return new CustomError(
      'approvalRuleEmptyPath',
      match === 'TAG' || match === 'TAGALL'
        ? 'At least one tag is required.'
        : 'A path is required.'
    )
  }
  if (match === 'REGEX') {
    try {
      new RegExp(path)
    } catch (err: any) {
      return new CustomError(
        'approvalRuleInvalidRegex',
        `Not a valid regular expression: ${err.message}`
      )
    }
  }
  if (submitterGroups.length < 1) {
    return new CustomError(
      'approvalRuleNoSubmitters',
      'At least one group has to be able to submit edits.'
    )
  }
  if (reviewerGroups.length < 1) {
    return new CustomError(
      'approvalRuleNoReviewers',
      'At least one group has to review submissions.'
    )
  }
  return null
}

/**
 * Reject group IDs that are not groups on this instance, for either list.
 *
 * @returns Whether the reply has been sent
 */
async function rejectUnknownGroups(
  reply: FastifyReply,
  groupIds: (string[] | undefined)[]
): Promise<boolean> {
  const unknown = await WIKI.models.approvals.getUnknownGroupIds(
    groupIds.flatMap((ids) => ids ?? [])
  )
  if (unknown.length > 0) {
    reply.badRequest(`No such group: ${unknown.join(', ')}`)
    return true
  }
  return false
}

/**
 * Approvals API Routes
 */
async function routes(app: FastifyInstance) {
  /**
   * LIST SITE APPROVAL RULES
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/approvals/rules',
    {
      config: {
        permissions: ['read:sites', 'manage:sites']
      },
      schema: {
        summary: 'List the approval rules of a site',
        description:
          'Each rule says which pages accept edit suggestions, which groups may submit them, and which groups review them. A page matched by no rule accepts none, so a site with no rules has the feature off.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        response: {
          200: {
            description: 'List of approval rules',
            type: 'array',
            items: { $ref: 'ApprovalRule#' }
          }
        }
      }
    },
    async (req, reply) => {
      const site = await WIKI.models.sites.getSiteById({ id: req.params.siteId })
      if (!site) {
        return reply.notFound('Site does not exist.')
      }
      return WIKI.models.approvals.getRules(req.params.siteId)
    }
  )

  /**
   * CREATE AN APPROVAL RULE
   */
  app.post<{ Params: { siteId: string }; Body: ApprovalRulePatch }>(
    '/sites/:siteId/approvals/rules',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Create an approval rule',
        description:
          'Rules are not ordered: a page is covered when any rule matches it, so a new one only ever adds coverage.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId']
        },
        body: {
          allOf: [
            { $ref: 'ApprovalRuleInput#' },
            { type: 'object', required: ['name', 'match', 'path'] }
          ]
        },
        response: {
          200: {
            description: 'Rule created successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              rule: { $ref: 'ApprovalRule#' }
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

      const invalid = validateRule({
        name: req.body.name!,
        match: req.body.match!,
        path: req.body.path!,
        submitterGroups: req.body.submitterGroups ?? [],
        reviewerGroups: req.body.reviewerGroups ?? []
      })
      if (invalid) {
        throw invalid
      }
      if (await rejectUnknownGroups(reply, [req.body.submitterGroups, req.body.reviewerGroups])) {
        return reply
      }

      const rule = await WIKI.models.approvals.createRule(req.params.siteId, req.body)
      return {
        ok: true,
        rule
      }
    }
  )

  /**
   * UPDATE AN APPROVAL RULE
   */
  app.put<{ Params: { siteId: string; ruleId: string }; Body: ApprovalRulePatch }>(
    '/sites/:siteId/approvals/rules/:ruleId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Update an approval rule',
        description: 'Accepts any subset of the fields; omitted ones are left unchanged.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            ruleId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId', 'ruleId']
        },
        body: { $ref: 'ApprovalRuleInput#' },
        response: {
          200: {
            description: 'Rule updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              rule: { $ref: 'ApprovalRule#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const current = await WIKI.models.approvals.getRule(req.params.siteId, req.params.ruleId)
      if (!current) {
        return reply.notFound('Approval rule does not exist.')
      }
      if (Object.keys(req.body).length < 1) {
        throw new CustomError('approvalRuleEmpty', 'No rule fields provided to update.')
      }

      // -> Validated as the rule will be, not as it was sent: changing the mode alone has to hold up
      //    against the stored path, and emptying one group list has to be caught even though the other
      //    was not touched
      const invalid = validateRule({
        name: req.body.name ?? current.name,
        match: req.body.match ?? current.match,
        path: req.body.path ?? current.path,
        submitterGroups: req.body.submitterGroups ?? current.submitterGroups,
        reviewerGroups: req.body.reviewerGroups ?? current.reviewerGroups
      })
      if (invalid) {
        throw invalid
      }
      if (await rejectUnknownGroups(reply, [req.body.submitterGroups, req.body.reviewerGroups])) {
        return reply
      }

      const rule = await WIKI.models.approvals.updateRule(
        req.params.siteId,
        req.params.ruleId,
        req.body
      )
      if (!rule) {
        return reply.notFound('Approval rule does not exist.')
      }
      return {
        ok: true,
        rule
      }
    }
  )

  /**
   * DELETE AN APPROVAL RULE
   */
  app.delete<{ Params: { siteId: string; ruleId: string } }>(
    '/sites/:siteId/approvals/rules/:ruleId',
    {
      config: {
        permissions: ['manage:sites']
      },
      schema: {
        summary: 'Delete an approval rule',
        description:
          'The pages it covered stop accepting edit suggestions, unless another rule also matches them.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid'
            },
            ruleId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['siteId', 'ruleId']
        },
        response: {
          204: {
            description: 'Rule deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      if (!(await WIKI.models.approvals.deleteRule(req.params.siteId, req.params.ruleId))) {
        return reply.notFound('Approval rule does not exist.')
      }
      return reply.code(204).send()
    }
  )

  /**
   * LIST SUGGESTIONS WAITING ON THIS REVIEWER
   */
  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/approvals/submissions',
    {
      schema: {
        summary: 'List the edit suggestions waiting for the caller to review',
        description:
          'Scoped by the approval rules: a suggestion appears here when an enabled rule covers its page and names a group the caller is in. Oldest first, which is the order a queue is worked through. `manage:system` sees the whole site’s queue.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId']
        },
        response: {
          200: {
            description: 'Suggestions awaiting review',
            type: 'array',
            items: { $ref: 'PageEditSubmission#' }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      return WIKI.models.approvals.getReviewableSubmissions(req.params.siteId, reviewerFor(req))
    }
  )

  /**
   * GET ONE SUGGESTION TO REVIEW
   */
  app.get<{ Params: { siteId: string; submissionId: string } }>(
    '/sites/:siteId/approvals/submissions/:submissionId',
    {
      schema: {
        summary: 'Get an edit suggestion, with both sides of the diff',
        description:
          'The suggested source and the page as it currently stands, which is what the review screen compares. Answers 404 for a suggestion that is not the caller’s to review, so that an ID cannot be probed for.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            submissionId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'submissionId']
        },
        response: {
          200: { $ref: 'PageEditSubmissionDetail#' }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const submission = await WIKI.models.approvals.getSubmissionForReview(
        req.params.siteId,
        req.params.submissionId,
        reviewerFor(req)
      )
      if (!submission) {
        return reply.notFound('This edit suggestion does not exist.')
      }
      return submission
    }
  )

  /**
   * APPROVE A SUGGESTION
   */
  app.post<{
    Params: { siteId: string; submissionId: string }
    Body: { content?: string; render?: string }
  }>(
    '/sites/:siteId/approvals/submissions/:submissionId/approve',
    {
      schema: {
        summary: 'Approve an edit suggestion and write it to the page',
        description:
          'Applies `content` when given — the reviewer may have adjusted the suggestion before accepting it — and what was submitted otherwise. Send `render` alongside it, as the editor does on any other save: the markdown pipeline lives in the client. Without it the server renders the page itself, which needs the Puppeteer extension. The page is re-indexed as it would be for any other edit, with the reviewer recorded as the author, and the suggestion is closed out.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            submissionId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'submissionId']
        },
        body: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'What to write to the page. Defaults to the suggestion as submitted.'
            },
            render: {
              type: 'string',
              description:
                'The HTML for that content. Omitting it makes the server render the page, which needs the Puppeteer extension.'
            }
          }
        },
        response: {
          200: {
            description: 'Suggestion approved',
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
      const actor = actorFrom(req)
      if (!actor) {
        return reply.unauthorized()
      }
      const submission = await WIKI.models.approvals.getSubmissionForReview(
        req.params.siteId,
        req.params.submissionId,
        reviewerFor(req)
      )
      if (!submission) {
        return reply.notFound('This edit suggestion does not exist.')
      }

      const applied = await WIKI.models.approvals.approveSubmission({
        siteId: req.params.siteId,
        submissionId: req.params.submissionId,
        content: req.body.content ?? submission.content,
        render: req.body.render,
        actor
      })
      if (!applied) {
        return reply.notFound('This edit suggestion does not exist.')
      }
      return {
        ok: true,
        message: 'Edit suggestion approved.'
      }
    }
  )

  /**
   * REJECT A SUGGESTION
   */
  app.post<{ Params: { siteId: string; submissionId: string } }>(
    '/sites/:siteId/approvals/submissions/:submissionId/reject',
    {
      schema: {
        summary: 'Decline an edit suggestion',
        description: 'Discards the suggestion. The page is left exactly as it is.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            submissionId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'submissionId']
        },
        response: {
          200: {
            description: 'Suggestion declined',
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
      const submission = await WIKI.models.approvals.getSubmissionForReview(
        req.params.siteId,
        req.params.submissionId,
        reviewerFor(req)
      )
      if (!submission) {
        return reply.notFound('This edit suggestion does not exist.')
      }
      await WIKI.models.approvals.rejectSubmission(req.params.siteId, req.params.submissionId)
      return {
        ok: true,
        message: 'Edit suggestion declined.'
      }
    }
  )

  /**
   * GET OWN SUGGESTION STATE FOR A PAGE
   *
   * Deliberately not permission-gated: whether somebody may suggest an edit is decided by the site's
   * approval rules and the groups they are in, and for an anonymous reader those are the guests
   * group's. A route permission would answer 401 before any of that could be considered.
   */
  app.get<{
    Params: { siteId: string; pageId: string }
    Querystring: { withContent?: boolean }
  }>(
    '/sites/:siteId/pages/:pageId/suggestions/self',
    {
      schema: {
        summary: 'Whether the caller may suggest edits to a page, and what they already suggested',
        description:
          "Answers `canSubmit: false` for a page no enabled rule opens to this reader, which is what hides the button. With `withContent`, also returns the source the editor should open with: the caller's own pending suggestion when they have one, so that they carry on where they left off, otherwise the page as it stands. The source is only ever included when `canSubmit` holds.",
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            pageId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'pageId']
        },
        querystring: {
          type: 'object',
          properties: {
            withContent: { type: 'boolean', default: false }
          }
        },
        response: {
          200: {
            description: 'Suggestion state for the caller',
            type: 'object',
            properties: {
              canSubmit: { type: 'boolean' },
              isGuest: {
                type: 'boolean',
                description:
                  'True when nobody is logged in, in which case submitting has to carry a name and an email address.'
              },
              submission: {
                type: ['object', 'null'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              },
              content: {
                type: 'string',
                description: 'Only present with `withContent`, and only when `canSubmit` holds.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const page = await loadSuggestablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }

      const actor = actorFrom(req)
      const groupIds = WIKI.models.approvals.getActorGroupIds(req)
      const pageRef: ApprovalPageRef = { id: page.id, path: page.path, tags: page.tags ?? [] }
      const rule = await WIKI.models.approvals.findSubmitRule(req.params.siteId, pageRef, groupIds)
      if (!rule) {
        return { canSubmit: false, isGuest: !actor, submission: null }
      }

      const submission = await WIKI.models.approvals.getOwnSubmission(page.id, actor?.id ?? null)
      return {
        canSubmit: true,
        isGuest: !actor,
        submission: submission ? { id: submission.id, updatedAt: submission.updatedAt } : null,
        ...(req.query.withContent
          ? { content: submission ? submission.content : (page.content ?? '') }
          : {})
      }
    }
  )

  /**
   * SUBMIT AN EDIT SUGGESTION FOR A PAGE
   */
  app.put<{
    Params: { siteId: string; pageId: string }
    Body: { content: string; guestName?: string; guestEmail?: string }
  }>(
    '/sites/:siteId/pages/:pageId/suggestions/self',
    {
      schema: {
        summary: 'Submit an edit suggestion for a page',
        description:
          'Stores the suggested source together with a patch against the page as it stands, so that suggestions to different parts of a page can each be accepted later. A logged in author has one open suggestion per page and submitting again replaces it. An anonymous submitter has no account to attribute it to and has to give a name and an email address instead.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            pageId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'pageId']
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string' },
            guestName: { type: 'string', maxLength: 255 },
            guestEmail: { type: 'string', maxLength: 255 }
          }
        },
        response: {
          200: {
            description: 'Suggestion submitted successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              submission: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const page = await loadSuggestablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }

      const actor = actorFrom(req)
      const groupIds = WIKI.models.approvals.getActorGroupIds(req)
      const pageRef: ApprovalPageRef = { id: page.id, path: page.path, tags: page.tags ?? [] }
      const rule = await WIKI.models.approvals.findSubmitRule(req.params.siteId, pageRef, groupIds)
      if (!rule) {
        return reply.forbidden('This page does not accept edit suggestions from you.')
      }

      const guestName = (req.body.guestName ?? '').trim()
      const guestEmail = (req.body.guestEmail ?? '').trim()
      if (!actor) {
        // -> Nothing else records who this came from, and a reviewer has to be able to answer whoever
        //    sent it
        if (guestName.length < 1) {
          throw new CustomError('suggestionGuestNameMissing', 'A name is required.')
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
          throw new CustomError('suggestionGuestEmailInvalid', 'A valid email address is required.')
        }
      }

      const submission = await WIKI.models.approvals.saveSubmission({
        siteId: req.params.siteId,
        page: pageRef,
        baseContent: page.content ?? '',
        content: req.body.content,
        authorId: actor?.id ?? null,
        guestName,
        guestEmail
      })

      return {
        ok: true,
        submission: { id: submission.id, updatedAt: submission.updatedAt }
      }
    }
  )
}

export default routes
