import NodeCache from 'node-cache'
import { and, asc, eq, inArray, lte, min, sql } from 'drizzle-orm'
import {
  notifications as notificationsTable,
  sites as sitesTable,
  userNotificationPrefs as prefsTable,
  users as usersTable
} from '../db/schema.ts'
import { locales } from '../models/locales.ts'
import { mail } from '../models/mail.ts'
import type { MailNotificationEntry, MailSite } from '../models/mail.ts'
import { NOTIFICATION_CATEGORIES, isCategoryKey } from './index.ts'
import { enqueueOnce } from './queue.ts'
import { createUnsubscribeToken } from './unsubscribe.ts'

/**
 * The mail drain: notifications whose email is due, sent.
 *
 * Runs in a worker thread (`tasks/workers/send-notification-mail.ts`). What is due is decided by one
 * column, `emailAfter`, and nothing else — the cadence (a short window, then quiet until the entry is
 * read) is entirely in how the fan-out sets it, which is what lets an hourly or daily digest be added
 * later as a different `emailAfter` without anything here changing.
 *
 * **One mail per person per site.** A mail names the wiki it comes from and its links use that site's
 * hostname, so a person active on two sites gets two, each of which reads as coming from its own
 * wiki. Everything due for that pair goes into the one mail — a single entry told in full, or a list.
 */

/** Entries listed in one digest; above this it says how many more and links to the inbox. */
const DIGEST_MAX_ENTRIES = 50

/** How many times an email is tried before it is given up on. */
const MAX_ATTEMPTS = 3

/** How long a failed send waits before it is tried again, in seconds. */
const RETRY_DELAY = 600

/**
 * How long a claim on an email lasts, in seconds — longer than any relay takes to accept one, so that
 * only a run that died mid-send ever lets it lapse.
 */
const SEND_LEASE = 600

/** How many recipients one run sends to when nothing is configured. */
const DEFAULT_BATCH_SIZE = 100

interface SiteInfo {
  hostname: string
  isEnabled: boolean
  mailSite: MailSite
}

/** A due entry, with what drawing it in a mail needs. */
interface DueRow {
  id: string
  category: string
  variant: string
  count: number
  pageId: string | null
  commentId: string | null
  data: Record<string, any>
  inApp: boolean
}

/**
 * The sites a run may send for: what the mail calls each, where its links point, and whether its
 * notifications are switched on. Read once per run — a worker has no `WIKI.sites`.
 */
async function loadSites(): Promise<Map<string, SiteInfo>> {
  const rows = await WIKI.db
    .select({ id: sitesTable.id, hostname: sitesTable.hostname, config: sitesTable.config })
    .from(sitesTable)
  return new Map(
    rows.map((row) => {
      const config = (row.config ?? {}) as Record<string, any>
      return [
        row.id,
        {
          hostname: row.hostname,
          isEnabled: config.features?.notifications !== false,
          mailSite: {
            name: config.title || 'Wiki.js',
            primaryLocale: config.locales?.primary || null
          }
        }
      ]
    })
  )
}

/** Where an entry leads, from the site the mail is about. */
function urlOf(baseUrl: string, row: DueRow): string {
  if (row.category === 'reviewRequested' && row.data.submissionId) {
    return `${baseUrl}/_inbox/review/${row.data.submissionId}`
  }
  if (!row.pageId) {
    // -> The page has gone: the inbox still says what it was
    return `${baseUrl}/_inbox`
  }
  const section = NOTIFICATION_CATEGORIES[row.category as keyof typeof NOTIFICATION_CATEGORIES]
  return `${baseUrl}/i/${row.pageId}${section?.section === 'discussions' ? '#talk' : ''}`
}

function entryOf(baseUrl: string, row: DueRow): MailNotificationEntry {
  return {
    category: row.category,
    variant: row.variant,
    count: row.count,
    actorName: row.data.actorName ?? null,
    pageTitle: row.data.page?.title ?? '',
    // -> Only while the comment exists, the same rule the inbox applies
    ...(row.commentId && row.data.excerpt && { excerpt: row.data.excerpt }),
    ...(row.data.origin && { origin: row.data.origin }),
    url: urlOf(baseUrl, row)
  }
}

/**
 * The (user, site) pairs that have something due, oldest first.
 *
 * Not locked: the rows themselves are claimed, one pair at a time, in `claim`. Two instances choosing
 * the same pair is therefore harmless — whichever comes second finds the rows taken and moves on.
 */
async function duePairs(limit: number): Promise<{ userId: string; siteId: string | null }[]> {
  return WIKI.db
    .select({ userId: notificationsTable.userId, siteId: notificationsTable.siteId })
    .from(notificationsTable)
    .where(
      and(
        inArray(notificationsTable.emailState, ['pending', 'sending']),
        lte(notificationsTable.emailAfter, sql`now()`)
      )
    )
    .groupBy(notificationsTable.userId, notificationsTable.siteId)
    .orderBy(asc(min(notificationsTable.emailAfter)))
    .limit(limit)
}

/**
 * Take what is due for one person on one site, so that nobody else sends it.
 *
 * One statement, and no transaction held open across the send: a worker thread has a single database
 * connection (`core/db.ts`), so a transaction kept open while the mail is rendered and sent would
 * leave nothing for the queries that rendering makes — the locale strings, the person's preferences —
 * and the run would wait on itself until the pool aborted it.
 *
 * Claimed rows are marked `sending`, and their `emailAfter` becomes the lease: a run that dies mid-send
 * leaves them `sending` with a lease that runs out, and the next run takes them again, which is what
 * `duePairs` and this both look for. At least once rather than at most once, then: a duplicate
 * notification is the better failure.
 */
async function claim(pair: { userId: string; siteId: string | null }): Promise<DueRow[]> {
  const result = await WIKI.db.execute(sql`
    UPDATE ${notificationsTable}
    SET "emailState" = 'sending', "emailAfter" = now() + make_interval(secs => ${SEND_LEASE})
    WHERE id IN (
      SELECT id FROM ${notificationsTable}
      WHERE "userId" = ${pair.userId}
        AND "siteId" IS NOT DISTINCT FROM ${pair.siteId}
        AND "emailState" IN ('pending', 'sending')
        AND "emailAfter" <= now()
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, category, variant, count, "pageId", "commentId", data, "inApp", "updatedAt"
  `)
  return (result.rows as any[])
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .map((row) => ({
      id: row.id,
      category: row.category,
      variant: row.variant,
      count: row.count,
      pageId: row.pageId,
      commentId: row.commentId,
      data: row.data ?? {},
      inApp: row.inApp
    }))
}

/**
 * The categories, among these, that the user has since turned email off for.
 *
 * Asked again at send time rather than trusted from when the entry was written: somebody who
 * unsubscribes while a mail is waiting should not receive it.
 */
async function emailOffFor(userId: string, categories: string[]): Promise<Set<string>> {
  const stored = await WIKI.db
    .select({ category: prefsTable.category, enabled: prefsTable.enabled })
    .from(prefsTable)
    .where(
      and(
        eq(prefsTable.userId, userId),
        eq(prefsTable.channel, 'email'),
        inArray(prefsTable.category, categories)
      )
    )
  const off = new Set<string>()
  for (const category of categories) {
    const row = stored.find((entry) => entry.category === category)
    const enabled = row
      ? row.enabled
      : isCategoryKey(category) && NOTIFICATION_CATEGORIES[category].defaults.email
    if (!enabled) {
      off.add(category)
    }
  }
  return off
}

/** Give claimed rows up as not to be emailed, saying why in the log. */
async function skip(userId: string, ids: string[], reason: string): Promise<void> {
  if (ids.length < 1) {
    return
  }
  WIKI.logger.debug(`Skipped ${ids.length} notification email(s) for ${userId}: ${reason}`)
  await WIKI.db
    .update(notificationsTable)
    .set({ emailState: 'skipped' })
    .where(inArray(notificationsTable.id, ids))
}

/**
 * Send whatever is due for one person on one site, as one mail.
 *
 * @returns Whether a mail was sent
 */
async function sendTo(
  pair: { userId: string; siteId: string | null },
  sites: Map<string, SiteInfo>
): Promise<boolean> {
  const rows = await claim(pair)
  if (rows.length < 1) {
    return false
  }
  const allIds = rows.map((row) => row.id)

  const [user] = await WIKI.db
    .select({
      email: usersTable.email,
      isActive: usersTable.isActive,
      isVerified: usersTable.isVerified,
      prefs: usersTable.prefs
    })
    .from(usersTable)
    .where(eq(usersTable.id, pair.userId))
  /*
    An entry with no site belongs to no wiki in particular. None of the launch categories writes one;
    when one does, it is sent as coming from the first site, which is as good a guess as any about
    where this person reads.
  */
  const site = pair.siteId ? sites.get(pair.siteId) : sites.values().next().value
  if (!user?.isActive || !user.isVerified) {
    await skip(pair.userId, allIds, 'the account cannot receive mail')
    return false
  }
  if (!site?.isEnabled) {
    await skip(pair.userId, allIds, 'notifications are switched off on the site')
    return false
  }
  const baseUrl = mail.baseUrl({ hostname: site.hostname })
  if (!baseUrl) {
    WIKI.logger.warn(
      'Notification emails cannot be sent for a site with no hostname unless a base URL is set under Admin → Mail.'
    )
    await skip(pair.userId, allIds, 'there is no base URL to build links with')
    return false
  }

  const off = await emailOffFor(pair.userId, [...new Set(rows.map((row) => row.category))])
  await skip(
    pair.userId,
    rows.filter((row) => off.has(row.category)).map((row) => row.id),
    'email was turned off since'
  )
  const sending = rows.filter((row) => !off.has(row.category))
  if (sending.length < 1) {
    return false
  }
  const ids = sending.map((row) => row.id)

  const listed = sending.slice(0, DIGEST_MAX_ENTRIES)
  const categories = [...new Set(sending.map((row) => row.category))]
  const token = createUnsubscribeToken({ userId: pair.userId, categories })
  try {
    await mail.send({
      site: site.mailSite,
      to: user.email,
      template: sending.length > 1 ? 'notificationDigest' : 'notification',
      locale: (user.prefs as Record<string, any>)?.locale,
      data: {
        baseUrl,
        entries: listed.map((row) => entryOf(baseUrl, row)),
        more: sending.length - listed.length,
        manageUrl: `${baseUrl}/_profile/notifications`,
        unsubscribeUrl: `${baseUrl}/_unsubscribe?t=${token}`
      },
      /*
        RFC 8058. The POST is what a mail client sends when somebody presses its own unsubscribe
        button, and it acts at once; a GET of the same URL only redirects to the page that asks,
        because mail scanners fetch every link in a message.
      */
      headers: {
        'List-Unsubscribe': `<${baseUrl}/_api/notifications/unsubscribe?t=${token}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        // -> So that an out-of-office reply is not sent back to the wiki
        'Auto-Submitted': 'auto-generated'
      }
    })
  } catch (err: any) {
    WIKI.logger.warn(`Failed to send a notification email to <${user.email}>: ${err.message}`)
    /*
      Tried again later, up to a limit, rather than given up on at once: a relay that is down for ten
      minutes should not cost everybody the notifications that came due in those ten minutes.
    */
    await WIKI.db
      .update(notificationsTable)
      .set({
        data: sql`jsonb_set(${notificationsTable.data}, '{mailAttempts}', to_jsonb(coalesce((${notificationsTable.data} ->> 'mailAttempts')::int, 0) + 1))`,
        emailState: sql`CASE WHEN coalesce((${notificationsTable.data} ->> 'mailAttempts')::int, 0) + 1 >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END`,
        emailAfter: sql`now() + make_interval(secs => ${RETRY_DELAY})`
      })
      .where(inArray(notificationsTable.id, ids))
    return false
  }

  /*
    Sent. An entry the inbox does not show is closed as well: there is nowhere for it to be read, and
    while it stayed unread it would keep absorbing events without ever emailing about them again.
  */
  await WIKI.db
    .update(notificationsTable)
    .set({
      emailState: 'sent',
      emailedAt: sql`now()`,
      readAt: sql`CASE WHEN ${notificationsTable.inApp} THEN ${notificationsTable.readAt} ELSE now() END`
    })
    .where(inArray(notificationsTable.id, ids))
  return true
}

/**
 * Send everything that is due, as far as the run is allowed to go, then ask for the next run at the
 * moment the next email comes due.
 */
export async function sendPendingMail(signal: AbortSignal): Promise<void> {
  if (!mail.isConfigured) {
    // -> Nothing is written as pending while mail is not configured, so this is only what was
    //    waiting when it was switched off. It waits on: configuring mail again sends it
    return
  }
  /*
    A fresh cache each run, for the translator. A worker thread outlives many runs and never hears the
    `reloadLocales` event the request process does, so a cache it kept would go on writing mails from
    whatever strings were installed when the thread started.
  */
  WIKI.cache = new NodeCache({ checkperiod: 0 })
  await locales.getLocales()
  const sites = await loadSites()
  const batchSize = Number(WIKI.config.notifications?.mailBatchSize) || DEFAULT_BATCH_SIZE

  /*
    One pass over a batch of recipients, not a loop until nothing is left: a pair another instance is
    in the middle of sending stays due until it is done, and a loop would keep finding it. Whatever is
    still due afterwards is the next run's — asked for below.
  */
  let sent = 0
  for (const pair of await duePairs(batchSize)) {
    if (signal.aborted) {
      break
    }
    try {
      if (await sendTo(pair, sites)) {
        sent++
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to process notification emails for ${pair.userId}: ${err.message}`)
    }
  }
  if (sent > 0) {
    WIKI.logger.info(`Sent ${sent} notification email(s).`)
  }

  const [next] = await WIKI.db
    .select({ at: min(notificationsTable.emailAfter) })
    .from(notificationsTable)
    .where(inArray(notificationsTable.emailState, ['pending', 'sending']))
  if (next?.at) {
    await enqueueOnce('sendNotificationMail', new Date(next.at))
  }
}
