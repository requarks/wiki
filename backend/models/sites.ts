import { mergeWith, toMerged } from 'es-toolkit/object'
import { keyBy } from 'es-toolkit/array'
import {
  blocks as blocksTable,
  sites as sitesTable,
  storage as storageTable
} from '../db/schema.ts'
import { eq } from 'drizzle-orm'
import type { SystemIds } from './types.ts'

/**
 * Sites model
 */
class Sites {
  async getSiteById({ id, forceReload = false }: { id: string; forceReload?: boolean }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    }
    return WIKI.sites[id]
  }

  async getSiteByHostname({
    hostname,
    forceReload = false,
    strict = false
  }: {
    hostname: string
    forceReload?: boolean
    strict?: boolean
  }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    }
    const siteId = strict
      ? WIKI.sitesMappings[hostname]
      : WIKI.sitesMappings[hostname] || WIKI.sitesMappings['*']
    if (siteId) {
      return WIKI.sites[siteId]
    }
    return null
  }

  async isHostnameUnique(hostname: string): Promise<boolean> {
    return (await WIKI.db.$count(sitesTable, eq(sitesTable.hostname, hostname))) === 0
  }

  async getAllSites() {
    return WIKI.db.select().from(sitesTable).orderBy(sitesTable.hostname)
  }

  async reloadCache(): Promise<void> {
    WIKI.logger.info('Reloading site configurations...')
    const sites = await WIKI.db.select().from(sitesTable).orderBy(sitesTable.id)
    WIKI.sites = keyBy(sites, (s) => s.id)
    WIKI.sitesMappings = {}
    for (const site of sites) {
      WIKI.sitesMappings[site.hostname] = site.id
    }
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  async createSite(hostname: string, config: Record<string, any> = {}) {
    const result = await WIKI.db
      .insert(sitesTable)
      .values({
        hostname,
        isEnabled: true,
        config: toMerged(
          {
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
              collaborativeEditing: true,
              ratings: false,
              ratingsMode: 'off',
              comments: false,
              profile: true,
              reasonForChange: 'optional',
              search: true
            },
            logoUrl: '',
            logoText: true,
            sitemap: true,
            robots: {
              index: true,
              follow: true
            },
            // -> Local authentication is the only strategy guaranteed to exist at this point
            authStrategies: [{ id: WIKI.data.systemIds.localAuthId, order: 0, isVisible: true }],
            auth: {
              autoLogin: false,
              bypassUnauthorized: false,
              hideLocal: false,
              loginRedirect: '/',
              welcomeRedirect: '/',
              logoutRedirect: '/'
            },
            locales: {
              primary: 'en',
              active: ['en'],
              forcePrefix: false,
              showMenu: true
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
                  lineBreaks: true,
                  linkify: true,
                  multimdTable: true,
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
          },
          config
        )
      })
      .returning({ id: sitesTable.id })

    const newSite = result[0]

    // -> The menu every page of the site inherits, keyed by the site id. Empty to begin with, but it
    //    has to exist before a page can point at it
    WIKI.logger.debug(`Creating new root navigation for site ${newSite.id}`)
    await WIKI.models.navigation.ensureSiteNav(newSite.id)

    // -> Site lookups by id / hostname are served from cache, which must know about the new site
    await WIKI.models.sites.reloadCache()

    // -> Otherwise the new site would have no blocks until the next restart
    await WIKI.models.blocks.syncSite(newSite.id)

    // -> Same for storage: the site needs its database target from the moment it can hold content
    await WIKI.models.storage.syncSite(newSite.id)

    return newSite
  }

  async updateSite(
    id: string,
    patch: { hostname?: string; isEnabled?: boolean; config?: Record<string, any> }
  ): Promise<boolean> {
    const values: Partial<typeof sitesTable.$inferInsert> = {}
    if (patch.hostname !== undefined) {
      values.hostname = patch.hostname
    }
    if (patch.isEnabled !== undefined) {
      values.isEnabled = patch.isEnabled
    }
    if (patch.config) {
      // -> Config is a JSONB blob, so it must be read and merged rather than partially assigned.
      // Arrays are replaced rather than merged index-wise, otherwise removing an entry (e.g. a page
      // extension) would leave the original value in place.
      const current = await WIKI.db
        .select({ config: sitesTable.config })
        .from(sitesTable)
        .where(eq(sitesTable.id, id))
      if (current.length < 1) {
        return false
      }
      values.config = mergeWith(
        current[0].config as Record<string, any>,
        patch.config,
        (_targetValue, sourceValue) => (Array.isArray(sourceValue) ? sourceValue : undefined)
      )
    }
    if (Object.keys(values).length < 1) {
      return false
    }

    const updatedResult = await WIKI.db.update(sitesTable).set(values).where(eq(sitesTable.id, id))
    if ((updatedResult.rowCount ?? 0) < 1) {
      return false
    }

    await WIKI.models.sites.reloadCache()
    return true
  }

  async deleteSite(id: string): Promise<boolean> {
    // -> Block and storage rows are registration metadata derived from disk, and their FK has no
    //    cascade, so they would otherwise block the delete. Content tables (pages, assets, ...)
    //    deliberately still do — see the conflict handling in the route.
    await WIKI.db.delete(blocksTable).where(eq(blocksTable.siteId, id))
    await WIKI.db.delete(storageTable).where(eq(storageTable.siteId, id))

    const deletedResult = await WIKI.db.delete(sitesTable).where(eq(sitesTable.id, id))
    if ((deletedResult.rowCount ?? 0) < 1) {
      return false
    }

    await WIKI.models.sites.reloadCache()
    return true
  }

  async countSites() {
    return WIKI.db.$count(sitesTable)
  }

  async init(ids: SystemIds): Promise<void> {
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
          collaborativeEditing: true,
          ratings: false,
          ratingsMode: 'off',
          comments: false,
          profile: true,
          reasonForChange: 'optional',
          search: true
        },
        logoText: true,
        sitemap: true,
        robots: {
          index: true,
          follow: true
        },
        authStrategies: [{ id: ids.authModuleId, order: 0, isVisible: true }],
        auth: {
          autoLogin: false,
          bypassUnauthorized: false,
          hideLocal: false,
          loginRedirect: '/',
          welcomeRedirect: '/',
          logoutRedirect: '/'
        },
        locales: {
          primary: 'en',
          active: ['en'],
          forcePrefix: false,
          showMenu: true
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
              lineBreaks: true,
              linkify: true,
              multimdTable: true,
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
