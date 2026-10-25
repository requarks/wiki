import { and, asc, eq, notInArray, sql } from 'drizzle-orm'
import {
  comments as commentsTable,
  pageLifecycleRules as rulesTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'
import { CustomError, isValidPathSegment, normalizeNewPagePath } from '../helpers/common.ts'
import type { AccessActor } from './groups.ts'
import type { PageActor } from './pages.ts'

/**
 * What starts a rule, counted in days:
 *
 * - `contentAge` — since the page's body last changed, or since it was last marked reviewed
 * - `commentAge` — since its last comment (its creation, if it has none), or since its last review
 * - `interval` — every so many days, from the rule's creation and then from its last firing
 */
export const LIFECYCLE_TRIGGERS = ['contentAge', 'commentAge', 'interval'] as const
export type LifecycleTrigger = (typeof LIFECYCLE_TRIGGERS)[number]

export const LIFECYCLE_ACTION_KINDS = ['banner', 'notify', 'move', 'tags', 'remove'] as const

/**
 * `remove` is the rule deleting itself once it has fired `after` times, counting the firing that
 * carries it out — so `after: 1` is a rule that acts once and is gone.
 */
export type LifecycleAction =
  | { kind: 'banner'; message: string; icon: string }
  | { kind: 'notify' }
  | { kind: 'move'; path: string }
  | { kind: 'tags'; tags: string[] }
  | { kind: 'remove'; after: number }

/** The most firings a `remove` action may wait for. */
export const MAX_REMOVE_AFTER = 1000

/** In a move action's path, the last segment of the page's path as it stands when the rule fires. */
export const PAGE_PATH_NAME_PLACEHOLDER = '{pagePathName}'

/**
 * And the whole of that path, so that `/archived/{pagePath}` files the page under `archived` with
 * its folders kept. Not a prefix of the one above: the closing brace tells them apart.
 */
export const PAGE_PATH_PLACEHOLDER = '{pagePath}'

/** The most rules one page may carry. */
export const MAX_LIFECYCLE_RULES = 20

/** The longest trigger anybody can set: ten years. */
export const MAX_TRIGGER_DAYS = 3650

/** A rule as it is written, by the properties panel. No `id` means a new one. */
export interface LifecycleRuleInput {
  id?: string | null
  name: string
  trigger: LifecycleTrigger
  triggerDays: number
  actions: LifecycleAction[]
}

export interface LifecycleOutcome {
  status: 'applied' | 'skipped' | 'failed'
  message: string
  at: string
}

/** A rule as it is stored and read back. */
export interface LifecycleRule extends LifecycleRuleInput {
  id: string
  authorId: string | null
  authorName: string | null
  createdAt: Date
  updatedAt: Date
  lastFiredAt: Date | null
  fireCount: number
  lastOutcome: LifecycleOutcome | null
}

/** What `pages.lifecycleBanner` holds. */
export interface LifecycleBanner {
  message: string
  icon: string
  ruleId: string
  setAt: string
}

/** A rule due to be looked at by the daily run, with what its trigger is counted from. */
interface DueCandidate {
  rule: typeof rulesTable.$inferSelect
  siteId: string
  pageCreatedAt: Date
  contentUpdatedAt: Date
  lastReviewedAt: Date | null
  lastCommentAt: Date | null
}

const DAY_HOURS = 24

function latest(...dates: (Date | null | undefined)[]): Temporal.Instant {
  return dates
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.toTemporalInstant())
    .reduce((a, b) => (Temporal.Instant.compare(a, b) >= 0 ? a : b))
}

/**
 * Whether a rule is due, at `now`.
 *
 * The two "days since" triggers fire once each time their clock runs out: having fired after the
 * moment they count from, they wait for that moment to move — an edit, a comment, a review — rather
 * than firing again every day the page stays as it is. `interval` has no such moment and simply
 * counts from its own last firing.
 */
export function isDue(candidate: DueCandidate, now: Temporal.Instant): boolean {
  const { rule } = candidate
  const anchor =
    rule.trigger === 'interval'
      ? latest(rule.lastFiredAt ?? rule.createdAt)
      : rule.trigger === 'commentAge'
        ? latest(candidate.lastCommentAt ?? candidate.pageCreatedAt, candidate.lastReviewedAt)
        : latest(candidate.contentUpdatedAt, candidate.lastReviewedAt)
  const dueAt = anchor.add({ hours: rule.triggerDays * DAY_HOURS })
  if (Temporal.Instant.compare(now, dueAt) < 0) {
    return false
  }
  if (rule.trigger === 'interval' || !rule.lastFiredAt) {
    return true
  }
  return Temporal.Instant.compare(rule.lastFiredAt.toTemporalInstant(), anchor) < 0
}

/** Two rules say the same thing, which is what decides whether saving one makes its saver its author. */
function sameRule(a: LifecycleRuleInput, b: LifecycleRuleInput): boolean {
  return (
    a.name === b.name &&
    a.trigger === b.trigger &&
    a.triggerDays === b.triggerDays &&
    JSON.stringify(a.actions) === JSON.stringify(b.actions)
  )
}

/**
 * Page lifecycle model
 *
 * The rules a page carries about growing old, and the daily run that acts on them. Rules are not
 * page content (see `pageLifecycleRules`), and neither is what they leave behind on the page — the
 * banner and the review date are columns a version never records.
 */
class PageLifecycle {
  /** A page's rules, oldest first, with the name of whoever last wrote each. */
  async rulesOf(pageId: string): Promise<LifecycleRule[]> {
    const rows = await WIKI.db
      .select({ rule: rulesTable, authorName: usersTable.name })
      .from(rulesTable)
      .leftJoin(usersTable, eq(usersTable.id, rulesTable.authorId))
      .where(eq(rulesTable.pageId, pageId))
      .orderBy(asc(rulesTable.createdAt), asc(rulesTable.id))
    return rows.map(({ rule, authorName }) => ({
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger as LifecycleTrigger,
      triggerDays: rule.triggerDays,
      actions: rule.actions as LifecycleAction[],
      authorId: rule.authorId,
      authorName: authorName ?? null,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      lastFiredAt: rule.lastFiredAt,
      fireCount: rule.fireCount,
      lastOutcome: (rule.lastOutcome as LifecycleOutcome | null) ?? null
    }))
  }

  /**
   * Where a move action takes a page that is at `pagePath` now.
   *
   * @throws CustomError when what the template makes is not a path a page could have
   */
  destinationOf(template: string, pagePath: string): string {
    /*
      A page already filed under what comes before `{pagePath}` has been moved by this rule before:
      moving it again would nest it one more `archived/` deep every time the rule fired. So it stays
      where it is, which the caller reads as nothing to do.
    */
    if (template.includes(PAGE_PATH_PLACEHOLDER)) {
      const [lead = ''] = template.split(PAGE_PATH_PLACEHOLDER)
      const prefix = normalizeNewPagePath(lead.replace(/^\/+/, '')).replace(/\/+$/, '')
      if (prefix && pagePath.startsWith(`${prefix}/`)) {
        return pagePath
      }
    }
    const pathName = pagePath.split('/').at(-1) ?? ''
    const path = normalizeNewPagePath(
      template
        .replaceAll(PAGE_PATH_NAME_PLACEHOLDER, pathName)
        .replaceAll(PAGE_PATH_PLACEHOLDER, pagePath)
        .replace(/^\/+/, '')
    )
    if (!path || !path.split('/').every(isValidPathSegment)) {
      throw new CustomError(
        'lifecycleInvalidPath',
        'A move action must lead to a valid page path: letters, numbers, hyphens and slashes.'
      )
    }
    return path
  }

  /**
   * A rule as the panel sent it, tidied and checked: one action of each kind at most, at least one
   * action, and every value inside what a rule can hold.
   */
  normalize(input: LifecycleRuleInput, pagePath: string): LifecycleRuleInput {
    const name = input.name.trim()
    if (!name) {
      throw new CustomError('lifecycleNameMissing', 'A lifecycle rule needs a name.')
    }
    const kinds = input.actions.map((action) => action.kind)
    if (kinds.length < 1) {
      throw new CustomError('lifecycleNoAction', `"${name}" needs at least one action.`)
    }
    if (new Set(kinds).size !== kinds.length) {
      throw new CustomError('lifecycleDuplicateAction', `"${name}" names the same action twice.`)
    }
    // -> A rule whose only action is deleting itself would count down to nothing and then go
    if (kinds.every((kind) => kind === 'remove')) {
      throw new CustomError(
        'lifecycleOnlyRemove',
        `"${name}" needs an action besides removing itself.`
      )
    }
    const actions = input.actions.map((action): LifecycleAction => {
      switch (action.kind) {
        case 'banner': {
          const message = (action.message ?? '').trim()
          if (!message) {
            throw new CustomError(
              'lifecycleBannerEmpty',
              `The banner of "${name}" needs a message.`
            )
          }
          return { kind: 'banner', message, icon: (action.icon ?? '').trim() }
        }
        case 'move': {
          const path = (action.path ?? '').trim()
          // -> Checked now, against the page as it is, so a template that can never work is refused
          //    to its author instead of failing quietly a few months from now
          this.destinationOf(path, pagePath)
          return { kind: 'move', path }
        }
        case 'tags': {
          const tags = [...new Set((action.tags ?? []).map((tag) => tag.trim()).filter(Boolean))]
          if (tags.length < 1) {
            throw new CustomError('lifecycleTagsEmpty', `"${name}" applies no tags.`)
          }
          return { kind: 'tags', tags }
        }
        case 'remove': {
          const after = action.after ?? 1
          if (!Number.isInteger(after) || after < 1 || after > MAX_REMOVE_AFTER) {
            throw new CustomError(
              'lifecycleRemoveAfterInvalid',
              `"${name}" must be removed after 1 to ${MAX_REMOVE_AFTER} triggers.`
            )
          }
          return { kind: 'remove', after }
        }
        default:
          return { kind: 'notify' }
      }
    })
    return {
      id: input.id ?? null,
      name,
      trigger: input.trigger,
      triggerDays: input.triggerDays,
      actions
    }
  }

  /**
   * Which of these rules are new or say something different from what is stored — the ones whose
   * saver becomes their author, and whose actions the route therefore has to check the saver may
   * take.
   */
  async changedRules(pageId: string, inputs: LifecycleRuleInput[]): Promise<LifecycleRuleInput[]> {
    const stored = new Map((await this.rulesOf(pageId)).map((rule) => [rule.id, rule]))
    return inputs.filter((input) => {
      const current = input.id ? stored.get(input.id) : undefined
      return !current || !sameRule(input, current)
    })
  }

  /**
   * Replace a page's rules with these, already normalized.
   *
   * By id: a rule left out is deleted, a rule that says something new is rewritten with its saver as
   * its author, and a rule that is unchanged is not touched at all — its author, and when it last
   * fired, stay as they were. An id this page does not have is a new rule, given an id of its own.
   *
   * A banner whose rule this save removes, or stops putting one up, is taken down with it: nothing
   * would ever explain it, and nobody could tell which rule to change to stop it coming back.
   */
  async replaceRules(
    page: { id: string; lifecycleBanner: LifecycleBanner | null },
    inputs: LifecycleRuleInput[],
    actorId: string
  ): Promise<LifecycleRule[]> {
    if (inputs.length > MAX_LIFECYCLE_RULES) {
      throw new CustomError(
        'lifecycleTooManyRules',
        `A page may have at most ${MAX_LIFECYCLE_RULES} lifecycle rules.`
      )
    }
    const banners = inputs.filter((input) => input.actions.some((a) => a.kind === 'banner'))
    if (banners.length > 1) {
      throw new CustomError(
        'lifecycleBannerTaken',
        'Only one lifecycle rule on a page may show a banner.'
      )
    }

    const bannerRuleId = page.lifecycleBanner?.ruleId
    let hadBannerRule = false
    await WIKI.db.transaction(async (tx) => {
      // -> Two saves of one page's rules at once queue on the page row rather than interleave
      await tx
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(eq(pagesTable.id, page.id))
        .for('update')
      const stored = await tx.select().from(rulesTable).where(eq(rulesTable.pageId, page.id))
      const storedById = new Map(stored.map((rule) => [rule.id, rule]))
      hadBannerRule = Boolean(bannerRuleId && storedById.has(bannerRuleId))
      const kept = inputs.filter((input) => input.id && storedById.has(input.id))

      await tx.delete(rulesTable).where(
        and(
          eq(rulesTable.pageId, page.id),
          kept.length > 0
            ? notInArray(
                rulesTable.id,
                kept.map((input) => input.id!)
              )
            : undefined
        )
      )
      for (const input of inputs) {
        const current = input.id ? storedById.get(input.id) : undefined
        const fields = {
          name: input.name,
          trigger: input.trigger,
          triggerDays: input.triggerDays,
          actions: input.actions,
          authorId: actorId,
          updatedAt: new Date()
        }
        if (!current) {
          await tx.insert(rulesTable).values({ ...fields, pageId: page.id })
        } else if (
          !sameRule(input, {
            name: current.name,
            trigger: current.trigger as LifecycleTrigger,
            triggerDays: current.triggerDays,
            actions: current.actions as LifecycleAction[]
          })
        ) {
          await tx.update(rulesTable).set(fields).where(eq(rulesTable.id, current.id))
        }
      }
    })

    const rules = await this.rulesOf(page.id)
    /*
      Only when it is THIS save that took the rule away or its banner off. A banner can outlive its
      rule on purpose -- a rule that removes itself after firing leaves the banner it put up -- and
      such a banner is for a review to take down, not for the next unrelated edit of the rules.
    */
    if (
      hadBannerRule &&
      !rules.some(
        (rule) => rule.id === bannerRuleId && rule.actions.some((a) => a.kind === 'banner')
      )
    ) {
      await this.setBanner(page.id, null)
    }
    return rules
  }

  /**
   * Somebody has looked the page over: it is still accurate, or they have just made it so. Takes the
   * banner down and restarts every "days since" clock from now.
   */
  async markReviewed(pageId: string): Promise<void> {
    await WIKI.db
      .update(pagesTable)
      .set({ lastReviewedAt: sql`now()`, lifecycleBanner: null })
      .where(eq(pagesTable.id, pageId))
  }

  /** Put a banner up, or take it down. Moves neither `updatedAt` nor anything a version records. */
  async setBanner(pageId: string, banner: LifecycleBanner | null): Promise<void> {
    await WIKI.db
      .update(pagesTable)
      .set({ lifecycleBanner: banner })
      .where(eq(pagesTable.id, pageId))
  }

  // == THE DAILY RUN ==================

  /**
   * Fire every rule that is due, on every site. Once a day, off `SYSTEM_SCHEDULE`.
   *
   * Rules are looked at one at a time and each re-reads its page before acting, because a rule that
   * moved a page has changed what the next rule on it would see.
   */
  async runDue({ signal }: { signal?: AbortSignal } = {}): Promise<{
    checked: number
    fired: number
  }> {
    const rows: DueCandidate[] = await WIKI.db
      .select({
        rule: rulesTable,
        siteId: pagesTable.siteId,
        pageCreatedAt: pagesTable.createdAt,
        contentUpdatedAt: pagesTable.contentUpdatedAt,
        lastReviewedAt: pagesTable.lastReviewedAt,
        lastCommentAt:
          sql<Date | null>`(SELECT max(c."createdAt") FROM ${commentsTable} c WHERE c."pageId" = ${pagesTable.id} AND c."deletedAt" IS NULL)`.mapWith(
            commentsTable.createdAt
          )
      })
      .from(rulesTable)
      .innerJoin(pagesTable, eq(pagesTable.id, rulesTable.pageId))
      .orderBy(asc(rulesTable.pageId), asc(rulesTable.createdAt))

    const now = Temporal.Now.instant()
    let fired = 0
    for (const candidate of rows) {
      if (signal?.aborted) {
        WIKI.logger.warn('Lifecycle rules: stopped before every rule was looked at.')
        break
      }
      if (!isDue(candidate, now)) {
        continue
      }
      await this.fire(candidate.rule, candidate.siteId)
      fired++
    }
    return { checked: rows.length, fired }
  }

  /**
   * Carry out one rule's actions, as its author — or, when that account is gone or disabled, as the
   * wiki's own longest-standing administrator — and record how it went on the rule.
   *
   * Tags, then the banner, then the move, then the notification: the owners are told last, so the
   * link they get is to where the page now is. One action failing does not stop the others.
   */
  async fire(rule: typeof rulesTable.$inferSelect, siteId: string): Promise<LifecycleOutcome> {
    const notes: string[] = []
    let status: LifecycleOutcome['status'] = 'applied'
    const fail = (message: string) => {
      status = 'failed'
      notes.push(message)
    }
    const skip = (message: string) => {
      if (status === 'applied') {
        status = 'skipped'
      }
      notes.push(message)
    }

    const actors = await this.actorsFor(rule.authorId)
    const actions = rule.actions as LifecycleAction[]
    const reason = `Lifecycle rule: ${rule.name}`.slice(0, 255)
    const mayAt = (permission: string, ref: { path: string; locale: string; tags: string[] }) =>
      actors !== null &&
      WIKI.models.groups.checkAccess(actors.access, permission, { siteId, ...ref })

    if (!actors) {
      fail('Nobody to act as: the author is gone and the wiki has no active administrator.')
    } else {
      for (const action of actions
        .filter((action) => LIFECYCLE_ORDER.includes(action.kind))
        .sort((a, b) => LIFECYCLE_ORDER.indexOf(a.kind) - LIFECYCLE_ORDER.indexOf(b.kind))) {
        const page = await WIKI.models.pages.getPage({ siteId, id: rule.pageId })
        if (!page) {
          fail('The page is gone.')
          break
        }
        try {
          switch (action.kind) {
            case 'tags': {
              const tags = [...new Set([...(page.tags ?? []), ...action.tags])]
              if (tags.length === (page.tags ?? []).length) {
                break
              }
              // -> Asked again now, not only when the rule was saved: the author may have lost it since
              if (!mayAt('write:tags', page) || !mayAt('write:tags', { ...page, tags })) {
                skip('Tags not applied: the author may no longer change tags here.')
                break
              }
              await WIKI.models.pages.updatePage(
                siteId,
                page.id,
                { tags, reasonForChange: reason },
                actors.page
              )
              break
            }
            case 'banner':
              await this.setBanner(page.id, {
                message: action.message,
                icon: action.icon,
                ruleId: rule.id,
                setAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' })
              })
              break
            case 'move': {
              const path = this.destinationOf(action.path, page.path)
              if (path === page.path) {
                break
              }
              const destination = { path, locale: page.locale, tags: page.tags ?? [] }
              if (!mayAt('manage:pages', page) || !mayAt('manage:pages', destination)) {
                skip(`Not moved to /${path}: the author may no longer move this page there.`)
                break
              }
              const taken = await WIKI.db
                .select({ id: pagesTable.id })
                .from(pagesTable)
                .where(
                  and(
                    eq(pagesTable.siteId, siteId),
                    eq(pagesTable.locale, page.locale),
                    eq(pagesTable.path, path)
                  )
                )
                .limit(1)
              if (taken.length > 0) {
                skip(`Not moved: a page already exists at /${path}.`)
                break
              }
              await WIKI.models.pages.movePage(siteId, page.id, { path }, actors.page)
              await WIKI.models.pages.relinkMovedPage(
                siteId,
                page.id,
                { locale: page.locale, path: page.path },
                actors.page,
                (ref) => WIKI.models.groups.checkAccess(actors.access, 'write:pages', ref)
              )
              notes.push(`Moved to /${path}.`)
              break
            }
            case 'notify':
              await WIKI.models.notifications.emit('page:lifecycle', {
                siteId,
                actorId: null,
                data: {
                  variant: 'triggered',
                  page: WIKI.models.notifications.pageSnapshot(page),
                  excerpt: rule.name
                }
              })
              break
          }
        } catch (err: any) {
          fail(`${action.kind}: ${err.message}`)
        }
      }
    }

    const outcome: LifecycleOutcome = {
      status,
      message: notes.join(' '),
      at: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' })
    }
    const [counted] = await WIKI.db
      .update(rulesTable)
      .set({
        lastFiredAt: sql`now()`,
        lastOutcome: outcome,
        fireCount: sql`${rulesTable.fireCount} + 1`
      })
      .where(eq(rulesTable.id, rule.id))
      .returning({ fireCount: rulesTable.fireCount })

    /*
      Last, once everything else has been done and recorded: a rule that removes itself after this
      firing has still done what it fires for. Every firing counts, whatever came of it -- it is the
      trigger that is being counted, not the success of the actions.
    */
    const remove = actions.find((action) => action.kind === 'remove')
    let removed = false
    if (remove && counted && counted.fireCount >= remove.after) {
      await WIKI.db.delete(rulesTable).where(eq(rulesTable.id, rule.id))
      removed = true
    }

    const log = `Lifecycle rule ${rule.id} on page ${rule.pageId}: ${status}${outcome.message ? ` — ${outcome.message}` : ''}${removed ? ' (rule removed)' : ''}`
    if (outcome.status === 'failed') {
      WIKI.logger.warn(log)
    } else {
      WIKI.logger.info(log)
    }
    return outcome
  }

  /**
   * Who a rule acts as: its author while their account is active, else the system actor. Both the
   * actor a page save takes and the one a page rule is asked about.
   */
  private async actorsFor(
    authorId: string | null
  ): Promise<{ page: PageActor; access: AccessActor } | null> {
    let userId = authorId
    if (userId) {
      const active = await WIKI.db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, userId), eq(usersTable.isActive, true)))
        .limit(1)
      userId = active.length > 0 ? userId : null
    }
    userId ??= await WIKI.models.users.getSystemActorId()
    if (!userId) {
      return null
    }
    const access = await WIKI.models.groups.actorForUser(userId)
    return { page: { id: userId, permissions: access.permissions }, access }
  }
}

/** The actions a firing carries out, in order. `remove` is not one: it is settled after them. */
const LIFECYCLE_ORDER: LifecycleAction['kind'][] = ['tags', 'banner', 'move', 'notify']

export const pageLifecycle = new PageLifecycle()
