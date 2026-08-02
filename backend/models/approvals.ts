import { createHash } from 'node:crypto'
import { createPatch } from 'diff'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import {
  approvalRules as approvalRulesTable,
  groups as groupsTable,
  pageEditSubmissions as submissionsTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'

/**
 * How a rule decides which pages it covers. The same set group page rules use, so an administrator
 * writing one has learnt the other.
 */
export const approvalMatchModes = ['START', 'EXACT', 'END', 'REGEX', 'TAG', 'TAGALL'] as const

export type ApprovalMatchMode = (typeof approvalMatchModes)[number]

/** The part of a page a rule is matched against. */
/** What a rule is matched against: where the page is, and what it is tagged with. */
export interface ApprovalPageMatch {
  path: string
  tags: string[]
}

export interface ApprovalPageRef extends ApprovalPageMatch {
  id: string
  /**
   * The page's own switch, from its properties. A page with contributions turned off takes no
   * suggestions whatever the rules say — which is how a single page is exempted without writing a
   * rule around it.
   */
  allowContributions: boolean
}

/**
 * Who is reviewing, as the rules see them.
 *
 * `reviewsAll` covers the two ways of being a reviewer without a rule naming your group: the
 * `manage:system` permission, which sees everything everywhere, and `review:pages`, which is granted
 * to review pages and would be worth nothing if it could not. Neither widens WHICH pages take
 * suggestions -- a page still needs a rule -- only who may answer them.
 */
export interface ReviewerScope {
  groupIds: string[]
  reviewsAll?: boolean
}

/** An edit suggested against a page, as the author's own view of it. */
export interface PageEditSubmission {
  id: string
  content: string
  baseHash: string
  createdAt: Date
  updatedAt: Date
}

/** A submission as a reviewer sees it in their queue. */
export interface ReviewableSubmission {
  id: string
  createdAt: Date
  updatedAt: Date
  /** Whether the page has changed since the suggestion was made against it. */
  isStale: boolean
  page: {
    id: string
    path: string
    title: string
    locale: string
  }
  author: {
    /** Null for a guest, who has no account to point at. */
    id: string | null
    name: string
    email: string
    isGuest: boolean
  }
}

/** A submission opened for review, with everything the diff needs. */
export interface ReviewableSubmissionDetail extends ReviewableSubmission {
  /** What the suggestion proposes the page should say. */
  content: string
  /** What it currently says, i.e. the other side of the diff. */
  pageContent: string
  /** Unified diff against the page as it stood when the suggestion was made. */
  patch: string
}

/** An approval rule as the API exposes it. */
export interface ApprovalRule {
  id: string
  name: string
  isEnabled: boolean
  match: ApprovalMatchMode
  path: string
  /** IDs of the groups whose members may submit edit suggestions for a matching page. */
  submitterGroups: string[]
  /** IDs of the groups that review those submissions, and are notified of new ones. */
  reviewerGroups: string[]
  createdAt: Date
  updatedAt: Date
}

/** The fields a rule is created or updated with. */
export interface ApprovalRulePatch {
  name?: string
  isEnabled?: boolean
  match?: ApprovalMatchMode
  path?: string
  submitterGroups?: string[]
  reviewerGroups?: string[]
}

/**
 * The tags of a tag-mode rule, as they are written into the one pattern field: comma-separated, and
 * compared in lower case the way page tags are stored.
 */
function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
}

const ruleSelection = {
  id: approvalRulesTable.id,
  name: approvalRulesTable.name,
  isEnabled: approvalRulesTable.isEnabled,
  match: approvalRulesTable.match,
  path: approvalRulesTable.path,
  submitterGroups: approvalRulesTable.submitterGroups,
  reviewerGroups: approvalRulesTable.reviewerGroups,
  createdAt: approvalRulesTable.createdAt,
  updatedAt: approvalRulesTable.updatedAt
}

/**
 * Every site's rules, by site id, in the order `getRules` promises.
 *
 * Cached for the reason the group rules are (`models/groups.ts`): whether a page takes suggestions
 * and who reviews it are questions the page view asks about every page it draws, and answering them
 * from the database would put two queries in front of every page read. Rules change from one admin
 * screen, and the cache is reloaded there.
 *
 * A single instance's memory, like the group and site caches beside it: a rule changed on one node of
 * a cluster reaches the others when they next reload.
 */
let rulesCache: Record<string, ApprovalRule[]> = {}

/**
 * Approvals model
 *
 * Only the rules for now: which pages accept edit suggestions, from whom, and who reviews them. The
 * submissions themselves are a separate concern and are not stored yet.
 */
class Approvals {
  /**
   * Reload every site's rules into memory.
   *
   * Called at boot and after any change to a rule, so that an administrator's edit takes effect on the
   * next request — the same contract `models/groups.ts` gives page rules.
   */
  async reloadCache(): Promise<void> {
    const rows = (await WIKI.db
      .select({ ...ruleSelection, siteId: approvalRulesTable.siteId })
      .from(approvalRulesTable)
      .orderBy(
        asc(sql`lower(${approvalRulesTable.name})`),
        asc(approvalRulesTable.createdAt)
      )) as (ApprovalRule & { siteId: string })[]
    rulesCache = {}
    for (const { siteId, ...rule } of rows) {
      rulesCache[siteId] ??= []
      rulesCache[siteId].push(rule as ApprovalRule)
    }
    WIKI.logger.info(`Loaded ${rows.length} approval rules [ OK ]`)
  }

  /**
   * Every rule configured for a site, by name.
   *
   * Order carries no meaning — a page is covered if any enabled rule matches it — so the list is
   * sorted for the reader: alphabetically, ignoring case, since `Zoo` sorting before `apple` is not
   * what alphabetical means to anyone. Two rules sharing a name keep a stable order by age.
   *
   * From `rulesCache`, so this costs nothing to ask; async because every caller awaits it and because
   * where the rules come from is this model's business. The array is the cached one — read it, do not
   * sort or splice it.
   */
  async getRules(siteId: string): Promise<ApprovalRule[]> {
    return rulesCache[siteId] ?? []
  }

  /**
   * A single rule, scoped to its site so that an ID from another site cannot be reached through it.
   *
   * @returns The rule, or null if this site has no such rule
   */
  async getRule(siteId: string, id: string): Promise<ApprovalRule | null> {
    const rows = await WIKI.db
      .select(ruleSelection)
      .from(approvalRulesTable)
      .where(and(eq(approvalRulesTable.siteId, siteId), eq(approvalRulesTable.id, id)))
      .limit(1)
    return (rows[0] as ApprovalRule) ?? null
  }

  /**
   * The IDs among those given that are not groups on this instance.
   *
   * A picker only offers real groups, so a miss means a stale client or a group deleted mid-edit —
   * worth reporting rather than storing an ID that resolves to nobody.
   */
  async getUnknownGroupIds(groupIds: string[]): Promise<string[]> {
    const wanted = [...new Set(groupIds)]
    if (wanted.length < 1) {
      return []
    }
    const found = await WIKI.db
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .where(inArray(groupsTable.id, wanted))
    const foundIds = new Set(found.map((g: any) => g.id))
    return wanted.filter((id) => !foundIds.has(id))
  }

  /**
   * Create a rule for a site.
   *
   * @returns The rule as stored
   */
  async createRule(siteId: string, patch: ApprovalRulePatch): Promise<ApprovalRule> {
    const rows = await WIKI.db
      .insert(approvalRulesTable)
      .values({
        siteId,
        name: patch.name ?? '',
        isEnabled: patch.isEnabled ?? true,
        match: patch.match ?? 'START',
        // -> Trimmed, so a pattern typed with a stray space still matches what it reads as -- and so
        //    that a `START` path of nothing but spaces is the whole site rather than a rule that
        //    quietly covers no page at all
        path: (patch.path ?? '').trim(),
        submitterGroups: patch.submitterGroups ?? [],
        reviewerGroups: patch.reviewerGroups ?? []
      })
      .returning(ruleSelection)
    // -> Every rule read afterwards comes from the cache, so it has to know about this one
    await this.reloadCache()
    return rows[0] as ApprovalRule
  }

  /**
   * Update a rule, leaving out fields alone.
   *
   * @returns The updated rule, or null if this site has no such rule
   */
  async updateRule(
    siteId: string,
    id: string,
    patch: ApprovalRulePatch
  ): Promise<ApprovalRule | null> {
    const values: Record<string, any> = { updatedAt: new Date() }
    for (const key of [
      'name',
      'isEnabled',
      'match',
      'path',
      'submitterGroups',
      'reviewerGroups'
    ] as const) {
      if (patch[key] !== undefined) {
        // -> Trimmed for the same reason it is on create
        values[key] = key === 'path' ? String(patch[key]).trim() : patch[key]
      }
    }

    const rows = await WIKI.db
      .update(approvalRulesTable)
      .set(values)
      .where(and(eq(approvalRulesTable.siteId, siteId), eq(approvalRulesTable.id, id)))
      .returning(ruleSelection)
    await this.reloadCache()
    return (rows[0] as ApprovalRule) ?? null
  }

  /**
   * Whether a rule covers a page.
   *
   * Paths are compared without a leading slash on either side, which is how they are stored and how
   * the rule is written. A regular expression that will not compile matches nothing rather than
   * throwing: the rule is already refused at the API, so this is only reached by one that was valid
   * when it was written and stopped being so.
   */
  matchesPage(rule: ApprovalRule, page: ApprovalPageMatch): boolean {
    const pagePath = page.path.replace(/^\/+/, '')
    const rulePath = rule.path.replace(/^\/+/, '')
    switch (rule.match) {
      case 'START':
        return pagePath.startsWith(rulePath)
      case 'EXACT':
        return pagePath === rulePath
      case 'END':
        return pagePath.endsWith(rulePath)
      case 'REGEX':
        try {
          return new RegExp(rulePath).test(pagePath)
        } catch {
          return false
        }
      case 'TAG':
        return parseTags(rule.path).some((tag) => page.tags.includes(tag))
      case 'TAGALL': {
        const wanted = parseTags(rule.path)
        return wanted.length > 0 && wanted.every((tag) => page.tags.includes(tag))
      }
      default:
        return false
    }
  }

  /**
   * The groups an actor belongs to, as the rules see them.
   *
   * A request with no session is not nobody: it is the guests group, and a rule naming that group is
   * how an administrator opens suggestions to anyone reading the site. Taken from the fixed ID in the
   * configuration rather than by reading the guest account's membership — that account's groups cannot
   * be changed, and the ID of the account itself only exists while an instance is being seeded.
   */
  getActorGroupIds(req: any): string[] {
    if (req.session?.authenticated && req.session.user?.id) {
      return req.session.groups ?? []
    }
    return [WIKI.data.systemIds.guestsGroupId]
  }

  /**
   * The enabled rule that lets these groups suggest an edit to this page, if there is one.
   *
   * The page's own `allowContributions` is a veto rather than another condition to match: a rule says
   * which pages MAY take suggestions, and turning the switch off on one page says that this one does
   * not — no rule has to be rewritten, narrowed or excluded around it.
   *
   * Everything asking whether a page takes a suggestion asks this, which is why the check lives here
   * rather than at either route.
   *
   * @returns The first matching rule, or null when the page takes no suggestions from them
   */
  async findSubmitRule(
    siteId: string,
    page: ApprovalPageRef,
    groupIds: string[]
  ): Promise<ApprovalRule | null> {
    if (groupIds.length < 1 || !page.allowContributions) {
      return null
    }
    const rules = await this.getRules(siteId)
    return (
      rules.find(
        (rule) =>
          rule.isEnabled &&
          rule.submitterGroups.some((id) => groupIds.includes(id)) &&
          this.matchesPage(rule, page)
      ) ?? null
    )
  }

  /**
   * Whether this reviewer has any business reviewing this page at all.
   *
   * What decides whether the page view offers a review button, so it is about the page rather than
   * about what happens to be waiting on it: a reviewer of a page with an empty queue is still its
   * reviewer. A page no rule covers takes no suggestions, so nobody reviews it -- not even an
   * administrator, who would only be offered a button that could never have anything behind it.
   */
  async canReviewPage(
    siteId: string,
    page: ApprovalPageMatch,
    { groupIds, reviewsAll = false }: ReviewerScope
  ): Promise<boolean> {
    if (!reviewsAll && groupIds.length < 1) {
      return false
    }
    const rules = await this.getRules(siteId)
    return rules.some(
      (rule) =>
        rule.isEnabled &&
        (reviewsAll || rule.reviewerGroups.some((id) => groupIds.includes(id))) &&
        this.matchesPage(rule, page)
    )
  }

  /**
   * Whether this request could review anything at all, i.e. it is a logged in user.
   *
   * Reads the session and nothing else, so a guest can be turned away before a single query is made on
   * their behalf. A guest counts as a member of the guests group everywhere else, which is right for
   * SUBMITTING — anonymous suggestions are a feature — but a review is an act with an author.
   */
  isReviewerSession(req: any): boolean {
    return Boolean(req.session?.authenticated && req.session.user?.id)
  }

  /**
   * Where this reader stands on this page: may they suggest an edit to it, and do they review it.
   *
   * Answered here, in one place, because it is answered on EVERY page view — the page route carries it
   * back with the page rather than leaving the browser to ask two more questions about a page it has
   * just been given. The cost is kept to what is actually needed: the rules are in memory, and neither
   * of the two queries below is reached by a reader the rules say nothing about.
   *
   * @param req The request, for its session; both answers are about who is asking
   */
  async pageViewerState(
    req: any,
    siteId: string,
    page: ApprovalPageRef
  ): Promise<{
    canSuggestEdits: boolean
    hasOpenSuggestion: boolean
    canReview: boolean
    pendingSubmissions: ReviewableSubmission[]
  }> {
    const actorId = req.session?.authenticated ? (req.session.user?.id ?? null) : null
    const groupIds = this.getActorGroupIds(req)

    const submitRule = await this.findSubmitRule(siteId, page, groupIds)
    /*
      Only a logged in author can have one waiting: a guest suggestion is attributed to nobody, so
      there is nothing to look up and nothing to carry on from. `getOwnSubmission` says the same, and
      this keeps the query from being made at all.
    */
    const hasOpenSuggestion = Boolean(
      submitRule && actorId && (await this.getOwnSubmission(page.id, actorId))
    )

    const reviewerScope = this.isReviewerSession(req)
      ? {
          groupIds,
          reviewsAll:
            (req.session?.permissions ?? []).includes('manage:system') ||
            WIKI.models.groups.checkAccess(
              WIKI.models.groups.actorForRequest(req),
              'review:pages',
              {
                path: page.path,
                tags: page.tags
              }
            )
        }
      : { groupIds: [], reviewsAll: false }
    const canReview = await this.canReviewPage(siteId, page, reviewerScope)

    return {
      canSuggestEdits: Boolean(submitRule),
      hasOpenSuggestion,
      canReview,
      pendingSubmissions: canReview
        ? await this.getReviewableSubmissions(siteId, { ...reviewerScope, pageId: page.id })
        : []
    }
  }

  /**
   * The suggestion this user already has open on this page, if any.
   *
   * Guests get null whoever they are: there is no account to look one up by, so every guest
   * suggestion is a new one.
   */
  async getOwnSubmission(
    pageId: string,
    authorId: string | null
  ): Promise<PageEditSubmission | null> {
    if (!authorId) {
      return null
    }
    const rows = await WIKI.db
      .select({
        id: submissionsTable.id,
        content: submissionsTable.content,
        baseHash: submissionsTable.baseHash,
        createdAt: submissionsTable.createdAt,
        updatedAt: submissionsTable.updatedAt
      })
      .from(submissionsTable)
      .where(and(eq(submissionsTable.pageId, pageId), eq(submissionsTable.authorId, authorId)))
      .limit(1)
    return (rows[0] as PageEditSubmission) ?? null
  }

  /**
   * Store an edit somebody has suggested for a page.
   *
   * The patch is taken against the page as it stands right now, which is what makes two suggestions to
   * different parts of the same page both applicable later. A logged in author has one open suggestion
   * per page and this replaces it; a guest has no identity to match on, so each submission is its own.
   *
   * @param baseContent The page source the suggestion was made against
   * @returns The stored suggestion
   */
  async saveSubmission({
    siteId,
    page,
    baseContent,
    content,
    authorId,
    guestName,
    guestEmail
  }: {
    siteId: string
    page: ApprovalPageRef
    baseContent: string
    content: string
    authorId: string | null
    guestName?: string
    guestEmail?: string
  }): Promise<PageEditSubmission> {
    const values = {
      siteId,
      pageId: page.id,
      authorId,
      content,
      patch: createPatch(page.path, baseContent, content),
      baseHash: createHash('sha256').update(baseContent).digest('hex'),
      guestName: authorId ? null : (guestName ?? ''),
      guestEmail: authorId ? null : (guestEmail ?? ''),
      updatedAt: new Date()
    }

    const rows = authorId
      ? await WIKI.db
          .insert(submissionsTable)
          .values(values)
          .onConflictDoUpdate({
            target: [submissionsTable.pageId, submissionsTable.authorId],
            // -> Matches the partial index, which only covers rows with an author
            targetWhere: sql`"authorId" IS NOT NULL`,
            set: {
              content: values.content,
              patch: values.patch,
              baseHash: values.baseHash,
              updatedAt: values.updatedAt
            }
          })
          .returning()
      : await WIKI.db.insert(submissionsTable).values(values).returning()

    const stored = rows[0]
    WIKI.logger.debug(
      `Stored an edit suggestion for page ${page.id} from ${authorId ?? `guest <${guestEmail}>`}`
    )
    return {
      id: stored.id,
      content: stored.content,
      baseHash: stored.baseHash,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt
    }
  }

  /**
   * How many suggestions are waiting on a page. Counted for every reviewer, whoever wrote them.
   */
  async countSubmissions(pageId: string): Promise<number> {
    return WIKI.db.$count(submissionsTable, eq(submissionsTable.pageId, pageId))
  }

  /**
   * Every suggestion waiting on this reviewer, oldest first.
   *
   * A suggestion is theirs to review when an enabled rule covers its page and names a group they are
   * in — the same rules that let it be submitted, read from the other side. Someone holding
   * `manage:system` sees the site's whole queue, as they do everywhere else.
   *
   * Ordered oldest first because a queue is worked through in the order things arrived.
   */
  async getReviewableSubmissions(
    siteId: string,
    { groupIds, reviewsAll = false, pageId }: ReviewerScope & { pageId?: string }
  ): Promise<ReviewableSubmission[]> {
    if (!reviewsAll && groupIds.length < 1) {
      return []
    }
    const rules = (await this.getRules(siteId)).filter(
      (rule) =>
        rule.isEnabled && (reviewsAll || rule.reviewerGroups.some((id) => groupIds.includes(id)))
    )
    if (rules.length < 1) {
      return []
    }

    const rows = await WIKI.db
      .select({
        id: submissionsTable.id,
        baseHash: submissionsTable.baseHash,
        guestName: submissionsTable.guestName,
        guestEmail: submissionsTable.guestEmail,
        createdAt: submissionsTable.createdAt,
        updatedAt: submissionsTable.updatedAt,
        pageId: pagesTable.id,
        pagePath: pagesTable.path,
        pageTitle: pagesTable.title,
        pageLocale: pagesTable.locale,
        pageTags: pagesTable.tags,
        pageContent: pagesTable.content,
        authorId: usersTable.id,
        authorName: usersTable.name,
        authorEmail: usersTable.email
      })
      .from(submissionsTable)
      .innerJoin(pagesTable, eq(pagesTable.id, submissionsTable.pageId))
      .leftJoin(usersTable, eq(usersTable.id, submissionsTable.authorId))
      .where(
        pageId
          ? and(eq(submissionsTable.siteId, siteId), eq(submissionsTable.pageId, pageId))
          : eq(submissionsTable.siteId, siteId)
      )
      .orderBy(asc(submissionsTable.createdAt))

    // -> Matched in memory rather than in SQL: a rule can be a regular expression or a set of tags,
    //    which no `WHERE` clause here could express, and a review queue is small
    return rows
      .filter((row: any) =>
        rules.some((rule) =>
          /*
            No `allowContributions` here, deliberately: that switch governs whether a suggestion may
            be MADE. One already sent stays in its reviewers' queue if the page is later closed to
            contributions -- otherwise turning the switch off would silently strand work somebody had
            submitted in good faith, with nobody able to accept or decline it.
          */
          this.matchesPage(rule, { path: row.pagePath, tags: row.pageTags ?? [] })
        )
      )
      .map((row: any) => this.toReviewable(row))
  }

  /**
   * One submission, if it is this reviewer's to look at, with both sides of the diff.
   *
   * @returns The submission, or null when it does not exist or is not theirs to review
   */
  async getSubmissionForReview(
    siteId: string,
    submissionId: string,
    { groupIds, reviewsAll = false }: ReviewerScope
  ): Promise<ReviewableSubmissionDetail | null> {
    // -> Reuses the queue rather than re-deriving who may see what: one definition of reviewable
    const reviewable = await this.getReviewableSubmissions(siteId, { groupIds, reviewsAll })
    if (!reviewable.some((s) => s.id === submissionId)) {
      return null
    }

    const rows = await WIKI.db
      .select({
        content: submissionsTable.content,
        patch: submissionsTable.patch,
        pageContent: pagesTable.content
      })
      .from(submissionsTable)
      .innerJoin(pagesTable, eq(pagesTable.id, submissionsTable.pageId))
      .where(eq(submissionsTable.id, submissionId))
      .limit(1)
    const detail = rows[0]
    if (!detail) {
      return null
    }

    return {
      ...reviewable.find((s) => s.id === submissionId)!,
      content: detail.content,
      pageContent: detail.pageContent ?? '',
      patch: detail.patch
    }
  }

  /**
   * Accept a suggestion: write it to the page and close the suggestion out.
   *
   * The content applied is whatever the reviewer settled on, which is not necessarily what was
   * submitted — the review screen lets them adjust it before accepting. It is written as an ordinary
   * page edit, so the render, the search index and the page hooks all happen the way they do for any
   * other save, with the reviewer recorded as the author: they are the one putting it on the page, and
   * a guest submitter has no account to attribute it to.
   *
   * @returns False when there is no such submission
   */
  async approveSubmission({
    siteId,
    submissionId,
    content,
    render,
    actor
  }: {
    siteId: string
    submissionId: string
    content: string
    /** The rendered HTML. Rendered here instead when the caller has none, which needs an extension. */
    render?: string
    actor: { id: string; permissions: string[] }
  }): Promise<boolean> {
    const rows = await WIKI.db
      .select({ id: submissionsTable.id, pageId: submissionsTable.pageId })
      .from(submissionsTable)
      .where(and(eq(submissionsTable.id, submissionId), eq(submissionsTable.siteId, siteId)))
      .limit(1)
    const submission = rows[0]
    if (!submission) {
      return false
    }

    const page = await WIKI.models.pages.getPage({
      siteId,
      id: submission.pageId,
      withContent: true
    })
    if (!page) {
      return false
    }

    /*
      The render has to move with the content, or the page keeps serving HTML that no longer matches
      its source. The markdown pipeline lives in the frontend, so the reviewer's browser produces it
      the same way the editor does on any other save, and it arrives with the approval.

      Falling back to the server-side renderer covers an API client that has no pipeline of its own.
      That one needs the Puppeteer extension and says so if it is missing, which is the honest answer:
      the alternative is quietly leaving a stale render on a page somebody just changed.
    */
    const config = WIKI.sites[siteId]?.config?.editors?.[page.editor]?.config ?? {}
    const html =
      render ??
      (await WIKI.models.rendering.renderContent(content, {
        editor: page.editor,
        config
      }))
    await WIKI.models.pages.updatePage(siteId, page.id, { content, render: html }, actor)

    await WIKI.db.delete(submissionsTable).where(eq(submissionsTable.id, submissionId))
    WIKI.logger.debug(`Approved edit suggestion ${submissionId} onto page ${page.id}`)
    return true
  }

  /**
   * Decline a suggestion, which discards it. The page is untouched.
   *
   * @returns False when there is no such submission
   */
  async rejectSubmission(siteId: string, submissionId: string): Promise<boolean> {
    const result = await WIKI.db
      .delete(submissionsTable)
      .where(and(eq(submissionsTable.id, submissionId), eq(submissionsTable.siteId, siteId)))
    return (result.rowCount ?? 0) > 0
  }

  /** One joined row, as the review queue presents it. */
  toReviewable(row: any): ReviewableSubmission {
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // -> The page has moved on since this was written, so accepting it wholesale would undo whatever
      //    changed in between. The reviewer is shown the current page as the other side of the diff
      //    either way; this is what tells them to look closely.
      isStale:
        createHash('sha256')
          .update(row.pageContent ?? '')
          .digest('hex') !== row.baseHash,
      page: {
        id: row.pageId,
        path: row.pagePath,
        title: row.pageTitle,
        locale: row.pageLocale
      },
      author: {
        id: row.authorId ?? null,
        name: row.authorName ?? row.guestName ?? '',
        email: row.authorEmail ?? row.guestEmail ?? '',
        isGuest: !row.authorId
      }
    }
  }

  /**
   * Delete a rule.
   *
   * @returns Whether a rule was deleted
   */
  async deleteRule(siteId: string, id: string): Promise<boolean> {
    const result = await WIKI.db
      .delete(approvalRulesTable)
      .where(and(eq(approvalRulesTable.siteId, siteId), eq(approvalRulesTable.id, id)))
    await this.reloadCache()
    return (result.rowCount ?? 0) > 0
  }
}

export const approvals = new Approvals()
