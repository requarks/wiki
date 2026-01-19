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
     * GET ACTIVE BANNERS (multiple)
     */
    async active(obj, args, context) {
      try {
        const banners = await WIKI.models.notificationBanners.getActiveBanners()
        return banners
      } catch (err) {
        WIKI.logger.warn(err)
        return []
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
          startDate: args.startDate,
          endDate: args.endDate,
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
          responseResult: {
            succeeded: false,
            errorCode: 1,
            slug: 'notification-banner-create-error',
            message: err.message || 'Failed to create notification banner'
          },
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
        if (args.startDate) updateData.startDate = args.startDate
        if (args.endDate) updateData.endDate = args.endDate
        if (_.isBoolean(args.isActive)) updateData.isActive = args.isActive
        
        const banner = await WIKI.models.notificationBanners.updateBanner(args.id, updateData)
        
        return {
          responseResult: generateSuccess('Notification banner updated successfully'),
          banner
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return {
          responseResult: {
            succeeded: false,
            errorCode: 1,
            slug: 'notification-banner-update-error',
            message: err.message || 'Failed to update notification banner'
          },
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
          responseResult: {
            succeeded: false,
            errorCode: 1,
            slug: 'notification-banner-delete-error',
            message: err.message || 'Failed to delete notification banner'
          }
        }
      }
    }
  }
}
