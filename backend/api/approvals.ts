import { CustomError } from '../helpers/common.ts'
import { actorFrom, mayBypassPassword, mayOnPage, unlockedFor } from './pages.ts'
import type { ApprovalPageRef, ApprovalRulePatch, ReviewerScope } from '../models/approvals.ts'
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
  const page = await WIKI.models.pages.getPage({
    siteId,
    id: pageId,
    withContent: true,
    publicOnly: !actor,
    unlocked: (id: string) => unlockedFor(req, id),
    withPassword: mayBypassPassword(req)
  })
  /*
    Reading the page comes first, for suggesting an edit to it and for reviewing one alike: neither is
    something to be done to a page the caller may not see, and answering as though it were not there
    is how every other page-scoped route treats that.
  */
  if (!page || !mayOnPage(req, 'read:pages', page)) {
    return null
  }
  return page
}

/**
 * Who is reviewing, as the approval rules see them: the groups on their session, plus whether they
 * review everything regardless of which groups a rule names.
 *
 * Two different kinds of rule meet here. An APPROVAL rule says which pages take suggestions and who
 * reviews them; a group's PAGE rules say what a member may do to a page, `review:pages` among them.
 * Holding that permission is the second way of being a reviewer, because reviewing is the entire
 * content of it — a group granted it and named in no approval rule could otherwise review nothing.
 *
 * Page permissions are per page, so `reviewsAll` is answered for a page when there is one. Without
 * one — the site-wide queue in the inbox — it is answered at the site root, which is the only thing
 * a queue spanning every page could ask about; the per-page check then still applies to each entry
 * through the approval rules that produced it.
 *
 * Nobody reviews anything without an account. A guest is treated as a member of the guests group,
 * which is right for SUBMITTING — anonymous suggestions are a feature — but a review is an act with
 * an author: accepting one writes the page and records who accepted it. So a rule that named the
 * guests group among its reviewers, or a page rule granting them `review:pages`, would otherwise hand
 * the queue to the public. An empty scope reviews nothing, whatever the rules say.
 */
function reviewerFor(req: FastifyRequest, page?: { path: string; tags?: string[] }): ReviewerScope {
  if (!isReviewerSession(req)) {
    return { groupIds: [], reviewsAll: false }
  }
  const actor = WIKI.models.groups.actorForRequest(req)
  return {
    groupIds: WIKI.models.approvals.getActorGroupIds(req),
    reviewsAll:
      actor.permissions.includes('manage:system') ||
      WIKI.models.groups.checkAccess(actor, 'review:pages', page ?? { path: '' })
  }
}

/** Shorthand for the model's own check; see `isReviewerSession` there for why reviewing needs one. */
function isReviewerSession(req: FastifyRequest): boolean {
  return WIKI.models.approvals.isReviewerSession(req)
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
  /*
    Empty is only meaningful for `START`, where it is every path and therefore the whole site -- which
    is how a rule covers a site without naming a folder.

    Every other mode still needs something. An empty `EXACT` matches no page at all; an empty `END` or
    `REGEX` matches every one of them, but by accident of the operator rather than by intent, and a
    rule whose reach nobody meant to write is exactly what this refuses.
  */
  if (match !== 'START' && (!path || path.trim().length < 1)) {
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
          'Applies `content` when given — the reviewer may have adjusted the suggestion before accepting it — and what was submitted otherwise. Send `render` alongside it, as the editor does on any other save: the markdown pipeline lives in the client. Without it the server queues the page for rendering, which needs the Puppeteer extension and answers 503 without it; the page then serves its previous HTML until the queue reaches it. The page is re-indexed as it would be for any other edit, with the reviewer recorded as the author, and the suggestion is closed out.',
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
   * PENDING SUBMISSIONS FOR A PAGE
   */
  app.get<{ Params: { siteId: string; pageId: string } }>(
    '/sites/:siteId/pages/:pageId/submissions',
    {
      /*
        No route-level `permissions`: those are page permissions, granted by a group's rules rather
        than group-wide. `canReview` below is the real answer, and an ineligible caller gets `false`
        rather than a refusal — the button simply does not appear.
      */
      schema: {
        summary: "Edit suggestions waiting on a page, for that page's reviewers",
        description:
          'What the review button on a page view is drawn from. `canReview` says whether this caller reviews this page at all — an enabled rule covers it and either names one of their groups or they hold `review:pages` or `manage:system` — and is what decides whether the button is shown; `submissions` is what is waiting, oldest first, and is empty for everybody else.\n\nA reviewer with an empty queue still gets `canReview: true`: the button belongs to the page, not to whatever happens to be pending on it.',
        tags: ['Approvals'],
        params: {
          type: 'object',
          properties: {
            siteId: { type: 'string', format: 'uuid' },
            pageId: { type: 'string', format: 'uuid' }
          },
          required: ['siteId', 'pageId']
        },
        response: {
          200: {
            description: 'Whether the caller reviews this page, and what is waiting on it',
            type: 'object',
            properties: {
              canReview: { type: 'boolean' },
              submissions: {
                type: 'array',
                items: { $ref: 'PageEditSubmission#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      /*
        Answered before the page is even looked up. Every reader loading any page asks this, so the
        one case that can be settled from the session alone is settled there: a guest reviews nothing,
        and the wiki has no reason to read a page and a rule set to say so again on every page view.
      */
      if (!isReviewerSession(req)) {
        return { canReview: false, submissions: [] }
      }
      const page = await loadSuggestablePage(req, req.params.siteId, req.params.pageId)
      if (!page) {
        return reply.notFound('This page does not exist.')
      }

      const scope = reviewerFor(req, { path: page.path, tags: page.tags ?? [] })
      const canReview = await WIKI.models.approvals.canReviewPage(
        req.params.siteId,
        { path: page.path, tags: page.tags ?? [] },
        scope
      )
      if (!canReview) {
        return { canReview: false, submissions: [] }
      }
      return {
        canReview: true,
        submissions: await WIKI.models.approvals.getReviewableSubmissions(req.params.siteId, {
          ...scope,
          pageId: req.params.pageId
        })
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
      const pageRef: ApprovalPageRef = {
        id: page.id,
        path: page.path,
        tags: page.tags ?? [],
        allowContributions: page.allowContributions
      }
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
      const pageRef: ApprovalPageRef = {
        id: page.id,
        path: page.path,
        tags: page.tags ?? [],
        allowContributions: page.allowContributions
      }
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
