import { settings as settingsTable } from '../db/schema.ts'
import { generateSigningCertificates } from './apiKeys.ts'
import crypto from 'node:crypto'
import type { SystemIds } from './types.ts'

/**
 * Settings model
 */
class Settings {
  /**
   * Fetch settings from DB
   * @returns Settings, or `false` when the table is empty
   */
  async getConfig(): Promise<Record<string, any> | false> {
    const settings = await WIKI.db.select().from(settingsTable)
    if (settings.length > 0) {
      return settings.reduce((res: Record<string, any>, val: any) => {
        res[val.key] = 'v' in val.value ? val.value.v : val.value
        return res
      }, {})
    } else {
      return false
    }
  }

  /**
   * Apply settings to DB
   * @param key Setting key
   * @param value Setting value object
   */
  async updateConfig(key: string, value: Record<string, any>): Promise<void> {
    await WIKI.db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } })
  }

  /**
   * Initialize settings table
   * @param ids Generated IDs
   */
  async init(ids: SystemIds): Promise<void> {
    WIKI.logger.info('Generating certificates...')
    const certs = generateSigningCertificates()

    WIKI.logger.info('Inserting default settings...')
    await WIKI.db.insert(settingsTable).values([
      {
        key: 'api',
        value: {
          isEnabled: false
        }
      },
      {
        key: 'auth',
        value: {
          // -> The installation keypair, carrying its own passphrase. Its one job is signing API
          //    keys (`models/apiKeys.ts`).
          certs,
          // -> What @fastify/session signs its cookies with, and nothing else. Separate from the
          //    keypair's passphrase so that either can be rotated without disturbing the other —
          //    the two utilities that do so are `POST /system/certificates` and
          //    `POST /system/sessions/invalidate`.
          secret: crypto.randomBytes(32).toString('hex'),
          rootAdminGroupId: ids.groupAdminId,
          rootAdminUserId: ids.userAdminId,
          guestUserId: ids.userGuestId
        }
      },
      {
        key: 'flags',
        value: {
          experimental: false,
          authDebug: false,
          sqlLog: false
        }
      },
      {
        key: 'icons',
        value: {
          fa: {
            isActive: true,
            config: {
              version: 6,
              license: 'free',
              token: ''
            }
          },
          la: {
            isActive: true
          }
        }
      },
      {
        key: 'mail',
        value: {
          senderName: '',
          senderEmail: '',
          defaultBaseURL: '',
          host: '',
          port: 465,
          name: '',
          secure: true,
          verifySSL: true,
          user: '',
          pass: '',
          useDKIM: false,
          dkimDomainName: '',
          dkimKeySelector: '',
          dkimPrivateKey: ''
        }
      },
      {
        key: 'metrics',
        value: {
          isEnabled: false
        }
      },
      {
        key: 'search',
        value: {
          termHighlighting: true,
          dictOverrides: {}
        }
      },
      {
        key: 'security',
        value: {
          corsConfig: '',
          corsMode: 'OFF',
          cspDirectives: '',
          disallowIframe: true,
          disallowOpenRedirect: true,
          enforceCsp: false,
          enforceHsts: false,
          enforceSameOriginReferrerPolicy: true,
          forceAssetDownload: true,
          hstsDuration: 0,
          trustProxy: false,
          uploadMaxFileSize: 10485760,
          uploadMaxFiles: 20,
          uploadScanSVG: true
        }
      },
      {
        key: 'update',
        value: {
          lastCheckedAt: null,
          version: WIKI.version,
          versionDate: WIKI.releaseDate
        }
      },
      {
        key: 'userDefaults',
        value: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h'
        }
      }
    ])
  }
}

export const settings = new Settings()
