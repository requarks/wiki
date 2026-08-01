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
export interface ApprovalPageRef {
  id: string
  path: string
  tags: string[]
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
 * Approvals model
 *
 * Only the rules for now: which pages accept edit suggestions, from whom, and who reviews them. The
 * submissions themselves are a separate concern and are not stored yet.
 */
class Approvals {
  /**
   * Every rule configured for a site, by name.
   *
   * Order carries no meaning — a page is covered if any enabled rule matches it — so the list is
   * sorted for the reader: alphabetically, ignoring case, since `Zoo` sorting before `apple` is not
   * what alphabetical means to anyone. Two rules sharing a name keep a stable order by age.
   */
  async getRules(siteId: string): Promise<ApprovalRule[]> {
    return WIKI.db
      .select(ruleSelection)
      .from(approvalRulesTable)
      .where(eq(approvalRulesTable.siteId, siteId))
      .orderBy(
        asc(sql`lower(${approvalRulesTable.name})`),
        asc(approvalRulesTable.createdAt)
      ) as Promise<ApprovalRule[]>
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
        path: patch.path ?? '',
        submitterGroups: patch.submitterGroups ?? [],
        reviewerGroups: patch.reviewerGroups ?? []
      })
      .returning(ruleSelection)
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
        values[key] = patch[key]
      }
    }

    const rows = await WIKI.db
      .update(approvalRulesTable)
      .set(values)
      .where(and(eq(approvalRulesTable.siteId, siteId), eq(approvalRulesTable.id, id)))
      .returning(ruleSelection)
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
  matchesPage(rule: ApprovalRule, page: ApprovalPageRef): boolean {
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
   * @returns The first matching rule, or null when the page takes no suggestions from them
   */
  async findSubmitRule(
    siteId: string,
    page: ApprovalPageRef,
    groupIds: string[]
  ): Promise<ApprovalRule | null> {
    if (groupIds.length < 1) {
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
    { groupIds, isAdmin = false }: { groupIds: string[]; isAdmin?: boolean }
  ): Promise<ReviewableSubmission[]> {
    if (!isAdmin && groupIds.length < 1) {
      return []
    }
    const rules = (await this.getRules(siteId)).filter(
      (rule) =>
        rule.isEnabled && (isAdmin || rule.reviewerGroups.some((id) => groupIds.includes(id)))
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
      .where(eq(submissionsTable.siteId, siteId))
      .orderBy(asc(submissionsTable.createdAt))

    // -> Matched in memory rather than in SQL: a rule can be a regular expression or a set of tags,
    //    which no `WHERE` clause here could express, and a review queue is small
    return rows
      .filter((row: any) =>
        rules.some((rule) =>
          this.matchesPage(rule, { id: row.pageId, path: row.pagePath, tags: row.pageTags ?? [] })
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
    { groupIds, isAdmin = false }: { groupIds: string[]; isAdmin?: boolean }
  ): Promise<ReviewableSubmissionDetail | null> {
    // -> Reuses the queue rather than re-deriving who may see what: one definition of reviewable
    const reviewable = await this.getReviewableSubmissions(siteId, { groupIds, isAdmin })
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
    return (result.rowCount ?? 0) > 0
  }
}

export const approvals = new Approvals()
