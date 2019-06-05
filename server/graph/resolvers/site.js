const graphHelper = require('../../helpers/graph')

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
        ...WIKI.config.seo,
        ...WIKI.config.logo,
        ...WIKI.config.features
      }
    }
  },
  SiteMutation: {
    async updateConfig(obj, args, context) {
      try {
        WIKI.config.host = args.host
        WIKI.config.title = args.title
        WIKI.config.company = args.company
        WIKI.config.seo = {
          description: args.description,
          robots: args.robots,
          analyticsService: args.analyticsService,
          analyticsId: args.analyticsId
        }
        WIKI.config.logo = {
          hasLogo: args.hasLogo,
          logoIsSquare: args.logoIsSquare
        }
        WIKI.config.features = {
          featurePageRatings: args.featurePageRatings,
          featurePageComments: args.featurePageComments,
          featurePersonalWikis: args.featurePersonalWikis
        }
        await WIKI.configSvc.saveToDb(['host', 'title', 'company', 'seo', 'logo', 'features'])

        return {
          responseResult: graphHelper.generateSuccess('Site configuration updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
