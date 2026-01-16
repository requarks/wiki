const { generateError, generateSuccess } = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    notificationBanners: () => ({})
  },
  Mutation: {
    notificationBanners: () => ({})
  },
  NotificationBannerQuery: {
    /**
     * GET ACTIVE BANNER
     */
    async active(obj, args, context) {
      try {
        const banner = await WIKI.models.notificationBanners.getActiveBanner()
        return banner
      } catch (err) {
        WIKI.logger.warn(err)
        return null
      }
    },
    
    /**
     * GET ALL BANNERS (ADMIN)
     */
    async list(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        const banners = await WIKI.models.notificationBanners.getAllBanners()
        return banners
      } catch (err) {
        WIKI.logger.warn(err)
        throw err
      }
    },
    
    /**
     * GET SINGLE BANNER
     */
    async single(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        const banner = await WIKI.models.notificationBanners.query()
          .findById(args.id)
        
        return banner
      } catch (err) {
        WIKI.logger.warn(err)
        throw err
      }
    }
  },
  NotificationBannerMutation: {
    /**
     * CREATE BANNER
     */
    async create(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        const bannerData = {
          text: args.text,
          urgency: args.urgency.toLowerCase(),
          icon: args.icon || null,
          backgroundColor: args.backgroundColor || null,
          textColor: args.textColor || null,
          startDate: args.startDate || null,
          endDate: args.endDate || null,
          isActive: _.isBoolean(args.isActive) ? args.isActive : true
        }
        
        const banner = await WIKI.models.notificationBanners.createBanner(bannerData)
        
        return {
          responseResult: generateSuccess('Notification banner created successfully'),
          banner
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return {
          responseResult: generateError(err),
          banner: null
        }
      }
    },
    
    /**
     * UPDATE BANNER
     */
    async update(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        const updateData = {}
        if (args.text) updateData.text = args.text
        if (args.urgency) updateData.urgency = args.urgency.toLowerCase()
        if (args.icon !== undefined) updateData.icon = args.icon
        if (args.backgroundColor !== undefined) updateData.backgroundColor = args.backgroundColor
        if (args.textColor !== undefined) updateData.textColor = args.textColor
        if (args.startDate !== undefined) updateData.startDate = args.startDate
        if (args.endDate !== undefined) updateData.endDate = args.endDate
        if (_.isBoolean(args.isActive)) updateData.isActive = args.isActive
        
        const banner = await WIKI.models.notificationBanners.updateBanner(args.id, updateData)
        
        return {
          responseResult: generateSuccess('Notification banner updated successfully'),
          banner
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return {
          responseResult: generateError(err),
          banner: null
        }
      }
    },
    
    /**
     * DELETE BANNER
     */
    async delete(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        await WIKI.models.notificationBanners.deleteBanner(args.id)
        
        return {
          responseResult: generateSuccess('Notification banner deleted successfully')
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return {
          responseResult: generateError(err)
        }
      }
    },
    
    /**
     * TOGGLE BANNER STATUS
     */
    async toggle(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }
        
        const banner = await WIKI.models.notificationBanners.toggleBannerStatus(args.id)
        
        if (!banner) {
          throw new Error('Banner not found')
        }
        
        return {
          responseResult: generateSuccess('Notification banner status toggled successfully'),
          banner
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return {
          responseResult: generateError(err),
          banner: null
        }
      }
    }
  }
}
