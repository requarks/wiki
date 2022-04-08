const graphHelper = require('../../helpers/graph')
const _ = require('lodash')
const CleanCSS = require('clean-css')
const path = require('path')

/* global WIKI */

module.exports = {
  Query: {
    async sites () {
      const sites = await WIKI.models.sites.query()
      return sites.map(s => ({
        ...s.config,
        id: s.id,
        hostname: s.hostname,
        isEnabled: s.isEnabled
      }))
    },
    async siteById (obj, args) {
      const site = await WIKI.models.sites.query().findById(args.id)
      return site ? {
        ...site.config,
        id: site.id,
        hostname: site.hostname,
        isEnabled: site.isEnabled
      } : null
    },
    async siteByHostname (obj, args) {
      let site = await WIKI.models.sites.query().where({
        hostname: args.hostname
      }).first()
      if (!site && !args.exact) {
        site = await WIKI.models.sites.query().where({
          hostname: '*'
        }).first()
      }
      return site ? {
        ...site.config,
        id: site.id,
        hostname: site.hostname,
        isEnabled: site.isEnabled
      } : null
    },
    // LEGACY
    async site() { return {} }
  },
  Mutation: {
    /**
     * CREATE SITE
     */
    async createSite (obj, args) {
      try {
        // -> Validate inputs
        if (!args.hostname || args.hostname.length < 1 || !/^(\\*)|([a-z0-9\-.:]+)$/.test(args.hostname)) {
          throw WIKI.ERROR(new Error('Invalid Site Hostname'), 'SiteCreateInvalidHostname')
        }
        if (!args.title || args.title.length < 1 || !/^[^<>"]+$/.test(args.title)) {
          throw WIKI.ERROR(new Error('Invalid Site Title'), 'SiteCreateInvalidTitle')
        }
        // -> Check for duplicate catch-all
        if (args.hostname === '*') {
          const site = await WIKI.models.sites.query().where({
            hostname: args.hostname
          }).first()
          if (site) {
            throw WIKI.ERROR(new Error('A site with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.'), 'SiteCreateDuplicateCatchAll')
          }
        }
        // -> Create site
        const newSite = await WIKI.models.sites.createSite(args.hostname, {
          title: args.title
        })
        return {
          status: graphHelper.generateSuccess('Site created successfully'),
          site: newSite
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPDATE SITE
     */
    async updateSite (obj, args) {
      try {
        // -> Load site
        const site = await WIKI.models.sites.query().findById(args.id)
        if (!site) {
          throw WIKI.ERROR(new Error('Invalid Site ID'), 'SiteInvalidId')
        }
        // -> Check for bad input
        if (_.has(args.patch, 'hostname') && _.trim(args.patch.hostname).length < 1) {
          throw WIKI.ERROR(new Error('Hostname is invalid.'), 'SiteInvalidHostname')
        }
        // -> Check for duplicate catch-all
        if (args.patch.hostname === '*' && site.hostname !== '*') {
          const dupSite = await WIKI.models.sites.query().where({ hostname: '*' }).first()
          if (dupSite) {
            throw WIKI.ERROR(new Error(`Site ${dupSite.config.title} with a catch-all hostname already exists! Cannot have 2 catch-all hostnames.`), 'SiteUpdateDuplicateCatchAll')
          }
        }
        // -> Format Code
        if (args.patch?.theme?.injectCSS) {
          args.patch.theme.injectCSS = new CleanCSS({ inline: false }).minify(args.patch.theme.injectCSS).styles
        }
        // -> Update site
        await WIKI.models.sites.updateSite(args.id, {
          hostname: args.patch.hostname ?? site.hostname,
          isEnabled: args.patch.isEnabled ?? site.isEnabled,
          config: _.defaultsDeep(_.omit(args.patch, ['hostname', 'isEnabled']), site.config)
        })

        return {
          status: graphHelper.generateSuccess('Site updated successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * DELETE SITE
     */
    async deleteSite (obj, args) {
      try {
        // -> Ensure site isn't last one
        const sitesCount = await WIKI.models.sites.query().count('id').first()
        if (sitesCount?.count && _.toNumber(sitesCount?.count) <= 1) {
          throw WIKI.ERROR(new Error('Cannot delete the last site. At least 1 site must exists at all times.'), 'SiteDeleteLastSite')
        }
        // -> Delete site
        await WIKI.models.sites.deleteSite(args.id)
        return {
          status: graphHelper.generateSuccess('Site deleted successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPLOAD LOGO
     */
    async uploadSiteLogo (obj, args) {
      try {
        const { filename, mimetype, createReadStream } = await args.image
        WIKI.logger.info(`Processing site logo ${filename} of type ${mimetype}...`)
        if (!WIKI.extensions.ext.sharp.isInstalled) {
          throw new Error('This feature requires the Sharp extension but it is not installed.')
        }
        console.info(mimetype)
        const destFormat = mimetype.startsWith('image/svg') ? 'svg' : 'png'
        const destPath = path.resolve(
          process.cwd(),
          WIKI.config.dataPath,
          `assets/logo.${destFormat}`
        )
        await WIKI.extensions.ext.sharp.resize({
          format: destFormat,
          inputStream: createReadStream(),
          outputPath: destPath,
          width: 100
        })
        WIKI.logger.info('New site logo processed successfully.')
        return {
          status: graphHelper.generateSuccess('Site logo uploaded successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * UPLOAD FAVICON
     */
    async uploadSiteFavicon (obj, args) {
      const { filename, mimetype, createReadStream } = await args.image
      console.info(filename, mimetype)
      return {
        status: graphHelper.generateSuccess('Site favicon uploaded successfully')
      }
    },
    // LEGACY
    async site() { return {} }
  },
  SiteQuery: {
    async config(obj, args, context, info) {
      return {
        host: WIKI.config.host,
        title: WIKI.config.title,
        company: WIKI.config.company,
        contentLicense: WIKI.config.contentLicense,
        logoUrl: WIKI.config.logoUrl,
        ...WIKI.config.seo,
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
        if (args.host) {
          let siteHost = _.trim(args.host)
          if (siteHost.endsWith('/')) {
            siteHost = siteHost.slice(0, -1)
          }
          WIKI.config.host = siteHost
        }

        if (args.title) {
          WIKI.config.title = _.trim(args.title)
        }

        if (args.company) {
          WIKI.config.company = _.trim(args.company)
        }

        if (args.contentLicense) {
          WIKI.config.contentLicense = args.contentLicense
        }

        if (args.logoUrl) {
          WIKI.config.logoUrl = _.trim(args.logoUrl)
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

        await WIKI.configSvc.saveToDb(['host', 'title', 'company', 'contentLicense', 'seo', 'logoUrl', 'auth', 'features', 'security', 'uploads'])

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
