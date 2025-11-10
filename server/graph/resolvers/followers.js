const { generateError, generateSuccess } = require('../../helpers/graph')
require('./site')

/* global WIKI */

module.exports = {
  Query: {
    async isFollowing(obj, args, context) {
      try {
        const { siteId, pageId } = args
        const { user } = context.req
        const { id: userId } = user

        const existingFollower = await WIKI.models.followers.query().findOne({ userId, siteId, pageId })

        const message = existingFollower ? 'User is following' : 'User is not following'

        return { operation: generateSuccess(message), isFollowing: !!existingFollower }
      } catch (err) {
        WIKI.logger.warn(err)
        return { operation: generateError(err, false), isFollowing: false }
      }
    }
  },
  Mutation: {
    /**
     * CREATE FOLLOWER
     */
    async createFollower(obj, args, context) {
      try {
        const { siteId, pageId } = args
        const { user } = context.req
        const { id: userId } = user

        if (!WIKI.auth.checkAccess(context.req.user, ['read:pages'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        // Check if user is already following
        const existingFollower = await WIKI.models.followers.query().where({ userId, siteId, pageId }).first()

        if (existingFollower) {
          throw new WIKI.Error.AlreadyFollower()
        }

        // Create new follower
        const newFollower = await WIKI.models.followers.query().insert({
          userId,
          siteId,
          pageId
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
        const { siteId, pageId } = args
        const { user } = context.req
        const { id: userId } = user

        // Check if user is following
        const existingFollower = await WIKI.models.followers.query().findOne({ userId, siteId, pageId })

        if (!existingFollower) {
          return generateError('You are not following this page')
        }

        // Delete follower
        await WIKI.models.followers.query().delete().where({ userId, siteId, pageId })

        return { responseResult: generateSuccess('Successfully unfollowed the page') }
      } catch (err) {
        WIKI.logger.warn(err)
        return generateError(err)
      }
    }
  }
}
