import path from 'node:path'
import os from 'node:os'
import { DateTime } from 'luxon'
import { filesize } from 'filesize'
import { isNil } from 'es-toolkit/predicate'
import { gte, sql } from 'drizzle-orm'
import {
  groups as groupsTable,
  pages as pagesTable,
  tags as tagsTable,
  users as usersTable
} from '../db/schema.js'

/**
 * System API Routes
 */
async function routes(app, options) {
  app.get(
    '/info',
    {
      config: {
        permissions: ['read:dashboard']
      },
      schema: {
        summary: 'System Info',
        tags: ['System']
      }
    },
    async (request, reply) => {
      return {
        configFile: path.join(process.cwd(), 'config.yml'),
        cpuCores: os.cpus().length,
        currentVersion: WIKI.version,
        dbHost: WIKI.config.db.host,
        dbVersion: WIKI.dbManager.VERSION,
        groupsTotal: await WIKI.db.$count(groupsTable),
        hostname: os.hostname(),
        httpPort: 0,
        isMailConfigured: WIKI.config?.mail?.host?.length > 2,
        isSchedulerHealthy: true,
        latestVersion: WIKI.config.update.version,
        latestVersionReleaseDate: DateTime.fromISO(WIKI.config.update.versionDate).toJSDate(),
        loginsPastDay: await WIKI.db.$count(
          usersTable,
          gte(usersTable.lastLoginAt, sql`NOW() - INTERVAL '1 DAY'`)
        ),
        nodeVersion: process.version.substring(1),
        operatingSystem: `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`,
        pagesTotal: await WIKI.db.$count(pagesTable),
        platform: os.platform(),
        ramTotal: filesize(os.totalmem()),
        tagsTotal: await WIKI.db.$count(tagsTable),
        upgradeCapable: !isNil(process.env.UPGRADE_COMPANION),
        usersTotal: await WIKI.db.$count(usersTable),
        workingDirectory: process.cwd()
      }
    }
  )

  app.get(
    '/flags',
    {
      schema: {
        summary: 'System Flags',
        tags: ['System']
      }
    },
    async (request, reply) => {
      return WIKI.config.flags
    }
  )

  app.get(
    '/checkForUpdate',
    {
      config: {
        permissions: ['read:dashboard']
      },
      schema: {
        summary: 'Check for Updates',
        tags: ['System']
      }
    },
    async (request, reply) => {
      const renderJob = await WIKI.scheduler.addJob({
        task: 'checkVersion',
        maxRetries: 0,
        promise: true
      })
      await renderJob.promise
      return {
        current: WIKI.version,
        latest: WIKI.config.update.version,
        latestDate: WIKI.config.update.versionDate
      }
    }
  )
}

export default routes
