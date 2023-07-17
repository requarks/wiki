import { Model } from 'objection'
import { defaultsDeep, keyBy } from 'lodash-es'
import { v4 as uuid } from 'uuid'

/**
 * Site model
 */
export class Site extends Model {
  static get tableName () { return 'sites' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['hostname'],

      properties: {
        id: { type: 'string' },
        hostname: { type: 'string' },
        isEnabled: { type: 'boolean', default: false }
      }
    }
  }

  static get jsonAttributes () {
    return ['config']
  }

  static async getSiteByHostname ({ hostname, forceReload = false }) {
    if (forceReload) {
      await WIKI.db.sites.reloadCache()
    }
    const siteId = WIKI.sitesMappings[hostname] || WIKI.sitesMappings['*']
    if (siteId) {
      return WIKI.sites[siteId]
    }
    return null
  }

  static async reloadCache () {
    WIKI.logger.info('Reloading site configurations...')
    const sites = await WIKI.db.sites.query().orderBy('id')
    WIKI.sites = keyBy(sites, 'id')
    WIKI.sitesMappings = {}
    for (const site of sites) {
      WIKI.sitesMappings[site.hostname] = site.id
    }
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  static async createSite (hostname, config) {
    const newSiteId = uuid

    const newDefaultNav = await WIKI.db.navigation.query().insertAndFetch({
      name: 'Default',
      siteId: newSiteId,
      items: JSON.stringify([])
    })

    const newSite = await WIKI.db.sites.query().insertAndFetch({
      id: newSiteId,
      hostname,
      isEnabled: true,
      config: defaultsDeep(config, {
        title: 'My Wiki Site',
        description: '',
        company: '',
        contentLicense: '',
        footerExtra: '',
        pageExtensions: ['md', 'html', 'txt'],
        pageCasing: true,
        discoverable: false,
        defaults: {
          tocDepth: {
            min: 1,
            max: 2
          }
        },
        features: {
          ratings: false,
          ratingsMode: 'off',
          comments: false,
          contributions: false,
          profile: true,
          search: true
        },
        logoUrl: '',
        logoText: true,
        sitemap: true,
        robots: {
          index: true,
          follow: true
        },
        locales: {
          primary: 'en',
          active: ['en']
        },
        assets: {
          logo: false,
          logoExt: 'svg',
          favicon: false,
          faviconExt: 'svg',
          loginBg: false
        },
        theme: {
          dark: false,
          codeBlocksTheme: 'github-dark',
          colorPrimary: '#1976D2',
          colorSecondary: '#02C39A',
          colorAccent: '#FF9800',
          colorHeader: '#000000',
          colorSidebar: '#1976D2',
          injectCSS: '',
          injectHead: '',
          injectBody: '',
          contentWidth: 'full',
          sidebarPosition: 'left',
          tocPosition: 'right',
          showSharingMenu: true,
          showPrintBtn: true,
          baseFont: 'roboto',
          contentFont: 'roboto'
        },
        editors: {
          asciidoc: {
            isActive: true,
            config: {}
          },
          markdown: {
            isActive: true,
            config: {
              allowHTML: true,
              kroki: false,
              krokiServerUrl: 'https://kroki.io',
              latexEngine: 'katex',
              lineBreaks: true,
              linkify: true,
              multimdTable: true,
              plantuml: false,
              plantumlServerUrl: 'https://www.plantuml.com/plantuml/',
              quotes: 'english',
              tabWidth: 2,
              typographer: false,
              underline: true
            }
          },
          wysiwyg: {
            isActive: true,
            config: {}
          }
        },
        nav: {
          mode: 'mixed',
          defaultId: newDefaultNav.id,
        },
        uploads: {
          conflictBehavior: 'overwrite',
          normalizeFilename: true
        }
      })
    })

    WIKI.logger.debug(`Creating new DB storage for site ${newSite.id}`)

    await WIKI.db.storage.query().insert({
      module: 'db',
      siteId: newSite.id,
      isEnabled: true,
      contentTypes: {
        activeTypes: ['pages', 'images', 'documents', 'others', 'large'],
        largeThreshold: '5MB'
      },
      assetDelivery: {
        streaming: true,
        directAccess: false
      },
      state: {
        current: 'ok'
      }
    })

    return newSite
  }

  static async updateSite (id, patch) {
    return WIKI.db.sites.query().findById(id).patch(patch)
  }

  static async deleteSite (id) {
    await WIKI.db.storage.query().delete().where('siteId', id)
    return WIKI.db.sites.query().deleteById(id)
  }
}
