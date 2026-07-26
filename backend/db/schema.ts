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
    data: bytea(),
    preview: bytea(),
    storageInfo: jsonb(),
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
    siteId: uuid()
      .notNull()
      .references(() => sites.id)
  },
  (table) => [index('navigation_siteId_idx').on(table.siteId)]
)

// PAGES ------------------------------
export const pagePublishStateEnum = pgEnum('pagePublishState', ['draft', 'published', 'scheduled'])
export const pages = pgTable(
  'pages',
  {
    id: uuid().primaryKey().defaultRandom(),
    locale: ltree('locale').notNull(),
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
    index('pages_isSearchableComputed_idx').on(table.isSearchableComputed)
  ]
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

// STORAGE -----------------------------
export const storage = pgTable(
  'storage',
  {
    id: uuid().primaryKey().defaultRandom(),
    // -> Directory name under `modules/storage`, one row per module per site
    module: varchar({ length: 255 }).notNull(),
    isEnabled: boolean().notNull().default(false),
    // -> `{ activeTypes: string[], largeThreshold: string }`
    contentTypes: jsonb().notNull().default({}),
    // -> `{ streaming: boolean, directAccess: boolean }`
    assetDelivery: jsonb().notNull().default({}),
    // -> `{ enabled: boolean }`
    versioning: jsonb().notNull().default({}),
    // -> Values for the props the module declares in its `definition.yml`
    config: jsonb().notNull().default({}),
    // -> Where the module stands, as opposed to how it is configured: `{ setup: 'notconfigured' |
    //    'pendinginstall' | 'configured' }` for a module that has a setup process to go through.
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
    folderPath: ltree('folderPath'),
    fileName: varchar({ length: 255 }).notNull(),
    hash: varchar({ length: 255 }).notNull(),
    type: treeTypeEnum('tree').notNull(),
    locale: ltree('locale').notNull(),
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
    index('tree_locale_idx').using('gist', table.locale),
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
