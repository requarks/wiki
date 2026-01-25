import { boolean, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// AUTHENTICATION ----------------------
export const authenticationTable = pgTable('authentication', {
  id: uuid().primaryKey().defaultRandom(),
  module: varchar({ length: 255 }).notNull(),
  isEnabled: boolean().notNull().default(false),
  displayName: varchar({ length: 255 }).notNull().default(''),
  config: jsonb().notNull().default({}),
  registration: boolean().notNull().default(false),
  allowedEmailRegex: varchar({ length: 255 }).notNull().default(''),
  autoEnrollGroups: uuid().array().default([])
})

// GROUPS ------------------------------
export const groupsTable = pgTable('groups', {
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

// SETTINGS ----------------------------
export const settingsTable = pgTable('settings', {
  key: varchar({ length: 255 }).notNull().primaryKey(),
  value: jsonb().notNull().default({})
})

// SITES -------------------------------
export const sitesTable = pgTable('sites', {
  id: uuid().primaryKey().defaultRandom(),
  hostname: varchar({ length: 255 }).notNull().unique(),
  isEnabled: boolean().notNull().default(false),
  config: jsonb().notNull(),
  createdAt: timestamp().notNull().defaultNow()
})

// USERS -------------------------------
export const usersTable = pgTable('users', {
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
  index('lastLoginAt_idx').on(table.lastLoginAt)
])
