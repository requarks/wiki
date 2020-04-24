const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async site() { return {} }
  },
  Mutation: {
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
        ...WIKI.config.security
      }
    }
  },
  SiteMutation: {
    async updateConfig(obj, args, context) {
      let siteHost = _.trim(args.host)
      if (siteHost.endsWith('/')) {
        siteHost = siteHost.splice(0, -1)
      }
      try {
        WIKI.config.host = siteHost
        WIKI.config.title = _.trim(args.title)
        WIKI.config.company = _.trim(args.company)
        WIKI.config.contentLicense = args.contentLicense
        WIKI.config.seo = {
          description: args.description,
          robots: args.robots,
          analyticsService: args.analyticsService,
          analyticsId: args.analyticsId
        }
        WIKI.config.logoUrl = _.trim(args.logoUrl)
        WIKI.config.features = {
          featurePageRatings: args.featurePageRatings,
          featurePageComments: args.featurePageComments,
          featurePersonalWikis: args.featurePersonalWikis
        }
        WIKI.config.security = {
          securityIframe: args.securityIframe,
          securityReferrerPolicy: args.securityReferrerPolicy,
          securityTrustProxy: args.securityTrustProxy,
          securitySRI: args.securitySRI,
          securityHSTS: args.securityHSTS,
          securityHSTSDuration: args.securityHSTSDuration,
          securityCSP: args.securityCSP,
          securityCSPDirectives: args.securityCSPDirectives
        }
        await WIKI.configSvc.saveToDb(['host', 'title', 'company', 'contentLicense', 'seo', 'logoUrl', 'features', 'security'])

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
