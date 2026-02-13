/* global WIKI */

/**
 * GraphQL Resolvers for User Settings
 */
module.exports = {
  Query: {
    /**
     * Get user settings for the current authenticated user
     */
    async userSettings (obj, args, context) {
      // Ensure user is authenticated
      if (!context.req.user || context.req.user.id < 1) {
        throw new WIKI.Error.AuthRequired()
      }

      const userId = context.req.user.id

      try {
        // Fetch user settings (should exist via $afterInsert hook or migration for older users)
        const settings = await WIKI.models.userSettings.query().findById(userId)

        if (!settings) {
          throw new Error(`User settings not initialized for user ${userId}. This indicates a setup issue.`)
        }

        WIKI.logger.info(`✓ Fetched user settings for user ${userId}: isReleaseInfoSeen=${settings.is_release_info_seen}`)

        return {
          userId: settings.user_id,
          isReleaseInfoSeen: settings.is_release_info_seen
        }
      } catch (err) {
        WIKI.logger.error(`✗ Failed to fetch user settings for user ${userId}: ${err.message}`)
        throw err
      }
    }
  },

  Mutation: {
    /**
     * Mark release info as seen for the current user
     */
    async markReleaseInfoAsSeen (obj, args, context) {
      // Ensure user is authenticated
      if (!context.req.user || context.req.user.id < 1) {
        throw new WIKI.Error.AuthRequired()
      }

      const userId = context.req.user.id

      try {
        // Update the release info seen flag
        const updated = await WIKI.models.userSettings.query()
          .where('user_id', userId)
          .patch({ is_release_info_seen: true })

        if (updated === 0) {
          throw new Error(`User settings row not found for user ${userId}. Cannot mark release as seen.`)
        }

        WIKI.logger.debug(`✓ Successfully marked release as seen for user ${userId}`)

        return {
          responseResult: {
            succeeded: true,
            errorCode: 0,
            slug: 'releaseInfoMarkedSeen',
            message: 'Release info marked as seen successfully'
          }
        }
      } catch (err) {
        WIKI.logger.error(`✗ Failed to mark release info as seen for user ${userId}: ${err.message}`)
        return {
          responseResult: {
            succeeded: false,
            errorCode: 1,
            slug: 'releaseInfoMarkFailed',
            message: err.message
          }
        }
      }
    }
  }
}
