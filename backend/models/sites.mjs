import { defaultsDeep, keyBy } from 'lodash-es'
import { sites as sitesTable } from '../db/schema.mjs'
import { eq } from 'drizzle-orm'

/**
 * Sites model
 */
class Sites {
  async getSiteByHostname ({ hostname, forceReload = false }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    }
    const siteId = WIKI.sitesMappings[hostname] || WIKI.sitesMappings['*']
    if (siteId) {
      return WIKI.sites[siteId]
    }
    return null
  }

  async reloadCache () {
    WIKI.logger.info('Reloading site configurations...')
    const sites = await WIKI.db.select().from(sitesTable).orderBy(sitesTable.id)
    WIKI.sites = keyBy(sites, 'id')
    WIKI.sitesMappings = {}
    for (const site of sites) {
      WIKI.sitesMappings[site.hostname] = site.id
    }
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  async createSite (hostname, config) {
    const result = await WIKI.db.insert(sitesTable).values({
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
          browse: true,
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
        uploads: {
          conflictBehavior: 'overwrite',
          normalizeFilename: true
        }
      })
    }).returning({ id: sitesTable.id })

    const newSite = result[0]

    // WIKI.logger.debug(`Creating new root navigation for site ${newSite.id}`)

    // await WIKI.db.navigation.query().insert({
    //   id: newSite.id,
    //   siteId: newSite.id,
    //   items: []
    // })

    // WIKI.logger.debug(`Creating new DB storage for site ${newSite.id}`)

    // await WIKI.db.storage.query().insert({
    //   module: 'db',
    //   siteId: newSite.id,
    //   isEnabled: true,
    //   contentTypes: {
    //     activeTypes: ['pages', 'images', 'documents', 'others', 'large'],
    //     largeThreshold: '5MB'
    //   },
    //   assetDelivery: {
    //     streaming: true,
    //     directAccess: false
    //   },
    //   state: {
    //     current: 'ok'
    //   }
    // })

    return newSite
  }

  async updateSite (id, patch) {
    return WIKI.db.sites.query().findById(id).patch(patch)
  }

  async deleteSite (id) {
    // await WIKI.db.storage.query().delete().where('siteId', id)
    const deletedResult = await WIKI.db.delete(sitesTable).where(eq(sitesTable.id, id))
    return Boolean(deletedResult.rowCount > 0)
  }

  async countSites () {
    return WIKI.db.$count(sitesTable)
  }

  async init (ids) {
    WIKI.logger.info('Inserting default site...')

    await WIKI.db.insert(sitesTable).values({
      id: ids.siteId,
      hostname: '*',
      isEnabled: true,
      config: {
        title: 'Default Site',
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
          browse: true,
          ratings: false,
          ratingsMode: 'off',
          comments: false,
          contributions: false,
          profile: true,
          reasonForChange: 'required',
          search: true
        },
        logoText: true,
        sitemap: true,
        robots: {
          index: true,
          follow: true
        },
        authStrategies: [{ id: ids.authModuleId, order: 0, isVisible: true }],
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
        uploads: {
          conflictBehavior: 'overwrite',
          normalizeFilename: true
        }
      }
    })
  }
}

export const sites = new Sites()
