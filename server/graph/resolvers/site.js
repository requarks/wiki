const graphHelper = require('../../helpers/graph')
const { generateError, generateSuccess } = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async site() { return {} },
    async sites(obj, args, context) {
      let sites = await WIKI.models.sites.query().orderBy('name')

      let ignoreRulePath = true
      let permissions = ['read:pages', 'manage:sites', 'manage:system']

      if (args.showAdminOnly) {
        ignoreRulePath = false
        permissions = ['manage:sites', 'manage:system']
      }

      sites = _.filter(sites, s => {
        return WIKI.auth.checkAccess(context.req.user,
          permissions,
          { siteId: s.id },
          ignoreRulePath
        )
      })

      return sites.map(s => ({
        ...s.config,
        id: s.id,
        name: s.name,
        path: s.path,
        isEnabled: s.isEnabled,
        createdAt: s.createdAt
      }))
    },
    async siteById(obj, args) {
      const site = await WIKI.models.sites.query().findById(args.id)
      return site ? {
        ...site.config,
        id: site.id,
        name: site.name,
        path: site.path,
        isEnabled: site.isEnabled
      } : null
    },
    async siteByPath(obj, args) {
      let site = await WIKI.models.sites.query().where({
        path: args.path
      }).first()
      if (!site && !args.exact) {
        site = await WIKI.models.sites.query().where({
          path: '*'
        }).first()
      }
      return site ? {
        ...site.config,
        id: site.id,
        name: site.name,
        path: site.path,
        isEnabled: site.isEnabled
      } : null
    },
    async siteCount(obj, args, context) { // Count sites site manager has access to
      let sites = await WIKI.models.sites.query().orderBy('name')

      sites = _.filter(sites, s => {
        return WIKI.auth.checkAccess(
          context.req.user,
          ['manage:sites', 'manage:system'],
          { siteId: s.id },
          false
        )
      })
      return { count: sites.length }
    }
  },
  Mutation: {
    async site() { return {} },
    /**
     * CREATE SITE
     */
    async createSite(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        WIKI.logger.info(`Creating site ${args.name} (${args.path})...`)

        // -> Validate inputs
        if (!args.path || args.path.length < 1 || !/^(\\*)|([a-z0-9\-.:]+)$/.test(args.path)) {
          throw new WIKI.Error.Custom('SiteCreateInvalidPath', 'Invalid Site Path')
        }
        if (!args.name || args.name.length < 1 || !/^[^<>"]+$/.test(args.name)) {
          throw new WIKI.Error.Custom('SiteCreateInvalidName', 'Invalid Site Name')
        }
        // -> Check for duplicate path
        const site = await WIKI.models.sites.query().where({
          path: args.path
        }).first()

        if (site) {
          throw new WIKI.Error.SiteAlreadyExists('A site with the same path already exists! Cannot have 2 sites with the same path.')
        }

        // -> Create site
        const newSite = await WIKI.models.sites.createSite(args.name, args.path)

        WIKI.logger.info(`Created site ${args.name} (${args.path}).`)

        return {
          operation: generateSuccess('Site created successfully'),
          site: newSite
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    },
    /**
     * UPDATE SITE
     */
    async updateSite(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        // -> Load site
        const site = await WIKI.models.sites.query().findById(args.id)
        if (!site) {
          throw new WIKI.Error.Custom('SiteInvalidId', 'Invalid Site ID')
        }
        // -> Update site
        await WIKI.models.sites.updateSite(args.id, {
          isEnabled: args.patch.isEnabled ?? site.isEnabled,
          name: args.patch.name ?? site.name
        })

        return {
          operation: generateSuccess('Site updated successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    },
    /**
     * DELETE SITE
     */
    async deleteSite(obj, args, context) {
      const getPagesBySiteId = async (siteId) => {
        const pageIds = await WIKI.models.pages.query()
          .select('id')
          .where('siteId', '=', siteId)
        return pageIds.map(p => p.id)
      }

      const getCommentsByPageId = async (pageId) => {
        const pageIds = await WIKI.models.comments.query()
          .select('id')
          .where('pageId', '=', pageId)
        return pageIds.map(p => p.id)
      }

      const deletePage = async (pageId) => {
        try {
          WIKI.logger.debug(`Deleting page with pageId = ${pageId}`)
          await WIKI.models.pages.deletePage({id: pageId, user: context.req.user}, true)
          return true
        } catch (err) {
          WIKI.logger.warn(err)
          return generateError(err)
        }
      }

      const deleteHistoryPage = async (pageId) => {
        try {
          WIKI.logger.debug(`Deleting history page with pageId = ${pageId}`)
          await WIKI.models.pageHistory.purgeByPageId(pageId)
          return true
        } catch (err) {
          WIKI.logger.warn(err)
          return generateError(err)
        }
      }

      const deleteComment = async (id) => {
        try {
          WIKI.logger.debug(`Deleting history page with pageId = ${id}`)
          await WIKI.models.comments.deleteComment({
            id,
            user: context.req.user,
            ip: context.req.ip
          })
          return true
        } catch (err) {
          WIKI.logger.warn(err)
          return generateError(err)
        }
      }

      const deleteAsset = async (id) => {
        const asset = await WIKI.models.assets.query().findById(id)
        if (asset) {
          const assetPath = await asset.getAssetPath()

          await WIKI.models.knex('assetData').where('id', id).del()
          await WIKI.models.assets.query().deleteById(id)
          await asset.deleteAssetCache()

          // Delete from Storage
          await WIKI.models.storage.assetEvent({
            event: 'deleted',
            asset: {
              ...asset,
              path: assetPath,
              authorId: context.req.user.id,
              authorName: context.req.user.name,
              authorEmail: context.req.user.email
            }
          })
        }
      }

      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system', 'manage:sites'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        // -> Ensure at least 1 extra site still exists
        const sitesCount = await WIKI.models.sites.query().count('id').first()
        if (sitesCount?.count && _.toNumber(sitesCount?.count) <= 1) {
          throw new WIKI.Error.Custom('SiteDeleteLastSite', 'Cannot delete the last site. At least 1 site must exists at all times.')
        }

        const remainingAssets = await WIKI.models.assets.query().where({'siteId': args.id})
        for (const asset of remainingAssets) {
          await deleteAsset(asset.id)
        }

        const remainingPages = await getPagesBySiteId(args.id)

        for (const pageId of remainingPages) {
          const remainingComments = await getCommentsByPageId(pageId)

          for (const id of remainingComments) {
            await deleteComment(id)
          }

          await deleteHistoryPage(pageId)
          await deletePage(pageId)
        }

        // -> Delete site
        await WIKI.models.sites.deleteSite(args.id)
        return {
          operation: generateSuccess('Site deleted successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    }
  },
  SiteQuery: {
    async config(obj, args, context, info) {
      return {
        host: WIKI.config.host,
        title: WIKI.config.title,
        company: WIKI.config.company,
        contentLicense: WIKI.config.contentLicense,
        footerOverride: WIKI.config.footerOverride,
        logoUrl: WIKI.config.logoUrl,
        pageExtensions: WIKI.config.pageExtensions.join(', '),
        ...WIKI.config.seo,
        ...WIKI.config.editShortcuts,
        ...WIKI.config.features,
        ...WIKI.config.security,
        authAutoLogin: WIKI.config.auth.autoLogin,
        authEnforce2FA: WIKI.config.auth.enforce2FA,
        authHideLocal: WIKI.config.auth.hideLocal,
        authLoginBgUrl: WIKI.config.auth.loginBgUrl,
        authJwtAudience: WIKI.config.auth.audience,
        authJwtExpiration: WIKI.config.auth.tokenExpiration,
        authJwtRenewablePeriod: WIKI.config.auth.tokenRenewal,
        uploadMaxFileSize: WIKI.config.uploads.maxFileSize,
        uploadMaxFiles: WIKI.config.uploads.maxFiles,
        uploadScanSVG: WIKI.config.uploads.scanSVG,
        uploadForceDownload: WIKI.config.uploads.forceDownload
      }
    }
  },
  SiteMutation: {
    async updateConfig(obj, args, context) {
      try {
        if (args.hasOwnProperty('host')) {
          let siteHost = _.trim(args.host)
          if (siteHost.endsWith('/')) {
            siteHost = siteHost.slice(0, -1)
          }
          WIKI.config.host = siteHost
        }

        if (args.hasOwnProperty('title')) {
          WIKI.config.title = _.trim(args.title)
        }

        if (args.hasOwnProperty('company')) {
          WIKI.config.company = _.trim(args.company)
        }

        if (args.hasOwnProperty('contentLicense')) {
          WIKI.config.contentLicense = args.contentLicense
        }

        if (args.hasOwnProperty('footerOverride')) {
          WIKI.config.footerOverride = args.footerOverride
        }

        if (args.hasOwnProperty('logoUrl')) {
          WIKI.config.logoUrl = _.trim(args.logoUrl)
        }

        if (args.hasOwnProperty('pageExtensions')) {
          WIKI.config.pageExtensions = _.trim(args.pageExtensions).split(',').map(p => p.trim().toLowerCase()).filter(p => p !== '')
        }

        WIKI.config.seo = {
          description: _.get(args, 'description', WIKI.config.seo.description),
          robots: _.get(args, 'robots', WIKI.config.seo.robots),
          analyticsService: _.get(args, 'analyticsService', WIKI.config.seo.analyticsService),
          analyticsId: _.get(args, 'analyticsId', WIKI.config.seo.analyticsId)
        }

        WIKI.config.auth = {
          autoLogin: _.get(args, 'authAutoLogin', WIKI.config.auth.autoLogin),
          enforce2FA: _.get(args, 'authEnforce2FA', WIKI.config.auth.enforce2FA),
          hideLocal: _.get(args, 'authHideLocal', WIKI.config.auth.hideLocal),
          loginBgUrl: _.get(args, 'authLoginBgUrl', WIKI.config.auth.loginBgUrl),
          audience: _.get(args, 'authJwtAudience', WIKI.config.auth.audience),
          tokenExpiration: _.get(args, 'authJwtExpiration', WIKI.config.auth.tokenExpiration),
          tokenRenewal: _.get(args, 'authJwtRenewablePeriod', WIKI.config.auth.tokenRenewal)
        }

        WIKI.config.editShortcuts = {
          editFab: _.get(args, 'editFab', WIKI.config.editShortcuts.editFab),
          editMenuBar: _.get(args, 'editMenuBar', WIKI.config.editShortcuts.editMenuBar),
          editMenuBtn: _.get(args, 'editMenuBtn', WIKI.config.editShortcuts.editMenuBtn),
          editMenuExternalBtn: _.get(args, 'editMenuExternalBtn', WIKI.config.editShortcuts.editMenuExternalBtn),
          editMenuExternalName: _.get(args, 'editMenuExternalName', WIKI.config.editShortcuts.editMenuExternalName),
          editMenuExternalIcon: _.get(args, 'editMenuExternalIcon', WIKI.config.editShortcuts.editMenuExternalIcon),
          editMenuExternalUrl: _.get(args, 'editMenuExternalUrl', WIKI.config.editShortcuts.editMenuExternalUrl)
        }

        WIKI.config.features = {
          featurePageRatings: _.get(args, 'featurePageRatings', WIKI.config.features.featurePageRatings),
          featurePageComments: _.get(args, 'featurePageComments', WIKI.config.features.featurePageComments),
          featurePersonalWikis: _.get(args, 'featurePersonalWikis', WIKI.config.features.featurePersonalWikis)
        }

        WIKI.config.security = {
          securityOpenRedirect: _.get(args, 'securityOpenRedirect', WIKI.config.security.securityOpenRedirect),
          securityIframe: _.get(args, 'securityIframe', WIKI.config.security.securityIframe),
          securityReferrerPolicy: _.get(args, 'securityReferrerPolicy', WIKI.config.security.securityReferrerPolicy),
          securityTrustProxy: _.get(args, 'securityTrustProxy', WIKI.config.security.securityTrustProxy),
          securitySRI: _.get(args, 'securitySRI', WIKI.config.security.securitySRI),
          securityHSTS: _.get(args, 'securityHSTS', WIKI.config.security.securityHSTS),
          securityHSTSDuration: _.get(args, 'securityHSTSDuration', WIKI.config.security.securityHSTSDuration),
          securityCSP: _.get(args, 'securityCSP', WIKI.config.security.securityCSP),
          securityCSPDirectives: _.get(args, 'securityCSPDirectives', WIKI.config.security.securityCSPDirectives)
        }

        WIKI.config.uploads = {
          maxFileSize: _.get(args, 'uploadMaxFileSize', WIKI.config.uploads.maxFileSize),
          maxFiles: _.get(args, 'uploadMaxFiles', WIKI.config.uploads.maxFiles),
          scanSVG: _.get(args, 'uploadScanSVG', WIKI.config.uploads.scanSVG),
          forceDownload: _.get(args, 'uploadForceDownload', WIKI.config.uploads.forceDownload)
        }

        await WIKI.configSvc.saveToDb(['host', 'title', 'company', 'contentLicense', 'footerOverride', 'seo', 'logoUrl', 'pageExtensions', 'auth', 'editShortcuts', 'features', 'security', 'uploads'])

        if (WIKI.config.security.securityTrustProxy) {
          WIKI.app.enable('trust proxy')
        } else {
          WIKI.app.disable('trust proxy')
        }

        return {
          responseResult: graphHelper.generateSuccess('Site configuration updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
