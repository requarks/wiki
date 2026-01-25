import { settingsTable } from '../db/schema.mjs'
import { has, reduce, set } from 'lodash-es'
import { pem2jwk } from 'pem-jwk'
import crypto from 'node:crypto'

/**
 * Settings model
 */
class Settings {
  /**
   * Fetch settings from DB
   * @returns {Promise<Object>} Settings
   */
  async getConfig () {
    const settings = await WIKI.db.select().from(settingsTable)
    if (settings.length > 0) {
      return reduce(settings, (res, val, key) => {
        set(res, val.key, (has(val.value, 'v')) ? val.value.v : val.value)
        return res
      }, {})
    } else {
      return false
    }
  }

  /**
   * Apply settings to DB
   * @param {string} key Setting key
   * @param {Object} value Setting value object
   */
  async updateConfig (key, value) {
    await WIKI.models.insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } })
  }

  /**
   * Initialize settings table
   * @param {Object} ids Generated IDs
   */
  async init (ids) {
    WIKI.logger.info('Generating certificates...')
    const secret = crypto.randomBytes(32).toString('hex')
    const certs = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: secret
      }
    })

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
          audience: 'urn:wiki.js',
          tokenExpiration: '30m',
          tokenRenewal: '14d',
          certs: {
            jwk: pem2jwk(certs.publicKey),
            public: certs.publicKey,
            private: certs.privateKey
          },
          secret,
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
          defaultBaseURL: 'https://wiki.example.com',
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
          disallowFloc: true,
          disallowIframe: true,
          disallowOpenRedirect: true,
          enforceCsp: false,
          enforceHsts: false,
          enforceSameOriginReferrerPolicy: true,
          forceAssetDownload: true,
          hstsDuration: 0,
          trustProxy: false,
          authJwtAudience: 'urn:wiki.js',
          authJwtExpiration: '30m',
          authJwtRenewablePeriod: '14d',
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
