import { mergeWith, toMerged } from 'es-toolkit/object'
import { keyBy } from 'es-toolkit/array'
import {
  blocks as blocksTable,
  siteAssets as siteAssetsTable,
  sites as sitesTable,
  storage as storageTable
} from '../db/schema.ts'
import { and, eq } from 'drizzle-orm'
import { detectImageMime, detectSvg, normalizeImage, svgMimeType } from '../helpers/images.ts'
import type { ImageNormalization } from '../helpers/images.ts'
import type { SystemIds } from './types.ts'

/**
 * The images a site can have uploaded for it. Each name is also the flag in the site's
 * `config.assets` saying whether there is one — which is what the cached site config is asked before
 * the bytes are ever looked up — and the name the image is addressed by, both to upload it and to
 * serve it.
 */
export const siteAssetKinds = ['logo', 'favicon', 'loginBg'] as const

export type SiteAssetKind = (typeof siteAssetKinds)[number]

/**
 * The size and format each image is stored at, i.e. what a browser is eventually handed. Every one
 * is far smaller than what an administrator is likely to upload: these are a header logo, a tab icon
 * and a login backdrop, not artwork to be kept at its original resolution.
 */
const SITE_ASSET_NORMALIZATION: Record<SiteAssetKind, ImageNormalization> = {
  // -> A logo is whatever shape its owner made it, so it is fitted rather than cropped
  logo: { width: 512, height: 512, fit: 'inside', format: 'webp' },
  // -> PNG rather than WebP: a favicon is read by whatever the browser's tab strip, bookmark list and
  //    home screen are made of, some of it much older than the page itself
  favicon: { width: 180, height: 180, fit: 'cover', format: 'png' },
  loginBg: { width: 1920, height: 1080, fit: 'cover', format: 'webp' }
}

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
            banner: {
              isEnabled: false,
              title: '',
              content: ''
            },
            pageExtensions: ['md', 'html', 'txt'],
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
              favicon: false,
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
              pastedDestination: ''
            },
            storage: {
              largeThreshold: '25MB',
              sitePrefix: false,
              localePrefix: true,
              syncInterval: '5m',
              directAccessFallback: 'stream'
            }
          },
          config
        )
      })
      .returning({ id: sitesTable.id })

    const newSite = result[0]

    // -> The menu every page of the site inherits, one per locale. Empty to begin with, but it has to
    //    exist before a page can point at it, and a site starts with its primary locale — the rest get
    //    one the first time a page is written in them
    WIKI.logger.debug(`Creating new root navigation for site ${newSite.id}`)
    await WIKI.models.navigation.siteNavId(newSite.id, config.locales.primary)

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

  /**
   * The bytes of an image uploaded for a site, if there is one.
   *
   * What was stored depends on what the upload could be normalized to — Sharp is an optional
   * extension, and an SVG is never re-encoded at all — so the type is read back off the bytes rather
   * than assumed.
   */
  async getAsset(
    siteId: string,
    kind: SiteAssetKind
  ): Promise<{ data: Buffer; mime: string } | null> {
    const rows = await WIKI.db
      .select({ data: siteAssetsTable.data })
      .from(siteAssetsTable)
      .where(and(eq(siteAssetsTable.siteId, siteId), eq(siteAssetsTable.kind, kind)))
      .limit(1)
    const data = rows[0]?.data
    if (!data) {
      return null
    }
    const mime =
      detectImageMime(data) ?? (detectSvg(data) ? svgMimeType : 'application/octet-stream')
    return { data, mime }
  }

  /**
   * Replace one of a site's images.
   *
   * A raster upload is brought down to the size and format it will be served at, per
   * `SITE_ASSET_NORMALIZATION` — there is no reason to hand every visitor the multi-megabyte
   * original of an image displayed 34 pixels tall. That needs the Sharp extension, so without it the
   * uploaded bytes are stored as they came in, which is what the admin area's "requires Sharp"
   * indicator is warning about. An SVG is stored as it came in either way: it is markup, it already
   * scales to any size, and rasterizing it would throw away the only reason to use one.
   *
   * @param data The uploaded image, already known to be one of the supported formats
   */
  async setAsset(siteId: string, kind: SiteAssetKind, data: Buffer): Promise<void> {
    const normalized = detectSvg(data)
      ? data
      : ((await normalizeImage(data, SITE_ASSET_NORMALIZATION[kind])) ?? data)
    await WIKI.db
      .insert(siteAssetsTable)
      .values({ siteId, kind, data: normalized })
      .onConflictDoUpdate({
        target: [siteAssetsTable.siteId, siteAssetsTable.kind],
        set: { data: normalized }
      })
    // -> Serving reads this flag off the cached site config before it looks for any bytes
    await WIKI.models.sites.updateSite(siteId, { config: { assets: { [kind]: true } } })
  }

  /**
   * Remove one of a site's images, leaving the built-in default to be served again.
   */
  async clearAsset(siteId: string, kind: SiteAssetKind): Promise<void> {
    await WIKI.db
      .delete(siteAssetsTable)
      .where(and(eq(siteAssetsTable.siteId, siteId), eq(siteAssetsTable.kind, kind)))
    await WIKI.models.sites.updateSite(siteId, { config: { assets: { [kind]: false } } })
  }

  async deleteSite(id: string): Promise<boolean> {
    // -> Block, storage and uploaded image rows belong to the site rather than to its content, and
    //    their FK has no cascade, so they would otherwise block the delete. Content tables (pages,
    //    assets, ...) deliberately still do — see the conflict handling in the route.
    await WIKI.db.delete(blocksTable).where(eq(blocksTable.siteId, id))
    await WIKI.db.delete(storageTable).where(eq(storageTable.siteId, id))
    await WIKI.db.delete(siteAssetsTable).where(eq(siteAssetsTable.siteId, id))

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
        banner: {
          isEnabled: false,
          title: '',
          content: ''
        },
        pageExtensions: ['md', 'html', 'txt'],
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
          favicon: false,
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
          pastedDestination: ''
        },
        storage: {
          largeThreshold: '25MB',
          sitePrefix: false,
          localePrefix: true,
          syncInterval: '5m',
          directAccessFallback: 'stream'
        }
      }
    })
  }
}

export const sites = new Sites()
