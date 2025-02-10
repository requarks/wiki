const _ = require('lodash')

/* global WIKI */

module.exports = async ({ siteId, pageId, pageTitle, pagePath, sitePath, userEmail, followerIds, event }) => {
  WIKI.logger.info(`Notifying users for page ID ${pageId}...`)

  try {
    const followers = await WIKI.models.users.query().whereIn('id', followerIds).withGraphFetched('groups').modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions', 'groups.rules')
    })
    const activeFollowers = followers.filter(follower => follower.isActive)

    const recipients = []

    for (const follower of activeFollowers) {
      const hasReadAccess = WIKI.auth.checkAccess(follower, ['read:pages'], {
        path: pagePath,
        siteId: siteId
      })

      if (hasReadAccess) {
        recipients.push(follower.email)
      }
    }

    const eventText = event.replace('_PAGE', '').toLowerCase() + 'd'

    const batches = _.chunk(recipients, 10)
    for (const batch of batches) {
      await WIKI.mail.send({
        template: 'page-notify',
        to: '',
        bcc: batch,
        subject: `[Page Notification] Page ${eventText.charAt(0).toUpperCase() + eventText.slice(1)}: ${pageTitle}`,
        text: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
        data: {
          preheadertext: `The page "${pageTitle}" has been ${event.toLowerCase()} by ${userEmail}.`,
          pageUrl: `${WIKI.config.host}/${sitePath}`,
          pageTitle: pageTitle,
          userEmail: userEmail,
          eventText: eventText
        }
      })
    }

    WIKI.logger.info(`Successfully notified users for page ID ${pageId}`)
  } catch (err) {
    WIKI.logger.warn(err)
  }
}
