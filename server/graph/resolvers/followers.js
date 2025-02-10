const { generateError, generateSuccess } = require('../../helpers/graph')
require('./site')

/* global WIKI */

module.exports = {
  Query: {
    async isFollowing(obj, args, context) {
      try {
        const { pageId, siteId } = args
        const { user } = context.req
        const { id: userId } = user

        const existingFollower = await WIKI.models.followers.query().findOne({ userId, pageId, siteId })

        return { operation: generateSuccess('User is following'), isFollowing: !!existingFollower }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    }
  },
  Mutation: {
    /**
     * CREATE FOLLOWER
     */
    async createFollower(obj, args, context) {
      try {
        const { pageId, siteId } = args
        const { user } = context.req
        const { id: userId } = user

        if (!WIKI.auth.checkAccess(context.req.user, ['read:pages'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        // Check if user is already following
        const existingFollower = await WIKI.models.followers.query().where({ userId, pageId, siteId }).first()

        if (existingFollower) {
          throw new WIKI.Error.AlreadyFollower()
        }

        // Create new follower
        const newFollower = await WIKI.models.followers.query().insert({
          userId,
          pageId,
          siteId
        })

        return {
          operation: generateSuccess('Successfully followed the page'),
          follower: newFollower
        }
      } catch (err) {
        WIKI.logger.warn(err)
        return { operation: generateError(err, false), follower: null }
      }
    },
    /**
     * DELETE FOLLOWER
     */
    async deleteFollower(obj, args, context) {
      try {
        const { pageId, siteId } = args
        const { user } = context.req
        const { id: userId } = user

        // Check if user is following
        const existingFollower = await WIKI.models.followers.query().findOne({ userId, pageId, siteId })

        if (!existingFollower) {
          return generateError('You are not following this page')
        }

        // Delete follower
        await WIKI.models.followers.query().delete().where({ userId, pageId, siteId })

        return generateSuccess('Successfully unfollowed the page')
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    }
  }
}
