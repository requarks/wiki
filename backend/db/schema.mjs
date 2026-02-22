import { defineRelations, sql } from 'drizzle-orm'
import { bigint, boolean, bytea, customType, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

// == CUSTOM TYPES =====================

const ltree = customType({
  dataType () {
    return 'ltree'
  }
})
const tsvector = customType({
  dataType () {
    return 'tsvector'
  }
})

// == TABLES ===========================

// API KEYS ----------------------------
export const apiKeys = pgTable('apiKeys', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  key: text().notNull(),
  expiration: timestamp().notNull().defaultNow(),
  isRevoked: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// ASSETS ------------------------------
export const assetKindEnum = pgEnum('assetKind', ['document', 'image', 'other'])
export const assets = pgTable('assets', {
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
  authorId: uuid().notNull().references(() => users.id),
  siteId: uuid().notNull().references(() => sites.id),
}, (table) => [
  index('assets_siteId_idx').on(table.siteId)
])

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
export const blocks = pgTable('blocks', {
  id: uuid().primaryKey().defaultRandom(),
  block: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }).notNull(),
  icon: varchar({ length: 255 }).notNull(),
  isEnabled: boolean().notNull().default(false),
  isCustom: boolean().notNull().default(false),
  config: jsonb().notNull().default({}),
  siteId: uuid().notNull().references(() => sites.id),
}, (table) => [
  index('blocks_siteId_idx').on(table.siteId)
])

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

// JOB HISTORY -------------------------
export const jobHistoryStateEnum = pgEnum('jobHistoryState', ['active', 'completed', 'failed', 'interrupted'])
export const jobHistory = pgTable('jobHistory', {
  id: uuid().primaryKey().defaultRandom(),
  task: varchar({ length: 255 }).notNull(),
  state: jobHistoryStateEnum().notNull(),
  useWorker: boolean().notNull().default(false),
  wasScheduled: boolean().notNull().default(false),
  payload: jsonb().notNull(),
  attempt: integer().notNull().default(1),
  maxRetries: integer().notNull().default(0),
  lastErrorMessage: text(),
  executedBy: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  completedAt: timestamp().notNull()
})

// JOB SCHEDULE ------------------------
export const jobSchedule = pgTable('jobSchedule', {
  id: uuid().primaryKey().defaultRandom(),
  task: varchar({ length: 255 }).notNull(),
  cron: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 255 }).notNull().default('system'),
  payload: jsonb().notNull(),
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
  payload: jsonb().notNull(),
  retries: integer().notNull().default(0),
  maxRetries: integer().notNull().default(0),
  waitUntil: timestamp(),
  isScheduled: boolean().notNull().default(false),
  createdBy: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow()
})

// LOCALES -----------------------------
export const locales = pgTable('locales', {
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
}, (table) => [
  index('locales_language_idx').on(table.language)
])

// NAVIGATION --------------------------
export const navigation = pgTable('navigation', {
  id: uuid().primaryKey().defaultRandom(),
  items: jsonb().notNull().default([]),
  siteId: uuid().notNull().references(() => sites.id),
}, (table) => [
  index('navigation_siteId_idx').on(table.siteId)
])

// PAGES ------------------------------
export const pagePublishStateEnum = pgEnum('pagePublishState', ['draft', 'published', 'scheduled'])
export const pages = pgTable('pages', {
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
  tags: text().array().notNull().default(sql`ARRAY[]::text[]`),
  toc: jsonb(),
  editor: varchar({ length: 255 }).notNull(),
  contentType: varchar({ length: 255 }).notNull(),
  isBrowsable: boolean().notNull().default(true),
  isSearchable: boolean().notNull().default(true),
  isSearchableComputed: boolean('isSearchableComputed').generatedAlwaysAs(() => sql`${pages.publishState} != 'draft' AND ${pages.isSearchable}`),
  password: varchar({ length: 255 }),
  ratingScore: integer().notNull().default(0),
  ratingCount: timestamp().notNull().defaultNow(),
  scripts: jsonb().notNull().default({}),
  historyData: jsonb().notNull().default({}),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  authorId: uuid().notNull().references(() => users.id),
  creatorId: uuid().notNull().references(() => users.id),
  ownerId: uuid().notNull().references(() => users.id),
  siteId: uuid().notNull().references(() => sites.id),
}, (table) => [
  index('pages_authorId_idx').on(table.authorId),
  index('pages_creatorId_idx').on(table.creatorId),
  index('pages_ownerId_idx').on(table.ownerId),
  index('pages_siteId_idx').on(table.siteId),
  index('pages_ts_idx').using('gin', table.ts),
  index('pages_tags_idx').using('gin', table.tags),
  index('pages_isSearchableComputed_idx').on(table.isSearchableComputed)
])

// SETTINGS ----------------------------
export const settings = pgTable('settings', {
  key: varchar({ length: 255 }).notNull().primaryKey(),
  value: jsonb().notNull().default({})
})

// SITES -------------------------------
export const sites = pgTable('sites', {
  id: uuid().primaryKey().defaultRandom(),
  hostname: varchar({ length: 255 }).notNull().unique(),
  isEnabled: boolean().notNull().default(false),
  config: jsonb().notNull(),
  createdAt: timestamp().notNull().defaultNow()
})

// TAGS --------------------------------
export const tags = pgTable('tags', {
  id: uuid().primaryKey().defaultRandom(),
  tag: varchar({ length: 255 }).notNull(),
  usageCount: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  siteId: uuid().notNull().references(() => sites.id)
}, (table) => [
  index('tags_siteId_idx').on(table.siteId),
  uniqueIndex('tags_composite_idx').on(table.siteId, table.tag)
])

// TREE --------------------------------
export const treeTypeEnum = pgEnum('treeType', ['folder', 'page', 'asset'])
export const treeNavigationModeEnum = pgEnum('treeNavigationMode', ['inherit', 'override', 'overrideExact', 'hide', 'hideExact'])
export const tree = pgTable('tree', {
  id: uuid().primaryKey().defaultRandom(),
  folderPath: ltree('folderPath'),
  fileName: varchar({ length: 255 }).notNull(),
  hash: varchar({ length: 255 }).notNull(),
  type: treeTypeEnum('tree').notNull(),
  locale: ltree('locale').notNull(),
  title: varchar({ length: 255 }).notNull(),
  navigationMode: treeNavigationModeEnum('navigationMode').notNull().default('inherit'),
  navigationId: uuid(),
  tags: text().array().notNull().default(sql`ARRAY[]::text[]`),
  meta: jsonb().notNull().default({}),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  siteId: uuid().notNull().references(() => sites.id)
}, (table) => [
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
])

// USER AVATARS ------------------------
export const userAvatars = pgTable('userAvatars', {
  id: uuid().primaryKey(),
  data: bytea().notNull()
})

// USER KEYS ---------------------------
export const userKeys = pgTable('userKeys', {
  id: uuid().primaryKey().defaultRandom(),
  kind: varchar({ length: 255 }).notNull(),
  token: varchar({ length: 255 }).notNull(),
  meta: jsonb().notNull().default({}),
  createdAt: timestamp().notNull().defaultNow(),
  validUntil: timestamp().notNull(),
  userId: uuid().notNull().references(() => users.id)
}, (table) => [
  index('userKeys_userId_idx').on(table.userId)
])

// USERS -------------------------------
export const users = pgTable('users', {
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
}, (table) => [
  index('users_lastLoginAt_idx').on(table.lastLoginAt)
])

// == RELATION TABLES ==================

// USER GROUPS -------------------------
export const userGroups = pgTable('userGroups', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid().notNull().references(() => groups.id, { onDelete: 'cascade' })
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
  index('userGroups_userId_idx').on(table.userId),
  index('userGroups_groupId_idx').on(table.groupId),
  index('userGroups_composite_idx').on(table.userId, table.groupId)
])

// == RELATIONS ========================

export const relations = defineRelations({ users, groups, userGroups },
  r => ({
    users: {
      groups: r.many.groups({
        from: r.users.id.through(r.userGroups.userId),
        to: r.groups.id.through(r.userGroups.groupId)
      })
    },
    groups: {
      members: r.many.users()
    }
  })
)
