import { mergeWith, toMerged } from 'es-toolkit/object'
import { keyBy } from 'es-toolkit/array'
import {
  approvalRules as approvalRulesTable,
  blocks as blocksTable,
  navigation as navigationTable,
  pageHistory as pageHistoryTable,
  pageLinks as pageLinksTable,
  siteAssets as siteAssetsTable,
  sites as sitesTable,
  storage as storageTable,
  tags as tagsTable
} from '../db/schema.ts'
import { and, eq, inArray } from 'drizzle-orm'
import { invalidateAppShellCache } from '../helpers/appShell.ts'
import { CustomError } from '../helpers/common.ts'
import {
  detectImageMime,
  detectSvg,
  normalizeImage,
  sanitizeSvg,
  svgMimeType
} from '../helpers/images.ts'
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
 * Images made from an upload rather than uploaded themselves, for somewhere the upload as stored
 * cannot go. Each is stored, flagged in `config.assets` and served (`/_site/<siteId>/<name>`) the
 * way an upload is, but is never uploaded on its own: it is made when its source is, from the bytes
 * as they came in, and removed with it.
 *
 * Making one needs the Sharp extension. Without it there is none — no default stands in, since what
 * the default would show is the Wiki.js mark — and whatever would have used it does without.
 */
export const siteAssetRenditions = ['logoMail'] as const

export type SiteAssetRendition = (typeof siteAssetRenditions)[number]

const SITE_ASSET_RENDITIONS: Partial<
  Record<SiteAssetKind, { name: SiteAssetRendition; normalization: ImageNormalization }>
> = {
  /*
    The logo at the top of every mail (`models/mail.ts`). PNG, because the logo as stored is a WebP
    or an SVG: Gmail draws no SVG, and Outlook for Windows no WebP. Twice the 32 pixels it is shown
    at, for a high-density screen, and as wide as a wordmark is likely to need.
  */
  logo: {
    name: 'logoMail',
    normalization: { width: 256, height: 64, fit: 'inside', format: 'png' }
  }
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
    /*
      Sitemap lists and app shell fragments are held per site for minutes at a time, and `WIKI.cache`
      has no expiry sweeper — an entry is only dropped when its own key is next read. So a site that
      was deleted, or whose sitemap was just switched off, would hold its last list for the life of the
      process: nothing will ever ask for that key again. This is also the one place every create,
      update and delete of a site's settings passes through, and those settings are in both — the
      site's own title and description, whether it wants to be indexed, how it brackets URLs by
      locale. So it is the place to let them go.
    */
    WIKI.models.pages.invalidateSitemaps()
    invalidateAppShellCache()
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  /**
   * Reload the site caches here, and tell every other instance of an HA set to do the same.
   *
   * `WIKI.sitesMappings` is what turns a request's hostname into a site, and an instance that never
   * heard about a change goes on answering from what it loaded at boot. For a site added beside a
   * catch-all `*` that is the wrong site rather than no site: its hostname is not in the mapping
   * there, so the lookup falls through to the catch-all, and which site a reader gets depends on which
   * instance the load balancer picked. Every write to the sites table goes through here for that
   * reason; `reloadCache` itself does not emit, or two instances would answer each other for ever.
   */
  async reloadCacheEverywhere(): Promise<void> {
    await this.reloadCache()
    WIKI.events.outbound.emit('reloadSites')
  }

  async createSite(hostname: string, config: Record<string, any> = {}) {
    /*
      The whole configuration the site is created with, defaults and caller's together. Read back
      below rather than reading `config` again: the caller supplies the handful of fields the create
      form asks for, so anything else looked up there is undefined — which is what made creating a
      site through the API fail on `locales.primary` every time.
    */
    const siteConfig = toMerged(
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
        colorizeBrokenLinks: true,
        discoverable: false,
        defaults: {
          tocDepth: {
            min: 1,
            max: 2
          }
        },
        features: {
          // -> On, because what a wiki is for is pages that point at each other, and what points at
          //    the page in front of you is worth knowing by default. It gates the TAB and the route
          //    behind it; links are recorded either way, so turning it off and on again shows the
          //    same list rather than an empty one.
          backlinks: true,
          browse: true,
          collaborativeEditing: true,
          ratingsMode: 'off',
          // -> On, because what decides whether a site has comments is whether a provider has
          //    been picked. This is the switch that turns them all off without losing that
          //    choice, which is only useful to somebody who has already made it.
          comments: true,
          // -> On: a glossary with no terms costs a reader nothing, and the menu row that opens it is
          //    also gated on `read:glossary`, which nobody but a fresh install's users holds
          glossary: true,
          // -> On: a term is linked only where its own `autoLink` is on as well, and only for a reader
          //    who may read the glossary, so this changes nothing until somebody writes a term
          glossaryAutoLink: true,
          lastEditedBy: true,
          // -> On: a reader who follows a link to a folder rather than a page is better served by
          //    what is in it than by a notice that there is nothing there
          listFolderChildren: true,
          // -> On: who may open a note and who may start one are the `read:notes` and `write:notes`
          //    page rules, and only administrators can start one until somebody grants the second
          liveNotes: true,
          // -> On: a reader who watches a page or is mentioned expects to be told. What each person
          //    receives, and how, is theirs to choose under Profile → Notifications
          notifications: true,
          reasonForChange: 'optional',
          search: true
        },
        /*
              The wiki's own provider, so that a site with comments turned on has somewhere for them
              to go without an administrator having to choose first. Every alternative is somebody
              else's service with an account to open; this one needs nothing set up. Whether there
              are comments at all is `features.comments` above -- see `models/comments.ts`.
            */
        comments: {
          provider: 'default',
          providers: {}
        },
        // -> The MCP server's settings that belong to a site rather than to the instance. Empty
        //    `guidelinesPath` is no guidelines page — see `models/mcp.ts`
        mcp: {
          guidelinesPath: ''
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
        // -> All on for a site created now; one that predates the automations keeps them off, as its
        //    migrations set them, rather than starting to rewrite menus nobody asked it to touch
        navigation: {
          addPagesToParentMenu: true,
          removePagesFromParentMenu: true,
          migrateLinksOnMove: true,
          updateLabelsOnRename: true,
          createFolderMenus: true,
          deleteOrphanedMenus: true,
          includeStorageOperations: true,
          showParentLink: true
        },
        assets: {
          logo: false,
          logoMail: false,
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
          showPageProgress: true,
          pageTransitions: true,
          baseFont: 'roboto',
          contentFont: 'roboto'
        },
        editors: {
          asciidoc: {
            isActive: true,
            config: {
              math: 'katex',
              minimap: false
            }
          },
          /*
            No config of its own: how a blog behaves is set up per blog, on its own front page, which
            is where somebody who wants a blog is already standing. This flag is only whether the site
            offers `New Blog` at all.
          */
          blog: {
            isActive: true,
            config: {}
          },
          /*
            How a board behaves is set up on its own front page, for the blog's reason. What is set
            here is the site's: how long an account waits between two submitted ideas
            (`feedback.submissionIntervalFor`), a duration, `0` for no limit.
          */
          feedback: {
            isActive: true,
            config: {
              submissionInterval: '1m'
            }
          },
          /*
            No config of its own: a drawing is drawn rather than written, so there is no syntax, no
            pipeline and nothing about how it is authored to set per site. This flag is only whether
            the site offers `New Drawing` at all.
          */
          excalidraw: {
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
              minimap: false,
              typographer: false,
              underline: true,
              wikiLinks: true,
              inlineMath: 'katex'
            }
          },
          /*
            No config of its own: a redirection is a page with a target instead of a body, so there is
            nothing about how it is written to configure. This flag is only whether the site offers
            `New Redirection` at all — turning it off leaves the redirections a site already has
            working and editable, and stops new ones being made.
          */
          redirect: {
            isActive: true,
            config: {}
          },
          /*
            No config of its own, deliberately. The Visual editor writes markdown and its preview is
            rendered by the markdown pipeline, so it reads `markdown.config` — two settings blobs that
            had to agree would only be a way for them to disagree.
          */
          visual: {
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
          stripLeadingH1: false,
          mapReadmeToHome: false,
          syncInterval: '5m',
          directAccessFallback: 'stream'
        },
        // -> Keyed by the directory name under `modules/analytics`. Empty until an administrator
        //    turns a provider on; the model completes each one from the module's declared props.
        analytics: {
          providers: {}
        }
      },
      config
    )

    const result = await WIKI.db
      .insert(sitesTable)
      .values({
        hostname,
        isEnabled: true,
        config: siteConfig
      })
      .returning({ id: sitesTable.id })

    const newSite = result[0]

    // -> The menu every page of the site inherits, one per locale. Empty to begin with, but it has to
    //    exist before a page can point at it, and a site starts with its primary locale — the rest get
    //    one the first time a page is written in them
    WIKI.logger.debug(`Creating new root navigation for site ${newSite.id}`)
    await WIKI.models.navigation.siteNavId(newSite.id, siteConfig.locales.primary)

    // -> Site lookups by id / hostname are served from cache, which must know about the new site
    await WIKI.models.sites.reloadCacheEverywhere()

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

    await WIKI.models.sites.reloadCacheEverywhere()
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
    kind: SiteAssetKind | SiteAssetRendition
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
   * indicator is warning about. An SVG is never resized or re-encoded: it is markup, it already
   * scales to any size, and rasterizing it would throw away the only reason to use one.
   *
   * An SVG is sanitized (`sanitizeSvg`) when the security settings say uploaded SVGs are — the same
   * `uploadScanSVG` an asset upload follows — and stored as it came in when they do not, behind the
   * CSP `/_site` serves one with.
   *
   * Its renditions (`SITE_ASSET_RENDITIONS`) are made here too, from the upload as it came in (or as
   * sanitized) rather than from what was stored, so that a PNG is not made from a WebP that has
   * already lost some of the detail. One that cannot be made has its previous version removed
   * rather than kept: it would be the old logo.
   *
   * @param upload The uploaded image, already known to be one of the supported formats
   * @throws `siteImageInvalidSvg` for an SVG with no `svg` root, when SVGs are sanitized
   */
  async setAsset(siteId: string, kind: SiteAssetKind, upload: Buffer): Promise<void> {
    let data = upload
    if (WIKI.config.security?.uploadScanSVG && detectSvg(upload)) {
      const sanitized = sanitizeSvg(upload)
      if (!sanitized) {
        throw new CustomError('siteImageInvalidSvg', 'This file is not a valid SVG image.')
      }
      data = sanitized
    }
    const normalized = detectSvg(data)
      ? data
      : ((await normalizeImage(data, SITE_ASSET_NORMALIZATION[kind])) ?? data)
    const rendition = SITE_ASSET_RENDITIONS[kind]
    const rendered = rendition ? await normalizeImage(data, rendition.normalization) : null
    await WIKI.db.transaction(async (tx) => {
      const rows = [
        { siteId, kind, data: normalized },
        ...(rendition && rendered ? [{ siteId, kind: rendition.name, data: rendered }] : [])
      ]
      for (const row of rows) {
        await tx
          .insert(siteAssetsTable)
          .values(row)
          .onConflictDoUpdate({
            target: [siteAssetsTable.siteId, siteAssetsTable.kind],
            set: { data: row.data }
          })
      }
      if (rendition && !rendered) {
        await tx
          .delete(siteAssetsTable)
          .where(and(eq(siteAssetsTable.siteId, siteId), eq(siteAssetsTable.kind, rendition.name)))
      }
    })
    // -> Serving reads these flags off the cached site config before it looks for any bytes
    await WIKI.models.sites.updateSite(siteId, {
      config: {
        assets: { [kind]: true, ...(rendition && { [rendition.name]: Boolean(rendered) }) }
      }
    })
  }

  /**
   * Remove one of a site's images, and its renditions, leaving the built-in default to be served
   * again.
   */
  async clearAsset(siteId: string, kind: SiteAssetKind): Promise<void> {
    const rendition = SITE_ASSET_RENDITIONS[kind]?.name
    await WIKI.db
      .delete(siteAssetsTable)
      .where(
        and(
          eq(siteAssetsTable.siteId, siteId),
          inArray(siteAssetsTable.kind, rendition ? [kind, rendition] : [kind])
        )
      )
    await WIKI.models.sites.updateSite(siteId, {
      config: { assets: { [kind]: false, ...(rendition && { [rendition]: false }) } }
    })
  }

  async deleteSite(id: string): Promise<boolean> {
    // -> Block, storage, uploaded image, navigation, approval rule and tag rows belong to the site
    //    rather than to its content, and their FK has no cascade, so they would otherwise block the
    //    delete — `createSite` itself writes the site's menu, so not even an empty site could go.
    //    Content tables (pages, assets, the tree) deliberately still do — see the conflict handling
    //    in the route — and one transaction is what keeps a refused delete from having already wiped
    //    the site's configuration, or its deleted pages' history, on its way to the refusal.
    const deleted = await WIKI.db.transaction(async (tx) => {
      await tx.delete(blocksTable).where(eq(blocksTable.siteId, id))
      await tx.delete(storageTable).where(eq(storageTable.siteId, id))
      await tx.delete(siteAssetsTable).where(eq(siteAssetsTable.siteId, id))
      // -> A site's own menus, and whatever menus of tree entries are left once the tree is empty
      //    (`navigation.deleteOrphanedMenus` off). Any entry still standing refuses the delete below
      await tx.delete(navigationTable).where(eq(navigationTable.siteId, id))
      await tx.delete(approvalRulesTable).where(eq(approvalRulesTable.siteId, id))
      // -> The tag list a page's tags are picked from. Pages hold their tags as text, so nothing
      //    references these rows, and nothing deletes one when the last page using it goes
      await tx.delete(tagsTable).where(eq(tagsTable.siteId, id))
      // -> The versions of pages already deleted, which outlive them so that they can be restored —
      //    into this site, which is going. A live page's versions go only if the page does, and a
      //    live page refuses the delete below
      await tx.delete(pageHistoryTable).where(eq(pageHistoryTable.siteId, id))
      // -> Links written on another site's pages into this one. Once it is gone they lead out of the
      //    wiki, and a link that does is not recorded at all — so this is what a re-save of the page
      //    would leave too, rather than this site staying undeletable while anybody links to it
      await tx.delete(pageLinksTable).where(eq(pageLinksTable.targetSiteId, id))
      const result = await tx.delete(sitesTable).where(eq(sitesTable.id, id))
      return (result.rowCount ?? 0) > 0
    })
    if (!deleted) {
      return false
    }

    await WIKI.models.sites.reloadCacheEverywhere()
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
        colorizeBrokenLinks: true,
        discoverable: false,
        defaults: {
          tocDepth: {
            min: 1,
            max: 2
          }
        },
        features: {
          backlinks: true,
          browse: true,
          collaborativeEditing: true,
          ratingsMode: 'off',
          comments: true,
          glossary: true,
          glossaryAutoLink: true,
          lastEditedBy: true,
          listFolderChildren: true,
          liveNotes: true,
          notifications: true,
          reasonForChange: 'optional',
          search: true
        },
        comments: {
          provider: 'default',
          providers: {}
        },
        mcp: {
          guidelinesPath: ''
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
        // -> All on for a site created now; one that predates the automations keeps them off, as its
        //    migrations set them, rather than starting to rewrite menus nobody asked it to touch
        navigation: {
          addPagesToParentMenu: true,
          removePagesFromParentMenu: true,
          migrateLinksOnMove: true,
          updateLabelsOnRename: true,
          createFolderMenus: true,
          deleteOrphanedMenus: true,
          includeStorageOperations: true,
          showParentLink: true
        },
        assets: {
          logo: false,
          logoMail: false,
          favicon: false,
          loginBg: false
        },
        editors: {
          asciidoc: {
            isActive: true,
            config: {
              math: 'katex',
              minimap: false
            }
          },
          /*
            No config of its own: how a blog behaves is set up per blog, on its own front page, which
            is where somebody who wants a blog is already standing. This flag is only whether the site
            offers `New Blog` at all.
          */
          blog: {
            isActive: true,
            config: {}
          },
          /*
            How a board behaves is set up on its own front page, for the blog's reason. What is set
            here is the site's: how long an account waits between two submitted ideas
            (`feedback.submissionIntervalFor`), a duration, `0` for no limit.
          */
          feedback: {
            isActive: true,
            config: {
              submissionInterval: '1m'
            }
          },
          /*
            No config of its own: a drawing is drawn rather than written, so there is no syntax, no
            pipeline and nothing about how it is authored to set per site. This flag is only whether
            the site offers `New Drawing` at all.
          */
          excalidraw: {
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
              minimap: false,
              typographer: false,
              underline: true,
              wikiLinks: true,
              inlineMath: 'katex'
            }
          },
          /*
            No config of its own: a redirection is a page with a target instead of a body, so there is
            nothing about how it is written to configure. This flag is only whether the site offers
            `New Redirection` at all — turning it off leaves the redirections a site already has
            working and editable, and stops new ones being made.
          */
          redirect: {
            isActive: true,
            config: {}
          },
          /*
            No config of its own, deliberately. The Visual editor writes markdown and its preview is
            rendered by the markdown pipeline, so it reads `markdown.config` — two settings blobs that
            had to agree would only be a way for them to disagree.
          */
          visual: {
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
          showPageProgress: true,
          pageTransitions: true,
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
          stripLeadingH1: false,
          mapReadmeToHome: false,
          syncInterval: '5m',
          directAccessFallback: 'stream'
        },
        analytics: {
          providers: {}
        }
      }
    })
  }
}

export const sites = new Sites()
