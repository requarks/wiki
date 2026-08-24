import { sql, type SQL } from 'drizzle-orm'
import {
  bigint,
  boolean,
  bytea,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'

// == CUSTOM TYPES =====================

// -> Typed as a string: an ltree path comes back from the driver as its dotted text form, and every
//    caller treats it as one
const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree'
  }
})
const tsvector = customType({
  dataType() {
    return 'tsvector'
  }
})

// == TABLES ===========================

// API KEYS ----------------------------
export const apiKeys = pgTable('apiKeys', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  // -> Only the tail of the token, to tell keys apart in the admin list. The token itself is a
  //    signed JWT shown once at creation and never stored: it is a bearer credential, and
  //    verification needs the public key plus this row's state, not the token.
  keyShort: varchar({ length: 8 }).notNull(),
  // -> IDs of the groups whose permissions the key carries. Resolved on every request, so editing a
  //    group immediately affects the keys pointing at it.
  groups: jsonb().notNull().default([]),
  expiration: timestamp().notNull().defaultNow(),
  isRevoked: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// APPROVAL RULES ----------------------
/**
 * Which pages accept edit suggestions, who may submit them, and who reviews them.
 *
 * Per site, and matched the way group page rules are: a mode plus a pattern. A page no rule matches
 * accepts no suggestions at all, so this table being empty means the feature is off.
 */
export const approvalRules = pgTable(
  'approvalRules',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 255 }).notNull().default(''),
    // -> A rule can be turned off without losing what it says, which is how an administrator suspends
    //    suggestions on a section without having to write the rule again afterwards.
    isEnabled: boolean().notNull().default(true),
    // -> One of START / EXACT / END / REGEX / TAG / TAGALL, the same set group page rules use. A
    //    varchar rather than an enum so that adding a mode does not need a migration; the API schema
    //    is what rejects an unknown one.
    match: varchar({ length: 16 }).notNull().default('START'),
    path: varchar({ length: 2048 }).notNull().default(''),
    // -> Group IDs. Resolved on use rather than joined, so deleting a group takes effect at once, the
    //    way `apiKeys.groups` works.
    submitterGroups: jsonb().notNull().default([]),
    reviewerGroups: jsonb().notNull().default([]),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [index('approvalRules_siteId_idx').on(table.siteId)]
)

// ASSETS ------------------------------
export const assetKindEnum = pgEnum('assetKind', ['document', 'image', 'other'])
export const assets = pgTable(
  'assets',
  {
    id: uuid().primaryKey().defaultRandom(),
    fileName: varchar({ length: 255 }).notNull(),
    fileExt: varchar({ length: 255 }).notNull(),
    isSystem: boolean().notNull().default(false),
    kind: assetKindEnum().notNull().default('other'),
    mimeType: varchar({ length: 255 }).notNull().default('application/octet-stream'),
    fileSize: bigint({ mode: 'number' }), // in bytes
    meta: jsonb().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    // -> Set only while the database is one of the targets configured to store this kind of file.
    //    An asset is written to every target that claims it, and each derives where its own copy
    //    sits from the tree, so there is nothing to record here about where the bytes went.
    data: bytea(),
    preview: bytea(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [index('assets_siteId_idx').on(table.siteId)]
)

// AUTHENTICATION ----------------------
export const authentication = pgTable('authentication', {
  id: uuid().primaryKey().defaultRandom(),
  module: varchar({ length: 255 }).notNull(),
  isEnabled: boolean().notNull().default(false),
  displayName: varchar({ length: 255 }).notNull().default(''),
  config: jsonb().notNull().default({}),
  registration: boolean().notNull().default(false),
  allowedEmailRegex: varchar({ length: 255 }).notNull().default(''),
  autoEnrollGroups: uuid().array().default([])
})

// BLOCKS ------------------------------
export const blocks = pgTable(
  'blocks',
  {
    id: uuid().primaryKey().defaultRandom(),
    block: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }).notNull(),
    icon: varchar({ length: 255 }).notNull(),
    isEnabled: boolean().notNull().default(false),
    isCustom: boolean().notNull().default(false),
    config: jsonb().notNull().default({}),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [index('blocks_siteId_idx').on(table.siteId)]
)

// GROUPS ------------------------------
export const groups = pgTable('groups', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  permissions: jsonb().notNull(),
  rules: jsonb().notNull(),
  redirectOnLogin: varchar({ length: 255 }).notNull().default(''),
  redirectOnFirstLogin: varchar({ length: 255 }).notNull().default(''),
  redirectOnLogout: varchar({ length: 255 }).notNull().default(''),
  isSystem: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// HOOKS -------------------------------
export const hookStateEnum = pgEnum('hookState', ['pending', 'success', 'error'])
export const hooks = pgTable('hooks', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  // -> Event keys such as `page:create`, matched against what the server emits
  events: text()
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  url: text().notNull(),
  includeMetadata: boolean().notNull().default(true),
  includeContent: boolean().notNull().default(false),
  acceptUntrusted: boolean().notNull().default(false),
  // -> Sent verbatim as the Authorization header, so it holds whatever secret the remote expects
  authHeader: text(),
  // -> Outcome of the most recent delivery, which is what the admin list shows
  state: hookStateEnum().notNull().default('pending'),
  lastErrorMessage: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// ICONS -------------------------------
// -> An Iconify icon set the wiki draws icons from, e.g. `mdi`. Adding one makes its icons
//    searchable; individual icons are only stored once something references them.
export const iconSets = pgTable('iconSets', {
  // -> The Iconify prefix, which is what content references: `<prefix>:<name>`
  prefix: varchar({ length: 64 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  isEnabled: boolean().notNull().default(true),
  // -> Iconify collection metadata (author, license, total, palette, samples, ...) as published by
  //    the upstream API, refreshed on demand rather than being authored here
  info: jsonb().notNull().default({}),
  refreshedAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow()
})

// -> The permanent home of every icon the wiki has ever served. Fetched from the Iconify API on first
//    use, then never fetched again: the disk cache is derived from these rows and may be empty.
export const icons = pgTable(
  'icons',
  {
    prefix: varchar({ length: 64 })
      .notNull()
      .references(() => iconSets.prefix),
    name: varchar({ length: 255 }).notNull(),
    // -> The SVG markup inside the `<svg>` element, with `currentColor` left as-is
    body: text().notNull(),
    // -> Resolved Iconify icon properties: the viewBox is `left top width height`, and the transform
    //    flags apply on top of it. Aliases are resolved before storing, so a row is self-contained.
    width: integer().notNull().default(16),
    height: integer().notNull().default(16),
    left: integer().notNull().default(0),
    top: integer().notNull().default(0),
    rotate: integer().notNull().default(0),
    hFlip: boolean().notNull().default(false),
    vFlip: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.prefix, table.name] })]
)

// JOB HISTORY -------------------------
export const jobHistoryStateEnum = pgEnum('jobHistoryState', [
  'active',
  'completed',
  'failed',
  'interrupted'
])
export const jobHistory = pgTable('jobHistory', {
  id: uuid().primaryKey().defaultRandom(),
  task: varchar({ length: 255 }).notNull(),
  state: jobHistoryStateEnum().notNull(),
  useWorker: boolean().notNull().default(false),
  wasScheduled: boolean().notNull().default(false),
  payload: jsonb(),
  attempt: integer().notNull().default(1),
  maxRetries: integer().notNull().default(0),
  lastErrorMessage: text(),
  executedBy: varchar({ length: 255 }),
  createdAt: timestamp().notNull(),
  startedAt: timestamp().notNull().defaultNow(),
  completedAt: timestamp()
})

// JOB SCHEDULE ------------------------
export const jobSchedule = pgTable('jobSchedule', {
  id: uuid().primaryKey().defaultRandom(),
  task: varchar({ length: 255 }).notNull(),
  cron: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 255 }).notNull().default('system'),
  payload: jsonb(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// JOB LOCK ----------------------------
export const jobLock = pgTable('jobLock', {
  key: varchar({ length: 255 }).primaryKey(),
  lastCheckedBy: varchar({ length: 255 }),
  lastCheckedAt: timestamp().notNull().defaultNow()
})

// JOBS --------------------------------
export const jobs = pgTable('jobs', {
  id: uuid().primaryKey().defaultRandom(),
  task: varchar({ length: 255 }).notNull(),
  useWorker: boolean().notNull().default(false),
  payload: jsonb(),
  retries: integer().notNull().default(0),
  maxRetries: integer().notNull().default(0),
  waitUntil: timestamp(),
  isScheduled: boolean().notNull().default(false),
  createdBy: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// LOCALES -----------------------------
export const locales = pgTable(
  'locales',
  {
    code: varchar({ length: 255 }).primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    nativeName: varchar({ length: 255 }).notNull(),
    language: varchar({ length: 8 }).notNull(), // Unicode language subtag
    region: varchar({ length: 3 }).notNull(), // Unicode region subtag
    script: varchar({ length: 4 }).notNull(), // Unicode script subtag
    isRTL: boolean().notNull().default(false),
    /**
     * Whether `strings` holds a real string set. A locale the update task has only seen in the
     * remote metadata gets a row so that it can be offered, but has nothing to serve until it is
     * installed.
     */
    isInstalled: boolean().notNull().default(false),
    /**
     * The remote metadata's hash of the strings file this row was installed from, so that an update
     * only downloads the locales that actually changed. Empty for a locale that came off disk and
     * for one that is not installed yet -- which is exactly what makes the next update fetch it.
     */
    hash: varchar({ length: 64 }).notNull().default(''),
    /**
     * The short code an administrator would rather this locale be shown as -- `zh` for `zh-CN` --
     * overriding the one derived from the tag. An alias and nothing more: `code` stays the identity,
     * so nothing a page, an asset or a storage target already records has to move for this.
     * Null when the derived form is fine, which is the usual case.
     */
    customCode: varchar({ length: 255 }).unique(),
    /**
     * The name an administrator would rather this locale be shown as, overriding the one `Intl`
     * gives for the tag. Display only, and not unique: two locales reading alike in a menu is a
     * choice somebody made, not a collision. Null when the derived name is fine.
     */
    customName: varchar({ length: 255 }),
    strings: jsonb().notNull().default([]),
    completeness: integer().notNull().default(0),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow()
  },
  (table) => [index('locales_language_idx').on(table.language)]
)

// NAVIGATION --------------------------
export const navigation = pgTable(
  'navigation',
  {
    id: uuid().primaryKey().defaultRandom(),
    items: jsonb().notNull().default([]),
    /**
     * Set only on a site-wide menu, naming the locale it is the menu for — the sidebar a page in that
     * locale falls back to when nothing above it overrides one. Null on a menu belonging to a tree
     * entry, which is identified by that entry's id instead. Postgres lets a unique index hold any
     * number of nulls, which is what lets both kinds share the table.
     */
    locale: varchar({ length: 255 }),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [
    index('navigation_siteId_idx').on(table.siteId),
    uniqueIndex('navigation_siteId_locale_key').on(table.siteId, table.locale)
  ]
)

// PAGES ------------------------------
export const pagePublishStateEnum = pgEnum('pagePublishState', ['draft', 'published', 'scheduled'])
export const pages = pgTable(
  'pages',
  {
    id: uuid().primaryKey().defaultRandom(),
    // -> A BCP-47 code, matched only ever for equality. Not `ltree`: a hyphenated code is a single
    //    label to it, so `'pt-BR'::ltree <@ 'pt'` is false and the type buys no locale-family
    //    matching -- see the note on `pageHistory.locale`.
    locale: varchar({ length: 255 }).notNull(),
    path: varchar({ length: 255 }).notNull(),
    hash: varchar({ length: 255 }).notNull(),
    alias: varchar({ length: 255 }),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 255 }),
    icon: varchar({ length: 255 }),
    publishState: pagePublishStateEnum('publishState').notNull().default('draft'),
    publishStartDate: timestamp(),
    publishEndDate: timestamp(),
    config: jsonb().notNull().default({}),
    relations: jsonb().notNull().default([]),
    /**
     * The set of pages this one is a translation of: every page sharing this id is the same page in
     * another locale, and the locale selector uses it to send a reader to the right one.
     *
     * Null for a page with no counterparts, which is most of them — a null is what makes the unique
     * index below tolerate any number of unrelated pages, since postgres counts nulls as distinct.
     * The group has no row of its own: it is an identity, and its membership IS this column.
     */
    localeGroupId: uuid(),
    content: text(),
    render: text(),
    searchContent: text(),
    ts: tsvector('ts'),
    tags: text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    toc: jsonb(),
    editor: varchar({ length: 255 }).notNull(),
    contentType: varchar({ length: 255 }).notNull(),
    isBrowsable: boolean().notNull().default(true),
    isSearchable: boolean().notNull().default(true),
    // -> The generated expression references its own table, so the return type must be annotated
    //    explicitly to break the circular inference (TS7022/TS7024).
    isSearchableComputed: boolean('isSearchableComputed').generatedAlwaysAs(
      (): SQL => sql`${pages.publishState} != 'draft' AND ${pages.isSearchable}`
    ),
    password: varchar({ length: 255 }),
    ratingScore: integer().notNull().default(0),
    ratingCount: timestamp().notNull().defaultNow(),
    scripts: jsonb().notNull().default({}),
    historyData: jsonb().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    authorId: uuid()
      .notNull()
      .references(() => users.id),
    creatorId: uuid()
      .notNull()
      .references(() => users.id),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [
    index('pages_authorId_idx').on(table.authorId),
    index('pages_creatorId_idx').on(table.creatorId),
    index('pages_ownerId_idx').on(table.ownerId),
    index('pages_siteId_idx').on(table.siteId),
    index('pages_ts_idx').using('gin', table.ts),
    index('pages_tags_idx').using('gin', table.tags),
    index('pages_isSearchableComputed_idx').on(table.isSearchableComputed),
    // -> One page per locale in a group, enforced here rather than in the model: a group is edited
    //    from any of its members, so two saves racing each other are two writers of the same set
    uniqueIndex('pages_localeGroupId_locale_idx').on(table.localeGroupId, table.locale)
  ]
)

// PAGE HISTORY ------------------------
/**
 * One row per change to a page: what it looked like afterwards, who made it, and what kind of change
 * it was.
 *
 * Every row is a complete version rather than a delta, which is what makes the three things this
 * exists for straightforward: comparing any two versions, putting a page back to one of them, and
 * recovering a page that was deleted. The deletion itself is recorded the same way, carrying the page
 * as it stood when it went — that row is the whole of what a recovery needs.
 *
 * The render is deliberately not kept. It is derived from the content by a pipeline that lives in the
 * frontend, and storing a second copy of every page's HTML for every version is a great deal of space
 * for something a restore can regenerate.
 */
export const pageHistory = pgTable(
  'pageHistory',
  {
    id: uuid().primaryKey().defaultRandom(),
    // -> Not a foreign key: the history of a deleted page is exactly what recovering it needs, so it
    //    has to outlive the row it points at
    pageId: uuid().notNull(),
    /**
     * `created`, `updated`, `moved` or `deleted`. A varchar rather than an enum so that naming another
     * kind of change later does not need a migration.
     */
    action: varchar({ length: 16 }).notNull().default('updated'),
    /** Which fields this change touched, so a history list can summarise it without diffing. */
    changedFields: text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /*
      Columns rather than part of `meta` below: a history list shows these for every row, a page that
      has moved needs the path it had at the time rather than the one it has now, and looking a history
      up by where the page was — the only way in once the page itself is gone — means matching on the
      locale and the path together.

      A locale code is BCP-47 with hyphens (`pt-BR`), and every comparison anywhere is an equality
      one. `locales.code`, which these values come from, is a varchar too.
    */
    locale: varchar({ length: 255 }).notNull(),
    path: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    content: text(),
    /**
     * The rest of the page as it stood: description, icon, tags, publish state and dates, relations,
     * scripts, config, editor and content type. Kept whole rather than as columns of its own so that a
     * field added to a page does not have to be added here too.
     */
    meta: jsonb().notNull().default({}),
    /**
     * Why the change was made, in the author's words, as the editor's reason-for-change prompt
     * collected it. Null when the site does not ask for one, or asks and is not answered.
     */
    reason: varchar({ length: 255 }),
    versionDate: timestamp().notNull().defaultNow(),
    // -> Null once the account is gone, rather than holding the account hostage: a history row is a
    //    record of what happened to the page, and requiring its author to exist for ever would mean
    //    that editing a page once made an account undeletable — even after the page itself was gone.
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [
    index('pageHistory_pageId_idx').on(table.pageId, table.versionDate),
    // -> "What happened to the page at this path, in this locale", which is how a deleted page is
    //    found again: there is no page row left to look its ID up from. Leading with `siteId` means
    //    this also serves the plain per-site queries.
    index('pageHistory_siteId_idx').on(table.siteId, table.locale, table.path, table.versionDate),
    index('pageHistory_authorId_idx').on(table.authorId)
  ]
)

// PAGE EDIT SUBMISSIONS ---------------
/**
 * An edit suggested by somebody who may read a page but not change it, waiting to be reviewed.
 *
 * Both the resulting source and a patch are kept, because they answer different questions. The patch
 * is what a reviewer merges — it is computed against the page as it stood at submission time, so two
 * people suggesting edits to different parts of a page can both be accepted. The source is what the
 * author resumes from and what a review screen shows, and it cannot be reconstructed from the patch
 * alone once the page has moved on.
 */
export const pageEditSubmissions = pgTable(
  'pageEditSubmissions',
  {
    id: uuid().primaryKey().defaultRandom(),
    content: text().notNull(),
    /** Unified diff, from the page content this was based on to `content`. */
    patch: text().notNull(),
    /** SHA-256 of that base content, so a reviewer can tell the page has changed underneath. */
    baseHash: varchar({ length: 64 }).notNull(),
    // -> A guest has no account to attribute the suggestion to, so it says who sent it. Null for a
    //    logged in author, whose name is on `authorId` instead.
    guestName: varchar({ length: 255 }),
    guestEmail: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    authorId: uuid().references(() => users.id)
  },
  (table) => [
    index('pageEditSubmissions_pageId_idx').on(table.pageId),
    index('pageEditSubmissions_siteId_idx').on(table.siteId),
    index('pageEditSubmissions_authorId_idx').on(table.authorId),
    // -> One open suggestion per person per page: coming back to the button continues that one rather
    //    than starting a second. Guests are excluded because they are all the same nobody.
    uniqueIndex('pageEditSubmissions_page_author_idx')
      .on(table.pageId, table.authorId)
      .where(sql`"authorId" IS NOT NULL`)
  ]
)

// PAGE WATCHING -----------------------
/**
 * A page somebody asked to be told about, one row per person per page.
 *
 * A row IS the watch: there is no `isEnabled` to turn off, because unwatching a page is not a state a
 * page keeps — it is the absence of interest, and the row goes. Which is also why the whole table can
 * be read as "everyone to notify about this page" when notifications are built on top of it.
 *
 * `siteId` is carried alongside `pageId` rather than reached through the page, since every query here
 * is scoped to one site: the watch list belongs to an inbox, and an inbox belongs to a site.
 */
export const pageWatching = pgTable(
  'pageWatching',
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp().notNull().defaultNow(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
  },
  (table) => [
    // -> Covers the site scoping too, being the leading column: this is the inbox's own query
    index('pageWatching_user_site_idx').on(table.userId, table.siteId),
    // -> Watching a page twice is watching it once, so the second attempt is a no-op rather than a row
    uniqueIndex('pageWatching_page_user_idx').on(table.pageId, table.userId)
  ]
)

// PAGE RENDER QUEUE -------------------
/**
 * A page waiting for the server to render it, one row per page.
 *
 * The markdown pipeline lives in the frontend, so rendering a page here means driving a headless
 * browser — too heavy to hold a request open for, and ruinous to do several times at once. A row is a
 * request for a render, and the `renderPages` task drains the table one page at a time through a
 * single browser (`models/rendering.ts`).
 *
 * A row IS the request, so asking twice for the same page updates the row instead of adding a second:
 * what gets rendered is the content as it stands when the browser reaches it, and rendering it twice
 * would produce the same HTML. `createdAt` keeps its place in the queue across those repeats.
 *
 * The two permissions travel with the row because a render is sanitized against what the person who
 * asked for it may embed, and by the time the job runs there is no session left to ask.
 */
export const pageRenderQueue = pgTable(
  'pageRenderQueue',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** `write:scripts` — whether this render may keep `<script>` and inline handlers. */
    allowScripts: boolean().notNull().default(false),
    /** `write:styles` — whether this render may keep `<style>` and inline `style` attributes. */
    allowStyles: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    pageId: uuid()
      .notNull()
      .unique()
      .references(() => pages.id, { onDelete: 'cascade' }),
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    // -> Only ever logged, and a deleted account is no reason to drop a render somebody is waiting for
    requestedById: uuid().references(() => users.id, { onDelete: 'set null' })
  },
  // -> How the drain picks what to render next
  (table) => [index('pageRenderQueue_createdAt_idx').on(table.createdAt)]
)

// RATE LIMITS -------------------------
/**
 * One counter per rate-limited client, and the ban it has earned itself.
 *
 * In the database rather than in each instance's memory because a limit every instance enforces on
 * its own is a limit multiplied by however many are running — and because a ban has to hold when the
 * next attempt lands on another one. Every read and write of a row happens in a single upserting
 * statement (`models/rateLimits.ts`), which is what makes concurrent attempts count exactly once.
 *
 * Rows are self-correcting: an expired window or ban is reset by the next attempt on that key. They
 * are only ever deleted to reclaim space — see the `purgeRateLimits` task.
 */
export const rateLimits = pgTable(
  'rateLimits',
  {
    /** What is being limited and who by, e.g. `auth:203.0.113.4`. */
    key: varchar({ length: 255 }).primaryKey(),
    /** Attempts made inside the current window. */
    hits: integer().notNull().default(0),
    windowStartedAt: timestamp().notNull().defaultNow(),
    /** When the ban lifts. Null for a client that has not earned one. */
    bannedUntil: timestamp(),
    updatedAt: timestamp().notNull().defaultNow()
  },
  // -> How the purge finds rows nothing has touched in a long while
  (table) => [index('rateLimits_updatedAt_idx').on(table.updatedAt)]
)

// SETTINGS ----------------------------
export const settings = pgTable('settings', {
  key: varchar({ length: 255 }).notNull().primaryKey(),
  value: jsonb().notNull().default({})
})

// SESSIONS ----------------------------
export const sessions = pgTable(
  'sessions',
  {
    id: varchar({ length: 255 }).primaryKey(),
    userId: uuid().references(() => users.id),
    data: jsonb().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow()
  },
  (table) => [index('sessions_userId_idx').on(table.userId)]
)

// SITES -------------------------------
export const sites = pgTable('sites', {
  id: uuid().primaryKey().defaultRandom(),
  hostname: varchar({ length: 255 }).notNull().unique(),
  isEnabled: boolean().notNull().default(false),
  config: jsonb().notNull(),
  createdAt: timestamp().notNull().defaultNow()
})

// -> The images an administrator uploads for a site — its logo, favicon and login background — one row
//    per kind. Held in the database rather than under `dataPath`, which is a cache: an instance that
//    comes back with an empty data directory must still look like itself. Whether a kind has been
//    uploaded at all is mirrored in the site's `config.assets`, so serving a site that has uploaded
//    nothing costs no query here.
export const siteAssets = pgTable(
  'siteAssets',
  {
    siteId: uuid()
      .notNull()
      .references(() => sites.id),
    kind: varchar({ length: 255 }).notNull(),
    data: bytea().notNull()
  },
  (table) => [primaryKey({ columns: [table.siteId, table.kind] })]
)

// STORAGE -----------------------------
export const storage = pgTable(
  'storage',
  {
    id: uuid().primaryKey().defaultRandom(),
    // -> Directory name under `modules/storage`, one row per module per site
    module: varchar({ length: 255 }).notNull(),
    isEnabled: boolean().notNull().default(false),
    // -> `{ activeTypes: string[] }`, i.e. which kinds of content are written here. What counts as a
    //    large file is not among them: that is one answer per site, in the site's own config.
    contentTypes: jsonb().notNull().default({}),
    // -> `{ streaming: boolean, directAccess: boolean, servedTypes: string[] }`. `servedTypes` names
    //    the content types a reader's request is answered from this target, and is a subset of
    //    `contentTypes.activeTypes` — a target can only serve back what it was asked to store.
    assetDelivery: jsonb().notNull().default({}),
    // -> Values for the props the module declares in its `definition.yml`
    config: jsonb().notNull().default({}),
    // -> `{ status: 'healthy' | 'warning' | 'error', message: string, updatedAt: string | null }`:
    //    how the target is actually behaving, as opposed to how it is configured. Written by the
    //    storage model as it dispatches to the module — never by the admin area, which is why it is
    //    absent from the storage PUT — and reported by the Status card on the target's page.
    state: jsonb().notNull().default({}),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  // -> Covers lookups by site as well, being the leading column
  (table) => [uniqueIndex('storage_composite_idx').on(table.siteId, table.module)]
)

// TAGS --------------------------------
export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    tag: varchar({ length: 255 }).notNull(),
    usageCount: integer().notNull().default(0),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [
    index('tags_siteId_idx').on(table.siteId),
    uniqueIndex('tags_composite_idx').on(table.siteId, table.tag)
  ]
)

// TREE --------------------------------
export const treeTypeEnum = pgEnum('treeType', ['folder', 'page', 'asset'])
export const treeNavigationModeEnum = pgEnum('treeNavigationMode', [
  'inherit',
  'override',
  'overrideExact',
  'hide',
  'hideExact'
])
export const tree = pgTable(
  'tree',
  {
    id: uuid().primaryKey().defaultRandom(),
    // -> Genuinely hierarchical, and queried as such with `<@`, `@>` and lquery: this is what ltree is
    //    for. The locale beside it is not, and is a plain string.
    folderPath: ltree('folderPath'),
    fileName: varchar({ length: 255 }).notNull(),
    hash: varchar({ length: 255 }).notNull(),
    type: treeTypeEnum('tree').notNull(),
    locale: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    navigationMode: treeNavigationModeEnum('navigationMode').notNull().default('inherit'),
    navigationId: uuid(),
    tags: text()
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    meta: jsonb().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [
    index('tree_folderpath_idx').on(table.folderPath),
    index('tree_folderpath_gist_idx').using('gist', table.folderPath),
    index('tree_fileName_idx').on(table.fileName),
    index('tree_hash_idx').on(table.hash),
    index('tree_type_idx').on(table.type),
    // -> A plain btree: the locale is a string compared for equality, and GiST — which is what an
    //    ltree column wanted — has no operator class for varchar at all
    index('tree_locale_idx').on(table.locale),
    index('tree_navigationMode_idx').on(table.navigationMode),
    index('tree_navigationId_idx').on(table.navigationId),
    index('tree_tags_idx').using('gin', table.tags),
    index('tree_siteId_idx').on(table.siteId)
  ]
)

// USER AVATARS ------------------------
export const userAvatars = pgTable('userAvatars', {
  id: uuid().primaryKey(),
  data: bytea().notNull()
})

// USER KEYS ---------------------------
export const userKeys = pgTable(
  'userKeys',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: varchar({ length: 255 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    meta: jsonb().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    validUntil: timestamp().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id)
  },
  (table) => [index('userKeys_userId_idx').on(table.userId)]
)

// USERS -------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }).notNull().unique(),
    name: varchar({ length: 255 }).notNull(),
    auth: jsonb().notNull().default({}),
    meta: jsonb().notNull().default({}),
    passkeys: jsonb().notNull().default({}),
    prefs: jsonb().notNull().default({}),
    hasAvatar: boolean().notNull().default(false),
    isActive: boolean().notNull().default(false),
    isSystem: boolean().notNull().default(false),
    isVerified: boolean().notNull().default(false),
    lastLoginAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow()
  },
  (table) => [index('users_lastLoginAt_idx').on(table.lastLoginAt)]
)

// == RELATION TABLES ==================

// USER GROUPS -------------------------
export const userGroups = pgTable(
  'userGroups',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.groupId] }),
    index('userGroups_userId_idx').on(table.userId),
    index('userGroups_groupId_idx').on(table.groupId),
    index('userGroups_composite_idx').on(table.userId, table.groupId)
  ]
)
