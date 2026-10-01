# Notifications

**Status:** a proposal. Nothing here is implemented yet. What already exists and is built on (page
watching, the inbox shell, the disabled Profile entry) is listed in [§2](#2-what-exists-today). Table,
column, route and file names are proposals until the first phase lands.
**Covers:** what a user is notified about, how they choose which notifications they get and how,
how an event becomes an inbox entry and an email without slowing the request that caused it, and
how new kinds of notification are added later.

A wiki already tells you a great deal if you go looking for it: the watch list, the review queue,
the Talk tab. What it does not do is *come and find you*. This document is about that half: being
told that a page you watch has changed, that someone answered you, that a suggestion is waiting for
your review.

The constraints this is written against:

- **A notification never tells anyone more than they could have found out for themselves.** Every
  recipient is checked against the permission that would let them see the thing they are told
  about, *at the time they are told*.
- **The request that caused an event does one write, and nothing else.** Working out who to tell,
  checking each person's access, and talking to an SMTP server all happen in worker threads,
  however many people end up being notified.
- **A new kind of notification is one file, one emit call and its strings.** The admin-facing ones
  that are coming (registrations, failed logins, a failed git sync) must not need a second system.

---

## 1. Goals and non-goals

**Goals**

- **Seven categories at launch** ([§4.2](#42-the-launch-categories)), five on by default and two
  opt-in.
- **Per-user, per-category choice of channel**: Email, In-App, both or neither, from **Profile →
  Notifications**. One set of preferences per user, not one per site.
- **Scales with the instance**: the cost of an event is roughly proportional to the number of
  people who actually receive it, not to the number of accounts on the wiki.
- **Coalescing**: a page saved forty times in an afternoon does not produce forty inbox entries.
- **RFC 8058 one-click unsubscribe** on every notification email. This is a hard requirement.
- **A per-site switch** that turns notifications off for a site.
- **Polling now, push later**, without the push work having to change anything polling relies on.

**Non-goals**

- **Live push in the first version.** [§9.3](#93-adding-push-later) says how it attaches.
- **Hourly and daily digest emails in the first version.** They are expected to follow, and
  [§10.5](#105-leaving-room-for-hourly-and-daily-digests) is what the first version does to make
  them additive.
- **Other channels** (browser Web Push, Slack DMs, Matrix). The preference model leaves room for
  them ([§5](#5-preferences)), but none is planned.
- **Third-party comment providers.** Disqus, Giscus and the rest keep their discussions in somebody
  else's service. Only the built-in provider produces comment events.
- **Notifying guests.** A notification needs an account to belong to.
- **Notifying anyone of their own actions.** The actor of an event is never one of its recipients.

---

## 2. What exists today

| Piece | Where | State |
| ----- | ----- | ----- |
| Page watching | `db/schema.ts` → `pageWatching`, `models/pageWatching.ts`, `api/watching.ts` | Done. One row per (page, user), carrying the site. The comments in that code already expect "whatever delivers the news later" to read it. **Rows cascade away when the page is deleted**, which matters for [§6.3](#63-deletion-snapshot-the-watchers-first) |
| Watch button and list | the bell in the page header, `pages/InboxWatching.vue` | Done |
| Inbox shell | `layouts/InboxLayout.vue`, `/_inbox/messages` → `pages/InboxMessages.vue` | Placeholder, reading "Nothing here yet" |
| Review deep link | `/_inbox/review/:submissionId?` | Done. Its route comment anticipates a notification linking to it |
| Profile entry | `layouts/ProfileLayout.vue`, key `notifications` | Present but `disabled: true`, and has no route |
| Header button | `components/HeaderNav.vue`, `mdi:inbox-full` → `/_inbox` | Present, with no badge |
| Strings | `locales/en.json` → `profile.notifications`, `inbox.*` | `inbox.title` already reads "Inbox & Notifications" |

What it is built from:

| Piece | Where | Used for |
| ----- | ----- | -------- |
| Webhook emit | `models/hooks.ts` → `emit()` | The contract to copy: called from the models, never throws, and does no delivery inline. Every `hooks.emit` call site is a candidate notification emit site |
| Scheduler and workers | `core/scheduler.ts`, `worker.ts`, `tasks/workers/` | Fan-out and mail both run as worker tasks. `dispatch-webhook.ts` is the model for a worker task that imports its own models |
| Page rules | `helpers/pageRules.ts` → `resolvePageRule`, `models/groups.ts` → `checkAccess` | Pure and in memory. The answer depends only on a user's *set of groups*, which is what makes bulk access checks cheap ([§7.2](#72-access-is-checked-per-group-set-not-per-user)) |
| Approval rules | `models/approvals.ts` → `matchesPage`, `reviewerGroups` | Who reviews a page |
| Mentions | `models/comments.ts` → `resolveMentions` | Turns `@handle` text into users with one query |
| Mail | `models/mail.ts`, `locales.translator()` | Templates, two bodies (HTML and text), locale fallback |
| Import scope | `storage.importingFrom()` (AsyncLocalStorage) | Tells an import or a git pull apart from a person's edit ([§6.2](#62-origin)) |
| Form bodies | `@fastify/formbody`, registered in `index.ts` | The one-click unsubscribe POST is `application/x-www-form-urlencoded` |

---

## 3. Architecture

```
 request path                  worker: fan-out                  worker: mail drain
 ────────────                  ───────────────                  ──────────────────
 notifications.emit()  ──►  notificationEvents  ──►  notifications            ──►  SMTP
   one INSERT, never          (outbox; claimed       one row per recipient         one mail per user
   throws; a debounced        with SKIP LOCKED)      per coalescing key, with      per drain, single
   job kick                                          in-app and email state        or digest
                                                            │
                                                            └──►  GET /notifications/summary  ◄── polling
                                                                  (push attaches here later, §9.3)
```

Three tables and two worker tasks. This is deliberately **not** one scheduler job per recipient,
or even one per event. Every job costs a `jobs` row and a `jobHistory` row. On a busy wiki one job
per page save is thousands of rows a day before anyone has been notified, and one job per recipient
is that multiplied by the audience. Instead, the outbox is drained in batches, and the job is only
the thing that wakes the drain up.

### 3.1 Where the code lives

| Path | What |
| ---- | ---- |
| `backend/notifications/index.ts` | The category registry: `NOTIFICATION_CATEGORIES`, the `NotificationCategory` type, lookup by event |
| `backend/notifications/categories/<key>.ts` | One file per category ([§4.1](#41-a-category-is-a-file)) |
| `backend/models/notifications.ts` | `emit()`, preferences, inbox queries, the unsubscribe token, settings |
| `backend/api/notifications.ts` | Inbox, summary, preferences, unsubscribe, admin settings |
| `backend/tasks/workers/dispatch-notifications.ts` | Fan-out ([§7](#7-fan-out)) |
| `backend/tasks/workers/send-notification-mail.ts` | Mail drain ([§10](#10-email)) |
| `backend/tasks/simple/purge-notifications.ts` | Retention ([§12.3](#123-purging)) |

`notifications/` is a new top-level backend directory rather than a directory under `modules/`:
`refreshFromDisk` expects every directory there to hold a `definition.yml`. A category is code, not
an installable module, and there is nothing to discover from disk.

---

## 4. Categories

### 4.1 A category is a file

```ts
export interface NotificationCategory<E extends NotificationEventKind = NotificationEventKind> {
  key: string                        // 'watchedPage', also the preference key and the i18n key
  events: readonly E[]               // which emitted events it reacts to
  scope: 'site' | 'instance'         // see §11; every launch category is 'site'
  origins: readonly EventOrigin[]    // which origins it fires for, see §6.2
  defaults: { inApp: boolean; email: boolean }
  priority: number                   // higher wins when one event reaches a user twice, §7.4
  visibleTo(actor: AccessActor): boolean      // shown in Profile → Notifications?
  recipients(event, ctx): AsyncIterable<string[]>  // candidate user IDs, in batches
  accessCheck: string | null         // page permission each recipient must hold NOW
  groupKey(event): string            // the coalescing key, §8.3
  variant(event): string             // which message: 'edited', 'moved', 'deleted', ...
  snapshot(event): Record<string, unknown>  // what the entry displays, §8.2
}
```

`NOTIFICATION_CATEGORIES` is a closed `as const` list, the same pattern as `AUDIT_ACTIONS`, so
`npm run typecheck` refuses a key that does not exist. Each key is also its translation prefix
(`notifications.categories.<key>.*`), so adding a category means adding its strings too.

`recipients` returns **candidates**. Removing the actor, checking access, applying preferences and
deduplicating are done once by the fan-out for every category ([§7](#7-fan-out)), so a category
cannot get any of them wrong.

### 4.2 The launch categories

| Key | Reacts to | Candidates | Must hold now | Default | Coalesces on | Origins |
| --- | --------- | ---------- | ------------- | ------- | ------------ | ------- |
| `watchedPage` | `page:edit`, `page:rename`, `page:delete` | the page's watchers | `read:pages` | in-app ✓ email ✓ | `watchedPage:<pageId>` | all |
| `reviewRequested` | `submission:new`, `submission:update` | members of the reviewer groups of every enabled rule matching the page | none ([§4.3](#43-reviewers)) | ✓ ✓ | `review:<submissionId>` | user |
| `watchedPageComment` | `comment:new` | the page's watchers | `read:comments` | ✓ ✓ | `watchedComment:<pageId>` | user |
| `commentReply` | `comment:new` with a parent | the author of the parent comment, if it has an account | `read:comments` | ✓ ✓ | `reply:<parentId>` | user |
| `mention` | `comment:new`, `comment:edit` | users whose handle is written in the comment (on an edit, only handles that were not there before) | `read:comments` | ✓ ✓ | `mention:<commentId>` | user |
| `pageCreated` | `page:create` | users who opted in | `read:pages` | ✗ ✗ | `pageCreated:<pageId>` | user |
| `pageDeleted` | `page:delete` | users who opted in | `read:pages`, against the page as it was | ✗ ✗ | `pageDeleted:<pageId>` | user |

**`watchedPage` variants.** `edited`, `moved` (path or locale changed, which is what `page:rename`
is), `published`, `unpublished`, `scheduled` (the publish window was set or changed), and `deleted`.
A publish-state change is a variant of an edit, worked out by comparing the old and new
`publishState`, `publishStartDate` and `publishEndDate` in `updatePage`. A coalesced entry
([§8.3](#83-coalescing-and-idempotency-are-the-same-index)) records every variant it has absorbed, so
"edited 4 times and moved" can be said.

**Email defaults apply only where email can be sent.** On an instance where `mail.isConfigured`
is false, every email preference reads as off and the Profile screen says why
([§5.2](#52-the-profile-screen)).

### 4.3 Reviewers

Only **members of the groups named in `reviewerGroups`** of the enabled rules that match the page
are notified. Holding `review:pages` at the page, or `manage:system`, does not make anyone a
recipient. On a large wiki, every administrator would otherwise receive every suggestion. An
administrator who wants these notifications is placed in a reviewer group like anyone else. (They
can still see and answer the whole queue, as `getReviewableSubmissions` allows today. Only the
notification is narrower.)

No page permission is checked on top of that: the rule naming the group *is* the grant, and the
notification says no more than the reviewer's own queue already shows. The submitter is excluded,
like any actor. A guest's suggestion notifies just as a signed-in user's does.

`submission:update` is the author revising a suggestion that is still open (there is one per author
per page, by the unique index). It bumps the existing unread entry rather than adding a second one.

`approvals.matchesPage` has to be callable from a worker thread, so if it reads anything off `this`
beyond its arguments, it moves to a pure helper beside `helpers/pageRules.ts`.

---

## 5. Preferences

### 5.1 Storage

```
userNotificationPrefs
  userId    uuid  → users.id, on delete cascade
  category  varchar(64)
  channel   varchar(16)      -- 'inApp' | 'email'
  enabled   boolean
  updatedAt timestamp
  PRIMARY KEY (userId, category, channel)
  INDEX (category, channel) WHERE enabled
```

**A row is stored only when it differs from the category's default.** No rows means the defaults,
and setting a choice back to its default deletes the row. That keeps the table small, and keeps the
defaults in the registry rather than copied into every account.

**A table rather than a key in `users.prefs`**, because of the opt-in categories. To fan out
`pageCreated`, the question is "who has turned this on?" across every account on the instance. That
is an index lookup on the partial index above, rather than a scan of a JSONB column. The default-on
categories ask the other way round, "of these watchers, who has turned it off?", which joins the
already-small candidate list against the primary key.

**One row per channel, not one column per channel**, so a third channel would be a new value
rather than a migration.

Preferences are **global**: one set per user, covering every site they use.

### 5.2 The Profile screen

`pages/ProfileNotifications.vue`, at `/_profile/notifications` (enabling the entry
`ProfileLayout.vue` already has). One row per category the caller can see (`visibleTo`), each with
its title, a one-line description, and two toggles: **In-App** and **Email**. Grouped under
headings: *Pages you watch*, *Discussions*, *Reviews*, *Everything on the wiki*. The last group
holds the two opt-in categories, with a note that they can be busy.

- With mail not configured, the Email column is disabled, with a hint that the administrator has not
  set up outgoing mail.
- On a site where notifications are switched off ([§11](#11-the-site-switch)), a banner says so.
  The preferences still apply on the user's other sites.
- A **Stop all email** action at the foot of the screen turns off email for every category in one
  go. It is the same thing the unsubscribe page offers.

`GET /_api/users/me/notifications` answers with every visible category, its effective
`{ inApp, email }`, its defaults, and `emailAvailable`. `PUT` takes the full map back, stores only
the rows that differ from the defaults, and audits `updateNotificationPrefs` (kind `profile`) with
the categories that changed.

---

## 6. Emitting

### 6.1 The call

```ts
WIKI.models.notifications.emit('page:edit', {
  siteId, actorId, pageId,
  snapshot: { title, path, locale, tags, publishState, ... },
  variant: 'edited'
})
```

It writes one `notificationEvents` row and asks for a fan-out run. Like `hooks.emit`, it **never
throws**: a notification problem must not fail the action that caused it. It returns at once, and
it is called only after the action has succeeded.

It returns without writing anything when:

- the site has notifications switched off ([§11](#11-the-site-switch)), checked against
  `WIKI.sites`, which the request path has and a worker does not, or
- no category listens for this event from this origin. A git pull's `page:create` is dropped here
  rather than written and then thrown away.

**The kick is debounced per instance.** The first emit arms a timer of about one second, and when it
fires, a single `dispatchNotifications` job is added. A burst of 500 saves becomes a handful of jobs.
A `* * * * *` `SYSTEM_SCHEDULE` entry runs the same task as a safety net, so an instance that dies
with a timer armed loses at most a minute.

Emit sites, beside the existing `hooks.emit` calls:

| Event | Where |
| ----- | ----- |
| `page:create` | `pages.createPage`, and the restore path that re-creates a page |
| `page:edit` | `pages.updatePage`, including the save `approvals` makes when a suggestion is approved (the actor is the reviewer, and the snapshot carries who suggested it) |
| `page:rename` | `pages.movePage` |
| `page:delete` | `pages.deletePage`, `deletePagesByTag`, `tree.deleteFolder`, and git's removals in `applyIncoming`. Every path that removes a page row has to go through [§6.3](#63-deletion-snapshot-the-watchers-first) |
| `submission:new` / `submission:update` | where `approvals` writes a `pageEditSubmissions` row |
| `comment:new` / `comment:edit` | `api/comments.ts`, beside the webhook emits (comments are only ever created from a route) |

### 6.2 Origin

Every event carries an `origin`: `user`, `import` or `bulk`.

- **`import`**: anything running inside `storage.importingFrom()`, which covers Import Everything
  and a git pull's `applyIncoming`. `emit` reads the scope itself, so callers do not pass it.
- **`bulk`**: `deletePagesByTag` and `tree.deleteFolder`. These run their per-page work inside a
  `notifications.bulk(work)` AsyncLocalStorage scope of the same shape.
- **`user`**: everything else.

A category's `origins` decides whether it fires for an origin. **`watchedPage` fires for all
three**, so a watcher hears about a page a git pull rewrote, with the entry saying "via storage
sync" where there is no actor. **`pageCreated` and `pageDeleted` fire for `user` only**, so an
import of 5,000 pages, or a tag deletion, does not send 5,000 notifications to everyone who opted in.

### 6.3 Deletion: snapshot the watchers first

`pageWatching` rows are deleted with the page, so by the time a fan-out runs, a deleted page has no
watchers left to find. The `page:delete` emit therefore happens **before** the page row is deleted,
and captures the watchers in the same statement:

```sql
INSERT INTO "notificationEvents" (…, "recipients")
VALUES (…, ARRAY(SELECT "userId" FROM "pageWatching" WHERE "pageId" = $1))
```

The IDs never pass through Node, and the row is written whether or not the delete then succeeds. A
delete that fails after this point (rare, since the page row is the last thing to go) leaves an
event saying a page was deleted that was not. To avoid that, the fan-out checks that the page row
is really gone before it sends any `deleted` variant, and drops the event if the page is still there.

Access for a deleted page is checked against the snapshot's path, locale and tags, the page as it
was.

Restoring a deleted page does not bring its watchers back: the cascade has already removed them.
That is a property of the existing schema, noted here rather than changed.

---

## 7. Fan-out

`tasks/workers/dispatch-notifications.ts`, in a worker thread.

### 7.1 Claiming

It claims up to 50 unprocessed events, oldest first, with `FOR UPDATE SKIP LOCKED`, writing
`claimedAt` and `claimedBy`. Several instances can drain the outbox at once without two of them
taking the same event. A claim older than `scheduler.taskTimeout` plus a margin counts as abandoned
and can be claimed again, the same reasoning as `reapStaleJobs`. When the batch is done, the task
runs again straight away if more events are waiting, and stops otherwise.

### 7.2 Access is checked per group set, not per user

`checkAccess` depends only on the actor's groups (plus `manage:system`). Candidates are read
together with their memberships:

```sql
SELECT u.id, array_agg(ug."groupId" ORDER BY ug."groupId") AS groups, u.prefs->>'locale' …
FROM users u JOIN "userGroups" ug ON ug."userId" = u.id
WHERE u.id = ANY($candidates) AND u."isActive" AND NOT u."isSystem"
GROUP BY u.id
```

The check is memoized on the joined group IDs. Ten thousand candidates spread over six group
combinations cost six rule evaluations. The worker has no `WIKI.models.groups`, so it reads
`groups.rules` and `groups.permissions` directly once per run and calls `resolvePageRule` itself.
What it answers is what `checkAccess` would answer, from the same rows.

Access is checked **when the fan-out runs**, not when the event happened: someone whose access was
removed in between is not told.

### 7.3 Candidates, in batches

`recipients()` yields IDs in batches of 1,000, using keyset pagination on `userId`:

- **Watchers**: `pageWatching` by `pageId`, or `notificationEvents.recipients` for a deletion.
- **Opted in**: `userNotificationPrefs` where `category = $1 AND enabled`, on its partial index. The
  users table is never scanned.
- **Reviewers**: `userGroups` where `groupId = ANY($reviewerGroups)`.
- **Mentions and replies**: a handful of IDs, resolved from the comment.

### 7.4 One entry per person per event

A single `comment:new` can reach the same person three ways: they watch the page, they wrote the
parent comment, and they are mentioned in it. They get **one** entry, from the category with the
highest `priority` among those that would notify them on some channel:
`mention` (40) > `commentReply` (30) > `watchedPageComment` (10). Likewise `watchedPage` (20) beats
`pageDeleted` (5) for a watcher who also opted into deletions everywhere.

The dedup runs after preferences have been applied: someone who turned mentions off but watches the
page still gets the watched-page entry.

### 7.5 Writing

Rows are written 500 at a time, as one multi-row `INSERT … ON CONFLICT … DO UPDATE`
([§8.3](#83-coalescing-and-idempotency-are-the-same-index)). Each row carries `inApp` from the
preferences, and `emailState = 'pending'` with `emailAfter` set ([§10.2](#102-cadence)) where email is
on, the account is verified and mail is configured. When anything has been written with email
pending, the mail drain is kicked.

### 7.6 Long fan-outs

The task checks `signal` between batches. When it is about to time out, it writes the keyset cursor
it has reached onto the event row (`cursor`) and leaves the event claimed but unprocessed. The next
run picks it up from the cursor. This is the same idea as `renderPages` handing the rest of its
queue to a fresh job, so a `pageCreated` going out to a very large opted-in audience is spread over
several runs instead of running into the timeout.

---

## 8. Storage

### 8.1 `notificationEvents` (the outbox)

```
id          uuid PK          -- the event ID, also the idempotency key
kind        varchar(64)      -- 'page:edit', 'comment:new', …
origin      varchar(16)      -- 'user' | 'import' | 'bulk'
siteId      uuid null        -- null for an instance-scoped event, §11
actorId     uuid null        -- no FK: an event outliving its actor is fine
data        jsonb            -- snapshot, variant, IDs of the page / comment / submission
recipients  uuid[] null      -- pre-resolved candidates (deletions)
cursor      jsonb null       -- progress of an interrupted fan-out
claimedAt   timestamp null
claimedBy   varchar null
processedAt timestamp null
createdAt   timestamp
INDEX (createdAt) WHERE processedAt IS NULL
```

Processed events are kept for a day, which is enough to debug a notification that did not arrive.
After that they are purged ([§12.3](#123-purging)).

### 8.2 `notifications` (the inbox and the email queue)

```
id          uuid PK
userId      uuid → users.id, on delete cascade
siteId      uuid null → sites.id, on delete cascade      -- null: instance-scoped, §11
category    varchar(64)
variant     varchar(32)                                  -- the latest variant
groupKey    varchar(255)
pageId      uuid null → pages.id, on delete set null
commentId   uuid null → comments.id, on delete set null
actorId     uuid null → users.id, on delete set null
data        jsonb      -- snapshot: title, path, locale, actor name, excerpt, variants seen, …
count       integer default 1
lastEventId uuid
inApp       boolean
emailState  varchar(16) default 'none'   -- none | pending | sent | failed | skipped
emailAfter  timestamp null
emailedAt   timestamp null
readAt      timestamp null
createdAt   timestamp
updatedAt   timestamp                    -- bumped on coalescing, the inbox's sort key

INDEX (userId, updatedAt DESC)                                -- the inbox
INDEX (userId) WHERE readAt IS NULL AND inApp                 -- the badge
INDEX (emailAfter) WHERE emailState = 'pending'               -- the mail drain
UNIQUE (userId, groupKey) WHERE readAt IS NULL                -- §8.3
```

**The entry carries a snapshot**, because what it is about may be renamed, moved or deleted before
it is read. The link is built from `pageId` where the page still exists, so it follows a move, and
from the snapshot's path otherwise.

**An excerpt is shown only while its comment exists.** `commentId` is `set null` when the comment
is deleted, and the API leaves the excerpt out of any entry whose `commentId` is null. A moderator
deleting spam therefore removes its text from every inbox it reached. An email that has already
been sent cannot be recalled.

**One row covers both channels.** An email-only recipient still gets a row, with `inApp = false`,
and the inbox and the badge never show it. That keeps one source of truth, and gives coalescing
([§8.3](#83-coalescing-and-idempotency-are-the-same-index)) and the email cadence
([§10.2](#102-cadence)) one model to work on. An email-only row is closed (`readAt = emailedAt`) once
its email is sent, since there is no inbox in which it could be read.

### 8.3 Coalescing and idempotency are the same index

Every category gives each entry a `groupKey`, and a user has at most one **unread** entry per key.
The insert is:

```sql
INSERT INTO notifications (…) VALUES (…)
ON CONFLICT ("userId", "groupKey") WHERE "readAt" IS NULL
DO UPDATE SET
  count       = notifications.count + 1,
  variant     = EXCLUDED.variant,
  data        = notifications.data || EXCLUDED.data,   -- variants seen are unioned in code
  actorId     = EXCLUDED."actorId",
  lastEventId = EXCLUDED."lastEventId",
  updatedAt   = now(),
  emailState  = <per §10.2>,
  emailAfter  = <per §10.2>
WHERE notifications."lastEventId" IS DISTINCT FROM EXCLUDED."lastEventId"
```

- **Coalescing**: forty saves to a page you have not looked at yet are one entry, "edited 40
  times, last by Bob", which moves to the top of the inbox each time.
- **Idempotency**: a fan-out retried after a crash replays the same event ID. The `WHERE` makes the
  replay change nothing, so nobody's count is inflated and nobody gets a second row.
- **Reading resets it**: once the entry is read it no longer holds the unique slot, and the next
  event starts a new one.

The keys in [§4.2](#42-the-launch-categories) are chosen so that only things worth merging merge:
two comments on a watched page merge, but two mentions in two comments do not (`mention:<commentId>`).

---

## 9. In-app delivery

### 9.1 API

All routes are the caller's own rows: any logged-in session, no permission, and 401 for a guest.
No route declares `config.permissions`. Each comments `No route-level permissions:` and filters by
`userId` from the session.

| Route | What |
| ----- | ---- |
| `GET /_api/sites/:siteId/notifications?cursor=&unread=` | Keyset-paginated on `(updatedAt, id)`, 30 per page. Includes the site's rows plus instance-scoped ones (`siteId IS NULL`) |
| `GET /_api/sites/:siteId/notifications/summary` | `{ unread, latestAt }`. `unread` is counted from `SELECT 1 … LIMIT 100` on the badge index and shown as "99+" above 99. Answers with an `ETag` built from the two values, so a poll that finds nothing new is a 304 |
| `PUT /_api/sites/:siteId/notifications/:id/read` | Marks one entry read |
| `PUT /_api/sites/:siteId/notifications/read` | Marks everything read, or `{ pageId }` for one page's entries (mark-read-on-view, [§10.2](#102-cadence)) |
| `DELETE /_api/sites/:siteId/notifications/:id` | Dismisses an entry |

Marking read and dismissing are **not audited**. They are bookkeeping on one's own inbox, and a
click per notification would bury the audit log, for the same reason page views are not recorded.
Preference changes and the admin settings are audited.

### 9.2 Polling

A Pinia store, `stores/notifications.js`, holds `unread`, `latestAt` and the loaded page of entries,
and has one method that matters: `refresh()`, which calls `summary` and loads the list only if
`latestAt` moved. What calls `refresh()` is kept separate from the store itself:

- app boot, once the session is known to be signed in;
- a route change, throttled to once per 15 s;
- `visibilitychange` to visible;
- an interval of 60 s, **only while the tab is visible**, so a hundred background tabs do not poll.

The badge in `HeaderNav.vue` reads `unread`. `InboxMessages.vue` becomes the list: grouped by day,
unread entries marked, each entry's text produced **in the browser** from
`notifications.messages.<category>.<variant>` plus its snapshot, so an entry is read in the
language the interface is drawn in. Each entry links to its target:

- a page, or the page's Talk tab with the comment anchored;
- `/_inbox/review/:submissionId` for a review;
- for a deleted page, the snapshot's path, which leads to the page-not-found screen and its restore
  offer where the reader may restore.

### 9.3 Adding push later

Push is designed in now but not built. When it is added, it only ever says **"something changed,
call `refresh()`"**. The summary endpoint stays the single source of truth, so a pushed update and a
polled one leave the store in exactly the same state. Nothing about polling or the endpoint changes.

When it is built:

- every write that changes what a user's summary would answer (the fan-out's inserts, the read and
  dismiss routes, the purge) sends `NOTIFY notifications` with the affected user IDs, through
  `createNotifier` and chunked under Postgres's 8 kB payload limit;
- every instance `LISTEN`s and forwards to its own sockets on a `/_notifications` websocket, beside
  the collab and terminal ones;
- the 60 s interval drops to a 5 minute safety net while the socket is open.

No `NOTIFY` is sent in the polling version: with nothing listening it would be dead code.

---

## 10. Email

### 10.1 Templates

`MailTemplateData` gains `notification` (one entry) and `notificationDigest` (several), with strings
under `mail.notification.*`. Both render through the existing `MailContent` → `htmlShell` /
`textBody` pair. The language is the recipient's `prefs.locale`, falling back to the site's primary
locale, which is what `localeFor` already does.

What a notification email contains: the title, who did it, what it is about (page title and path),
for a comment the excerpt, one action button linking to the target, and a footer with **Manage
notifications** (linking to `/_profile/notifications`) and **Unsubscribe**. No page content is ever
included.

**The mail model has to run in a worker.** `mail.ts` currently reads `WIKI.sites[siteId]` (hostname,
title, primary locale) and goes through `WIKI.models.locales`, and a worker has neither. `send()` is
changed to take a `MailSiteContext` (`{ baseUrl, title, primaryLocale }`) from its caller. The
existing callers build it from `WIKI.sites`; the drain builds it from the `sites` rows it loads
once per run. The translator is checked to work with the worker's lazily opened database, and
imported directly the way `dispatch-webhook.ts` imports `hooks`.

### 10.2 Cadence

**A window, then quiet until read.** An entry is emailed once, a short delay after it first
appears, and then not again until its recipient has read it:

| | `emailState` / `emailAfter` |
| - | --------------------------- |
| **A new row** | `pending`, `emailAfter = now() + emailDelay` |
| **A coalesce while `pending`** | unchanged. The event merges into the email that is already due |
| **A coalesce after `sent`** | **stays `sent`.** The inbox entry keeps counting, but no further email is sent |
| **Read** | the entry gives up its unique slot ([§8.3](#83-coalescing-and-idempotency-are-the-same-index)), so the next event starts a new entry and a new email |

`emailAfter` is the only thing the drain looks at. It groups everything due for one user into a
single mail: the `notification` template for one entry, `notificationDigest` for several.

In practice: Alice watches *Runbook*, Bob saves it twelve times between 10:00 and 10:40, and at
10:05 Carol mentions Alice on another page. Alice receives two emails, "Runbook was edited" at about
10:03 and the mention at about 10:08, and nothing more about Runbook until she opens it. Her inbox
entry reads "edited 12 times". Sending an email per event would have meant thirteen of them, and a
window alone about ten, since Bob's pace keeps opening new windows.

**This only works if entries get read in the ordinary course of things**, or it becomes "one email,
ever". So **opening a page marks that page's `watchedPage` entries read**, and opening its Talk tab
marks its `watchedPageComment` entries read. The page payload already answers `isWatching`, so it
also answers `hasUnreadNotifications`, and the browser calls `PUT …/notifications/read { pageId }`
only when that is true. A page view therefore writes nothing unless there was something to clear.

**An email-only row closes when it is emailed** ([§8.2](#82-notifications-the-inbox-and-the-email-queue)),
because it has no inbox to be read in. Its recipient therefore gets one email per window rather than
one ever.

**`emailAfter` is computed in exactly one place**, `emailAfterFor(user, now)` in the notifications
model, and both the fan-out insert and the coalesce go through it. Today it answers
`now + emailDelay`. It is the seam where hourly and daily digests attach later
([§10.5](#105-leaving-room-for-hourly-and-daily-digests)).

### 10.3 The drain

`tasks/workers/send-notification-mail.ts`:

1. Claims up to `notifications.mailBatchSize` (default 100) **(user, site) pairs** with rows due,
   using `SELECT DISTINCT "userId", "siteId" … WHERE "emailState" = 'pending' AND "emailAfter" <=
   now() … FOR UPDATE SKIP LOCKED`.
2. For each pair, loads the due rows (capped at 50; above that, the digest says "and N more" and
   links to the inbox), drops them as `skipped` if the site has notifications switched off, renders
   one mail and sends it. **One mail per site, not one per user**, because a mail names the wiki it
   comes from and its links use that site's hostname. A user active on two sites gets two digests,
   each of which reads as coming from its own wiki. Instance-scoped entries (`siteId` null) go out
   with the site the recipient last signed in on ([§11](#11-the-site-switch)).
3. Marks the rows `sent` with `emailedAt`, or `failed` after the scheduler's retries are used up. A
   failure on one user does not stop the batch.
4. Runs itself again while due rows remain. The safety net is the same minute-by-minute schedule as
   fan-out.

Every send goes through the one cached transporter. Turning on nodemailer's `pool` option for this
task is worth measuring once it exists.

Notification mails also carry `Auto-Submitted: auto-generated`, so out-of-office replies are not
sent back to the wiki.

### 10.4 One-click unsubscribe (RFC 8058)

This is a hard requirement. Every notification mail carries:

```
List-Unsubscribe: <https://{host}/_api/notifications/unsubscribe?t={token}>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

**The token.** `base64url(payload) . base64url(HMAC-SHA256(payload))`, where the payload is
`{ v: 1, u: userId, c: [categories in this mail] }`. It is signed with
**`notifications.unsubscribeSecret`**, a 32-byte value seeded at install beside the other secrets in
`models/settings.ts`. It is deliberately not `auth.secret`: that one is rotated whenever an
administrator invalidates every session, which would break every unsubscribe link already sitting
in somebody's mailbox (the reason `apiKeys.ts` gives for keeping the certificate passphrase apart).
The token **does not expire**. A link in an email from last year still has to work, and the only
thing it can do is turn email off for one person.

**`POST`** (the one-click):

- `publicAccess`, no session, no cookie, no CSRF token. The mail client sends none of these.
- Takes `application/x-www-form-urlencoded` with `List-Unsubscribe=One-Click`.
- Verifies the HMAC with `timingSafeEqual`, then turns **email** off for the token's categories,
  writing `enabled = false` rows. In-app is left alone: the user only asked to stop receiving mail.
- Idempotent, and answers 200 with no body. An invalid token gets 400, saying nothing about which
  part failed.
- Recorded in the audit log as `unsubscribeNotifications` (kind `profile`), with the token's user as
  the actor. Like the auth events in `models/users.ts`, this is an action with no session, whose
  user is identified only by a credential.

**`GET`** on the same URL **does nothing** but redirect to the frontend page `/_unsubscribe?t=`.
Mail scanners fetch every link in a message, so a GET that acted would unsubscribe people who never
asked. This is the same principle as the welcome mail's verify link. That page names the categories,
offers **Unsubscribe from these** and **Stop all notification email** (the same POST with
`scope=all`), and links to the Profile screen. The footer link in the mail body points to this page.

**Deliverability checks, in the implementing PR:**

- Gmail and Yahoo require the `List-Unsubscribe` headers to be covered by the DKIM signature.
  Check which headers nodemailer's DKIM signing covers, and add these two if they are not among
  them.
- Gmail honours one-click only for an `https` URL. A site served over plain `http` still gets the
  header, which works as an ordinary link elsewhere. Admin → Notifications warns about it
  ([§12.2](#122-admin--notifications)).

### 10.5 Leaving room for hourly and daily digests

Not built in the first version, but expected to follow: a user choosing **Immediate**, **Hourly** or
**Daily** delivery for their notification email. Nothing built now should have to be reshaped when
it comes. What the design already does for it, and what adding it involves:

**What is in place from the start**

- **The drain only looks at `emailAfter`.** It never asks why a row is due, so a digest is nothing
  more than a later `emailAfter`. Claiming, grouping, rendering and marking rows sent stay the same.
- **`emailAfterFor` is the only place that computes it** ([§10.2](#102-cadence)). A schedule is a
  change to that one function.
- **The digest template already exists.** `notificationDigest` takes any number of entries,
  grouped by category, with the "and N more" cap. A daily digest is the same mail with more in it.
- **Quiet-until-read already holds back repeats.** An entry that went out in a digest stays `sent`
  however many more events land on it, so the next digest does not repeat it. It reappears only if
  it was read and a new entry was started.
- **The unsubscribe token already covers several categories** ([§10.4](#104-one-click-unsubscribe-rfc-8058)),
  which a digest needs.
- **One mail per (user, site)** ([§10.3](#103-the-drain)) is the right unit for a digest as well.

**What adding it involves**

- **A per-user preference**, global like the rest ([§5](#5-preferences)): `emailSchedule` (`immediate`
  | `hourly` | `daily`) and, for daily, the hour to send. It lives in `users.prefs` beside `timezone`
  rather than in `userNotificationPrefs`. It belongs to the user, not to a category, and the fan-out
  already reads each candidate's row for the locale ([§7.2](#72-access-is-checked-per-group-set-not-per-user)),
  so it costs no extra query. It appears as one **Email delivery** selector above the grid on
  Profile → Notifications.
- **`emailAfterFor` gains the schedule.** Hourly is the next top of the hour. Daily is the next
  occurrence of the chosen hour in the user's `prefs.timezone`, falling back to the site's, then
  UTC. That is computed with `Temporal.ZonedDateTime` so a daylight-saving change does not move the
  slot by an hour, then converted back to an instant for the column.
- **Some categories skip the digest.** A category definition gains `digest: boolean`, defaulting to
  true. A mention, a reply or a review request (and any later admin alert) is something a person is
  waiting on, so the proposal is that those stay immediate even for a daily-digest user. The
  implementer decides that list when the feature is built.
- **Changing the schedule reschedules what is pending.** Saving the preference recomputes
  `emailAfter` for that user's `pending` rows, so switching from daily to immediate does not hold
  back what has already queued.
- **Spreading the load.** Thousands of users on the default daily hour would all fall due in the
  same minute. `emailAfterFor` therefore adds a fixed offset per user within the hour, derived from
  the user ID, so the same user always lands at the same minute and the mail runs see a steady trickle
  instead of one spike. `mailBatchSize` and the drain re-running itself while rows remain handle the
  rest.
- **Retention.** A daily digest needs entries to survive at least a day before they are sent.
  `retentionDays` is already far longer, but the Admin → Notifications screen should refuse a value
  under 2 once digests exist.

---

## 11. The site switch

`features.notifications`, on by default, under **Admin → General → Features**, beside
`features.comments`.

Turned off for a site:

- `emit` writes nothing for that site's events ([§6.1](#61-the-call)).
- Pending emails for that site are marked `skipped` by the drain rather than sent.
- The inbox entry, the badge and the bell's "you will be notified" wording are hidden on that site.
  The **Watching** list stays, since watching is still a list a user keeps.
- Existing entries are kept, not deleted. Turning the switch back on shows them again.
- Preferences are untouched, since they are global ([§5.2](#52-the-profile-screen)).

**Instance-scoped categories ignore it.** None ships at launch, but the admin categories planned
([§13](#13-adding-a-category)) include some that belong to no site (a registration, since users are
per instance). Their entries have `siteId = null`, appear in every site's inbox, and their email
links use the site the recipient last signed in on, falling back to the first site.

---

## 12. Administration and housekeeping

### 12.1 Instance settings

Settings an administrator sets once for the whole instance. They are not user preferences and not
the per-site switch ([§11](#11-the-site-switch)).

| Key | Default | What | Where |
| --- | ------- | ---- | ----- |
| `notifications.retentionDays` | 90 | Entries older than this are purged, read or not | Settings blob, edited on Admin → Notifications |
| `notifications.emailDelay` | `3m` | The window of [§10.2](#102-cadence) | Same |
| `notifications.mailBatchSize` | 100 | Users per mail run. Raise it for a mail server that can take more, lower it for one that throttles. The API refuses anything outside 1–1000 | Same |
| `notifications.unsubscribeSecret` | generated at install | Signs unsubscribe tokens ([§10.4](#104-one-click-unsubscribe-rfc-8058)) | Settings blob, never returned by the API |

### 12.2 Admin → Notifications

`pages/AdminNotifications.vue` at `/_admin/notifications`, listed in the **System** section of
`AdminLayout.vue`'s sidebar. It goes in alphabetical order between Metrics and Rendering, behind
`manage:system` like its neighbours, with `fluent-topic-push-notification.svg` from `_assets/icons/` as
its icon. Its strings go under `admin.notifications.*`.

`GET` / `PUT /_api/system/notifications`, behind `manage:system`. A save is audited (kind `admin`,
action `updateNotificationSettings`) with the fields that changed, as the other configuration
routes are. The screen has two cards:

- **Settings**: retention, the email delay and the mail batch size.
- **Status**, read-only and answered by the same `GET`:
  - the outbox backlog (unprocessed events and the age of the oldest one), which is what shows that
    fan-out is falling behind;
  - emails pending, sent and failed over the last 24 hours;
  - whether outgoing mail is configured, linking to Admin → Mail when it is not;
  - a warning when a site is served over plain `http`, where Gmail ignores one-click unsubscribe
    ([§10.4](#104-one-click-unsubscribe-rfc-8058)).

This is also where any later instance-wide setting goes, for example turning a category off for the
whole instance.

### 12.3 Purging

`tasks/simple/purge-notifications.ts` runs daily off `SYSTEM_SCHEDULE`. It deletes entries past
retention and processed outbox events older than a day, in batches of 10,000, checking `signal`
between batches.

---

## 13. Adding a category

Worked example: telling the people who look after storage that a git sync failed.

1. **`notifications/categories/storageSyncFailed.ts`**: `scope: 'site'`, `origins: ['user',
   'import', 'bulk']` (the event comes from a scheduled job, which counts as whatever origin it ran
   under, and all are fine here), defaults in-app ✓ email ✓, `accessCheck: null`,
   `visibleTo: (actor) => actor.permissions.includes('manage:storage')`,
   `recipients`: users in a group whose `permissions` contain `manage:storage`, and
   `groupKey: storageSyncFailed:<targetId>`, so a target failing every five minutes is one entry
   until somebody looks at it.
2. Add its key to `NOTIFICATION_CATEGORIES`.
3. Add `WIKI.models.notifications.emit('storage:syncFailed', …)` in `storage.recordState`, **only
   on a transition** from healthy to `error` rather than on every failure.
4. Add `notifications.categories.storageSyncFailed.*`, `notifications.messages.storageSyncFailed.*`
   and its mail strings to `en.json`.

Nothing else changes: the Profile screen, fan-out, dedup, coalescing, mail and unsubscribe all come
from the registry.

**An event anyone can trigger must coalesce, or anyone can fill an administrator's mailbox.** A
failed-login category is the clear case: the login endpoint is open to the world, which is why
failed logins are not audited. It would need a `groupKey` per account, so repeated failures bump a
single entry, which the quiet-until-read cadence ([§10.2](#102-cadence)) then holds to a single email.

---

## 14. Behaviour worth pinning down

- **The actor is never a recipient**, including when they watch the page they just edited.
- **Inactive and system accounts are skipped**, and so is the guest account. **Unverified accounts
  get in-app entries but no email**, because the address has not been confirmed.
- **A comment edited to add a mention** notifies only the handles that were not in the previous
  version. Re-saving a comment does not mention everyone in it again.
- **Replies go to the parent's author only**, not to everyone else in the thread. Someone who
  wants to follow a whole discussion watches the page.
- **A scheduled page going live at its `publishStartDate` is not an event.** Visibility is worked
  out when the page is read, and no job flips anything at that time. Setting or changing the window
  is a `scheduled` variant; the moment it takes effect is silent.
- **`pageCreated` fires on creation whatever the publish state**, with the state in the snapshot
  ("created as a draft"). That matches what the recipient can see: any signed-in session sees
  unpublished pages where it has `read:pages`. It does not fire again when the page is later
  published.
- **Password-locked pages** notify like any other, by title and path, which is what the Watching
  list already shows. No content is ever part of an entry.
- **A user deleted with entries pending** takes them with them (`on delete cascade`).

---

## 15. Performance

| Where | Cost | Why it holds |
| ----- | ---- | ------------ |
| The request | One `INSERT` (with a sub-select for a deletion) | No recipient is resolved, no access is checked, no SMTP |
| Jobs | About one `dispatchNotifications` per second per instance under load, and one per minute otherwise | Debounced kick ([§6.1](#61-the-call)) |
| Candidates | Proportional to the audience | Watchers, reviewer groups and mentions are indexed lookups. Opt-ins come from a partial index ([§5.1](#51-storage)). The users table is never scanned |
| Access | One rule evaluation per distinct group set | [§7.2](#72-access-is-checked-per-group-set-not-per-user) |
| Writes | Multi-row inserts of 500 | Coalescing keeps a busy page at one row per watcher |
| Badge | Index-only, capped at 100 rows, 304 when unchanged, no polling from hidden tabs | [§9.1](#91-api), [§9.2](#92-polling) |
| Mail | One mail per user and site per drain | Digesting is part of the drain, not an extra step |
| Timeouts | None to hit | Fan-out resumes from a cursor ([§7.6](#76-long-fan-outs)), and the purge works in batches |
| HA | Any instance drains | `SKIP LOCKED` on both queues. No instance-local state except the debounce timer |

---

## 16. Suggested order

1. **Foundation**: the three tables and their migration (`npm run db-generate --
   --name=notifications`), the registry with the seven categories, `userNotificationPrefs` with its
   API, `ProfileNotifications.vue`, `features.notifications` in General → Features, and the
   `notifications` settings blob with `unsubscribeSecret` seeded.
2. **In-app**: `emit()` with origins, the debounce and the emit sites, the deletion snapshot,
   `dispatch-notifications.ts`, the inbox API, `stores/notifications.js` with polling, the
   `HeaderNav` badge, and `InboxMessages.vue`. Usable on its own: an instance with no mail
   configured is complete at this point.
3. **Email**: the `MailSiteContext` refactor, both templates and their strings,
   `send-notification-mail.ts` with the quiet-until-read cadence and mark-read-on-view, the
   unsubscribe token, routes and `/_unsubscribe` page, the DKIM check, and Admin → Notifications
   ([§12.2](#122-admin--notifications)).
4. **Housekeeping**: `purge-notifications.ts` and its `SYSTEM_SCHEDULE` entries.
5. **Later**: push ([§9.3](#93-adding-push-later)), hourly and daily digests
   ([§10.5](#105-leaving-room-for-hourly-and-daily-digests)), and the admin categories
   ([§13](#13-adding-a-category)).

Verification for each phase: `npm run typecheck` and `npx oxlint` in `backend/`, `npm run build` in
`frontend/`. Phases 2 and 3 are worth a throwaway instance. Mailpit is the mail server for
development: it receives every message without delivering any, which shows the digest, both bodies
and the `List-Unsubscribe` headers. Script two accounts, one watching a page the other edits ten
times, and check that one entry with a count of ten comes out. Then `curl` the one-click POST with
the token from the mail.
