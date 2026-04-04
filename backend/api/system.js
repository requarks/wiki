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
async function routes(app) {
  /**
   * SYSTEM INFO
   */
  app.get(
    '/info',
    {
      config: {
        permissions: ['read:dashboard']
      },
      schema: {
        summary: 'System Info',
        tags: ['System'],
        response: {
          200: {
            description: 'System Info',
            type: 'object',
            properties: {
              configFile: {
                type: 'string'
              },
              cpuCores: {
                type: 'number'
              },
              currentVersion: {
                type: 'string'
              },
              dbHost: {
                type: 'string'
              },
              groupsTotal: {
                type: 'number'
              },
              hostname: {
                type: 'string'
              },
              httpPort: {
                type: 'number'
              },
              isMailConfigured: {
                type: 'boolean'
              },
              isSchedulerHealthy: {
                type: 'boolean'
              },
              latestVersion: {
                type: 'string'
              },
              latestVersionReleaseDate: {
                type: 'string',
                format: 'date-time'
              },
              loginsPastDay: {
                type: 'number'
              },
              nodeVersion: {
                type: 'string'
              },
              operatingSystem: {
                type: 'string'
              },
              pagesTotal: {
                type: 'number'
              },
              platform: {
                type: 'string'
              },
              ramTotal: {
                type: 'string'
              },
              tagsTotal: {
                type: 'string'
              },
              upgradeCapable: {
                type: 'boolean'
              },
              usersTotal: {
                type: 'number'
              },
              workingDirectory: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async () => {
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
        isSchedulerHealthy: true, // TODO:
        latestVersion: WIKI.config.update.version,
        latestVersionReleaseDate: WIKI.config.update.versionDate,
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

  /**
   * SYSTEM FLAGS
   */
  app.get(
    '/flags',
    {
      schema: {
        summary: 'System Flags',
        tags: ['System'],
        response: {
          200: {
            description: 'System Flags',
            type: 'object',
            properties: {
              experimental: {
                type: 'boolean'
              },
              authDebug: {
                type: 'boolean'
              },
              sqlLog: {
                type: 'boolean'
              }
            }
          }
        }
      }
    },
    async () => {
      return WIKI.config.flags
    }
  )

  /**
   * LIST SYSTEM INSTANCES
   */
  app.get(
    '/instances',
    {
      config: {
        permissions: ['manage:system']
      },
      schema: {
        summary: 'List System Instances',
        tags: ['System'],
        response: {
          200: {
            description: 'List of all system instances',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string'
                },
                activeConnections: {
                  type: 'number'
                },
                activeListeners: {
                  type: 'number'
                },
                dbUser: {
                  type: 'string'
                },
                dbFirstSeen: {
                  type: 'string',
                  format: 'date-time'
                },
                dbLastSeen: {
                  type: 'string',
                  format: 'date-time'
                },
                ip: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    async () => {
      const instRaw = await WIKI.db.execute(
        sql`SELECT usename, client_addr, application_name, backend_start, state_change FROM pg_stat_activity WHERE datname = ${WIKI.dbManager.dbName} AND application_name LIKE 'Wiki.js%'`
      )
      const insts = {}
      for (const inst of instRaw.rows) {
        const instId = inst.application_name.substring(10, 20)
        const conType = [':MAIN', ':WORKER'].some((ct) => inst.application_name.endsWith(ct))
          ? 'main'
          : 'sub'
        inst.backend_start = DateTime.fromSQL(inst.backend_start).toISO()
        inst.state_change = DateTime.fromSQL(inst.state_change).toISO()
        const curInst = insts[instId] ?? {
          activeConnections: 0,
          activeListeners: 0,
          dbFirstSeen: inst.backend_start,
          dbLastSeen: inst.state_change
        }
        insts[instId] = {
          id: instId,
          activeConnections:
            conType === 'main' ? curInst.activeConnections + 1 : curInst.activeConnections,
          activeListeners:
            conType === 'sub' ? curInst.activeListeners + 1 : curInst.activeListeners,
          dbUser: inst.usename,
          dbFirstSeen:
            curInst.dbFirstSeen > inst.backend_start ? inst.backend_start : curInst.dbFirstSeen,
          dbLastSeen:
            curInst.dbLastSeen < inst.state_change ? inst.state_change : curInst.dbLastSeen,
          ip: inst.client_addr
        }
      }
      return Object.values(insts)
    }
  )

  /**
   * CHECK FOR UPDATE
   */
  app.post(
    '/checkForUpdate',
    {
      config: {
        permissions: ['read:dashboard']
      },
      schema: {
        summary: 'Check for Updates',
        tags: ['System'],
        response: {
          200: {
            description: 'Update Info',
            type: 'object',
            properties: {
              current: {
                type: 'string'
              },
              latest: {
                type: 'string'
              },
              latestDate: {
                type: 'string',
                format: 'date-time'
              }
            }
          }
        }
      }
    },
    async () => {
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
