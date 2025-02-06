const _ = require('lodash')

/* global WIKI */

module.exports = async (pageId, pageTitle, pagePath, userEmail, followerIds, event) => {
  WIKI.logger.info(`Notifying users for page ID ${pageId}...`)

  try {
    const followers = await WIKI.models.users.query().whereIn('id', followerIds).withGraphFetched('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions', 'groups.rules')
    })
    const activeFollowers = followers.filter(follower => follower.isActive)

    const recipients = []

    for (const follower of activeFollowers) {
      const hasReadAccess = WIKI.auth.checkAccess(follower, ['read:pages'], {
        path: pagePath
      })

      if (hasReadAccess) {
        recipients.push(follower.email)
      }
    }

    const batches = _.chunk(recipients, 10)
    for (const batch of batches) {
      await WIKI.mail.send({
        template: 'page-notify',
        bcc: batch,
        subject: `Page ${event}: ${pageTitle}`,
        text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        data: {
          pageUrl: `${WIKI.config.siteUrl}${pagePath}`,
          pageTitle,
          userEmail,
          event
        }
      })
    }

    WIKI.logger.info(`Successfully notified users for page ID ${pageId}`)
  } catch (err) {
    WIKI.logger.warn(err)
  }
}
